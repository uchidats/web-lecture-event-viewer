'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { classifyChange, classifyAudit, idYearConsistent, CLASS } = require('../../scripts/shadow-review/classify');
const { buildShadowReport } = require('../../scripts/shadow-review/run');
const { compareDates } = require('../../scripts/shadow-review/normalize');

const root = path.resolve(__dirname, '..', '..');
const ctx = { today: '2026-10-16', event: { id: 'e', date: '2027-04-20', endDate: '2027-04-23' } };
const classify = (change, c = ctx) => classifyChange({ confidence: 0.98, url: 'https://example.org/x', ...change }, c);
const expectRule = (change, classification, ruleId, c) => {
  const verdict = classify(change, c);
  assert.equal(verdict.classification, classification, `${verdict.ruleId}: ${verdict.reason}`);
  assert.equal(verdict.ruleId, ruleId);
  assert.ok(verdict.reason.length > 10, 'human readable reason');
  return verdict;
};

test('WGC 2027: CET/CEST表記のみ異なる同日・同時刻の締切は「締切日として同値」', () => {
  const evidence = 'Abstract submission deadline: October 19, 2026 (23:59 CEST).\nOctober 19, 2026 – Abstract submission deadline (23:59 CET)';
  const verdict = expectRule({ field: 'abstractSubmission', current: { status: 'unknown', startDate: null, deadline: null, url: null }, detected: null,
    reason: 'abstract-conflicting-timezones', evidence }, CLASS.EQUIVALENT, 'same-deadline-date-central-europe-timezone');
  assert.match(verdict.reason, /絶対時刻の同一性は主張しない/);
  assert.equal(verdict.shadowValue.deadline, '2026-10-19T23:59');
});

test('WGC 2027: 日付・時刻が食い違う、または中欧以外が混ざるタイムゾーン競合は人間確認', () => {
  expectRule({ field: 'abstractSubmission', reason: 'abstract-conflicting-timezones',
    evidence: 'Abstract submission deadline: October 19, 2026 (23:59 CEST)\nAbstract submission deadline: October 20, 2026 (23:59 CET)' }, CLASS.HUMAN, 'abstract-deadline-date-or-time-conflict');
  expectRule({ field: 'abstractSubmission', reason: 'abstract-conflicting-timezones', evidence: 'Abstract submission deadline: October 19, 2026 (23:59 JST)' },
    CLASS.HUMAN, 'abstract-timezone-conflict');
});

test('WGC 2027: 年だけ1年異なる参加登録締切は、妥当な候補が1つなら低リスク自動確定候補', () => {
  const evidence = JSON.stringify([
    { label: 'Early bird fee', deadline: '2027-01-18', category: 'early', advanceEligible: true },
    { label: 'Early bird registration', deadline: '2026-01-18', category: 'early', advanceEligible: true }]);
  const verdict = expectRule({ field: 'registration', reason: 'registration-conflicting-deadlines', evidence }, CLASS.LOW_RISK, 'registration-year-typo-single-plausible');
  assert.equal(verdict.shadowValue.periods[0].deadline, '2027-01-18');
});

test('WGC 2027: 年違いでも、両方が妥当・月日が違う・3候補以上なら人間確認', () => {
  const bothFuture = JSON.stringify([{ label: 'Early bird', deadline: '2027-01-18', category: 'early' }, { label: 'Early bird registration', deadline: '2026-12-18', category: 'early' }]);
  const dayDiffers = JSON.stringify([{ label: 'Early bird', deadline: '2027-01-18', category: 'early' }, { label: 'Early bird fee', deadline: '2026-01-19', category: 'early' }]);
  for (const evidence of [bothFuture, dayDiffers]) expectRule({ field: 'registration', reason: 'registration-conflicting-deadlines', evidence }, CLASS.HUMAN, 'registration-deadline-conflict');
  // Both years in the future of the reference date: not a past/stale typo.
  const bothPlausible = JSON.stringify([{ label: 'Early bird', deadline: '2027-01-18', category: 'early' }, { label: 'Early bird fee', deadline: '2026-12-18', category: 'early' }]);
  expectRule({ field: 'registration', reason: 'registration-conflicting-deadlines', evidence: bothPlausible }, CLASS.HUMAN, 'registration-deadline-conflict');
});

