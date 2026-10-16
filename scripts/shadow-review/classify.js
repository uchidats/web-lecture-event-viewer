'use strict';
// Shadow classification of review candidates. Judgement only: this module never changes events.js,
// Firestore status, review state, approval history or auto-apply counts.
const n = require('./normalize');

const CLASS = Object.freeze({ EQUIVALENT: 'equivalent', LOW_RISK: 'low_risk_auto_candidate', SOURCE: 'source_problem', HUMAN: 'human_review' });
const result = (classification, ruleId, reason, extra = {}) => ({ classification, ruleId, reason, ...extra });
const MIN_CONFIDENCE = 0.95;
const COMPLETION_FIELDS = new Set(['abstractSubmission.startDate', 'abstractSubmission.deadline', 'abstractSubmission.status', 'abstractSubmission.url', 'abstractSubmission.timeZone']);
const DATE_FIELDS = new Set(['date', 'endDate', 'year']);
const LOCATION_FIELDS = new Set(['venue', 'venues', 'city', 'country', 'cityCountry']);
const URL_FIELDS = new Set(['eventOfficialUrl', 'societyUrl', 'officialUrl', 'abstractSubmission.url']);
const CENTRAL_EUROPE = new Set(['CET', 'CEST']);

const httpsUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const parseJson = text => { try { return JSON.parse(text); } catch { return null; } };
const day = value => (typeof value === 'string' ? value.slice(0, 10) : '');

// ---- deadline timezone: same date and local time, only CET/CEST labels differ ----
function extractDeadlineStamps(text) {
  const stamps = [];
  const pattern = /([A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})[^\n]*?(\d{1,2}:\d{2})\s*[(（]?\s*(CEST|CET)\b/gi;
  for (const line of String(text || '').split('\n')) {
    if (!/deadline|締切|closes?|closing/i.test(line)) continue;
    for (const m of line.matchAll(pattern)) {
      const parsed = n.parseDateTime(`${m[1]} ${m[2]}`);
      if (parsed) stamps.push({ date: parsed.date, time: parsed.time, zone: m[3].toUpperCase() });
    }
  }
  return stamps;
}
function ruleCentralEuropeTimezone(evidence) {
  const stamps = extractDeadlineStamps(evidence);
  const zones = new Set(stamps.map(s => s.zone));
  if (stamps.length < 2 || ![...zones].every(z => CENTRAL_EUROPE.has(z)) || zones.size < 2) return null;
  if (new Set(stamps.map(s => `${s.date} ${s.time}`)).size !== 1) {
    return result(CLASS.HUMAN, 'abstract-deadline-date-or-time-conflict', '締切の日付またはローカル時刻が公式表記内で食い違っています。');
  }
  const { date, time } = stamps[0];
  return result(CLASS.EQUIVALENT, 'same-deadline-date-central-europe-timezone',
    `締切日とローカル時刻（${date} ${time}）は同一。CET/CEST表記のみ異なるため、締切日として同値候補（絶対時刻の同一性は主張しない）。`,
    { shadowValue: { deadline: `${date}T${time}`, timeZoneLabel: 'Central Europe (CET/CEST)' } });
}

// ---- registration periods ----
const periodKey = p => `${n.normText(String(p.label || '').replace(/registration|rate|fee/gi, ''))}|${p.category || ''}`;
function ruleRegistrationYearTypo(periods, ctx) {
  const groups = new Map();
  for (const p of periods) { const k = periodKey(p); groups.set(k, [...(groups.get(k) || []), p]); }
  const resolved = [], eventStart = ctx.event?.date || null;
  let typoFound = false;
  for (const group of groups.values()) {
    const deadlines = [...new Set(group.map(p => day(p.deadline)).filter(Boolean))];
    if (deadlines.length <= 1) { resolved.push(group[0]); continue; }
    const sameMonthDay = deadlines.every(d => d.slice(5) === deadlines[0].slice(5));
    const years = deadlines.map(d => Number(d.slice(0, 4))).sort();
    if (!sameMonthDay || deadlines.length !== 2 || years[1] - years[0] !== 1) return null;
    const plausible = deadlines.filter(d => d >= ctx.today && (!eventStart || d <= eventStart));
    if (plausible.length !== 1) return null;
    resolved.push(group.find(p => day(p.deadline) === plausible[0]));
    typoFound = true;
  }
  if (!typoFound) return null;
  return result(CLASS.LOW_RISK, 'registration-year-typo-single-plausible',
    '同じ区分・同じ月日の締切が年だけ1年異なる。今日以降かつ開催日前に収まる候補が1つだけのため、それを採用候補にできる（公式ページ内の年表記不一致の注記を残す）。シャドー期間中は自動採用しない。',
    { shadowValue: { type: 'international', periods: resolved } });
}
function ruleAdjacentPeriods(periods) {
  const sorted = [...periods].sort((a, b) => String(a.start || a.deadline).localeCompare(String(b.start || b.deadline)));
  let boundaries = 0;
  for (const p of sorted) if (p.start && p.deadline && day(p.start) > day(p.deadline)) return null;
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (!a.deadline || !b.start) continue;
    if (day(b.start) < day(a.deadline)) return null; // real overlap
    if (day(b.start) === day(a.deadline)) boundaries++;
  }
  if (!boundaries) return null;
  return result(CLASS.EQUIVALENT, 'registration-adjacent-periods-same-day-boundary',
    '前の期間の終了日と次の期間の開始日が同日の連続期間で、重なり・逆順はない。利用者に見える締切日は変わらず、正常な構造と判断できる。', { shadowValue: { periods: sorted } });
}
function validPeriods(value) {
  return value && Array.isArray(value.periods) && value.periods.length > 0 && value.periods.every(p => p && p.label && (p.start || p.deadline) && (!p.start || !p.deadline || day(p.start) <= day(p.deadline)));
}

