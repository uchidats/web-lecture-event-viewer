const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const config = require('../conference-sources');
const audit = require('../reports/event-url-audit-2026-10-07.json');
const additions = require('../reports/event-url-missing-audit-2026-10-08.json').records.filter(record => record.proposedEventOfficialUrl);
const corrections = require('../reports/event-metadata-high-priority-fixes-2026-10-09.json').results.filter(r=>r.status==='corrected');
const { loadEvents, mergeReview } = require('../scripts/auto-updater/storage');
const { assess, applyChanges } = require('../scripts/auto-updater/policy');
const { extractOfficialHtml } = require('../scripts/auto-updater/extract');
const { eventSourceUrl } = require('../scripts/auto-updater/event-urls');
const { runUpdater } = require('../scripts/auto-updater/pipeline');
const { trustedUrl, fetchOfficialPage } = require('../scripts/auto-updater/fetch');
const model = require('../review-model');
const root = path.resolve(__dirname, '..');

async function main() {
  const events = loadEvents(root).events;
  const conferences = events.filter(e => e.isConference);
  const approved = audit.records.filter(record => record.proposedEventOfficialUrl);
  assert.equal(approved.length, 31);
  assert.equal(conferences.filter(e => e.eventOfficialUrl).length, 46);
  assert.equal(additions.length, 5);
  for (const record of additions) assert.equal(events.find(e => e.id === record.id).eventOfficialUrl, record.proposedEventOfficialUrl);
  assert.equal(conferences.filter(e => e.societyUrl).length, 15);
  for (const record of audit.records) {
    const event = events.find(e => e.id === record.id);
    if(record.id==='oph-003'){assert.equal(event,undefined,'Erroneous historical demo record removed');continue;}
    const correction=corrections.find(r=>r.eventId===event.id);
    const expected=(field,old)=>correction?.changes.find(c=>c.field===field)?.after??old;
    assert.equal(event.officialUrl || null, expected('officialUrl',record.currentOfficialUrl)||null, `${event.id}: legacy URL`);
    assert.equal(event.title, expected('title',record.title));
    assert.equal(Number(event.date.slice(0, 4)), Number(String(expected('date',record.year)).slice(0,4)));
    if (record.proposedEventOfficialUrl) {
      assert.equal(event.eventOfficialUrl, record.proposedEventOfficialUrl);
      assert.equal(record.candidate.verification, 'confirmed');
      assert.ok(Object.values(record.candidate.checks).every(value => value === true));
      assert.notEqual(event.eventOfficialUrl, event.societyUrl);
    } else if (!additions.some(addition => addition.id === record.id)) {
      assert.equal(event.eventOfficialUrl, expected('eventOfficialUrl',undefined), `${event.id}: held event`);
      assert.equal(event.societyUrl, undefined, `${event.id}: held society`);
    }
  }
  assert.equal(approved.filter(record => !record.currentOfficialUrl).length, 11);
  assert.equal(audit.records.filter(record => !record.currentOfficialUrl && !record.proposedEventOfficialUrl).length, 41);
  for (const id of ['conf-int-aao-2027', 'conf-int-aao-2028', 'conf-int-apvrs-2028']) assert.equal(events.find(e => e.id === id).eventOfficialUrl, undefined);
  assert.equal(events.find(e=>e.id==='oph-010').eventOfficialUrl,'https://apacrs2026.org/');

  const context = vm.createContext({ assert, console, setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener: () => {} } });
  for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  vm.runInContext(`
    for (const event of sampleEvents) {
      const html = createEventCardHtml(event);
      const title = html.match(/<h3 class="card-title">([\\s\\S]*?)<\\/h3>/)[1];
      const before = {...event}; delete before.eventOfficialUrl; delete before.societyUrl;
      const maskTitle = value => value.replace(/<h3 class="card-title">[\\s\\S]*?<\\/h3>/, '<h3 class="card-title"></h3>');
      assert.equal(maskTitle(html), maskTitle(createEventCardHtml(before)), event.id + ': other card content');
      if (event.isConference && event.eventOfficialUrl) {
        assert.ok(title.includes('href="' + escapeHtml(event.eventOfficialUrl) + '"'));
        assert.ok(title.includes('target="_blank" rel="noopener noreferrer"'));
      } else assert.equal(title, escapeHtml(event.title));
    }
    const template = sampleEvents.find(e => e.isConference);
    const fallback = {...template, eventOfficialUrl: undefined, societyUrl: 'https://example.com/society', officialUrl: 'https://example.com/legacy'};
    assert.ok(!createEventCardHtml(fallback).match(/<h3 class="card-title">([\\s\\S]*?)<\\/h3>/)[1].includes('<a'));
    const escaped = {...template, title: '<Title> & Name', eventOfficialUrl: 'https://example.com/2026?a=1&b=2'};
    assert.ok(createEventCardHtml(escaped).includes('href="https://example.com/2026?a=1&amp;b=2"'));
    assert.ok(createEventCardHtml(escaped).includes('&lt;Title&gt; &amp; Name</a>'));
  `, context);

  const source = config.sources.find(s => s.id === 'oph-011');
  const event = events.find(e => e.id === source.id);
  const candidate = (value = event.eventOfficialUrl, overrides = {}) => ({
    field: 'eventOfficialUrl', value, url: source.pages[0].url, confidence: 0.99, method: 'pinned-event-url',
    evidence: source.name + ' / 2027-04-15', eventIdentityMatched: true, eventPageKind: 'event', eventYears: [2027], ...overrides
  });
  const decide = (candidates, current = event, registry = source, issues = []) => assess(current, registry, candidates, issues, config.defaults, { today: '2026-10-07' });
  assert.equal(decide([candidate()]).review.length, 0);
  const moved = candidate('https://convention.jtbcom.co.jp/131jos-new/index.html');
  assert.equal(decide([moved]).accepted.length, 0);
  assert.equal(decide([moved]).review[0].reason, 'event-url-change-needs-review');
  assert.equal(decide([candidate()], { ...event, eventOfficialUrl: undefined }).review[0].reason, 'event-url-change-needs-review');
  assert.equal(decide([candidate(undefined, { eventYears: [2026] })]).review[0].reason, 'event-url-year-mismatch');
  assert.equal(decide([candidate(undefined, { eventTitleYears: [2026] })]).review[0].reason, 'event-url-year-mismatch');
  assert.equal(decide([candidate('https://convention.jtbcom.co.jp/2026/131jos/')]).review[0].reason, 'event-url-year-mismatch');
  assert.equal(decide([candidate('https://convention.jtbcom.co.jp/132jos/', { eventIdentityMatched: false })]).review[0].reason, 'event-url-edition-mismatch');
  assert.equal(decide([candidate(source.societyUrl)]).review[0].reason, 'event-url-is-society-homepage');
  assert.equal(decide([candidate(undefined, { eventYears: [] })]).review[0].reason, 'event-url-edition-unverified');
  const multiple = decide([candidate(), moved]);
  assert.equal(multiple.accepted.length, 0);
  assert.equal(multiple.review.filter(r => r.reason === 'multiple-candidates').length, 2);
  assert.throws(() => applyChanges(events, [{ ...moved, eventId: event.id }]), /manual review/);
  const society = { field: 'societyUrl', value: source.societyUrl, url: source.pages[0].url,
    confidence: 0.99, method: 'pinned-society-url', evidence: '日本眼科学会' };
  assert.equal(decide([society]).review.length, 0);
  assert.equal(decide([{ ...society, value: 'https://www.nichigan.or.jp/about/' }]).review[0].reason, 'society-url-change-needs-review');
  assert.equal(decide([{ ...society, value: event.eventOfficialUrl }]).review[0].reason, 'untrusted-society-domain');
  assert.throws(() => applyChanges(events, [{ ...society, eventId: event.id, value: 'https://www.nichigan.or.jp/about/' }]), /manual review/);
  const legacy = candidate('https://convention.jtbcom.co.jp/legacy-change/', { field: 'officialUrl' });
  assert.equal(decide([legacy]).review[0].reason, 'legacy-official-url-needs-review');
  assert.throws(() => applyChanges(events, [{ ...legacy, eventId: event.id }]), /manual review/);

  const domesticHtml = (title = source.name, date = '2027年4月15日～18日') => `<html><title>${title}</title><dl><dt>会期</dt><dd>${date}</dd><dt>会場</dt><dd>会場未定</dd></dl><a href="${source.societyUrl}">日本眼科学会</a></html>`;
  const extract = html => extractOfficialHtml({ role: 'overview', url: source.pages[0].url, html }, source);
  const good = extract(domesticHtml());
  assert.ok(!good.candidates.some(c => c.field === 'officialUrl'));
  assert.deepEqual(good.candidates.find(c => c.field === 'eventOfficialUrl').eventYears, [2027]);
  assert.equal(good.candidates.find(c => c.field === 'societyUrl').value, source.societyUrl);
  const canonicalChanged = extract(domesticHtml().replace('</title>', '</title><link href="https://convention.jtbcom.co.jp/131jos-new/index.html" rel="canonical">'));
  assert.ok(canonicalChanged.candidates.some(c => c.field === 'eventOfficialUrl' && c.value === moved.value));
  assert.ok(decide(canonicalChanged.candidates).review.some(c => c.field === 'eventOfficialUrl' && c.reason === 'multiple-candidates'));
  const canonicalBeforeYear = extract(domesticHtml().replace('</title>', '</title><meta property="og:url" content="https://convention.jtbcom.co.jp/2026/131jos/">'));
  assert.ok(canonicalBeforeYear.candidates.some(c => c.field === 'eventOfficialUrl' && c.value.includes('/2026/')));
  const wrongYear = extract(domesticHtml(source.name, '2026年4月15日～18日'));
  assert.ok(decide(wrongYear.candidates, event, source, wrongYear.issues).review.some(r => r.field === 'eventOfficialUrl' && r.reason === 'event-url-year-mismatch'));
  const wrongTitle = extract(domesticHtml('第130回日本眼科学会総会'));
  assert.ok(decide(wrongTitle.candidates, event, source, wrongTitle.issues).review.some(r => r.field === 'eventOfficialUrl' && r.reason === 'event-url-edition-mismatch'));
  const homepage = extractOfficialHtml({ role: 'overview', url: source.societyUrl, html: '<html><title>日本眼科学会</title></html>' }, source);
  assert.ok(decide(homepage.candidates, event, source, homepage.issues).review.some(r => r.reason === 'event-url-is-society-homepage'));
  const societyPage = extractOfficialHtml({ role: 'society', url: source.societyUrl, html: '<html><title>日本眼科学会</title></html>' }, source);
  assert.deepEqual(societyPage.candidates.map(c => c.field), ['societyUrl']);
  assert.equal(decide(societyPage.candidates).review.length, 0);
  assert.equal(trustedUrl(source.societyUrl, source), false);
  assert.equal(trustedUrl(source.societyUrl, source, 'society'), true);
  const societyResponse = await fetchOfficialPage({ role: 'society', url: source.societyUrl }, source, config.defaults,
    async () => new Response('<html><title>日本眼科学会</title></html>', { headers: { 'content-type': 'text/html' } }));
  assert.equal(societyResponse.role, 'society');
  assert.equal(eventSourceUrl({ officialUrl: source.officialUrl }), source.officialUrl, 'legacy source config compatibility');

  const international = { ...source, id: 'international-test', name: 'Annual Meeting 2027', identity: ['Annual Meeting'],
    year: 2027, eventOfficialUrl: 'https://meeting.example/2027/', societyUrl: 'https://society.example/',
    allowedHosts: ['meeting.example'], allowedSocietyHosts: ['society.example'], societyIdentity: ['Society'] };
  const foreignEvent = { ...event, id: international.id, eventOfficialUrl: international.eventOfficialUrl, societyUrl: international.societyUrl };
  const foreignHtml = year => `<html><title>Annual Meeting ${year}</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: 'Annual Meeting ' + year,
    startDate: year + '-04-15', endDate: year + '-04-18', url: international.eventOfficialUrl,
    organizer: { name: 'Society', url: international.societyUrl } })}</script></html>`;
  const foreignGood = extractOfficialHtml({ role: 'overview', url: international.eventOfficialUrl, html: foreignHtml(2027) }, international);
  assert.deepEqual(foreignGood.candidates.find(c => c.field === 'eventOfficialUrl').eventYears, [2027]);
  assert.ok(foreignGood.candidates.some(c => c.field === 'societyUrl'));
  const foreignBad = extractOfficialHtml({ role: 'overview', url: international.eventOfficialUrl, html: foreignHtml(2026) }, international);
  assert.ok(decide(foreignBad.candidates, foreignEvent, international, foreignBad.issues).review.some(c => c.field === 'eventOfficialUrl' && c.reason === 'event-url-year-mismatch'));

  const queue = mergeReview({ version: 1, items: [] }, multiple.review.map(r => ({ ...r, eventId: event.id })), '2026-10-07T00:00:00Z');
  const normalized = model.normalize(queue);
  assert.equal(normalized.length, 2);
  assert.ok(normalized.every(r => r.riskLevel === 'high' && r.actionable));
  assert.ok(model.fieldLabels.eventOfficialUrl && model.fieldLabels.societyUrl);
  assert.ok(model.reasonLabels['event-url-year-mismatch']);
  assert.equal(model.normalize({ items: [{ ...queue.items[0], value: 'javascript:alert(1)' }] })[0].actionable, false);
  const memory = new Map();
  const store = model.createStore({ getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) });
  store.decide(normalized[0], 'approved', { reviewerId: 'test', items: normalized });
  assert.throws(() => store.decide(normalized[1], 'approved', { reviewerId: 'test', items: normalized }), /別候補/);
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'event-url-policy-test-'));
  const original = fs.readFileSync(path.join(root, 'events.js'), 'utf8');
  fs.writeFileSync(path.join(isolated, 'events.js'), original);
  fs.copyFileSync(path.join(root, 'venues.js'), path.join(isolated, 'venues.js'));
  const pipeline = await runUpdater({ root: isolated, config: { ...config, discovery: { enabled: false }, sources: [source] }, checkedAt: '2026-10-07T00:00:00Z',
    getPage: async page => ({ ...page, html: page.role === 'overview' ? domesticHtml().replace('</title>', '</title><link rel="canonical" href="' + moved.value + '">') :
      fs.readFileSync(path.join(root, 'scratch/fixtures/auto-updater', source.id + '-' + page.role + '.html'), 'utf8') }) });
  assert.ok(!pipeline.autoChanges.some(change => ['officialUrl', 'eventOfficialUrl', 'societyUrl'].includes(change.field)));
  const persisted = JSON.parse(fs.readFileSync(path.join(isolated, 'reports/auto-update-review.json'), 'utf8'));
  assert.ok(persisted.items.some(item => item.field === 'eventOfficialUrl' && item.reason === 'multiple-candidates' && item.value === moved.value && item.oldValue === event.eventOfficialUrl));
  assert.equal(fs.readFileSync(path.join(isolated, 'events.js'), 'utf8'), original);
  assert.equal(fs.readFileSync(path.join(root, 'events.js'), 'utf8'), original);
  console.log('PASS: 46 event URLs including official 2026 additions / 15 society URLs, held titles unlinked, no fallback, year/edition/multiple reviews and role isolation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