test('SOE 2027: 前期間の終了日と次期間の開始日が同日の連続期間は正常', () => {
  const evidence = JSON.stringify([
    { label: 'Early Bird', deadline: '2027-03-24', category: 'early', advanceEligible: true },
    { label: 'Standard', start: '2027-03-24', deadline: '2027-05-05', category: 'regular', advanceEligible: null }]);
  expectRule({ field: 'registration', reason: 'registration-ambiguous-boundary', evidence }, CLASS.EQUIVALENT, 'registration-adjacent-periods-same-day-boundary');
  const overlapping = JSON.stringify([{ label: 'Early', deadline: '2027-03-30' }, { label: 'Standard', start: '2027-03-24', deadline: '2027-05-05' }]);
  expectRule({ field: 'registration', reason: 'registration-ambiguous-boundary', evidence: overlapping }, CLASS.HUMAN, 'registration-boundary-unresolved');
  const reversed = JSON.stringify([{ label: 'Early', start: '2027-04-01', deadline: '2027-03-24' }, { label: 'Standard', start: '2027-03-24', deadline: '2027-05-05' }]);
  expectRule({ field: 'registration', reason: 'registration-ambiguous-boundary', evidence: reversed }, CLASS.HUMAN, 'registration-boundary-unresolved');
});

test('表記差: 空白・全角半角・記号・日付形式・時刻形式・配列順・空値は equivalent', () => {
  expectRule({ field: 'venue', current: '九州大学医学部 百年講堂', detected: '九州大学医学部百年講堂' }, CLASS.EQUIVALENT, 'text-format-only');
  expectRule({ field: 'title', current: 'ＡＢＣ　Congress 2027', detected: 'ABC Congress 2027' }, CLASS.EQUIVALENT, 'text-format-only');
  expectRule({ field: 'abstractSubmission.deadline', current: '2026/10/19', detected: 'October 19, 2026' }, CLASS.EQUIVALENT, 'same-date-format-difference');
  expectRule({ field: 'abstractSubmission.deadline', current: '2026-05-21 12:00', detected: '2026-05-21T12:00' }, CLASS.EQUIVALENT, 'same-date-format-difference');
  expectRule({ field: 'abstractSubmission.deadline', current: '2026-05-21 12:00', detected: '2026年5月21日' }, CLASS.EQUIVALENT, 'same-date-time-omitted');
  expectRule({ field: 'tags', current: ['a', 'b'], detected: ['b', 'a'] }, CLASS.EQUIVALENT, 'structure-order-only');
  expectRule({ field: 'registration', current: { type: 'domestic', periods: [{ label: 'A', deadline: '2026-01-01' }, { label: 'B', deadline: '2026-02-01' }] },
    detected: { periods: [{ deadline: '2026/02/01', label: 'B' }, { label: 'A', deadline: '2026-01-01' }], type: 'domestic' } }, CLASS.EQUIVALENT, 'structure-order-only');
  expectRule({ field: 'subtitle', current: null, detected: '' }, CLASS.EQUIVALENT, 'empty-value-equivalent');
  expectRule({ field: 'tags', current: [], detected: null }, CLASS.EQUIVALENT, 'empty-value-equivalent');
  assert.equal(compareDates('2026-10-19', '2026-10-20'), 'date-differs');
});

