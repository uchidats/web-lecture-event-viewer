// Opt-in network smoke test; never modifies events.js or tracked reports.
const assert = require('node:assert/strict');
const config = require('../conference-sources');
const { fetchOfficialPage } = require('../scripts/auto-updater/fetch');
const { extractOfficialHtml } = require('../scripts/auto-updater/extract');
async function main() {
  let checked = 0;
  for (const source of config.sources) for (const page of source.pages) {
    const document = await fetchOfficialPage(page, source, config.defaults);
    const result = extractOfficialHtml(document, source);
    assert.ok(!result.issues.includes('conference-identity-missing'), source.id);
    assert.ok(result.candidates.length, `${source.id}:${page.role}`);
    if (page.role === 'overview') for (const field of ['date', 'endDate', 'venue', 'eventOfficialUrl']) {
      assert.ok(result.candidates.some(c => c.field === field), `${source.id}:${field}`);
    }
    console.log(`PASS: ${source.id} ${page.role}: ${result.candidates.length} candidates`);
    checked++;
  }
  assert.equal(checked, config.sources.reduce((count, source) => count + source.pages.length, 0));
  console.log(`PASS: ${config.sources.length} pilots / ${checked} live official HTML pages (network-only smoke test)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