// ---- value comparison ----
function sameMeaning(field, current, detected) {
  if (n.isEmptyValue(current) && n.isEmptyValue(detected)) return result(CLASS.EQUIVALENT, 'empty-value-equivalent', 'null・空文字・空配列など、どちらも意味のある値を持たない。');
  if (n.isEmptyValue(current) || n.isEmptyValue(detected)) return null;
  const dates = n.compareDates(current, detected);
  if (dates === 'identical') return result(CLASS.EQUIVALENT, 'value-identical', '現在値と検出値は同一。');
  if (dates === 'format-only') return result(CLASS.EQUIVALENT, 'same-date-format-difference', '同じ日付・同じ時刻で、表記形式（区切り・語順・全角半角・T/空白）のみ異なる。');
  if (dates === 'time-dropped') return result(CLASS.EQUIVALENT, 'same-date-time-omitted', '同じ日付で、検出側に時刻表記がないだけ（精度の低い表記）。');
  if (typeof current === 'string' && typeof detected === 'string' && dates === null) {
    if (current === detected) return result(CLASS.EQUIVALENT, 'value-identical', '現在値と検出値は同一。');
    if (field === 'title' && n.sameTitleAlias(current, detected)) return result(CLASS.EQUIVALENT, 'title-known-alias-suffix', '開催回の略称（臨眼2026など）の有無だけの差。既存の題名正規化ルールと同じ扱い。');
    if (n.normText(current) === n.normText(detected)) return result(CLASS.EQUIVALENT, 'text-format-only', '空白・全角半角・記号・大文字小文字のみの差。文字内容は同一。');
  }
  if (typeof current === 'object' || typeof detected === 'object') {
    if (JSON.stringify(current) === JSON.stringify(detected)) return result(CLASS.EQUIVALENT, 'value-identical', '現在値と検出値は同一。');
    if (n.canonicalKey(current) === n.canonicalKey(detected)) return result(CLASS.EQUIVALENT, 'structure-order-only', '配列の順序・キー順・日付表記・空値の違いのみで、構造の意味は同一。');
  }
  return null;
}

