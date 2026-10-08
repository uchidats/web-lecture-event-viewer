// Real apply + full regression gate, entirely in an isolated copy (no network).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runUpdater } = require('../scripts/auto-updater/pipeline');
const { loadEvents } = require('../scripts/auto-updater/storage');
const registry = require('../conference-sources');
async function main() {
  const root = path.resolve(__dirname, '..');
  const original = fs.readFileSync(path.join(root, 'events.js'), 'utf8');
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'conference-updater-integration-'));
  for (const file of ['events.js', 'script.js', 'venues.js', 'companies.js', 'index.html', 'style.css', 'conference-sources.js', 'conference-discovery-sources.js', 'review-model.js']) fs.copyFileSync(path.join(root, file), path.join(isolated, file));
  for (const dir of ['scripts', 'scratch', 'docs']) fs.cpSync(path.join(root, dir), path.join(isolated, dir), { recursive: true });
  fs.mkdirSync(path.join(isolated, 'reports'), {recursive: true});
  for (const entry of fs.readdirSync(path.join(root, 'reports'), { withFileTypes: true })) {
    if (entry.isFile()) fs.copyFileSync(path.join(root, 'reports', entry.name), path.join(isolated, 'reports', entry.name));
  }
  const data = loadEvents(isolated);
  const baselines = JSON.parse(fs.readFileSync(path.join(root, 'scratch/fixtures/auto-updater/baseline-pilots.json'), 'utf8'));
  // Restore updater pilot values while retaining newer, unrelated fields such as registration.
  const isolatedBaseline = data.serialize(data.events.map(e => baselines[e.id] ? { ...e, ...baselines[e.id] } : e));
  fs.writeFileSync(path.join(isolated, 'events.js'), isolatedBaseline);
  const source = registry.sources.find(s => s.id === 'conf-jp-surgery-2027');
  const result = await runUpdater({
    root: isolated, config: { ...registry, discovery: { enabled: false }, sources: [source] }, apply: true, enforceGit: false,
    checkedAt: '2026-10-04T13:00:00Z',
    getPage: async page => ({ ...page, html: fs.readFileSync(path.join(root, 'scratch/fixtures/auto-updater', `${source.id}-${page.role}.html`), 'utf8') })
  });
  assert.equal(result.outcome, 'applied', JSON.stringify({ stopReason: result.stopReason, tests: result.tests }));
  assert.ok(result.tests.passed);
  assert.ok(result.tests.results.every(t => t.passed));
  assert.equal(loadEvents(isolated).events.length, 94);
  assert.equal(fs.readFileSync(path.join(isolated, result.backup, 'events.js'), 'utf8'), isolatedBaseline);
  assert.equal(fs.readFileSync(path.join(root, 'events.js'), 'utf8'), original);
  console.log(`PASS: isolated real apply (${result.autoChanges.length} fields) + all ${result.tests.results.length} syntax/regression gates; original main dataset unchanged`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
