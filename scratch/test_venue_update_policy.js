const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../conference-sources');
const { extractOfficialHtml } = require('../scripts/auto-updater/extract');
const { assess, applyChanges } = require('../scripts/auto-updater/policy');
const { loadEvents } = require('../scripts/auto-updater/storage');
const { runUpdater } = require('../scripts/auto-updater/pipeline');
const root = path.resolve(__dirname, '..');

async function main() {
  const dataset = loadEvents(root);
  const context = vm.createContext({ document: { getElementById: () => null, addEventListener: () => {} }, console });
  for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  const evaluate = code => vm.runInContext(code, context);
  const fuji = dataset.events.find(e => e.id === 'conf-int-fujiretina-2027');
  assert.equal(fuji.date, '2027-03-26'); assert.equal(fuji.endDate, '2027-03-28');
  assert.equal(fuji.venue, '虎ノ門ヒルズフォーラム'); assert.equal(fuji.venueId, 'toranomon-hills-forum');
  const venue = JSON.parse(evaluate(`JSON.stringify(getEventVenue(${JSON.stringify(fuji)}))`));
  assert.equal(venue.name, fuji.venue); assert.equal(venue.timeZone, 'Asia/Tokyo');
  const card = evaluate(`createEventCardHtml(${JSON.stringify(fuji)})`);
  assert.ok(card.includes(fuji.venue)); assert.ok(!card.includes('東京国際フォーラム'));
  assert.ok(card.includes(encodeURIComponent(venue.googleMaps.searchQuery)));
  const log = JSON.parse(fs.readFileSync(path.join(root, 'reports/venue-corrections.json'))).changes.find(c => c.eventId === fuji.id);
  assert.equal(log.newValue, fuji.venue); assert.equal(log.newVenueId, fuji.venueId); assert.ok(log.sourceUrl);

  const source = registry.sources.find(s => s.id === 'conf-jp-surgery-2027');
  const event = dataset.events.find(e => e.id === source.id);
  const document = {role: 'overview', url: source.pages[0].url,
    html: `<html><title>${source.name}</title><dl><dt>会場</dt><dd>虎ノ門ヒルズフォーラム</dd></dl></html>`};
  const extracted = extractOfficialHtml(document, source);
  const candidate = extracted.candidates.find(c => c.field === 'venue');
  assert.equal(candidate.venueEvidence, 'labeled-venue'); assert.equal(candidate.sourceRole, 'overview');
  const options = {today: '2026-10-05', venues: {}};
  const decide = (target, candidates, issues = []) => assess(target, source, candidates, issues, registry.defaults, options);
  const missing = {...event, venue: '未定', cityCountry: '東京都 / 日本'};
  delete missing.venueId;
  const accepted = decide(missing, [candidate]).accepted;
  assert.equal(accepted.length, 1); assert.equal(accepted[0].sourceUrl, document.url);
  assert.equal(applyChanges([missing], [{...accepted[0], eventId: event.id}])[0].venue, candidate.value);
  const city = {field: 'city', value: '東京都', confidence: .98, method: 'labeled-html', url: document.url};
  const existing = {...missing, venue: '東京国際フォーラム', cityCountry: '東京都 / 日本'};
  const changed = decide(existing, [candidate, city]);
  assert.equal(changed.accepted.length, 0);
  assert.ok(changed.review.some(r => r.reason === 'existing-venue-change-needs-review' && r.url === document.url));
  assert.equal(decide({...existing, venue: '海外交流会館'}, [candidate]).accepted.length, 0);
  assert.equal(decide({...missing, venue: candidate.value}, [candidate]).accepted.length, 0);
  assert.equal(assess({...missing, venueId: 'old'}, source, [candidate], [], registry.defaults,
    { ...options, venues: {old: {name: '東京国際フォーラム'}} }).accepted.length, 0);
  for (const unsafe of [
    {...candidate, venueEvidence: null}, {...candidate, evidence: ''},
    {...candidate, evidence: '東京国際フォーラム'}, {...candidate, method: 'ai', confidence: .99},
    {...candidate, sourceRole: 'abstract'}, {...candidate, url: 'https://evil.example/'},
    {...candidate, confidence: .8}
  ]) assert.equal(decide(missing, [unsafe]).accepted.length, 0);
  assert.throws(() => applyChanges([missing], [{...accepted[0], eventId:event.id, sourceUrl:null}]), /source URL/);
  assert.throws(() => applyChanges([existing], [{...accepted[0], eventId:event.id}]), /manual review/);
  const noVenue = extractOfficialHtml({...document, html: `<html><title>${source.name}</title><p>東京都で開催</p></html>`}, source);
  assert.ok(noVenue.issues.includes('venue-unextractable'));
  assert.ok(!noVenue.candidates.some(c => c.field === 'venue'));
  assert.equal(decide(existing, noVenue.candidates, noVenue.issues).accepted.filter(c => c.field === 'venue').length, 0);
  const jsonLd = extractOfficialHtml({...document, html: `<html><title>${source.name}</title><script type="application/ld+json">${JSON.stringify({
    '@type':'Event', name:source.name, location:{name:'虎ノ門ヒルズフォーラム'}
  })}</script></html>`}, source);
  const structuredVenue = jsonLd.candidates.find(c => c.field === 'venue');
  assert.equal(decide(missing, [structuredVenue]).accepted.length, 1);

  // Exercise real report/history persistence in an isolated dataset, without network or main mutations.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'venue-policy-'));
  fs.writeFileSync(path.join(tmp, 'events.js'), dataset.serialize(dataset.events.map(e => e.id === source.id ? missing : e)));
  fs.copyFileSync(path.join(root, 'venues.js'), path.join(tmp, 'venues.js'));
  const config = {...registry, sources:[{...source, pages:[source.pages[0]]}]};
  const applied = await runUpdater({root:tmp, config, apply:true, enforceGit:false,
    checkedAt:'2026-10-05T00:00:00Z', getPage:async () => document, check:() => ({passed:true, results:[]})});
  assert.equal(applied.outcome, 'applied');
  const history = JSON.parse(fs.readFileSync(path.join(tmp, 'reports/auto-update-history.json'))).changes;
  const historyVenue = history.find(c => c.field === 'venue');
  assert.equal(historyVenue.oldValue, '未定'); assert.equal(historyVenue.newValue, candidate.value);
  assert.equal(historyVenue.sourceUrl, document.url); assert.equal(historyVenue.url, document.url);
  assert.equal(historyVenue.evidence, candidate.evidence);
  assert.equal(loadEvents(tmp).events.find(e => e.id === source.id).venue, candidate.value);
  const report = JSON.parse(fs.readFileSync(path.join(tmp,'reports/auto-update-report.json')));
  assert.equal(report.autoChanges.find(c => c.field === 'venue').sourceUrl, document.url);
  assert.equal(fs.readFileSync(path.join(root,'events.js'),'utf8'), dataset.original);
  console.log('PASS: FujiRetina 2027 dates/venue/Maps/venueId/source log; explicit HTML/JSON-LD only, absent/guessed sources rejected, existing venues preserved, source URLs persisted');
}
main().catch(error => {console.error(error); process.exitCode=1;});
