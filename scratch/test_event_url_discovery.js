// Reproducible HTTP fixtures and real pipeline persistence; no network or production data writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverMissingEventUrls, identity, checkIdentity } = require('../scripts/auto-updater/discovery');
const { fetchOfficialPage } = require('../scripts/auto-updater/fetch');
const { loadEvents, mergeReview } = require('../scripts/auto-updater/storage');
const { runUpdater } = require('../scripts/auto-updater/pipeline');
const model = require('../review-model');
const registry = require('../conference-sources');
const root = path.resolve(__dirname, '..');
const index = 'https://society.test/meetings/';
const eventUrl = 'https://convention.test/2027/';
const event = { id: 'test', title: '第38回日本緑内障学会', date: '2027-04-20', endDate: '2027-04-23',
  eventType: '国内学会', isConference: true };
const html = body => '<html><body>' + body + '</body></html>';
const indexHtml = (urls = [eventUrl]) => html('<h2>第38回日本緑内障学会 2027</h2>' + urls.map(u => `<a href="${u}">第38回日本緑内障学会 2027</a>`).join(''));
const meetingHtml = (year = 2027, edition = 38, name = '日本緑内障学会') => html(`<title>第${edition}回${name}</title><h1>第${edition}回${name}</h1><dl><dt>会期</dt><dd>${year}年4月23日</dd></dl>`);
const settings = { enabled: true, allowedEventHosts: ['convention.test', 'society.test'], maxPagesPerEvent: 4, maxLinksPerIndex: 6,
  entries: [{ eventId: event.id, indexUrls: [index] }] };