// Supplemental text around a title (parenthetical aliases, English subtitles, scraped dates/venues) is not part of its identity.
// Edition numbers and the society name stay in the core, so a changed edition is never absorbed.
function titleCore(title) {
  let text = String(title).normalize('NFKC').split(/\r?\n/)[0];
  text = text.replace(/\s+[-–—]\s+.*$/u, '').replace(/\s*\([^)]*\)?\s*$/u, '').replace(/\s*\([^)]*\)\s*/gu, ' ');
  return n.normText(text);
}
// Event-level cancellation / postponement. Deadline extensions (締切延長) and registration wording are not event disruptions.
const DISRUPTION = /(開催|大会|学会|総会|学術集会|会期|本会|本大会|イベント)[^。\n]{0,15}(中止|延期|見合わせ)|(中止|延期)(の|と)?(お知らせ|となり|いたし|します|決定)|cancell?ed|postponed|rescheduled|called off/i;
const DEADLINE_CONTEXT = /(締切|〆切|募集|演題|登録|受付|期間|deadline|submission)[^。\n]{0,8}(延長|延期|extended)/gi;
function mentionsDisruption(value) {
  if (value == null) return false;
  const text = (typeof value === "string" ? value : JSON.stringify(value)).replace(DEADLINE_CONTEXT, " ");
  return DISRUPTION.test(text) || /^(cancelled|canceled|postponed)$/i.test(String(value).trim());
}
// ---- stale candidates: the value the candidate proposes is already in the current events.js ----
// Compared per field after normalization (never as a whole-record string match).
const editionsOf = text => [...new Set([...String(text || '').matchAll(/第\s*(\d+)\s*(?:回|(?=日本))|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2])))].sort((a, b) => a - b);
function currentValue(event, field) {
  if (field === 'edition') return editionsOf(event.title);
  if (field === 'year') return Number(String(event.date || '').slice(0, 4)) || undefined;
  return String(field).split('.').reduce((value, key) => (value == null ? undefined : value[key]), event);
}
// true: the current event already holds the detected value; false: it does not; null: cannot be compared safely.
function isReflected(field, detected, event) {
  if (!event || !field || n.isEmptyValue(detected)) return null;
  const current = currentValue(event, field);
  if (field === 'edition') return Array.isArray(detected) && detected.length > 0 && JSON.stringify(current) === JSON.stringify([...detected].sort((a, b) => a - b));
  if (field === 'year') return Number(detected) === current;
  if (n.isEmptyValue(current)) return false;
  const same = sameMeaning(field, current, detected);
  if (same && same.ruleId !== 'empty-value-equivalent') return true;
  if (field === 'title' && typeof current === 'string' && typeof detected === 'string') return !!titleCore(current) && titleCore(current) === titleCore(detected);
  return false;
}
// The id carries a year (e.g. conf-jp-xxx-2027) that must agree with the event's own start year.
function idYearConsistent(event) {
  const m = /-(20\d{2})$/.exec(event?.id || '');
  return !m || m[1] === String(event.date || '').slice(0, 4);
}
const NEVER_STALE_HUMAN = new Set(['event-cancelled-or-postponed']);
function staleAllowed(baseline, ctx) {
  if (!ctx.event || !idYearConsistent(ctx.event)) return false;
  if (baseline.classification === CLASS.SOURCE || baseline.classification === CLASS.EQUIVALENT) return false;
  return !NEVER_STALE_HUMAN.has(baseline.ruleId);
}
const staleResult = (reason, extra = {}) => result(CLASS.EQUIVALENT, 'stale-already-applied', `この候補はすでに現在データ（events.js）へ反映済み。${reason}`, extra);
function auditReflection(item, ctx) {
  const diffs = (item.audit.comparisons || []).filter(c => c.result === 'mismatch' || c.result === 'notation-difference');
  const checks = diffs.map(c => ({ field: c.field, reflected: isReflected(c.field, c.official, ctx.event) }));
  return { checks, all: checks.length > 0 && checks.every(c => c.reflected === true) };
}

