// Read-only event audit. Fetching/report generation never writes events.js.
const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, writeJson, readJson, mergeReview, hash } = require('./auto-updater/storage');
const { fetchOfficialPage } = require('./auto-updater/fetch');
const { text, compact, blocks, normalizeVenue, dateRanges, registrationPeriods } = require('./auto-updater/extract');
const CATEGORIES = ['verified', 'official-url-missing', 'metadata-mismatch', 'possible-wrong-edition',
  'bot-protected-official-candidate', 'insufficient-evidence', 'not-found'];
const FIELDS = ['title', 'edition', 'year', 'date', 'endDate', 'cityCountry', 'venue', 'sponsor', 'subtitle',
  'abstractSubmission.deadline', 'registration', 'eventOfficialUrl'];
const normalize = s => compact(String(s || '')).replace(/[（(][^）)]*[）)]/g, '').replace(/[・、,：:｜|／/]/g, '').toLowerCase();
const editions = s => [...new Set([...String(s).matchAll(/第\s*(\d+)\s*(?:回|(?=日本))|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2])))].sort((a,b)=>a-b);
const get = (e, field) => field === 'year' ? Number(e.date.slice(0, 4)) : field === 'edition' ? editions(e.title) :
  field.split('.').reduce((v, k) => v?.[k], e) ?? null;
