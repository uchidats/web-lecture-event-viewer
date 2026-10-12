const assert = require('node:assert/strict');
const { identity, checkIdentity, pageEvidence, generateOrganizerCandidates } = require('../scripts/auto-updater/discovery');
const { buildSearchQueries, discoverOfficialUrlWithGoogle } = require('../scripts/gemini-monitor/google-url-discoverer');
const registry = require('../conference-discovery-sources');
const event = { id: 'conf-jp-eyelid-2028', title: '第39回 日本眼瞼義眼床手術学会学術集会', date: '2028-02-19', conferenceRegion: 'domestic' };
const page = (edition, year, name = '日本眼瞼義眼床手術学会') => `<title>第${edition}回${name}</title><h1>第${edition}回${name}</h1><p>会期：${year}年2月19日</p>`;
async function main() {
  for (const [edition, year] of [[39, 2028], [40, 2029]]) {
    const next = { ...event, title: `第${edition}回 日本眼瞼義眼床手術学会`, date: `${year}-02-19` };
    const candidates = generateOrganizerCandidates(next, identity(next), ['https://convention.jtbcom.co.jp/gigan38/']);
    assert.ok(candidates.some(c => c.url === `https://convention.jtbcom.co.jp/gigan${edition}/`));
    assert.ok(buildSearchQueries(next).primaryQuery.includes(`site:convention.jtbcom.co.jp/gigan${edition}/`));
  }
  assert.ok(registry.entries.find(e => e.eventId === event.id).indexUrls.includes('https://convention.jtbcom.co.jp/gigan38/'));
  const url = 'https://convention.jtbcom.co.jp/gigan39/';
  const result = async html => discoverOfficialUrlWithGoogle(event, {
    offline: true, forceSearch: true, now: new Date('2027-10-01'),
    searchProvider: async () => [{ url, title: '第39回 日本眼瞼義眼床手術学会 2028', snippet: '公式大会サイト 2028', rank: 1 }],
    ...(html === null ? {} : { getPage: async () => ({ html }) })
  });
  const accepted = await result(page(39, 2028));
  assert.equal(accepted.status, 'adopted');
  assert.equal(accepted.adoptedUrl, url);
  for (const html of [null, page(38, 2028), page(39, 2027), page(39, 2028, '日本眼科学会'), page(39, 2028) + '<h2>第40回日本眼瞼義眼床手術学会</h2>']) {
    const rejected = await result(html);
    assert.notEqual(rejected.status, 'adopted');
    assert.equal(Boolean(rejected.adoptedUrl), false);
    if (html) {
      const checks = checkIdentity(pageEvidence(html), identity(event));
      assert.ok(!checks.nameMatches || !checks.editionMatches || !checks.yearMatches);
    }
  }
  console.log('PASS: gigan39/40 candidates and Google priority; official page identity mandatory; guesses/wrong name/edition/year rejected');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
