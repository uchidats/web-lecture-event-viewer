const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { loadEvents } = require('../scripts/auto-updater/storage');
const { getEventMonitoringTier, selectEventsForToday, diffDays } = require('../scripts/gemini-monitor/scheduler');
const { normalizeContentForHash, sha256 } = require('../scripts/gemini-monitor/fetcher');
const { extractMonitoringContext } = require('../scripts/gemini-monitor/extractor');
const { localSemanticAnalyzer } = require('../scripts/gemini-monitor/gemini-analyzer');
const { classifyDecision, prioritizeAdminReviewItems } = require('../scripts/gemini-monitor/classifier');
const { recordSnapshot, executeRollback, loadRollbackHistory, saveRollbackHistory } = require('../scripts/gemini-monitor/rollback-manager');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');
const { RECOMMENDED_ACTIONS, SEVERITY, SOURCE_QUALITY } = require('../scripts/gemini-monitor/constants');

async function testAll() {
  const root = path.resolve(__dirname, '..');
  const dataset = loadEvents(root);
  const events = dataset.events;
  assert.equal(events.length, 94, 'Dataset must contain 94 events');

  console.log('--- Test Suite 1: Schedule Tiers & Focus Fields (Requirement 5 & 6) ---');
  // 1.1 < 6 months (< 180 days) -> Daily
  const tier6m = getEventMonitoringTier({ date: '2026-11-01' }, '2026-10-09');
  assert.equal(tier6m.tierName, 'LESS_THAN_6M');
  assert.equal(tier6m.intervalDays, 1);
  assert.ok(tier6m.focusFields.includes('abstract_deadline'));

  // 1.2 6 months to < 1 year (180 - 365 days) -> Twice weekly
  const tier1y = getEventMonitoringTier({ date: '2027-05-15' }, '2026-10-09');
  assert.equal(tier1y.tierName, 'FROM_6M_TO_1Y');
  assert.equal(tier1y.intervalDays, 'twice-weekly');
  assert.ok(tier1y.focusFields.includes('city'));

  // 1.3 1 year to < 2 years (365 - 730 days) -> Weekly
  const tier2y = getEventMonitoringTier({ date: '2028-03-01' }, '2026-10-09');
  assert.equal(tier2y.tierName, 'FROM_1Y_TO_2Y');
  assert.equal(tier2y.intervalDays, 7);
  assert.ok(tier2y.focusFields.includes('edition'));

  // 1.4 >= 2 years (>= 730 days) -> Monthly
  const tierOver2y = getEventMonitoringTier({ date: '2029-03-01' }, '2026-10-09');
  assert.equal(tierOver2y.tierName, 'OVER_2Y');
  assert.equal(tierOver2y.intervalDays, 30);

  // 1.5 Ended conferences
  const tierEnded = getEventMonitoringTier({ date: '2026-02-01', endDate: '2026-02-02' }, '2026-10-09');
  assert.equal(tierEnded.isEnded, true);
  console.log('PASS: Schedule tiers and focus fields');

  console.log('\n--- Test Suite 2: Normalization and Hash Unchanged Skipping (Requirement 8, 9) ---');
  const htmlA = '<html><body><h1>第50回日本眼科手術学会</h1><nav><a href="/2025">2025</a></nav><p>日時: 2027年1月29日</p><div class="cookie-banner">Accept cookies</div><footer>2026 Copyright</footer></body></html>';
  const htmlB = '<html><body><h1>第50回日本眼科手術学会</h1><nav><a href="/2025">2025 updated</a></nav><p>日時: 2027年1月29日</p><div class="cookie-banner">Changed cookie text</div><footer>Different footer 2026</footer></body></html>';
  const normA = normalizeContentForHash(htmlA);
  const normB = normalizeContentForHash(htmlB);
  assert.equal(normA, normB, 'Dynamic cookie banner and footer changes must be ignored by normalization');
  assert.equal(sha256(normA), sha256(normB));
  console.log('PASS: Content normalization and stable hash calculation');

  console.log('\n--- Test Suite 3: 7 Target Societies Regression Audit (Requirement 16) ---');
  // 3.1 日本近視学会: conf-jp-myopia-2027 (第8回 vs 公式の第9回 混在ケース)
  const myopiaEventCurrent = events.find(e => e.id === 'conf-jp-myopia-2027');
  assert.ok(myopiaEventCurrent, 'conf-jp-myopia-2027 must exist');
  // Pre-fix state: Title was 8th edition, but official site says 9th edition
  const myopiaEventOld = { ...myopiaEventCurrent, title: '第8回 日本近視学会総会' };
  const myopiaContext9th = {
    summaryPromptText: '第9回日本近視学会総会 開催日: 2027年7月3日 会場: 高輪ゲートウェイ',
    detectedYears: [2027],
    detectedEditions: [9]
  };
  const myopiaDecision = classifyDecision(myopiaEventOld, localSemanticAnalyzer(myopiaEventOld, 'https://www.ganki.jp/myopia2027/', myopiaContext9th));
  assert.equal(myopiaDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW, 'Edition mismatch (8 vs 9) must be classified as needs_review');
  assert.equal(myopiaDecision.severity, SEVERITY.HIGH, 'Edition mismatch must have high severity');

  // Post-fix state: Title is 9th edition -> matches official page
  const myopiaDecisionFixed = classifyDecision(myopiaEventCurrent, localSemanticAnalyzer(myopiaEventCurrent, 'https://www.ganki.jp/myopia2027/', myopiaContext9th));
  assert.notEqual(myopiaDecisionFixed.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW, 'Matching edition 9 must not trigger edition mismatch error');
  console.log('PASS: 1. 日本近視学会 (conf-jp-myopia-2027): Pre-fix mismatch caught as needs_review (HIGH severity); post-fix verified clean');

  // 3.2 日本視野画像学会: conf-jp-perimetry-2026 (第15回 vs 旧誤表記38回)
  const perimetryEventCurrent = events.find(e => e.id === 'conf-jp-perimetry-2026');
  assert.ok(perimetryEventCurrent, 'conf-jp-perimetry-2026 must exist');
  const perimetryEventOld = { ...perimetryEventCurrent, title: '第38回 日本視野画像学会学術集会' };
  const perimetryContext15th = {
    summaryPromptText: '第15回日本視野画像学会学術集会 2026年5月16日-17日 東京慈恵会医科大学',
    detectedYears: [2026],
    detectedEditions: [15]
  };
  const perimetryDecision = classifyDecision(perimetryEventOld, localSemanticAnalyzer(perimetryEventOld, 'https://n-practice.co.jp/jips2026/', perimetryContext15th));
  assert.equal(perimetryDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.equal(perimetryDecision.severity, SEVERITY.HIGH);
  console.log('PASS: 2. 日本視野画像学会 (conf-jp-perimetry-2026): Wrong edition (38 vs 15) caught as needs_review');

  // 3.3 日本老視学会: conf-jp-presbyopia-2027 (第4回 vs 第5回)
  const presbyopiaEvent = events.find(e => e.id === 'conf-jp-presbyopia-2027');
  assert.ok(presbyopiaEvent, 'conf-jp-presbyopia-2027 must exist');
  const presbyopiaContext5th = {
    summaryPromptText: '第5回 日本老視学会学術総会 会期: 2027年1月16日-17日 御茶ノ水ソラシティ',
    detectedYears: [2027],
    detectedEditions: [5] // event in database is 4th
  };
  const presbyopiaDecision = classifyDecision(presbyopiaEvent, localSemanticAnalyzer(presbyopiaEvent, 'https://www.rousi.jp/jps5-overview', presbyopiaContext5th));
  assert.equal(presbyopiaDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  console.log('PASS: 3. 日本老視学会 (conf-jp-presbyopia-2027): Edition 4 vs 5 caught as needs_review');

  // 3.4 日本眼腫瘍学会: conf-jp-oncology-2027 (第44回 2027年 富山国際会議場)
  const oncologyEvent = events.find(e => e.id === 'conf-jp-oncology-2027');
  assert.ok(oncologyEvent, 'conf-jp-oncology-2027 must exist');
  const oncologyContext2028 = {
    summaryPromptText: '第45回 日本眼腫瘍学会 2028年開催予定',
    detectedYears: [2028],
    detectedEditions: [45]
  };
  const oncologyDecision = classifyDecision(oncologyEvent, localSemanticAnalyzer(oncologyEvent, 'https://www.jsoo.jp/society', oncologyContext2028));
  assert.equal(oncologyDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.equal(oncologyDecision.severity, SEVERITY.HIGH);
  console.log('PASS: 4. 日本眼腫瘍学会 (conf-jp-oncology-2027): Future year (2028) on 2027 event flagged as needs_review');

  // 3.5 APACRS: oph-010 (38th APACRS 2026-06-04 Pattaya Thailand PEACH)
  const apacrsEventCurrent = events.find(e => e.id === 'oph-010');
  assert.ok(apacrsEventCurrent, 'oph-010 must exist');
  // Pre-fix state: date was 2026-12-17 Singapore
  const apacrsEventOld = {
    ...apacrsEventCurrent,
    title: 'APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons)',
    date: '2026-12-17',
    cityCountry: 'シンガポール / シンガポール共和国',
    venue: 'Suntec Singapore'
  };
  const apacrsContextCorrect = {
    summaryPromptText: '38th APACRS – 55th RCOPT Joint Annual Meeting. Dates: 2026-06-04 to 2026-06-06. Venue: PEACH Pattaya',
    detectedYears: [2026],
    detectedEditions: [38, 55],
    datesText: '2026-06-04 to 2026-06-06',
    venueText: 'Pattaya Exhibition and Convention Hall (PEACH)'
  };
  const apacrsPreDecision = classifyDecision(apacrsEventOld, {
    ...localSemanticAnalyzer(apacrsEventOld, 'https://apacrs2026.org/', apacrsContextCorrect),
    start_date: '2026-06-04',
    city: 'Pattaya / Thailand',
    venue: 'Pattaya Exhibition and Convention Hall (PEACH)'
  });
  // Under Requirement 1 & 2: Shift from Dec to Jun confirmed on official event HP with high confidence is safe_auto_update
  assert.equal(apacrsPreDecision.action, RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE);

  // But if from third-party source, must be needs_review
  const apacrsThirdParty = classifyDecision(apacrsEventOld, {
    ...localSemanticAnalyzer(apacrsEventOld, 'https://thirdparty-travel.example.com/', apacrsContextCorrect),
    source_quality: SOURCE_QUALITY.THIRD_PARTY_OR_OTHER,
    start_date: '2026-06-04'
  });
  assert.equal(apacrsThirdParty.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);

  // Post-fix state: already in Pattaya, 2026-06-04 -> clean match
  const apacrsAnalyzedFixed = localSemanticAnalyzer(apacrsEventCurrent, 'https://apacrs2026.org/', apacrsContextCorrect);
  assert.equal(apacrsAnalyzedFixed.mismatches.length, 0);
  console.log('PASS: 5. APACRS (oph-010): Official major schedule/city shift is safe_auto_update; third-party is needs_review; post-fix matches cleanly');

  // 3.6 日本臨床視覚電気生理学会: conf-jp-iscev-2027 (第73回 2027年 青森 vs 第74回 2028年 千里)
  const iscevEvent = events.find(e => e.id === 'conf-jp-iscev-2027');
  assert.ok(iscevEvent, 'conf-jp-iscev-2027 must exist');
  const iscevContext74th = {
    summaryPromptText: '第74回 日本臨床視覚電気生理学会 2028年2月18日 千里ライフサイエンスセンター',
    detectedYears: [2028],
    detectedEditions: [74]
  };
  const iscevDecision = classifyDecision(iscevEvent, localSemanticAnalyzer(iscevEvent, 'https://n-practice.co.jp/jscev/meeting/latest.html', iscevContext74th));
  assert.equal(iscevDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  console.log('PASS: 6. 日本臨床視覚電気生理学会 (conf-jp-iscev-2027): 2028/74th meeting on 2027 event flagged as needs_review');

  // 3.7 日本眼科AI学会: conf-jp-ai-2027 (第3回 2022年 過去データが混在するケース)
  const aiEvent = events.find(e => e.id === 'conf-jp-ai-2027');
  assert.ok(aiEvent, 'conf-jp-ai-2027 must exist');
  const aiContextPast = {
    pageTitle: '第3回日本眼科AI学会総会',
    datesText: '2022年11月26日',
    summaryPromptText: '第3回日本眼科AI学会総会 2022年11月26日 京都ブライトンホテル',
    detectedYears: [2022],
    detectedEditions: [3]
  };
  const aiDecision = classifyDecision(aiEvent, localSemanticAnalyzer(aiEvent, 'https://www.jsaio.jp/meeting/', aiContextPast));
  assert.equal(aiDecision.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.equal(aiDecision.severity, SEVERITY.HIGH);
  console.log('PASS: 7. 日本眼科AI学会 (conf-jp-ai-2027): Past meeting (2022) for 2027 event caught as needs_review (HIGH severity)');

  console.log('\n--- Test Suite 4: Admin Review Throttling (0 to 3 typical, Max 5) (Requirement 2) ---');
  const manyReviewItems = [
    { eventId: 'ev-1', priorityScore: 420 },
    { eventId: 'ev-2', priorityScore: 380 },
    { eventId: 'ev-3', priorityScore: 350 },
    { eventId: 'ev-4', priorityScore: 310 },
    { eventId: 'ev-5', priorityScore: 290 },
    { eventId: 'ev-6', priorityScore: 250 },
    { eventId: 'ev-7', priorityScore: 200 }
  ];
  const { visible, deferred } = prioritizeAdminReviewItems(manyReviewItems, 5);
  assert.equal(visible.length, 5, 'Must show at most 5 items');
  assert.equal(deferred.length, 2, 'Excess items must be deferred');
  assert.equal(visible[0].eventId, 'ev-1', 'Highest priority item must be first');
  console.log('PASS: Admin review list capped at 5 with descending priority score');

  console.log('\n--- Test Suite 5: Rollback and Suppression (Requirement 4) ---');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-monitor-rb-test-'));
  const tempReports = path.join(tempDir, 'reports');
  fs.mkdirSync(tempReports, { recursive: true });

  const history = { version: 1, updatedAt: null, snapshots: [], suppressions: [], sourceLearningMeta: {} };
  saveRollbackHistory(tempDir, history);

  const snapshot = recordSnapshot(history, {
    eventId: 'conf-jp-surgery-2027',
    eventName: '第50回日本眼科手術学会学術総会',
    beforeValues: { date: '2027-01-30' },
    afterValues: { date: '2027-01-29' },
    fieldChanges: [{ field: 'date', before: '2027-01-30', after: '2027-01-29', severity: 'medium' }],
    evidence: { url: 'https://50.jsos.jp/', sourceQuality: 'official_event_page', confidence: 0.98, reason: 'Official site confirmed' },
    isShadow: true
  });
  saveRollbackHistory(tempDir, history);

  assert.equal(history.snapshots.length, 1);
  const rbResult = executeRollback(tempDir, snapshot.id, 'Wrong start date test', { carefulYearJudgment: true });
  assert.ok(rbResult.success);

  const reloadedHistory = loadRollbackHistory(tempDir);
  assert.equal(reloadedHistory.snapshots[0].status, 'rolled_back');
  assert.equal(reloadedHistory.suppressions.length, 1);
  assert.equal(reloadedHistory.suppressions[0].suppressedValue, '2027-01-29');
  assert.equal(reloadedHistory.suppressions[0].meta.carefulYearJudgment, true);

  // Verify that subsequent check suppresses this candidate
  const testCandidateEvent = { id: 'conf-jp-surgery-2027', date: '2027-01-30' };
  const suppressedCheck = classifyDecision(testCandidateEvent, {
    start_date: '2027-01-29',
    confidence: 0.98,
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  }, { suppressions: reloadedHistory.suppressions });

  assert.equal(suppressedCheck.status, 'suppressed');
  assert.equal(suppressedCheck.action, RECOMMENDED_ACTIONS.NO_CHANGE);
  console.log('PASS: Rollback restores state, records suppression, and prevents reapplication next day');

  console.log('\n--- Test Suite 6: Independence from Legacy Review System ---');
  const monitorFiles = ['constants.js', 'scheduler.js', 'fetcher.js', 'extractor.js', 'gemini-analyzer.js', 'classifier.js', 'rollback-manager.js', 'monitor.js'];
  for (const file of monitorFiles) {
    const code = fs.readFileSync(path.join(root, 'scripts/gemini-monitor', file), 'utf8');
    assert.ok(!code.includes('auto-update-review'), `${file} must not reference legacy auto-update-review`);
    assert.ok(!code.includes('review-data'), `${file} must not reference review-data`);
    assert.ok(!code.includes('review-model'), `${file} must not reference review-model`);
    assert.ok(!code.includes('OphthalReview'), `${file} must not reference OphthalReview`);
  }
  console.log('PASS: Complete isolation verified - scripts/gemini-monitor/ does not reference any legacy review state, model, or review data files');

  console.log('\n--- ALL GEMINI MONITOR REGRESSION TESTS PASSED SUCCESSFULLY! ---');
}

testAll().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