test('日付変更・締切日変更は人間確認（表記差に吸収しない）', () => {
  expectRule({ field: 'date', current: '2027-04-20', detected: '2027-04-23' }, CLASS.HUMAN, 'event-date-changed');
  expectRule({ field: 'abstractSubmission.deadline', current: '2026-11-05 13:00', detected: '2026-12-10 13:00' }, CLASS.HUMAN, 'deadline-date-changed');
  expectRule({ field: 'abstractSubmission.deadline', current: '2026-05-21 12:00', detected: '2026-05-21 18:00' }, CLASS.HUMAN, 'deadline-date-changed');
});

test('会場・都市・国の実質変更、情報量が減る会場名は人間確認', () => {
  expectRule({ field: 'venue', current: '国立京都国際会館', detected: '京都ブライトンホテル' }, CLASS.HUMAN, 'venue-location-changed');
  expectRule({ field: 'cityCountry', current: '京都市（京都府） / 日本', detected: 'Kyoto' }, CLASS.HUMAN, 'venue-location-changed');
  expectRule({ field: 'venue', current: 'じゅうろくプラザ（岐阜市文化産業交流センター）', detected: 'じゅうろくプラザ' }, CLASS.HUMAN, 'venue-information-reduced');
});

test('URL・ドメイン変更、開催回の不一致、学会名の意味的変更は人間確認', () => {
  expectRule({ field: 'abstractSubmission.url', current: 'https://a.example/index.html', detected: 'https://a.example/abstract/index.html' }, CLASS.HUMAN, 'url-changed');
  expectRule({ field: 'officialUrl', current: 'https://www.jrvs.jp/', detected: 'https://convention.example.co.jp/', reason: 'official-domain-changed' }, CLASS.HUMAN, 'url-domain-changed');
  expectRule({ field: 'title', current: '第8回 日本近視学会総会', detected: '第9回日本近視学会総会' }, CLASS.HUMAN, 'title-semantic-change');
  expectRule({ field: 'title', current: 'World Glaucoma Congress 2027 (WGC 2027)', detected: '12th World Glaucoma Congress' }, CLASS.HUMAN, 'title-semantic-change');
  expectRule({ field: 'edition', current: [39], detected: [16] }, CLASS.HUMAN, 'edition-mismatch');
});

test('括弧書きの別名・英語併記の増減だけの題名差は equivalent、回次が違えば人間確認', () => {
  expectRule({ field: 'title', current: '第14回 日本眼形成再建外科学会学術集会 (JSOPRS 2027)', detected: '第14回日本眼形成再建外科学会学術集会' }, CLASS.EQUIVALENT, 'title-supplemental-text-only');
  expectRule({ field: 'title', current: 'APAO 2027 (42nd Asia-Pacific Academy of Ophthalmology Congress)', detected: 'APAO 2027 – The 42nd Asia-Pacific Academy' }, CLASS.EQUIVALENT, 'title-supplemental-text-only');
  expectRule({ field: 'title', current: '第14回 日本眼形成再建外科学会 (JSOPRS 2027)', detected: '第15回日本眼形成再建外科学会' }, CLASS.HUMAN, 'title-semantic-change');
});

test('単純な欠損補完は低リスク候補。既存値の上書き・信頼度不足・複数候補は対象外', () => {
  expectRule({ field: 'abstractSubmission.startDate', current: null, detected: '2026-03-03T12:00', massChange: true }, CLASS.LOW_RISK, 'safe-completion-null-to-value');
  expectRule({ field: 'abstractSubmission.status', current: 'unknown', detected: 'closed' }, CLASS.LOW_RISK, 'safe-completion-null-to-value');
  expectRule({ field: 'abstractSubmission.deadline', current: null, detected: '2026-05-21 12:00', confidence: 0.8 }, CLASS.HUMAN, 'unclassified-difference');
  expectRule({ field: 'abstractSubmission.deadline', current: null, detected: '2026-05-21 12:00', reason: 'multiple-candidates' }, CLASS.HUMAN, 'multiple-candidates-differ');
  expectRule({ field: 'abstractSubmission.startDate', current: '2026-10-01', detected: '2026-10-01 10:00' }, CLASS.LOW_RISK, 'date-time-precision-added');
  expectRule({ field: 'subtitle', current: '仮の副題', detected: '公式の副題' }, CLASS.LOW_RISK, 'subtitle-official-replacement');
  expectRule({ field: 'subtitle', current: '仮の副題', detected: '公式の副題', confidence: 0.5 }, CLASS.HUMAN, 'subtitle-changed');
  expectRule({ field: 'registration', current: null, detected: { type: 'domestic', periods: [{ label: '事前', start: '2026-05-08', deadline: '2026-08-31' }] } },
    CLASS.LOW_RISK, 'safe-completion-registration-periods');
  expectRule({ field: 'registration', current: null, detected: { type: 'domestic', periods: [{ label: '事前', start: '2026-09-01', deadline: '2026-08-31' }] } },
    CLASS.HUMAN, 'registration-periods-changed');
});

