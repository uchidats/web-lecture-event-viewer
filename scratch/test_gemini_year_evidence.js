const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadEvents } = require('../scripts/auto-updater/storage');
const { extractMonitoringContext, getConferenceIdentityEvidence } = require('../scripts/gemini-monitor/extractor');
const { analyzeEventWithGemini, localSemanticAnalyzer, buildPrompt, getTrustedUrlVerification } = require('../scripts/gemini-monitor/gemini-analyzer');
const { classifyDecision } = require('../scripts/gemini-monitor/classifier');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');

async function main() {
  const repo = path.resolve(__dirname, '..');
  const event = loadEvents(repo).events.find(e => e.id === 'conf-jp-lowvision-2027');
  const url = 'https://www.ganki.jp/lowvision2027/';
  const verification = { url, yearMatches: true, editionMatches: true, confidence: 0.95 };
  const html = (year, news = '') => `<title>第28回日本ロービジョン学会学術総会</title><h1>第28回日本ロービジョン学会学術総会</h1>${year ? `<dl><dt>会期</dt><dd>${year}/5/22–23</dd></dl>` : ''}${news}`;
  const baseline = { same_event: true, confidence: 0.75, source_quality: 'official_event_page', mismatches: ['year_mismatch: page detected year 2026 whereas database record is for 2027'], severity: 'medium', recommended_action: 'needs_review', reason: 'page detected year 2026 whereas database record is for 2027' };
  for (const [label, sourceHtml] of [
    ['schedule matches', html(2027)],
    ['news year ignored', html(2027, '<p>ニュース投稿日: 2026-09-19</p><a href="../lowvision2026/">2026</a><p>更新日 2026</p><footer>Copyright 2026</footer>')],
    ['only news year extracted', html(null, '<dl><dt>2026-09-19</dt><dd>ホームページを開設しました</dd></dl>')]
  ]) {
    const context = extractMonitoringContext(sourceHtml, event);
    context.adoptedUrlVerification = verification;
    if (label === 'only news year extracted') assert.deepEqual(context.detectedYears, [2026]);
    const result = await analyzeEventWithGemini(event, url, context, { mockAnalyzer: async () => baseline });
    assert.deepEqual(result.mismatches, [], label);
    assert.equal(result.confidence, baseline.confidence, 'Confidence must not be raised');
    assert.ok(!localSemanticAnalyzer(event, url, context).mismatches.some(m => /year_mismatch/.test(m)), label);
    const prompt = buildPrompt(event, url, context);
    assert.ok(prompt.includes('High-confidence verification adopted for this exact URL'));
    assert.ok(prompt.includes('"confidence":0.95'));
    assert.ok(!prompt.includes('[Years Detected in Page]'));
    console.log(`PASS: ${label}`);
  }
  const conflictContext = extractMonitoringContext(html(2026, '<p>ニュース 2027</p>'), event);
  conflictContext.adoptedUrlVerification = verification;
  const conflict = await analyzeEventWithGemini(event, url, conflictContext, { mockAnalyzer: async () => ({ ...baseline, confidence: 0.99, mismatches: [], recommended_action: 'no_change' }) });
  assert.ok(conflict.mismatches.some(m => /year_mismatch/.test(m)));
  assert.equal(classifyDecision(event, conflict).action, 'needs_review');
  assert.ok(localSemanticAnalyzer(event, url, conflictContext).mismatches.some(m => /year_mismatch/.test(m)));
  const headingContext = extractMonitoringContext('<title>開催概要</title><h1>第28回日本ロービジョン学会学術総会</h1><p>開催日：2026年5月22日〜23日</p>', event);
  assert.equal(getConferenceIdentityEvidence(event, url, headingContext).hasScheduleYearConflict, true);
  console.log('PASS: conflicting actual schedule overrides verified URL');
  const generic = extractMonitoringContext('<title>学会一覧</title><h2>第28回日本ロービジョン学会学術総会</h2><dl><dt>会期</dt><dd>2026年5月22日</dd></dl>', event);
  assert.equal(getConferenceIdentityEvidence(event, url, generic).hasScheduleYearConflict, false);
  const missing = extractMonitoringContext(html(null, '<p>2026-09-19 更新</p>'), event);
  assert.deepEqual(localSemanticAnalyzer(event, url, missing).mismatches, []);
  for (const rejectedVerification of [{ ...verification, url: url + 'information.html' }, { ...verification, confidence: 0.89 }, { ...verification, yearMatches: false }, { ...verification, editionMatches: false }]) {
    assert.equal(getTrustedUrlVerification(url, { ...missing, adoptedUrlVerification: rejectedVerification }), null);
  }
  for (const other of ['edition_mismatch: expected 28, found 27', 'venue_mismatch: conflicting venue', 'city_mismatch: conflicting city']) {
    const result = await analyzeEventWithGemini(event, url, { ...missing, adoptedUrlVerification: verification }, { mockAnalyzer: async () => ({ ...baseline, mismatches: [...baseline.mismatches, other] }) });
    assert.deepEqual(result.mismatches, [other]);
    assert.equal(classifyDecision(event, result).action, 'needs_review');
  }
  const lowConfidence = await analyzeEventWithGemini(event, url, missing, { mockAnalyzer: async () => ({ ...baseline, mismatches: [], venue: '別会場' }) });
  assert.equal(classifyDecision(event, lowConfidence).action, 'needs_review');
  console.log('PASS: generic/body years and other review causes; verification requires identical URL and all thresholds');
  const originalFetch = global.fetch;
  try {
    global.fetch = async (_target, request) => {
      const prompt = JSON.parse(request.body).contents[0].parts[0].text;
      assert.ok(prompt.includes('"url":"https://www.ganki.jp/lowvision2027/"'));
      assert.ok(prompt.includes('"yearMatches":true'));
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(baseline) }] } }] }) };
    };
    const result = await analyzeEventWithGemini(event, url, { ...missing, adoptedUrlVerification: verification }, { apiKey: 'test-key' });
    assert.deepEqual(result.mismatches, []);
    assert.equal(result.confidence, baseline.confidence);
  } finally { global.fetch = originalFetch; }
  console.log('PASS: real API request/response path carries verifier evidence and reconciles unsupported year mismatch');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-year-shadow-'));
  fs.copyFileSync(path.join(repo, 'events.js'), path.join(root, 'events.js'));
  const before = fs.readFileSync(path.join(root, 'events.js'));
  const oldApply = process.env.ENABLE_AUTO_APPLY;
  try {
    process.env.ENABLE_AUTO_APPLY = 'false';
    let handedOff = false;
    const run = await runGeminiMonitor({ root, today: '2026-10-09', singleEventId: event.id, offline: true, skipEmail: true,
      searchProvider: async () => [{ rank: 1, url, title: '第28回日本ロービジョン学会学術総会 2027' }],
      getPage: async () => ({ html: html(null, '<p>2026-09-19 ホームページ開設</p>') }),
      mockAnalyzer: async (_event, targetUrl, context) => {
        assert.equal(targetUrl, url);
        assert.deepEqual(context.detectedYears, [2026]);
        assert.equal(context.adoptedUrlVerification.yearMatches, true);
        assert.equal(context.adoptedUrlVerification.editionMatches, true);
        assert.ok(context.adoptedUrlVerification.confidence >= 0.9);
        handedOff = true;
        return baseline;
      }
    });
    assert.equal(handedOff, true);
    assert.equal(run.metrics.urlDiscovered, 1);
    assert.equal(run.metrics.needsReview, 0);
    assert.equal(run.report.isApplyMode, false);
    assert.deepEqual(fs.readFileSync(path.join(root, 'events.js')), before);
  } finally { if (oldApply === undefined) delete process.env.ENABLE_AUTO_APPLY; else process.env.ENABLE_AUTO_APPLY = oldApply; }
  console.log('PASS: same-run verifier handoff and shadow events.js preservation');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