// ---- single field change ----
// change: { field, current, detected, reason, evidence, confidence, url, massChange }
function classifyChange(change, ctx) {
  const baseline = classifyChangeBase(change, ctx);
  if (staleAllowed(baseline, ctx) && isReflected(change.field, change.detected, ctx.event) === true) {
    return { ...staleResult(`現在値と検出値（${change.field}）は正規化後に一致。`), baselineRuleId: baseline.ruleId };
  }
  return baseline;
}
function classifyChangeBase(change, ctx) {
  const { field, current, detected, reason, evidence, confidence, url } = change;
  const confident = Number.isFinite(confidence) && confidence >= MIN_CONFIDENCE;
  const periods = parseJson(evidence);
  if ((mentionsDisruption(detected) || mentionsDisruption(evidence)) && !mentionsDisruption(current)) {
    return result(CLASS.HUMAN, "event-cancelled-or-postponed", "開催の中止・延期を示す記述があります。必ず人間が公式情報を確認してください。");
  }

  switch (reason) {
    case 'abstract-conflicting-timezones':
      return ruleCentralEuropeTimezone(evidence) || result(CLASS.HUMAN, 'abstract-timezone-conflict', '締切のタイムゾーン表記が食い違い、同値と判断できません。');
    case 'registration-conflicting-deadlines':
      return (Array.isArray(periods) && ruleRegistrationYearTypo(periods, ctx)) || result(CLASS.HUMAN, 'registration-deadline-conflict', '参加登録の締切が公式内で食い違い、年違いの単純な誤記とは判断できません。');
    case 'registration-ambiguous-boundary':
      return (Array.isArray(periods) && ruleAdjacentPeriods(periods)) || result(CLASS.HUMAN, 'registration-boundary-unresolved', '参加登録期間の境界が重なり、適用区分を確定できません。');
    case 'registration-invalid-order': return result(CLASS.HUMAN, 'registration-order-invalid', '参加登録期間の日付順序が不正です。');
    case 'bot-protected-official-candidate': return result(CLASS.SOURCE, 'bot-protected-body-unverified', 'Bot保護等のため本文を確認できていない候補。取得の問題として扱う。');
    case 'official-domain-changed': return result(CLASS.HUMAN, 'url-domain-changed', '公式URLのドメインが変わっています。');
    case 'multiple-candidates': case 'related-field-needs-review': case 'low-confidence': {
      const same = sameMeaning(field, current, detected);
      if (same) return same;
      const dates = n.compareDates(current, detected);
      if (dates === 'time-added' && reason === 'related-field-needs-review') return result(CLASS.LOW_RISK, 'date-time-precision-added', '同じ日付に時刻が追加されただけ。精度の補完で日付は変わらない。');
      return result(CLASS.HUMAN, reason === 'low-confidence' ? 'low-confidence-value' : 'multiple-candidates-differ', '公式に複数の候補があるか、信頼度が基準未満で、人間の判断が必要です。');
    }
    default:
  }
  if (/-conference-identity-unconfirmed$/.test(reason || '')) return result(CLASS.SOURCE, 'conference-identity-unconfirmed', '取得したページが対象の回の公式ページか確認できていません。');

  const same = sameMeaning(field, current, detected);
  if (same) return same;
  if (field === 'title' && typeof current === 'string' && typeof detected === 'string' && titleCore(current) && titleCore(current) === titleCore(detected)) {
    return result(CLASS.EQUIVALENT, 'title-supplemental-text-only', '括弧書きの別名・英語併記・会期や会場の付記が増減しているだけで、学会名と開催回の部分は同一。');
  }
  const dates = n.compareDates(current, detected);
  if (dates === 'time-added') return result(CLASS.LOW_RISK, 'date-time-precision-added', '同じ日付に時刻が追加されただけ。精度の補完で日付は変わらない。');
  if (dates === 'date-differs' || dates === 'time-differs') return result(CLASS.HUMAN, DATE_FIELDS.has(field) ? 'event-date-changed' : 'deadline-date-changed', '日付（または締切時刻）が実際に変わっています。');

  const unknownStatus = field === 'abstractSubmission.status' && current === 'unknown';
  if ((n.isEmptyValue(current) || unknownStatus) && !n.isEmptyValue(detected)) {
    const urlOk = !URL_FIELDS.has(field) || httpsUrl(detected);
    if (COMPLETION_FIELDS.has(field) && confident && urlOk && httpsUrl(url || detected)) {
      return result(CLASS.LOW_RISK, 'safe-completion-null-to-value', `未入力の「${field}」を、信頼度${Math.round(confidence * 100)}%の公式情報で補完するだけ。既存値の上書きはない。${change.massChange ? '（大量変更の安全装置で止まっているが、単純な欠損補完）' : ''}`);
    }
    if (field === 'registration' && confident && validPeriods(detected)) {
      return result(CLASS.LOW_RISK, 'safe-completion-registration-periods', '未入力の参加登録期間を、公式情報から構造が正しい形で補完するだけ。既存値の上書きはない。');
    }
    if (field === 'subtitle' && confident && httpsUrl(url)) return result(CLASS.LOW_RISK, 'subtitle-official-completion', '未入力の副題を公式ページで確認できる値で補完するだけ。');
    if (URL_FIELDS.has(field)) return result(CLASS.HUMAN, 'url-added-needs-review', 'URLの追加は、情報源の確認を人間に残す。');
  }
  if (field === 'subtitle') {
    return confident && httpsUrl(url)
      ? result(CLASS.LOW_RISK, 'subtitle-official-replacement', '副題は表示用の補足情報。公式ページで確認でき、日付・場所・URLには影響しないため、自動採用候補。')
      : result(CLASS.HUMAN, 'subtitle-changed', '副題が変わっていますが、公式での確認が十分ではありません。');
  }
  if (field === 'title') return result(CLASS.HUMAN, 'title-semantic-change', '学会名が表記差を超えて変わっています（回次の追加・名称の変更を含む）。');
  if (LOCATION_FIELDS.has(field)) {
    const a = n.normText(current), b = n.normText(detected);
    return b && a.includes(b) && b.length < a.length
      ? result(CLASS.HUMAN, 'venue-information-reduced', '会場・開催地の表記が短くなり、情報量が減ります。')
      : result(CLASS.HUMAN, 'venue-location-changed', '会場・都市・国が実質的に変わっています。');
  }
  if (field === 'registration') return result(CLASS.HUMAN, 'registration-periods-changed', '参加登録期間の内容が現在値と実質的に異なります。');
  if (field === 'edition') return result(CLASS.HUMAN, 'edition-mismatch', '開催回が一致しません。');
  if (URL_FIELDS.has(field)) return result(CLASS.HUMAN, 'url-changed', 'URLが変更されています。');
  return result(CLASS.HUMAN, 'unclassified-difference', '正規化しても意味が一致せず、既知のルールに該当しません。');
}