test('中止・延期は専用ruleで必ず human_review（締切延長は対象外）', () => {
  expectRule({ field: 'note', current: '', detected: '本年の学術集会は新型感染症のため中止いたします' }, CLASS.HUMAN, 'event-cancelled-or-postponed');
  expectRule({ field: 'abstractSubmission.status', current: 'unknown', detected: 'closed', evidence: 'The congress has been postponed to 2028.' }, CLASS.HUMAN, 'event-cancelled-or-postponed');
  expectRule({ field: 'status', current: 'scheduled', detected: 'cancelled' }, CLASS.HUMAN, 'event-cancelled-or-postponed');
  // Even a high-confidence completion with otherwise safe values must not escape human review.
  expectRule({ field: 'abstractSubmission.deadline', current: null, detected: '2026-05-21 12:00', evidence: '大会は延期となりました' }, CLASS.HUMAN, 'event-cancelled-or-postponed');
  // Deadline extensions are ordinary candidate changes, not event disruptions.
  const extension = classify({ field: 'abstractSubmission.deadline', current: '2026-05-21', detected: '2026-06-01', evidence: '演題募集期間を延長しました' });
  assert.notEqual(extension.ruleId, 'event-cancelled-or-postponed');
  assert.equal(classify({ field: 'title', current: 'A 2027', detected: 'A 2027', evidence: 'Event page' }).classification, CLASS.EQUIVALENT);
});

test('取得失敗・別年ページ・本文未確認は source_problem', () => {
  expectRule({ field: 'eventOfficialUrl', current: null, detected: 'https://a.example/', reason: 'bot-protected-official-candidate' }, CLASS.SOURCE, 'bot-protected-body-unverified');
  expectRule({ field: 'registration', reason: 'registration-conference-identity-unconfirmed' }, CLASS.SOURCE, 'conference-identity-unconfirmed');
});

const gemini = (items, reasonPrefix = '[Mass Change Escalated] ') => ({
  adminVisibleItems: items.map((fieldChanges, i) => ({ eventId: `ev-${i}`, eventName: `大会${i}`, confidence: 0.98, sourceUrl: 'https://example.org/p', reason: `${reasonPrefix}test`, fieldChanges })),
  deferredReviewItems: []
});
const events = Array.from({ length: 8 }, (_, i) => ({ id: `ev-${i}`, title: `大会${i}`, date: '2027-04-20' }));
const build = (geminiReport, legacyItems = []) => buildShadowReport({ legacyData: { version: 1, items: legacyItems }, geminiReport, events, today: '2026-10-16' });

