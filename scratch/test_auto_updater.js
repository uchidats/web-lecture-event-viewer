const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const config = require('../conference-sources');
const { extractOfficialHtml, normalizeDate, normalizeVenue, dateRanges } = require('../scripts/auto-updater/extract');
const { assess, applyChanges } = require('../scripts/auto-updater/policy');
const { runUpdater } = require('../scripts/auto-updater/pipeline');
const { evaluateMassChanges } = require('../scripts/auto-updater/mass-change');
const { loadEvents, mergeReview, assertCleanMain } = require('../scripts/auto-updater/storage');
const { fetchOfficialPage } = require('../scripts/auto-updater/fetch');
const root = path.resolve(__dirname, '..');
const fixtureDir = path.join(__dirname, 'fixtures', 'auto-updater');
const checkedAt = '2026-10-04T13:00:00Z';
const fixturePage = async (page, source) => ({ ...page, html: fs.readFileSync(path.join(fixtureDir, `${source.id}-${page.role}.html`), 'utf8') });

async function main() {
  const dataset = loadEvents(root);
  const baselinePilots = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'baseline-pilots.json'), 'utf8'));
  dataset.events = dataset.events.map(e => baselinePilots[e.id] || e);
  const source = config.sources.find(s => s.id === 'conf-jp-surgery-2027');
  const event = dataset.events.find(e => e.id === source.id);
  const candidate = (field, value, confidence = 0.98) => ({ field, value, confidence, method: 'labeled-html',
    url: source.pages[field === 'venue' ? 0 : 1].url,
    ...(field === 'venue' ? {sourceRole: 'overview', venueEvidence: 'labeled-venue', evidence: value} : {}) });
  const decide = (candidates, issues = [], override = {}) => assess(event, source, candidates, issues, config.defaults, { today: '2026-10-04', venues: {}, ...override });

  for (const [raw, expected] of [
    ['2026年11月5日（木）13時', '2026-11-05 13:00'], ['2026-11-05T13:00:00+09:00', '2026-11-05 13:00'],
    ['2026年11月5日 正午', '2026-11-05 12:00'], ['2028年2月29日', '2028-02-29'],
    ['2026-02-30', null], ['2026年13月1日', null], ['2026年1月1日 25:00', null], ['invalid', null]
  ]) assert.equal(normalizeDate(raw), expected, raw);
  assert.equal(dateRanges('2026年10月29日（木）～11月1日（日）', 2026)[0].end, '2026-11-01');
  assert.equal(dateRanges('3月3日（火）正午～5月21日（木）正午', 2026)[0].confidence, 0.8);
  assert.equal(normalizeVenue('<b>東京国際フォーラム</b><br>〒100-0005 東京都千代田区丸の内3-5-1'), '東京国際フォーラム');

  const perSource = new Map();
  for (const s of config.sources) {
    const extracted = [];
    for (const p of s.pages) {
      const result = extractOfficialHtml(await fixturePage(p, s), s);
      assert.ok(!result.issues.includes('conference-identity-missing'));
      if (p.role === 'overview') {
        for (const field of ['title', 'date', 'endDate', 'venue', 'officialUrl']) assert.ok(result.candidates.some(c => c.field === field), `${s.id}:${field}`);
      } else assert.ok(result.candidates.some(c => c.field === 'abstractSubmission.url'));
      extracted.push(...result.candidates);
    }
    perSource.set(s.id, extracted);
  }
  const actual = decide(perSource.get(source.id));
  assert.ok(actual.accepted.some(c => c.field === 'abstractSubmission.deadline' && c.value === '2026-08-31'));
  const updated = applyChanges(dataset.events, actual.accepted.map(c => ({ ...c, eventId: source.id })));
  assert.equal(updated.length, 94);
  assert.equal(updated.find(e => e.id === source.id).abstractSubmission.status, 'closed');
  assert.equal(updated.find(e => e.id === source.id).abstractDeadline, '2026-08-31');
  assert.deepEqual(updated.filter(e => e.id !== source.id), dataset.events.filter(e => e.id !== source.id));
  assert.deepEqual(updated.map(e => e.id), dataset.events.map(e => e.id));
  assert.throws(() => applyChanges(dataset.events, [{ eventId: source.id, field: 'id', value: 'changed' }]), /Protected/);
  for (const method of ['pdf', 'ai', 'surrounding-text', 'unknown']) assert.equal(decide([{ ...candidate('venue', '新会場', 0.99), method }]).accepted.length, 0);
  assert.equal(decide([candidate('venue', '新会場', 0.8)]).accepted.length, 0);
  assert.ok(decide([candidate('venue', '会場A'), candidate('venue', '会場B')]).review.every(r => r.reason === 'multiple-candidates'));
  assert.equal(decide([candidate('date', '2038-01-01')]).halt, true);
  assert.equal(decide([candidate('date', '2026-01-29')]).halt, true);
  assert.equal(decide([candidate('date', '2027-02-10'), candidate('endDate', '2027-01-31')]).halt, true);
  assert.equal(decide([], ['invalid-json-ld']).halt, true);
  assert.equal(assess(event, { ...source, autoUpdateEnabled: false }, [candidate('abstractSubmission.url', source.pages[1].url)], [],
    config.defaults, { today: '2026-10-04' }).accepted.length, 0);
  for (const [today, status] of [['2026-05-31', 'upcoming'], ['2026-06-01', 'open'], ['2026-08-31', 'open'], ['2026-09-01', 'closed']]) {
    const d = assess(event, source, [candidate('abstractSubmission.startDate', '2026-06-01'),
      candidate('abstractSubmission.deadline', '2026-08-31')], [], config.defaults, { today, venues: {} });
    assert.equal(d.accepted.find(c => c.field === 'abstractSubmission.status')?.value, status);
  }
  assert.ok(decide([candidate('date', '2027-04-01')]).review.some(r => r.reason === 'large-date-shift'));
  assert.equal(decide([candidate('venue', '新会場')], ['conference-identity-missing']).accepted.length, 0);
  assert.equal(decide([candidate('venue', null)]).accepted.length, 0);
  assert.equal(decide([candidate('officialUrl', 'https://evil.example/')]).accepted.length, 0);
  assert.equal(decide([candidate('abstractSubmission.url', 'https://50.jsos.jp/other-edition/')]).accepted.length, 1); // Same edition root; no edition path is asserted here.
  const editionSource = config.sources[0];
  const editionEvent = dataset.events.find(e => e.id === editionSource.id);
  assert.equal(assess(editionEvent, editionSource, [{ ...candidate('officialUrl', 'https://convention.jtbcom.co.jp/132jos/index.html'), url: editionSource.officialUrl }], [], config.defaults, { today: '2026-10-04' }).accepted.length, 0);
  assert.equal(assess({ ...event, venueId: 'forum' }, source, [candidate('venue', '大阪国際会議場')], [], config.defaults,
    { today: '2026-10-04', venues: { forum: { name: '東京国際フォーラム' } } }).accepted.length, 0);
  assert.equal(extractOfficialHtml({ html: 'not HTML', role: 'overview', url: source.officialUrl }, source).candidates.length, 0);
  assert.equal(extractOfficialHtml({ html: '<html><title>第51回日本眼科手術学会</title><p>第50回日本眼科手術学会</p></html>', role: 'overview', url: source.officialUrl }, source).issues[0], 'conference-identity-missing');
  const structured = extractOfficialHtml({ role: 'overview', url: source.officialUrl, html: `<html><title>${source.name}</title><script type="application/ld+json">${JSON.stringify({ '@type': 'Event', name: source.name, startDate: event.date, endDate: event.endDate, location: { name: event.venue, address: { addressLocality: '千代田区', addressCountry: 'JP' } } })}</script></html>` }, source);
  assert.ok(structured.candidates.some(c => c.method === 'json-ld' && c.field === 'country'));
  assert.ok(extractOfficialHtml({ role: 'overview', url: source.officialUrl, html: `<html><title>${source.name}</title><script type="application/ld+json">{bad}</script></html>` }, source).issues.includes('invalid-json-ld'));

  let calls = 0;
  await assert.rejects(fetchOfficialPage(source.pages[0], source, config.defaults, async () => {
    calls++; return new Response(null, { status: 302, headers: { location: 'https://evil.example/' } });
  }), /untrusted-domain/);
  assert.equal(calls, 1);
  await assert.rejects(fetchOfficialPage(source.pages[0], source, config.defaults, async () => new Response('bad', { status: 500 })), /http-500/);
  await assert.rejects(fetchOfficialPage(source.pages[0], source, config.defaults, async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } })), /non-html/);
  await assert.rejects(fetchOfficialPage(source.pages[0], source, { ...config.defaults, maxResponseBytes: 4 }, async () => new Response('<html>large</html>', { headers: { 'content-type': 'text/html' } })), /too-large/);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conference-updater-test-'));
  // Never remove directories recursively: leave this uniquely named test sandbox in OS temp.
  fs.writeFileSync(path.join(tmp, 'events.js'), dataset.serialize(dataset.events));
  fs.copyFileSync(path.join(root, 'venues.js'), path.join(tmp, 'venues.js'));
  const baseline = fs.readFileSync(path.join(tmp, 'events.js'), 'utf8');
  const options = { root: tmp, config, getPage: fixturePage, checkedAt, enforceGit: false };
  const reproduced = await runUpdater(options);
  assert.equal(reproduced.sourceCount, 5);
  assert.equal(reproduced.autoChanges.length, 11);
  assert.equal(reproduced.massChangeAssessment.changedEvents, 4);
  assert.equal(reproduced.stopped, false);
  assert.equal(reproduced.stopReason, null);
  assert.equal(reproduced.blockedAutoChanges.length, 0);
  assert.ok(reproduced.needsReview.every(c => c.reason !== 'mass-change-limit'));
  console.log('Artifact-equivalent dry-run:', JSON.stringify({ autoChanges: reproduced.autoChanges.length,
    genuineNeedsReview: reproduced.needsReview.length, blockedChanges: reproduced.blockedAutoChanges.length,
    stopReason: reproduced.stopReason, assessment: reproduced.massChangeAssessment }));
  const evaluate = (changes, defaults = {}) => evaluateMassChanges(changes, { ...config, defaults: { ...config.defaults, ...defaults } });
  const overwrites = reproduced.autoChanges.map(c => ({ ...c, oldValue: 'existing-value' }));
  assert.equal(evaluate(overwrites).stopped, true);
  for (const field of ['date', 'endDate', 'venue', 'city', 'country', 'title', 'officialUrl']) {
    assert.equal(evaluate([{ ...reproduced.autoChanges[0], field, oldValue: null }]).lowRiskCompletions, 0);
  }
  assert.equal(evaluate([{ ...reproduced.autoChanges[1], confidence: 0.5 }]).lowRiskCompletions, 0);
  assert.equal(evaluate([{ ...reproduced.autoChanges[1], url: 'https://evil.example/' }]).lowRiskCompletions, 0);
  assert.ok(evaluate(reproduced.autoChanges, { maxTotalAutoChanges: 10 }).exceeded.includes('total-fields'));
  assert.ok(evaluate(reproduced.autoChanges, { maxFieldsPerEvent: 3 }).exceeded.includes('fields-per-event'));
  const mass = await runUpdater({ ...options, config: { ...config, defaults: { ...config.defaults, maxChangedConferences: 3 } },
    apply: true, check: () => { throw new Error('Must not reach tests'); } });
  assert.equal(mass.outcome, 'stopped'); assert.equal(mass.stopReason, 'mass-change-limit');
  assert.equal(mass.autoChanges.length, 0);
  assert.equal(mass.blockedAutoChanges.length, 11);
  assert.deepEqual(mass.needsReview, reproduced.needsReview);
  const queue = JSON.parse(fs.readFileSync(path.join(tmp, 'reports/auto-update-review.json')));
  assert.ok(queue.items.every(c => c.reason !== 'mass-change-limit'));
  assert.equal(fs.readFileSync(path.join(tmp, 'events.js'), 'utf8'), baseline);
  const single = { ...config, sources: [source] };
  const dry = await runUpdater({ ...options, config: single });
  assert.equal(dry.outcome, 'dry-run'); assert.ok(dry.autoChanges.length);
  assert.equal(fs.readFileSync(path.join(tmp, 'events.js'), 'utf8'), baseline);
  assert.equal(fs.existsSync(path.join(tmp, 'reports/auto-update-source-state.json')), false);
  const failed = await runUpdater({ ...options, config: single, getPage: async () => { throw new Error('offline'); } });
  assert.equal(failed.autoChanges.length, 0);
  assert.ok(failed.needsReview.some(r => r.reason === 'fetch-failed'));
  assert.equal(fs.readFileSync(path.join(tmp, 'events.js'), 'utf8'), baseline);
  const malformed = await runUpdater({ ...options, config: single, getPage: async p => ({ ...p, html: '<html><title>error page</title></html>' }) });
  assert.equal(malformed.autoChanges.length, 0);
  const singleRisk = evaluate(dry.autoChanges).riskWeightedFields;
  const exactLimit = { ...single, defaults: { ...config.defaults, maxAutoChanges: singleRisk } };
  assert.equal((await runUpdater({ ...options, config: exactLimit })).stopped, false);
  assert.equal((await runUpdater({ ...options, config: { ...exactLimit, defaults: { ...exactLimit.defaults, maxAutoChanges: singleRisk - 0.25 } } })).stopped, true);
  const disabled = await runUpdater({ ...options, config: { ...single, enabled: false }, getPage: () => { throw new Error('Disabled must never fetch'); } });
  assert.equal(disabled.outcome, 'disabled');
  const rollback = await runUpdater({ ...options, config: single, apply: true, check: () => ({ passed: false, results: [] }) });
  assert.equal(rollback.outcome, 'rolled-back');
  assert.equal(fs.readFileSync(path.join(tmp, 'events.js'), 'utf8'), baseline);
  assert.equal(fs.existsSync(path.join(tmp, 'reports/auto-update-history.json')), false);
  const applied = await runUpdater({ ...options, config: single, apply: true, check: () => ({ passed: true, results: [] }) });
  assert.equal(applied.outcome, 'applied'); assert.equal(loadEvents(tmp).events.length, 94);
  const history = JSON.parse(fs.readFileSync(path.join(tmp, 'reports/auto-update-history.json')));
  assert.ok(history.changes.every(c => 'oldValue' in c && 'newValue' in c && c.changedAt && c.url && c.confidence >= 0.95));
  assert.equal(fs.readFileSync(path.join(tmp, applied.backup, 'events.js'), 'utf8'), baseline);
  const second = await runUpdater({ ...options, config: single, apply: true, check: () => { throw new Error('No repeated changes'); } });
  assert.equal(second.outcome, 'no-changes');
  assert.equal(JSON.parse(fs.readFileSync(path.join(tmp, 'reports/auto-update-history.json'))).changes.length, history.changes.length);
  fs.writeFileSync(path.join(tmp, 'reports/auto-update.lock'), 'busy');
  await assert.rejects(runUpdater({ ...options, apply: true }), /EEXIST/);
  const merged = mergeReview({ items: [] }, [{ eventId: source.id, reason: 'ambiguous' }], checkedAt);
  assert.equal(mergeReview(merged, [], checkedAt).items.length, 1);
  assert.equal(mergeReview(merged, [{ eventId: source.id, reason: 'ambiguous' }], checkedAt).items[0].occurrences, 2);
  fs.writeFileSync(path.join(tmp, 'reports/auto-update-history.json'), '{invalid');
  await assert.rejects(runUpdater({ ...options }), /JSON/);
  fs.writeFileSync(path.join(tmp, 'events.js'), 'const sampleEvents = [bad];');
  await assert.rejects(runUpdater({ ...options }), /JSON/);
  assert.throws(() => assertCleanMain(tmp), /Git|git|repository/);
  const cli = spawnSync(process.execPath, ['scripts/update-conferences.js', '--help'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, AUTO_UPDATE_DISABLED: '1' }
  });
  assert.equal(cli.status, 0); assert.ok(cli.stdout.includes('dry-run'));
  assert.equal(fs.readFileSync(path.join(root, 'events.js'), 'utf8'), dataset.original);
  const webContext = { document: { getElementById: () => null, addEventListener: () => {} }, console, setTimeout, clearTimeout };
  for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), webContext);
  assert.equal(vm.runInNewContext('sampleEvents.filter(e => typeof createEventCardHtml(e) === "string").length', webContext), 94);
  console.log('PASS: 5 official HTML pilots; normalization; abstract updates; confidence; exceptions; mass stop; fetch failure; redirects; dry-run; apply/rollback/backups; IDs; 94 cards');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