// ---- audit candidates (several comparisons) ----
const RANK = { [CLASS.HUMAN]: 4, [CLASS.SOURCE]: 3, [CLASS.LOW_RISK]: 2, [CLASS.EQUIVALENT]: 1 };
function classifyAuditBase(item, ctx) {
  const comparisons = item.audit.comparisons || [];
  const eventYear = Number(String(ctx.event?.date || '').slice(0, 4)) || null;
  const diffs = comparisons.filter(c => c.result === 'mismatch' || c.result === 'notation-difference');
  const dateMismatch = comparisons.find(c => c.field === 'date' && c.result === 'mismatch');
  const officialYear = dateMismatch ? Number(String(dateMismatch.official || '').slice(0, 4)) : null;
  const otherYear = (eventYear && officialYear && officialYear !== eventYear)
    || comparisons.some(c => c.field === 'year' && c.result === 'mismatch' && Number(c.official) !== Number(c.current));
  const details = diffs.map(c => ({ field: c.field, current: c.current, detected: c.official,
    ...classifyChangeBase({ field: c.field, current: c.current, detected: c.official, reason: null, evidence: c.evidence, confidence: c.confidence, url: c.url }, ctx) }));
  if (item.audit.category === 'possible-wrong-edition' && otherYear) {
    return { ...result(CLASS.SOURCE, 'official-page-other-year', '取得した公式ページの開催年・日付が現在のカードと異なり、別回・別年のページを参照している可能性が高い。'), details };
  }
  if (!details.length) {
    if (comparisons.length > 0 && comparisons.every(c => c.result === 'match')) {
      return { ...result(CLASS.EQUIVALENT, 'audit-all-fields-match', '照合できた項目はすべて一致。'), details };
    }
    const unavailable = ['not-found', 'bot-protected-official-candidate'].includes(item.audit.category);
    return { ...result(CLASS.SOURCE, unavailable ? 'audit-official-body-unavailable' : 'audit-no-official-evidence',
      unavailable ? '公式情報を取得できない、または本文を確認できていない。' : '一次情報の取得・抽出が不足しており、差分があるとは言えない。'), details };
  }
  const top = details.reduce((a, b) => (RANK[b.classification] > RANK[a.classification] ? b : a));
  const { field, current, detected, ...verdict } = top;
  const more = details.filter(d => d.classification !== CLASS.EQUIVALENT).length - (top.classification !== CLASS.EQUIVALENT ? 1 : 0);
  return { ...verdict, reason: more > 0 ? `${verdict.reason}（ほか${more}項目にも差分）` : verdict.reason, details };
}