test('大量変更: 9件全部が人間確認に回る状況でも、項目ごとに「自動処理可能」と「人間確認」を別集計する', () => {
  const report = build(gemini([
    [{ field: 'abstractSubmission.startDate', before: null, after: '2026-03-03T12:00' }, { field: 'abstractSubmission.deadline', before: null, after: '2026-05-21T12:00' }],
    [{ field: 'abstractSubmission.url', before: null, after: 'https://example.org/abstract' }],
    [{ field: 'venue', before: '国立京都国際会館', after: '京都ブライトンホテル' }],
    [{ field: 'title', before: '第8回 日本近視学会総会', after: '第9回日本近視学会総会' }],
    [{ field: 'venue', before: '九州大学医学部 百年講堂', after: '九州大学医学部百年講堂' }],
    [{ field: 'abstractSubmission.url', before: 'https://a.example/', after: 'https://b.example/' }]
  ]));
  const { massChange, total } = report.summary;
  assert.equal(total, 7);
  assert.equal(massChange.escalatedItems, 7);
  assert.equal(massChange.wouldHaveBeenAutoProcessable, 4); // 3 completions + 1 format-only
  assert.equal(massChange.trulyNeedHuman, 3);
  assert.equal(report.summary.equivalent + report.summary.low_risk_auto_candidate + report.summary.source_problem + report.summary.human_review, total);
});

test('重複: 複数系統で同一イベント・同一項目・同一意味の候補を重複として数える（候補自体は削除しない）', () => {
  const legacy = [{ eventId: 'ev-0', field: 'abstractSubmission.deadline', oldValue: null, value: '2026-05-21 12:00', confidence: 0.98, url: 'https://example.org/p', status: 'needs-review', reason: 'mass-change-limit' }];
  const report = build(gemini([[{ field: 'abstractSubmission.deadline', before: null, after: '2026-05-21T12:00' }]]), legacy);
  assert.equal(report.summary.total, 2);
  assert.equal(report.candidates.length, 2);
  assert.equal(report.summary.duplicates.duplicateCount, 1);
  assert.equal(report.summary.duplicates.groups[0].count, 2);
});

test('各判定に event id・大会名・項目・現在値・検出値・分類・rule id・理由が残る', () => {
  const report = build(gemini([[{ field: 'venue', before: '国立京都国際会館', after: '京都ブライトンホテル' }]]));
  const c = report.candidates[0];
  for (const key of ['eventId', 'eventName', 'field', 'current', 'detected', 'classification', 'ruleId', 'reason']) assert.ok(key in c, key);
  assert.equal(c.eventName, '大会0');
  assert.equal(c.current, '国立京都国際会館');
});

test('本番データ・状態に影響しない: 実行前後で events.js と reports の既存ファイルが変化しない', () => {
  const watched = ['events.js', 'reports/auto-update-review.json', 'reports/gemini-monitor-state.json', 'reports/gemini-rollback-history.json'];
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const before = watched.map(hash);
  require('../../scripts/shadow-review/run').main(['--today', '2026-10-16', '--no-write']);
  assert.deepEqual(watched.map(hash), before);
  const source = ['run.js', 'classify.js', 'normalize.js'].map(f => fs.readFileSync(path.join(root, 'scripts', 'shadow-review', f), 'utf8')).join('\n');
  assert.ok(!/firestore|review-model|localStorage|applier|rollback/i.test(source.replace(/Firestore status/g, '')), 'no coupling to production state modules');
});

test('現行データ(148件)の回帰: WGC/SOEの代表例が期待どおりに分類される', { skip: !fs.existsSync(path.join(root, 'reports/auto-update-review.json')) }, () => {
  const legacyData = JSON.parse(fs.readFileSync(path.join(root, 'reports/auto-update-review.json'), 'utf8'));
  const { loadEvents } = require('../../scripts/shadow-review/run');
  const report = buildShadowReport({ legacyData, events: loadEvents(), today: '2026-10-16' });
  const needs = legacyData.items.filter(i => i.status === 'needs-review' || !i.status).length;
  assert.equal(report.summary.total, needs);
  const find = (eventId, reason) => report.candidates.find(c => c.eventId === eventId && c.sourceReason === reason);
  assert.equal(find('conf-int-wgc-2027', 'abstract-conflicting-timezones').ruleId, 'same-deadline-date-central-europe-timezone');
  assert.equal(find('conf-int-wgc-2027', 'registration-conflicting-deadlines').ruleId, 'registration-year-typo-single-plausible');
  assert.equal(find('conf-int-soe-2027', 'registration-ambiguous-boundary').ruleId, 'registration-adjacent-periods-same-day-boundary');
  assert.equal(report.summary.human_review + report.summary.source_problem + report.summary.low_risk_auto_candidate + report.summary.equivalent, needs);
});

