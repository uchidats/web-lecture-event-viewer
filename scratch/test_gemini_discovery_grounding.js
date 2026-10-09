const assert = require('node:assert/strict');
const { loadEvents } = require('../scripts/auto-updater/storage');
const { classifyDecision } = require('../scripts/gemini-monitor/classifier');
const { searchGoogle, discoverOfficialUrlWithGoogle, buildSearchQueries, extractLinksFromGrounding, sanitizeDiagnostic } = require('../scripts/gemini-monitor/google-url-discoverer');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function main() {
  const event = loadEvents(require('node:path').resolve(__dirname, '..')).events.find(e => e.id === 'conf-jp-lowvision-2027');
  assert.equal(buildSearchQueries(event).primaryQuery, '第28回 日本ロービジョン学会学術総会 2027');
  const url = 'https://www.ganki.jp/lowvision2027/information.html';
  const originalFetch = global.fetch;
  const diagnostics = [];
  try {
    global.fetch = async (target, request) => {
      if (String(target).startsWith('https://vertexaisearch.cloud.google.com/')) return { url, body: { cancel: async () => {} } };
      const body = JSON.parse(request.body);
      assert.ok(body.tools[0].googleSearch);
      assert.ok(!body.contents[0].parts[0].text.includes('Search Google for: "'));
      return { ok: true, json: async () => ({ candidates: [{
        content: { parts: [{ thought: true, text: 'ignore' }, { text: `第28回 日本ロービジョン学会学術総会 2027 公式 ${url}` }] },
        groundingMetadata: { webSearchQueries: ['第28回 日本ロービジョン学会 2027'], groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test', title: '第28回 日本ロービジョン学会学術総会' } }] }
      }] }) };
    };
    const candidates = await searchGoogle(buildSearchQueries(event).primaryQuery, { apiKey: 'test', onRequest: d => diagnostics.push(d) });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].url, url);
    assert.deepEqual(diagnostics[0].webSearchQueries, ['第28回 日本ロービジョン学会 2027']);
    const result = await discoverOfficialUrlWithGoogle(event, { offline: true, now: '2026-10-09', forceSearch: true, searchProvider: async () => candidates });
    assert.equal(result.status, 'adopted');
    assert.equal(result.adoptedUrl, url);
    const rejected = await discoverOfficialUrlWithGoogle(event, { offline: true, now: '2026-10-09', forceSearch: true, searchProvider: async () => [{ rank: 1, url: 'https://note.com/lowvision2026', title: '第27回 2026' }] });
    assert.ok(rejected.searchDiagnostics.some(d => d.accepted === false && d.verification.reason));
    global.fetch = async () => ({ ok: false, status: 400 });
    await assert.rejects(searchGoogle('test', { apiKey: 'test' }), /Grounding HTTP 400/);
    global.fetch = async (target) => {
      if (String(target).startsWith('https://vertexaisearch.cloud.google.com/')) throw new Error('redirect unavailable');
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: `公式 第28回 2027 ${url}\nhttps://note.com/unrelated` }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/broken' } }, { web: { uri: 'not-a-url' } }] } }] }) };
    };
    const fallback = await searchGoogle('lowvision', { apiKey: 'test' });
    assert.deepEqual(fallback.map(c => c.url), [url]);
    assert.ok(!fallback[0].snippet.includes('note.com'));
    const chunks = extractLinksFromGrounding({ candidates: [{ content: { parts: [{ text: 'irrelevant 2027 第28回' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://www.ganki.jp/old2026/' } }], groundingSupports: [{ groundingChunkIndices: [0], segment: { text: '第27回 2026' } }] } }] });
    assert.equal(chunks[0].snippet, '第27回 2026');
    const secret = 'fake-key-only-for-testing';
    assert.ok(!JSON.stringify(sanitizeDiagnostic({ url: `https://example.org/?key=${secret}`, reason: secret }, { apiKey: secret })).includes(secret));
    const oldSecret = process.env.SMTP_PASS;
    try {
      process.env.SMTP_PASS = 'fake-smtp-secret';
      assert.equal(sanitizeDiagnostic('fake-smtp-secret'), 'REDACTED');
    } finally { if (oldSecret === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = oldSecret; }
  } finally { global.fetch = originalFetch; }
  for (const missing of [null, 'null', ' NULL ', '', 'undefined', 'unknown', 'N/A', 'n/a', 'none', '未定', '不明']) {
    const output = { same_event: true, confidence: 0.99, source_quality: 'official_event_page', mismatches: [], reason: 'test' };
    for (const field of ['official_url', 'start_date', 'end_date', 'venue', 'city', 'abstract_deadline', 'registration_deadline', 'official_title']) output[field] = missing;
    assert.deepEqual(classifyDecision(event, output).fieldChanges, []);
    output.official_url = url;
    assert.deepEqual(classifyDecision(event, output).fieldChanges.map(c => c.field), ['eventOfficialUrl']);
  }
  let searches = 0;
  const notDue = await discoverOfficialUrlWithGoogle(event, { offline: true, now: '2026-10-09', searchProvider: async () => { searches++; return []; } });
  assert.equal(notDue.status, 'normal-not-yet-created');
  assert.equal(searches, 0, 'Scheduled discovery must retain the 180-day window');
  const ended = await discoverOfficialUrlWithGoogle(event, { offline: true, now: '2028-01-01', forceSearch: true, searchProvider: async () => { searches++; return []; } });
  assert.equal(ended.status, 'skipped');
  assert.equal(searches, 0);
  const shadowRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-shadow-review-'));
  fs.copyFileSync(path.resolve(__dirname, '../events.js'), path.join(shadowRoot, 'events.js'));
  const before = fs.readFileSync(path.join(shadowRoot, 'events.js'));
  const oldApply = process.env.ENABLE_AUTO_APPLY;
  try {
    process.env.ENABLE_AUTO_APPLY = 'false';
    const result = await runGeminiMonitor({ root: shadowRoot, today: '2026-10-09', singleEventId: event.id, offline: true, skipEmail: true,
      searchProvider: async () => [{ rank: 1, url, title: '第28回 日本ロービジョン学会学術総会 2027' }],
      getPage: async () => ({ status: 200, html: '<html><h1>第28回 日本ロービジョン学会学術総会 2027</h1></html>' }) });
    assert.equal(result.report.mode, 'shadow_simulation');
    assert.equal(result.report.isApplyMode, false);
    assert.ok(result.metrics.urlDiscovered > 0, 'Shadow run exercises an adopted URL');
    assert.deepEqual(fs.readFileSync(path.join(shadowRoot, 'events.js')), before);
  } finally { if (oldApply === undefined) delete process.env.ENABLE_AUTO_APPLY; else process.env.ENABLE_AUTO_APPLY = oldApply; }
  console.log('PASS: Grounding destination URLs, search diagnostics, verifier rejection and missing metadata preservation');
}
main().catch(err => { console.error(err); process.exitCode = 1; });