const config = { ...registry, sources: [], discovery: settings };
function provider(pages, calls = []) {
  return (page, source, limits) => fetchOfficialPage(page, source, limits, async url => {
    calls.push(url);
    const page = pages[url];
    if (page instanceof Error) throw page;
    if (typeof page === 'object') return new Response(page.body || '', { status: page.status, headers: page.headers });
    return new Response(page || 'not found', { status: page ? 200 : 404, headers: { 'content-type': 'text/html' } });
  });
}
async function discover(pages, overrides = {}) {
  return discoverMissingEventUrls({ events: [event], config, getPage: provider(pages), ...overrides });
}
async function main() {
  const good = await discover({ [index]: indexHtml(), [eventUrl]: meetingHtml() });
  assert.equal(good.review.length, 1);
  assert.equal(good.review[0].reason, 'discovery-single-high-confidence');
  assert.equal(good.review[0].field, 'eventOfficialUrl');
  assert.equal(good.review[0].value, eventUrl);
  assert.ok(model.normalize({ items: good.review })[0].actionable);
  assert.ok(good.records[0].searchQueries[0].includes('2027'));
  assert.ok(good.records[0].searchQueries[0].includes('第38回'));
  assert.deepEqual(good.records[0].requests.map(r => r.httpStatus), [200, 200]);
  assert.equal(event.eventOfficialUrl, undefined);
  for (const [year, edition, name, reason] of [
    [2026, 38, '日本緑内障学会', 'event-url-year-mismatch'],
    [2027, 39, '日本緑内障学会', 'event-url-edition-mismatch'],
    [2027, 38, '別学会', 'discovery-name-mismatch']
  ]) {
    const result = await discover({ [index]: indexHtml(), [eventUrl]: meetingHtml(year, edition, name) });
    assert.equal(result.review[0].reason, reason);
    assert.equal(result.review[0].field, null);
    assert.equal(result.review[0].value, null);
    assert.equal(model.normalize({ items: result.review })[0].actionable, false);
  }
  const unknown = await discover({ [index]: indexHtml(), [eventUrl]: html('<title>第38回日本緑内障学会</title><footer>Copyright 2027</footer>') });
  assert.equal(unknown.review[0].reason, 'event-url-edition-unverified');
  const staleUrl = 'https://convention.test/2026/';
  const stale = await discover({ [index]: indexHtml([staleUrl]), [staleUrl]: meetingHtml() });
  assert.equal(stale.review[0].reason, 'event-url-year-mismatch');
  assert.equal(stale.review[0].field, null);
  const multiple = await discover({ [index]: indexHtml([eventUrl, 'https://convention.test/alternative/2027/']),
    [eventUrl]: meetingHtml(), 'https://convention.test/alternative/2027/': meetingHtml() });
  assert.equal(multiple.review.length, 2);
  assert.ok(multiple.review.every(r => r.reason === 'multiple-candidates' && r.value === null));
  const multipleQueue = mergeReview({ items: [] }, multiple.review, '2026-10-08');
  assert.equal(multipleQueue.items.length, 2);
  assert.notEqual(multipleQueue.items[0].id, multipleQueue.items[1].id);
  const limited = await discover({ [index]: indexHtml([eventUrl, 'https://convention.test/alternative/2027/']), [eventUrl]: meetingHtml() },
    { config: { ...config, discovery: { ...settings, maxPagesPerEvent: 1 } } });
  assert.equal(limited.review.length, 2);
  assert.ok(limited.review.every(r => r.field === null));
  const noPage = await discover({ [index]: html('<p>サイト準備中</p>') });
  assert.equal(noPage.review.length, 0);
  assert.equal(noPage.records[0].reason, 'discovery-dedicated-url-not-found');
  const status = await discover({ [index]: indexHtml(), [eventUrl]: { status: 403 } });
  assert.equal(status.records[0].requests[1].httpStatus, 403);
  assert.equal(status.review[0].reason, 'discovery-fetch-failed');
  const failed = await discover({ [index]: new Error('timeout') });
  assert.equal(failed.records[0].requests[0].httpStatus, null);
  assert.equal(failed.records[0].requests[0].error, 'timeout');
  const redirected = await discover({ [index]: indexHtml(), [eventUrl]: { status: 302, headers: { location: '/final/2027/' } },
    'https://convention.test/final/2027/': meetingHtml() });
  assert.deepEqual(redirected.records[0].requests.map(r => r.httpStatus), [200, 302, 200]);
  assert.equal(redirected.review[0].value, 'https://convention.test/final/2027/');
  const calls = [];
  const untrusted = await discoverMissingEventUrls({ events: [event], config,
    getPage: provider({ [index]: indexHtml(['https://unknown.test/2027/']) }, calls) });
  assert.deepEqual(calls, [index]);
  assert.equal(untrusted.review[0].candidateReason, 'untrusted-domain');
  const redirectedUntrusted = await discover({ [index]: indexHtml(), [eventUrl]: { status: 302, headers: { location: 'https://unknown.test/2027/' } } });
  assert.equal(redirectedUntrusted.review[0].reason, 'discovery-fetch-failed');
  const home = 'https://society.test/';
  const society = await discover({ [index]: indexHtml([home]), [home]: meetingHtml() });
  assert.equal(society.review[0].reason, 'event-url-is-society-homepage');
  const image = await discover({ [index]: indexHtml(), [eventUrl]: html('<title>第38回日本緑内障学会</title><img alt="会期 2027年4月23日">') });
  assert.equal(image.review[0].reason, 'discovery-single-high-confidence');
  const overview = 'https://convention.test/2027/info/';
  const corroborated = await discover({ [index]: indexHtml(),
    [eventUrl]: html(`<title>第38回日本緑内障学会</title><a href="${overview}">開催概要</a>`), [overview]: meetingHtml() });
  assert.equal(corroborated.review[0].value, eventUrl);
  assert.equal(corroborated.review[0].reason, 'discovery-single-high-confidence');
  assert.equal(corroborated.records[0].candidates[0].corroboratingUrl, overview);
  assert.deepEqual(corroborated.records[0].requests.map(r => r.url), [index, eventUrl, overview]);
  const neighbors = await discover({ [index]: html(`<table><tr><td>第38回日本緑内障学会 2027</td><td><a href="${eventUrl}">大会HP</a></td></tr><tr><td>別学会2027</td><td><a href="https://convention.test/other/2027/">第16回日本視野画像学会</a></td></tr></table>`), [eventUrl]: meetingHtml() });
  assert.equal(neighbors.review.length, 1);
  assert.equal(neighbors.review[0].reason, 'discovery-single-high-confidence');
  const directory = 'https://society.test/future/';
  const navigated = await discover({ [index]: html(`<a href="${directory}">学術集会案内</a>`), [directory]: indexHtml(), [eventUrl]: meetingHtml() });
  assert.equal(navigated.review[0].value, eventUrl);
  assert.equal(navigated.records[0].requests.length, 3);
  const unsafe = await discover({ [index]: indexHtml(['javascript:alert(1)', 'https://127.0.0.1/2027/']) });
  assert.equal(unsafe.review.length, 0);
  const blockedCalls = [];
  const blocked = await discover({}, { config: { ...config, discovery: { ...settings,
    entries: [{ eventId: event.id, indexUrls: [index], integrityReview: '開催回の修正が必要' }] } },
    getPage: async () => { blockedCalls.push('fetch'); } });
  assert.equal(blockedCalls.length, 0);
  assert.equal(blocked.review[0].reason, 'discovery-card-integrity-needs-review');
  assert.equal(blocked.review[0].field, null);
  const annual = identity({ ...event, title: 'ARVO 2027 Annual Meeting' });
  assert.equal(checkIdentity('ARVO Annual Meeting 2027', annual).editionMatches, true);
  assert.equal(checkIdentity('ARVO Annual Meeting 2026', annual).editionMatches, false);
  const joint = identity({ ...event, title: '第83回日本弱視斜視学会総会・第52回日本小児眼科学会総会' });
  assert.equal(checkIdentity('第83回日本弱視斜視学会総会・第51回日本小児眼科学会総会 2027', joint).editionMatches, false);
  const queue = mergeReview(mergeReview({ items: [] }, good.review, '2026-10-08'), good.review, '2026-10-09');
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].occurrences, 2);
  const realEvents = loadEvents(root).events;
  const audit = require('../reports/event-url-missing-audit-2026-10-08.json');
  for (const record of audit.records) {
    const current = realEvents.find(e => e.id === record.id);
    for (const field of ['title', 'date', 'endDate', 'venue']) assert.equal(current[field], record[field], `${record.id}: unchanged ${field}`);
    if (record.status === 'needs-review') assert.equal(current.eventOfficialUrl, undefined, `${record.id}: held URL`);
  }
  const callsAlreadySet = [];
  assert.equal((await discoverMissingEventUrls({ events: realEvents.filter(e => e.eventOfficialUrl), config,
    getPage: async () => callsAlreadySet.push('fetch') })).records.length, 0);
  assert.equal(callsAlreadySet.length, 0);
  assert.equal(registry.discovery.entries.filter(e => e.integrityReview).length, 20);

  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'event-discovery-pipeline-'));
  fs.copyFileSync(path.join(root, 'events.js'), path.join(isolated, 'events.js'));
  fs.copyFileSync(path.join(root, 'venues.js'), path.join(isolated, 'venues.js'));
  const original = fs.readFileSync(path.join(isolated, 'events.js'), 'utf8');
  const blank = realEvents.find(e => e.id === 'conf-jp-lowvision-2027');
  const source = registry.sources[0];
  const pipelineConfig = { ...registry, sources: [source], discovery: { ...settings,
    entries: [{ eventId: blank.id, indexUrls: [index] }] } };
  const getPage = async (page, source, limits) => {
    if (page.role.startsWith('discovery')) return provider({
      [index]: html(`<h2>${blank.title} 2027</h2><a href="${eventUrl}">${blank.title} 2027</a>`),
      [eventUrl]: html(`<title>${blank.title}</title><dl><dt>会期</dt><dd>2027年5月22日</dd></dl>`)
    })(page, source, limits);
    return { ...page, html: html('<title>error</title>') };
  };
  for (const apply of [false, true]) {
    const result = await runUpdater({ root: isolated, config: pipelineConfig, getPage, apply, enforceGit: false });
    assert.ok(!result.autoChanges.some(c => c.field === 'eventOfficialUrl'));
    assert.ok(result.needsReview.some(c => c.eventId === blank.id && c.reason === 'discovery-single-high-confidence'));
    assert.equal(fs.readFileSync(path.join(isolated, 'events.js'), 'utf8'), original);
    const persisted = JSON.parse(fs.readFileSync(path.join(isolated, 'reports/auto-update-review.json'), 'utf8'));
    assert.ok(persisted.items.some(c => c.eventId === blank.id && c.value === eventUrl));
    const report = JSON.parse(fs.readFileSync(path.join(isolated, 'reports/auto-update-report.json'), 'utf8'));
    assert.ok(report.discovery.records.find(r => r.eventId === blank.id).requests.every(r => r.httpStatus === 200));
  }
  console.log('PASS: discovery identity, annual/joint editions, single/multiple/absent candidates, mismatches, HTTP/redirect/network logs, trust boundaries, 20 integrity holds, review persistence and zero URL auto-apply in dry-run/apply');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