// ---- stale-already-applied: the candidate value is already in the current events.js ----
const staleCtx = event => ({ today: '2026-10-16', event: { id: 'conf-x-2027', date: '2027-04-20', ...event } });
const staleChange = (change, event) => classifyChange({ confidence: 0.98, url: 'https://example.org/p', ...change }, staleCtx(event));

test('stale: 現在値＝候補値なら、候補作成時の値と無関係に stale（equivalent）', () => {
  const verdict = staleChange({ field: 'venue', current: '旧会場', detected: '京都国際会館' }, { venue: '京都国際会館' });
  assert.equal(verdict.classification, CLASS.EQUIVALENT);
  assert.equal(verdict.ruleId, 'stale-already-applied');
  assert.equal(verdict.baselineRuleId, 'venue-location-changed');
  assert.match(verdict.reason, /すでに現在データ/);
});

test('stale: 表記差だけでも正規化後に一致していれば stale', () => {
  assert.equal(staleChange({ field: 'venue', current: 'x', detected: '九州大学医学部百年講堂' }, { venue: '九州大学医学部 百年講堂' }).ruleId, 'stale-already-applied');
  assert.equal(staleChange({ field: 'abstractSubmission.deadline', current: null, detected: '2026-05-21T12:00' }, { abstractSubmission: { deadline: '2026-05-21 12:00' } }).ruleId, 'stale-already-applied');
  assert.equal(staleChange({ field: 'title', current: '第8回 近視学会', detected: '第9回日本近視学会総会 - The 9th Annual Meeting' }, { title: '第9回 日本近視学会総会' }).ruleId, 'stale-already-applied');
  assert.equal(staleChange({ field: 'registration', current: null, detected: { type: 'domestic', periods: [{ label: 'B', deadline: '2026-02-01' }, { label: 'A', deadline: '2026-01-01' }] } },
    { registration: { periods: [{ label: 'A', deadline: '2026/01/01' }, { label: 'B', deadline: '2026-02-01' }], type: 'domestic' } }).ruleId, 'stale-already-applied');
});

test('stale: 現在値が候補値と異なる・現在データに項目がない場合は stale にしない', () => {
  assert.notEqual(staleChange({ field: 'venue', current: '旧会場', detected: '京都国際会館' }, { venue: '大阪国際会議場' }).ruleId, 'stale-already-applied');
  assert.notEqual(staleChange({ field: 'abstractSubmission.deadline', current: null, detected: '2026-05-21 12:00' }, { abstractSubmission: { deadline: null } }).ruleId, 'stale-already-applied');
  assert.notEqual(staleChange({ field: 'venue', current: 'x', detected: '京都国際会館' }, {}).ruleId, 'stale-already-applied');
  // No event to compare against: never stale.
  assert.notEqual(classifyChange({ field: 'venue', current: 'x', detected: 'y', confidence: 0.98 }, { today: '2026-10-16', event: null }).ruleId, 'stale-already-applied');
});

const auditItem = (category, comparisons) => ({ eventId: 'conf-x-2027', reason: 'metadata-audit-metadata-mismatch', audit: { category, comparisons } });
const cmp = (field, current, official, result = 'mismatch') => ({ field, current, official, result, confidence: 0.97, url: 'https://example.org/p' });

