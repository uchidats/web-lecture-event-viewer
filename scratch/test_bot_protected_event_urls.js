const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { discoverMissingEventUrls } = require('../scripts/auto-updater/discovery');
const { fetchOfficialPage } = require('../scripts/auto-updater/fetch');
const { loadEvents, mergeReview } = require('../scripts/auto-updater/storage');
const { applyReviewedEventUrls } = require('../scripts/apply-reviewed-event-urls');
const model = require('../review-model');
const registry = require('../conference-sources');
const root = path.resolve(__dirname, '..');
const target = 'https://annualmeeting.ascrs.org/';
const source = 'https://ascrs.confex.com/ascrs/27am/cfp.cgi';
const event = loadEvents(root).events.find(e => e.id === 'conf-int-ascrs-2027');
const original = fs.readFileSync(path.join(root, 'events.js'), 'utf8');
const alternate = '<html><title>Call for Submissions</title><a href="' + target + '">Main Website</a><h2>2027 ASCRS ASOA Annual Meeting</h2><h3>April 2-5, 2027, San Diego, CA</h3></html>';
const checkedAt = '2026-10-08T03:00:00Z';
function getPage(status, body, alternateHtml = alternate) {
  return (page, s, limits) => fetchOfficialPage(page, s, limits, async url => new Response(url === source ? alternateHtml : body,
    { status: url === source ? 200 : status, headers: { 'content-type': 'text/html' } }));
}
async function discover(status, body, overrides = {}) {
  return discoverMissingEventUrls({ events: [event], config: registry, checkedAt,
    getPage: getPage(status, body), ...overrides });
}
async function main() {
  let latest;
  for (const [status, body, protectedFlag] of [[403, '<html><title>Just a moment...</title>cf-chl-test</html>', true],
    [200, '<html><title>Just a moment...</title>Verify you are human</html>', true], [403, '<html>Access denied</html>', false]]) {
    latest = await discover(status, body);
    const item = latest.review.find(i => i.reason === 'bot-protected-official-candidate');
    assert.ok(item, JSON.stringify(latest));
    assert.equal(item.value, target);
    assert.equal(item.field, 'eventOfficialUrl');
    assert.equal(item.fetchFailure.httpStatus, status);
    assert.equal(item.fetchFailure.botProtected, protectedFlag);
    for (const k of ['officialSocietyDomain', 'yearMatches', 'nameMatches', 'editionMatches', 'cityMatches']) assert.equal(item.checks[k], true, k);
    assert.equal(item.checks.targetBodyVerified, false);
    assert.ok(item.officialEvidence.some(e => e.url === source));
    assert.equal(event.eventOfficialUrl, undefined);
  }
  const notFound = await discover(404, '<html>Not found</html>');
  assert.equal(notFound.review[0].reason, 'discovery-url-not-found-response');
  assert.equal(notFound.review[0].value, null);
  const entry = registry.discovery.entries.find(e => e.eventId === event.id);
  const isolatedConfig = e => ({ ...registry, discovery: { ...registry.discovery, entries: [e] } });
  const noDomain = await discover(403, '<html>denied</html>', { config: isolatedConfig({ ...entry, officialSocietyDomains: [] }) });
  assert.ok(!noDomain.review.some(e => e.reason === 'bot-protected-official-candidate'));
  const noSnapshot = { ...entry, verifiedEvidence: [] };
  const conflicting = await discover(403, '<html>denied</html>', {
    getPage: getPage(403, '<html>denied</html>', alternate.replaceAll('2027', '2026')) });
  assert.ok(!conflicting.review.some(e => e.reason === 'bot-protected-official-candidate'));
  for (const bad of ['2026 ASCRS ASOA Annual Meeting', '2027 Wrong Society Annual Meeting']) {
    const result = await discover(403, '<html>denied</html>', { config: isolatedConfig(noSnapshot),
      getPage: getPage(403, '<html>denied</html>', alternate.replace('2027 ASCRS ASOA Annual Meeting', bad).replace('April 2-5, 2027', 'April 2-5, 2026')) });
    assert.ok(!result.review.some(e => e.reason === 'bot-protected-official-candidate'));
  }
  const expired = await discover(403, '<html>denied</html>', { config: isolatedConfig(entry), checkedAt: '2027-02-01T00:00:00Z',
    getPage: async () => { throw new Error('timeout'); } });
  assert.equal(expired.records[0].candidates.length, 0);
  const network = await discover(403, '', { getPage: async page => {
    if (page.url === source) return { ...page, html: alternate, httpStatus: 200 };
    throw new Error('timeout');
  } });
  assert.ok(network.review.some(e => e.reason === 'bot-protected-official-candidate' && e.fetchFailure.httpStatus === null));
  const wrongCity = await discover(403, '<html>denied</html>', { config: isolatedConfig(noSnapshot),
    getPage: getPage(403, '<html>denied</html>', alternate.replace('San Diego', 'Boston')) });
  assert.equal(wrongCity.review[0].checks.cityMatches, false);
  assert.equal(wrongCity.review[0].field, null);
  const missingLink = await discover(403, '', { config: isolatedConfig(noSnapshot),
    getPage: getPage(403, '<html>denied</html>', alternate.replace(target, 'https://ascrs.org/')) });
  assert.ok(!missingLink.review.some(e => e.reason === 'bot-protected-official-candidate'));

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'human-event-url-test-'));
  fs.writeFileSync(path.join(temp, 'events.js'), original);
  fs.mkdirSync(path.join(temp, 'reports'));
  const queue = mergeReview({ items: [] }, latest.review, checkedAt);
  fs.writeFileSync(path.join(temp, 'reports/auto-update-review.json'), JSON.stringify(queue));
  const items = model.normalize(queue), memory = new Map();
  const store = model.createStore({ getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) });
  assert.throws(() => applyReviewedEventUrls({ root: temp, approvals: store.exportEventUrlApprovals(items, 'human-reviewer'), apply: true }), /approval export/);
  assert.equal(fs.readFileSync(path.join(temp, 'events.js'), 'utf8'), original);
  const item = items.find(i => i.reason === 'bot-protected-official-candidate');
  store.decide(item, 'approved', { reviewerId: 'human-reviewer', items });
  const approvals = store.exportEventUrlApprovals(items, 'human-reviewer');
  assert.equal(approvals.decisions.length, 1);
  assert.equal(applyReviewedEventUrls({ root: temp, approvals }).changes[0].value, target);
  assert.equal(fs.readFileSync(path.join(temp, 'events.js'), 'utf8'), original);
  const stale = structuredClone(approvals); stale.decisions[0].signature = 'stale';
  assert.throws(() => applyReviewedEventUrls({ root: temp, approvals: stale, apply: true }), /stale/);
  applyReviewedEventUrls({ root: temp, approvals, apply: true });
  assert.equal(loadEvents(temp).events.find(e => e.id === event.id).eventOfficialUrl, target);
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp, 'reports/auto-update-review.json'))).items.find(i => i.id === item.id).status, 'human-applied');
  assert.equal(fs.readFileSync(path.join(root, 'events.js'), 'utf8'), original);
  console.log('PASS: ASCRS 2027 bot 403/200, non-bot 403, alternate official evidence, domain/year/name/city/link checks, 404 separation, snapshot expiry, network failure, explicit human approval export/apply and no production mutation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