function classifyAudit(item, ctx) {
  const baseline = classifyAuditBase(item, ctx);
  const reflection = auditReflection(item, ctx);
  const verdict = { ...baseline, reflection: reflection.checks };
  if (staleAllowed(baseline, ctx) && reflection.all) {
    return { ...staleResult(`差分のあった${reflection.checks.length}項目（${reflection.checks.map(c => c.field).join('・')}）がすべて現在データに反映済み。`), baselineRuleId: baseline.ruleId, details: baseline.details, reflection: reflection.checks };
  }
  return verdict;
}

// ---- URL discovery candidates (no field) ----
function classifyDiscovery(item, ctx = {}) {
  const baseline = classifyDiscoveryBase(item);
  if (item.reason === 'discovery-card-integrity-needs-review' && ctx.auditSibling && ctx.event) {
    // The official edition/year is not stored on the discovery item; use the same event's audit facts, never a text guess.
    const sibling = classifyAuditBase(ctx.auditSibling, ctx), reflection = auditReflection(ctx.auditSibling, ctx);
    if (staleAllowed(baseline, ctx) && staleAllowed(sibling, ctx) && reflection.all) {
      return { ...staleResult('公式の開催回・年を示す同一大会の監査結果が、すでに現在のカードに反映されている。'), baselineRuleId: baseline.ruleId, reflection: reflection.checks };
    }
  }
  return baseline;
}
function classifyDiscoveryBase(item) {
  if (mentionsDisruption(item.evidence)) return result(CLASS.HUMAN, "event-cancelled-or-postponed", "開催の中止・延期を示す記述があります。必ず人間が公式情報を確認してください。");
  switch (item.reason) {
    case 'discovery-fetch-failed': return result(CLASS.SOURCE, 'discovery-fetch-failed', '公式学会一覧の取得に失敗。URLが存在しないとは判断できない。');
    case 'discovery-search-limit': return result(CLASS.SOURCE, 'discovery-search-limit', '探索の取得上限に達して未確定。');
    case 'event-url-edition-unverified': return result(CLASS.SOURCE, 'event-url-edition-unverified', '候補URLの開催年・開催回を確認できていない。');
    case 'event-url-year-mismatch': return result(CLASS.SOURCE, 'event-url-other-year', '候補URLの開催年が対象と一致せず、別年のページの可能性がある。');
    case 'discovery-card-integrity-needs-review': return result(CLASS.HUMAN, 'edition-card-mismatch', '公式の開催回・年と現在のカードが一致しません。カードの名称・回次の確認が必要です。');
    default: return result(CLASS.HUMAN, 'unclassified-discovery', '既知の探索ルールに該当しません。');
  }
}
function classifyLegacyItem(item, ctx) {
  if (item.audit) return classifyAudit(item, ctx);
  if (!item.field) return classifyDiscovery(item, ctx);
  return classifyChange({ field: item.field, current: item.oldValue, detected: item.value, reason: item.reason, evidence: item.evidence,
    confidence: item.confidence, url: item.url, massChange: item.reason === 'mass-change-limit' }, ctx);
}
module.exports = { CLASS, isReflected, idYearConsistent, classifyChange, classifyLegacyItem, classifyAudit, classifyDiscovery, ruleCentralEuropeTimezone, ruleRegistrationYearTypo, ruleAdjacentPeriods, extractDeadlineStamps };