test('stale: 複数項目の候補は、すべて反映済みのときだけ stale。一部だけ反映済みなら従来どおり', () => {
  const item = auditItem('metadata-mismatch', [cmp('title', '第8回 日本近視学会総会', '第9回日本近視学会総会'), cmp('venue', '旧会場', '京都国際会館')]);
  const all = classifyAudit(item, staleCtx({ title: '第9回 日本近視学会総会', venue: '京都国際会館' }));
  assert.equal(all.ruleId, 'stale-already-applied');
  assert.deepEqual(all.reflection.map(c => c.reflected), [true, true]);
  const partial = classifyAudit(item, staleCtx({ title: '第9回 日本近視学会総会', venue: '旧会場' }));
  assert.notEqual(partial.ruleId, 'stale-already-applied');
  assert.equal(partial.classification, CLASS.HUMAN);
  assert.deepEqual(partial.reflection.map(c => c.reflected), [true, false]);
});

test('stale: 別年・別回ページ疑いは、値が一致していても stale にしない（source_problem のまま）', () => {
  const item = auditItem('possible-wrong-edition', [cmp('title', '第4回 日本老視学会', '第4回 日本老視学会', 'notation-difference'), cmp('year', 2027, 2026), cmp('date', '2027-01-16', '2026-01-17')]);
  const verdict = classifyAudit(item, staleCtx({ title: '第4回 日本老視学会', date: '2026-01-17', id: 'conf-x-2026' }));
  assert.equal(verdict.classification, CLASS.SOURCE);
  assert.equal(verdict.ruleId, 'official-page-other-year');
});

test('stale: IDの年と開催年が不整合なイベント（presbyopia型）は、反映済みに見えても stale にしない', () => {
  assert.equal(idYearConsistent({ id: 'conf-jp-presbyopia-2027', date: '2026-01-17' }), false);
  assert.equal(idYearConsistent({ id: 'conf-jp-presbyopia-2028', date: '2027-01-16' }), false);
  assert.equal(idYearConsistent({ id: 'conf-jp-myopia-2027', date: '2027-07-03' }), true);
  assert.equal(idYearConsistent({ id: 'oph-001', date: '2026-10-29' }), true);
  const verdict = staleChange({ field: 'venue', current: 'x', detected: '品川THE GRAND HALL' }, { id: 'conf-jp-presbyopia-2027', date: '2026-01-17', venue: '品川THE GRAND HALL' });
  assert.notEqual(verdict.ruleId, 'stale-already-applied');
});

test('stale: 中止・延期は stale より優先して human_review', () => {
  const text = '本年の学術集会は新型感染症のため中止いたします';
  const verdict = staleChange({ field: 'note', current: '', detected: text }, { note: text });
  assert.equal(verdict.classification, CLASS.HUMAN);
  assert.equal(verdict.ruleId, 'event-cancelled-or-postponed');
  const withEvidence = staleChange({ field: 'venue', current: 'x', detected: '京都国際会館', evidence: 'The congress has been postponed.' }, { venue: '京都国際会館' });
  assert.equal(withEvidence.ruleId, 'event-cancelled-or-postponed');
});

test('stale: 現行データでは presbyopia 2件は stale にならず、反映済みの年次更新は stale になる', { skip: !fs.existsSync(path.join(root, 'reports/auto-update-review.json')) }, () => {
  const legacyData = JSON.parse(fs.readFileSync(path.join(root, 'reports/auto-update-review.json'), 'utf8'));
  const { loadEvents } = require('../../scripts/shadow-review/run');
  const report = buildShadowReport({ legacyData, events: loadEvents(), today: '2026-10-16' });
  const stale = report.candidates.filter(c => c.ruleId === 'stale-already-applied');
  assert.ok(stale.length > 0);
  assert.ok(!stale.some(c => /presbyopia/.test(c.eventId)), 'presbyopia must never be closed as stale');
  assert.ok(stale.some(c => c.eventId === 'conf-jp-myopia-2027'));
  assert.ok(stale.every(c => c.classification === CLASS.EQUIVALENT && c.baselineRuleId));
});