function family(event) {
  if (/JSCRS/.test(event.title)) return 'jscrs';
  const japanese = event.title.match(/日本[^（(・／/]*?学会/);
  return japanese ? normalize(japanese[0]) : normalize(event.title.replace(/20\d{2}|\d+(?:st|nd|rd|th)/gi, '').split('(')[0]);
}
function clean(html) { return html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<(s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, ''); }
function extractFacts(html, event, url, kind = 'event', role = 'overview') {
  const body = clean(html), pairs = blocks(body), facts = {};
  const add = (field, value, evidence, confidence = 0.97) => {
    if (value !== null && value !== undefined && value !== '' && !facts[field]) facts[field] = { value, evidence: text(evidence).slice(0, 700), url, confidence };
  };
  const headings = [...body.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(m => text(m[1]));
  const pageTitle = text(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const candidates = [...pageTitle.split(/[|｜]/), ...headings,
    ...[...body.matchAll(/<img\b[^>]*alt=["']([^"']+)["']/gi)].map(m=>m[1])]
    .filter(h => h.length < 350 && normalize(h).includes(family(event)) && /第\d+回|\d+(?:st|nd|rd|th)|20\d{2}/i.test(compact(h)));
  const score = name => editions(name).filter(n=>get(event,'edition').includes(n)).length * 4 + (name.includes(String(get(event,'year'))) ? 1 : 0);
  let name = candidates.filter(h=>!normalize(text(body)).includes(family(event)+get(event,'year')) ||
    !/20\d{2}/.test(h) || h.includes(String(get(event,'year')))).sort((a,b)=>score(b)-score(a))[0];
  if (kind === 'index') {
    // Only the dated row/block for this society and year; never compare a whole multiyear list.
    const yearSections = [...body.matchAll(/<strong\b[^>]*>\s*(20\d{2})年\s*<\/strong>/gi)];
    const section = yearSections.find(m=>Number(m[1])===get(event,'year'));
    const nextSection = section && yearSections.find(m=>m.index>section.index);
    const scoped = section ? body.slice(section.index, nextSection?.index || body.length) : body;
    const rows = [...scoped.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m => m[0]);
    const matching = rows.filter(r => {
      const cells=[...r.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>text(m[1]));
      const first=/^20\d{2}年?$/.test(cells[0]) ? cells[1] || '' : cells[0] || '';
      return normalize(first).includes(family(event)) && (!event.title.includes('総会') || first.includes('総会')) &&
        (section || text(r).includes(String(get(event,'year'))));
    });
    if (matching.length !== 1) return { facts, associated: false };
    const row = matching[0], lines = text(row);
    const societyLines = lines.split('\n').filter(l=>/第\s*\d+\s*回.*学会/.test(l));
    name = societyLines.length ? societyLines.join('・') : lines.match(/(?:日本[^\n]+学会[^\n]*|APAO|APVRS|ESCRS|ARVO|AAO)[^\n]*/)?.[0];
    if (name) add('title', name, lines, 0.95);
    const ranges = dateRanges(compact(lines), get(event, 'year'));
    if (ranges.length === 1 && ranges[0].start && ranges[0].end && (section || ranges[0].confidence >= 0.95)) {
      add('date', ranges[0].start.slice(0, 10), lines, 0.95); add('endDate', ranges[0].end.slice(0, 10), lines, 0.95);
    }
    const venue = lines.match(/(?:会場|開催場所)[：:]\s*([^\n]+)/)?.[1];
    if (venue) add('venue', venue, lines, 0.95);
    const organizer = lines.match(/主催[：:]\s*([^\n〔]+)/)?.[1];
    if (organizer?.includes('学会')) add('sponsor', organizer.trim(), lines, 0.95);
  } else {
    for (const [label, raw] of pairs) {
      const key = compact(label), value = text(raw);
      if (/^(学会名|大会名|会議名|名称)$/.test(key)) name = value.split('\n')[0];
      if (/^(テーマ|大会テーマ|Theme)$/i.test(key)) add('subtitle', value.split('\n')[0], value);
      if (/^(会場|会場名|開催会場|Venue)$/i.test(key)) add('venue', normalizeVenue(raw.replace(/※[\s\S]*/, '').replace(/Googleマップ/g,'')), value);
      if (/^(開催地|開催都市|City)$/i.test(key)) add('cityCountry', value.split('\n')[0], value);
      if (/^(主催|主催学会|主催団体)$/i.test(key)) add('sponsor', value.split('\n')[0], value);
      if (/^(会期|日程|日時|開催期間|Dates?)$/i.test(key)) {
        const ranges = dateRanges(compact(value).replace(/[、,]\s*(\d+)日/g, '～$1日'), get(event, 'year'));
        if (ranges.length === 1 && ranges[0].start && ranges[0].end && ranges[0].confidence >= 0.95) {
          add('date', ranges[0].start.slice(0, 10), value); add('endDate', ranges[0].end.slice(0, 10), value);
        } else {
          const single = value.match(/(20\d{2})年\s*(\d+)月\s*(\d+)日/);
          if (single && !/[〜～~]|\d+日.*\d+日/.test(value)) {
            const date = `${single[1]}-${single[2].padStart(2, '0')}-${single[3].padStart(2, '0')}`;
            add('date', date, value); add('endDate', date, value);
          }
        }
      }
      if (/^(演題締切日|演題登録締切日|演題募集締切)$/.test(key)) {
        const d = require('./auto-updater/extract').normalizeDate(value);
        if (d?.startsWith('20')) add('abstractSubmission.deadline', d, value);
      }
      if (/^(演題募集期間|演題登録期間)$/.test(key)) {
        const ranges = dateRanges(value, get(event, 'year'));
        if (ranges.length === 1 && ranges[0].confidence >= 0.95) add('abstractSubmission.deadline', ranges[0].end, value);
      }
    }
    if (name && normalize(name).includes(family(event))) add('title', name.replace(/【.*|\s*\|.*$/g, '').trim(), name);
    if (role === 'registration' || pairs.some(([label])=>/参加登録|Registration Period/i.test(label))) {
      const registration = registrationPeriods(pairs, { year: get(event, 'year'), id: event.id,
        registrationType: event.eventType === '海外学会' ? 'international' : 'domestic' });
      if (registration.value.periods.length) add('registration', registration.value, registration.evidence, 0.96);
    }
  }
  const associated = !!facts.title && normalize(facts.title.value).includes(family(event));
  if (!associated) return { facts: {}, associated: false };
  if (facts.title && editions(facts.title.value).length) add('edition', editions(facts.title.value), facts.title.evidence, facts.title.confidence);
  if (facts.date) add('year', Number(facts.date.value.slice(0, 4)), facts.date.evidence, facts.date.confidence);
  if (!facts.year && facts.title) {
    const years = [...new Set([...facts.title.value.matchAll(/20\d{2}/g)].map(m => Number(m[0])))];
    if (years.length === 1) add('year', years[0], facts.title.evidence);
  }
  if (role === 'registration') return { facts: Object.fromEntries(Object.entries(facts).filter(([k])=>k==='registration')), associated };
  if (role === 'abstract') return { facts: Object.fromEntries(Object.entries(facts).filter(([k])=>k==='abstractSubmission.deadline')), associated };
  return { facts, associated };
}
function compareEvent(event, facts, officialUrl, failures = [], notes = []) {
  const comparisons = FIELDS.map(field => {
    const current = get(event, field), fact = field === 'eventOfficialUrl' && officialUrl ?
      { value: officialUrl, url: officialUrl, confidence: facts.year ? 0.97 : 0.8, evidence: '確認した開催回公式ページ（開催年の確証は別項目）' } : facts[field];
    if (!fact) return { field, current, official: null, result: 'unverified' };
    if ((field === 'edition' && Array.isArray(current) && current.length > fact.value.length && fact.value.every(n=>current.includes(n))) ||
        (field === 'title' && get(event,'edition').length > editions(fact.value).length && editions(fact.value).every(n=>get(event,'edition').includes(n))))
      return { field, current, official: fact.value, result: 'unverified', ...fact, note: '合同開催の一部しか表記されていないため差異を断定しない。' };
    if (field === 'sponsor' && !String(fact.value).includes('学会'))
      return { field, current, official: fact.value, ...fact, confidence: 0.6, result: 'unverified', note: '大学教室・開催事務局の記載は主催学会と同義ではない。役割を人手確認する。' };
    if (field === 'registration') {
      fact.confidence = Math.min(fact.confidence, 0.8);
      fact.note = '登録種別・延長前後・関連企画の期間が混在する可能性がある抽出候補。原表を人手確認し、確定するまで反映対象にしない。';
    }
    const exact = JSON.stringify(current) === JSON.stringify(fact.value);
    const equivalent = typeof current === 'string' && typeof fact.value === 'string' && (normalize(current) === normalize(fact.value) ||
      field === 'venue' && normalize(current).replace(/県立|グリーンホール/g,'')===normalize(fact.value).replace(/県立|グリーンホール/g,'') ||
      field === 'title' && /[A-Za-z]/.test(current) && normalize(current).includes(family(event)) && normalize(fact.value).includes(family(event)) &&
      JSON.stringify(editions(current))===JSON.stringify(editions(fact.value)) && (!facts.year || facts.year.value===get(event,'year')) ||
      field === 'title' && JSON.stringify(editions(current))===JSON.stringify(editions(fact.value)) &&
      JSON.stringify([...new Set((current.match(/日本[^（(・／/]*?学会/g)||[]).map(normalize))].sort())===JSON.stringify([...new Set((fact.value.match(/日本[^（(・／/]*?学会/g)||[]).map(normalize))].sort()) &&
      (current.match(/日本[^（(・／/]*?学会/g)||[]).length>1 ||
      field === 'title' && JSON.stringify(editions(current)) === JSON.stringify(editions(fact.value)) &&
      normalize(current.replace(/第\s*\d+\s*回/g,'')) === normalize(fact.value.replace(/第\s*\d+\s*回/g,'')));
    return { field, current, official: fact.value, result: exact ? 'match' : equivalent ? 'notation-difference' : current == null || current === '' || field === 'edition' && !current.length || /^(未定|要確認)$/.test(String(current)) ? 'missing' : 'mismatch', ...fact };
  });
  const differences = comparisons.filter(c => ['missing', 'mismatch', 'notation-difference'].includes(c.result));
    const wrong = differences.some(c => ['edition', 'year'].includes(c.field) && c.result === 'mismatch');
  const material = differences.filter(c => c.result !== 'notation-difference' && c.field !== 'eventOfficialUrl');
  const major = ['title', 'edition', 'year', 'date', 'endDate', 'cityCountry', 'venue', 'sponsor', 'subtitle'];
  const complete = major.every(f => comparisons.find(c => c.field === f)?.result === 'match' || comparisons.find(c => c.field === f)?.result === 'notation-difference');
  const category = wrong ? 'possible-wrong-edition' : material.length ? 'metadata-mismatch' :
    complete && differences.some(c => c.field === 'eventOfficialUrl' && c.result === 'missing') ? 'official-url-missing' :
    complete ? 'verified' : failures.some(f => (f.botProtected || f.fetchState === 'bot-protected') && f.kind==='event') ? 'bot-protected-official-candidate' : 'insufficient-evidence';
  const priority = differences.some(c => ['edition', 'year', 'date', 'endDate', 'venue', 'cityCountry'].includes(c.field) && c.result === 'mismatch') ? '高' :
    material.some(c => ['title', 'subtitle', 'registration', 'abstractSubmission.deadline', 'sponsor'].includes(c.field)) ? '中' : '低';
  return { eventId: event.id, title: event.title, category, priority, comparisons, differences,
    uncheckedFields: comparisons.filter(c => c.result === 'unverified').map(c => c.field), officialUrl,
    failures, notes, currentSnapshot: structuredClone(event), confidence: differences.length ? Math.min(...differences.map(c => c.confidence)) : complete ? 0.97 : 0,
    reason: wrong ? '公式の開催年・回次と矛盾。年度混在の可能性があり、開催回の識別を人間が確認する。' :
      material.length ? '公式一次情報で確認した項目に差分あり。未確認項目は正しいと判定しない。' :
      complete ? '主要項目を照合済み。未確認の締切・登録期間等は別記。' : '一次情報の取得／抽出が不足。不存在・誤情報とは断定しない。' };
}
function sourcesFor(event, oldAudit, missingAudit, discovery) {
  const prior = oldAudit.records.find(r => r.id === event.id), missed = missingAudit.records.find(r => r.id === event.id);
  const urls = [];
  const add = (url, kind, role = 'overview') => { if (url?.startsWith('https:') && !new URL(url).hostname.endsWith('example.com')) urls.push({ url, kind, role }); };
  if (event.id === 'conf-jp-presbyopia-2027') {
    add('https://www.rousi.jp/jps4-summary', 'event'); add('https://www.rousi.jp/jps4', 'event'); add('https://www.rousi.jp/jps4-registration', 'event', 'registration');
  } else if (event.id === 'conf-jp-presbyopia-2028') {
    add('https://www.rousi.jp/jps5-overview', 'event'); add('https://www.rousi.jp/jps5', 'event');
  } else {
    add(event.eventOfficialUrl, 'event');
    if (!event.eventOfficialUrl) add(prior?.candidate?.url || missed?.candidateUrls?.[0], 'event');
  }
  const configured = require('../conference-sources').sources.find(s => s.id === event.id);
  for (const p of configured?.pages || []) add(p.url, 'event', p.role);
  if (!event.isConference) add(event.officialUrl, 'event');
  for (const u of discovery.entries.find(e => e.eventId === event.id)?.indexUrls || []) add(u, 'index');
  add(event.societyUrl || prior?.societyUrlCandidate, 'index'); add(event.sourceUrl, 'index');
  return [...new Map(urls.map(s => [s.url, s])).values()];
}
async function runAudit({ root = path.resolve(__dirname, '..'), getPage = fetchOfficialPage, checkedAt = new Date().toISOString() } = {}) {
  const dataset = loadEvents(root), baseline = hash(dataset.original);
  const auditDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
  const old = readJson(path.join(root, 'reports/event-url-audit-2026-10-07.json'), { records: [] });
  const missing = readJson(path.join(root, 'reports/event-url-missing-audit-2026-10-08.json'), { records: [] });
  const registry = require('../conference-discovery-sources'), cache = new Map(), records = [];
  const fetch = async source => {
    if (!cache.has(source.url)) cache.set(source.url, (async () => {
      const requests = [];
      try {
        const host = new URL(source.url).hostname;
        const doc = await getPage(source, { allowedHosts: [host,host.replace(/^www\./,'')] },
          { timeoutMs: 12000, maxResponseBytes: 5000000, onRequest: r => requests.push(r) });
        if (!requests.length) requests.push({ url: doc.url, httpStatus: doc.httpStatus ?? null });
        return { doc, requests };
      } catch (error) { return { requests, error: error.message, botProtected: error.botProtected === true, fetchState: error.fetchState || 'fetch-failed', url: source.url }; }
    })());
    return cache.get(source.url);
  };
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < dataset.events.length) {
      const event = dataset.events[next++], sources = sourcesFor(event, old, missing, registry), facts = {}, failures = [], documents = [];
      let officialUrl = null;
      for (const source of sources) {
        const result = await fetch(source); documents.push({ url: source.url, kind: source.kind, requests: result.requests, error: result.error || null });
        if (result.error) { failures.push({...result,kind:source.kind}); continue; }
        let parsed;
        try { parsed = extractFacts(result.doc.html, event, result.doc.url, source.kind, source.role); }
        catch (error) { failures.push({url:source.url,error:'extraction-failed: '+error.message}); continue; }
        // Parent congress metadata must not be mistaken for the individual seminar's facts.
        if (!event.isConference && !normalize(text(clean(result.doc.html))).includes(normalize(event.title))) continue;
        if (!parsed.associated) continue;
        for (const [field, fact] of Object.entries(parsed.facts)) if (!facts[field]) facts[field] = fact;
        if (source.kind === 'event' && !officialUrl) officialUrl = event.eventOfficialUrl ||
          (event.id === 'conf-jp-presbyopia-2027' ? 'https://www.rousi.jp/jps4' : event.id === 'conf-jp-presbyopia-2028' ? 'https://www.rousi.jp/jps5' : source.url);
        // Follow explicit same-site overview/abstract/registration links, never synthesize year URLs.
        if (source.kind === 'event' && source.role === 'overview') {
          for (const m of result.doc.html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
            const label = text(m[2]) + ' ' + [...m[2].matchAll(/alt=["']([^"']+)["']/gi)].map(x=>x[1]).join(' ');
            if (!/開催概要|学会概要|演題募集|演題登録|参加登録|Overview|General Information|Registration|Abstract Submission/i.test(label)) continue;
            let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), result.doc.url); } catch { continue; }
            if (u.protocol !== 'https:' || u.hostname !== new URL(source.url).hostname || /\.(pdf|zip)$/i.test(u.pathname)) continue;
            const base = new URL(source.url), prefix = base.pathname.replace(/index\.html?$/i, '').replace(/\/$/, '');
            if (base.search || prefix === '' && !/20\d{2}/.test(base.hostname)) continue; // shared portals/query IDs require explicit per-edition sources
            if (prefix && !u.pathname.startsWith(prefix + '/') && !u.pathname.startsWith(prefix + '-')) continue;
            const linkedYears = [...u.pathname.matchAll(/20\d{2}/g)].map(m=>Number(m[0]));
            const sourceYears = [...(base.hostname + base.pathname).matchAll(/20\d{2}/g)].map(m=>Number(m[0]));
            if (linkedYears.some(y=>sourceYears.length && !sourceYears.includes(y))) continue;
            if (sources.length < 9 && !sources.some(s => s.url === u.href)) sources.splice(sources.indexOf(source) + 1, 0,
              { url: u.href, kind: 'event', role: /演題|Abstract/i.test(label) ? 'abstract' : /参加|Registration/i.test(label) ? 'registration' : 'detail' });
          }
        }
      }
      for (const observation of require('../metadata-audit-observations').filter(o=>o.eventId===event.id && o.checkedOn===auditDay)) {
        for (const [field,value] of Object.entries(observation.facts)) {
          // This is a separately opened official page, not a third-party/search excerpt.
          // Explicit source observations correct limited HTML extraction (e.g. retrospective menus).
          facts[field]={value,url:observation.url,evidence:observation.evidence,confidence:0.97,method:'opened-official-page-observation',checkedOn:observation.checkedOn};
        }
        if (!documents.some(d=>d.url===observation.url)) documents.push({url:observation.url,kind:'official-observation',requests:[],error:null,checkedOn:observation.checkedOn});
      }
      const record = compareEvent(event, facts, officialUrl, failures);
      record.documents = documents; record.searchQueries = [`${event.title} ${get(event, 'year')} 公式 開催概要 演題募集 参加登録`];
      record.sourceCoverage = sources.map(s => s.url);
      records.push(record);
      console.log(`${records.length}/${dataset.events.length} ${event.id}: ${record.category}`);
    }
  }));
  records.sort((a, b) => dataset.events.findIndex(e => e.id === a.eventId) - dataset.events.findIndex(e => e.id === b.eventId));
  if (hash(fs.readFileSync(dataset.file, 'utf8')) !== baseline) throw new Error('events.js changed during audit');
  return finalizeAudit({root,records,checkedAt});
}
function finalizeAudit({root,records,checkedAt}) {
  const dataset=loadEvents(root);
  if(records.length!==dataset.events.length||new Set(records.map(r=>r.eventId)).size!==dataset.events.length||records.some(r=>JSON.stringify(r.currentSnapshot)!==JSON.stringify(dataset.events.find(e=>e.id===r.eventId))))
    throw new Error('Incomplete coverage or dataset changed since audit');
  for(const record of records){
    const search=require('../metadata-audit-observations').searchChecks[record.eventId];
    const auditDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(checkedAt));
    if(search?.checkedOn===auditDay && record.documents.length===0 && record.differences.length===0){record.category='not-found';record.reason='今回の名称・年検索と登録情報の確認範囲で、公式開催情報を確認できない。不存在の断定や検索結果からの開催情報確定は行わない。';
      record.searchQueries=[search.query];record.externalSearchCheck=search;}
    if(record.category==='bot-protected-official-candidate'&&!record.officialUrl){record.officialUrl=record.failures.find(f=>f.kind==='event')?.url||null;record.officialUrlStatus='candidate-body-unavailable';}
    if(record.eventId==='oph-014'){
      record.notes=['開催概要の国内学会単独会期は2027年4月23日。WGCとの合同会期は4月20～23日。カードがどちらの範囲を表すか確認してから日程を承認する。公式ご挨拶：https://site2.convention.co.jp/jgs2027/greeting/'];
      const date=record.comparisons.find(c=>c.field==='date');if(date)date.note='単独会期と合同会期の差。誤情報とは即断しない。';
    }
  }
  const summary = Object.fromEntries(CATEGORIES.map(c => [c, records.filter(r => r.category === c).length]));
  const report = { version: 1, checkedAt, total: records.length, summary, priorityCounts: Object.fromEntries(['高', '中', '低'].map(p => [p, records.filter(r => r.priority === p).length])),
    limitations: ['verifiedは主要項目の照合で、uncheckedFieldsにある項目の正しさを保証しない。', '取得失敗／未抽出はnot-foundやURL不存在と同義ではない。', '画像だけにある情報、未公開の将来開催回、個別共催セミナーは人手確認が必要。', '前回URL監査は探索入口だけに使用。値の根拠は取得した公式本文と出典付きの公式ページ閲覧観察。第三者検索結果から開催情報を確定しない。', 'metadata-audit-observations.jsは2026-10-09の一次情報観察。将来の再監査では確認日と内容を再確認する。'], records };
  writeJson(path.join(root, 'reports/event-metadata-audit-2026-10-09.json'), report);
  const entries = records.map(r => {
    const changes = Object.fromEntries(r.differences.filter(c => !['edition', 'year'].includes(c.field) && c.confidence >= 0.95).map(c => [c.field, c.official]));
    return { eventId: r.eventId, field: Object.keys(changes).length ? 'eventMetadata' : null,
      oldValue: r.currentSnapshot, value: Object.keys(changes).length ? changes : null, reason: 'metadata-audit-' + r.category,
      confidence: r.confidence, url: r.officialUrl || r.documents.find(d => !d.error)?.url || r.documents[0]?.url || null,
      evidence: r.reason, audit: r, requiresHumanApproval: true, reviewSnapshot: r.currentSnapshot,
      method: 'official-metadata-audit', priority: r.priority };
  });
  const queueFile = path.join(root, 'reports/auto-update-review.json');
  const previous=readJson(queueFile,{version:1,items:[]});
  for(const item of previous.items) if(item.method==='official-metadata-audit' && item.status==='needs-review')
    Object.assign(item,{status:'superseded',resolution:'新しい全件監査へ更新。以前の抽出・判定は履歴として保持。'});
  const queue=mergeReview(previous,entries,checkedAt);
  for(const entry of entries){const id=hash(JSON.stringify([entry.eventId,entry.field,entry.value,entry.reason,entry.url]));const item=queue.items.find(i=>i.id===id);
    Object.assign(item,entry,{status:'needs-review',lastSeen:checkedAt});}
  writeJson(queueFile,queue);
  console.log(JSON.stringify({ total: report.total, summary, priorityCounts: report.priorityCounts }, null, 2));
  return report;
}
if (require.main === module) runAudit().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { runAudit, finalizeAudit, extractFacts, compareEvent, CATEGORIES, FIELDS };
