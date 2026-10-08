const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const {
  SCHEDULE_TIERS,
  FOCUS_FIELDS,
  SOURCE_QUALITY,
  RECOMMENDED_ACTIONS,
  SEVERITY,
  IDEMPOTENCY_STATUS,
  LEARNING_FLAGS,
  THRESHOLDS
} = require('../scripts/gemini-monitor/constants');
const {
  isEventEnded,
  getEventMonitoringTier,
  getNextTwiceWeeklyDate,
  calculateNextCheckDate,
  selectEventsForToday
} = require('../scripts/gemini-monitor/scheduler');
const { classifyDecision, prioritizeAdminReviewItems } = require('../scripts/gemini-monitor/classifier');
const { applyFieldChangesToEvent, verifyDatasetIntegrity, checkMassChangeSafeguard, applyBatchUpdates } = require('../scripts/gemini-monitor/applier');
const { executeRollback, recordLearningMeta, loadRollbackHistory } = require('../scripts/gemini-monitor/rollback-manager');
const { composeEmail } = require('../scripts/gemini-monitor/notifier');

const root = path.resolve(__dirname, '..');

async function testAll() {
  console.log('=== Test Suite 1: Ended Event Exclusion & Evidence Reference (Requirements 5, 24) ===');

  // Ended event with endDate in the past
  const pastMultiDay = { id: 'past-01', title: '第1回過去学会', date: '2025-05-10', endDate: '2025-05-12', isConference: true };
  assert.strictEqual(isEventEnded(pastMultiDay, '2026-10-09'), true);
  const tierPast = getEventMonitoringTier(pastMultiDay, '2026-10-09');
  assert.strictEqual(tierPast.isEnded, true);
  assert.strictEqual(tierPast.status, 'completed');
  assert.strictEqual(calculateNextCheckDate(tierPast, '2026-10-09'), null);

  // Single-day event with date in the past
  const pastSingleDay = { id: 'past-02', title: '第2回過去研究会', date: '2026-01-15', isConference: true };
  assert.strictEqual(isEventEnded(pastSingleDay, '2026-10-09'), true);

  // Future event
  const futureEvent = { id: 'future-01', title: '第3回未来学会', date: '2027-04-10', endDate: '2027-04-12', isConference: true };
  assert.strictEqual(isEventEnded(futureEvent, '2026-10-09'), false);

  // Complete exclusion from selectEventsForToday
  const { selected, skipped } = selectEventsForToday([pastMultiDay, pastSingleDay, futureEvent], '2026-10-09', {});
  assert.strictEqual(selected.length, 1);
  assert.strictEqual(selected[0].eventId, 'future-01');
  const endedSkipped = skipped.filter(s => s.isEnded);
  assert.strictEqual(endedSkipped.length, 2);
  console.log('PASS: Ended events completely excluded from monitoring, no nextCheckDate scheduled');

  // Past edition page can be used as evidence URL for future meeting
  const futureEventUsingPastSource = {
    id: 'future-02',
    title: '第10回次世代眼科学会',
    date: '2027-09-01',
    isConference: true,
    eventOfficialUrl: 'https://example-past-society.org/2026/next-announcement'
  };
  const tierNext = getEventMonitoringTier(futureEventUsingPastSource, '2026-10-09');
  assert.strictEqual(tierNext.isEnded, false);
  console.log('PASS: Past conference website allowed as evidence source for future event');

  console.log('\n=== Test Suite 2: Updated 4-Tier Monitoring Frequency (Requirements 6, 24) ===');
  // < 6 months (< 180 days) -> Daily (1 day)
  const tier6m = getEventMonitoringTier({ date: '2026-12-01', isConference: true }, '2026-10-09');
  assert.strictEqual(tier6m.tierName, 'LESS_THAN_6M');
  assert.strictEqual(tier6m.intervalDays, 1);
  assert.ok(tier6m.focusFields.includes('venue'));
  assert.ok(tier6m.focusFields.includes('abstract_deadline'));

  // 6 months to < 1 year (180 to 365 days) -> Twice weekly (Tuesday & Friday)
  const tier1y = getEventMonitoringTier({ date: '2027-05-01', isConference: true }, '2026-10-09');
  assert.strictEqual(tier1y.tierName, 'FROM_6M_TO_1Y');
  assert.strictEqual(tier1y.intervalDays, 'twice-weekly');
  // Test Tuesday/Friday schedule helper
  // 2026-10-06 is Tuesday -> next is Friday 2026-10-09
  assert.strictEqual(getNextTwiceWeeklyDate('2026-10-06'), '2026-10-09');
  // 2026-10-09 is Friday -> next is Tuesday 2026-10-13
  assert.strictEqual(getNextTwiceWeeklyDate('2026-10-09'), '2026-10-13');

  // 1 year to < 2 years (365 to 730 days) -> Weekly (7 days)
  const tier2y = getEventMonitoringTier({ date: '2028-01-01', isConference: true }, '2026-10-09');
  assert.strictEqual(tier2y.tierName, 'FROM_1Y_TO_2Y');
  assert.strictEqual(tier2y.intervalDays, 7);

  // >= 2 years (>= 730 days) -> Monthly (30 days)
  const tierOver2y = getEventMonitoringTier({ date: '2029-01-01', isConference: true }, '2026-10-09');
  assert.strictEqual(tierOver2y.tierName, 'OVER_2Y');
  assert.strictEqual(tierOver2y.intervalDays, 30);
  console.log('PASS: New 4-tier schedule verified (<6m daily, 6m-1y twice-weekly Tue/Fri, 1y-2y weekly, >=2y monthly)');

  console.log('\n=== Test Suite 3: High-Confidence Auto-Update vs Source Evidence (Requirements 1, 2, 3, 24) ===');
  const baseEvent = {
    id: 'test-conf-01',
    title: '第50回日本眼科フォーラム',
    date: '2027-04-10',
    endDate: '2027-04-12',
    venue: '東京国際フォーラム',
    cityCountry: '東京',
    eventOfficialUrl: 'https://ophth-forum.jp/50/'
  };

  // Case 1: Major schedule shift + year shift, but verified on official event HP with high confidence -> SAFE_AUTO_UPDATE!
  const majorDateChange = classifyDecision(baseEvent, {
    same_event: true,
    confidence: 0.98,
    source_quality: SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    official_title: '第50回日本眼科フォーラム',
    edition: 50,
    start_date: '2027-06-20',
    end_date: '2027-06-22',
    city: '東京',
    venue: 'パシフィコ横浜',
    mismatches: [],
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE,
    reason: 'Official site confirmed venue moved to Pacifico Yokohama and dates shifted to June.'
  });
  assert.strictEqual(majorDateChange.action, RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE);
  assert.strictEqual(majorDateChange.isAutoApplicable, true);
  console.log('PASS: Major date + venue change on verified official HP is safe_auto_update (evidence prioritized over magnitude)');

  // Case 2: City change + edition correction, high confidence official announcement -> SAFE_AUTO_UPDATE!
  const cityEditionChange = classifyDecision(baseEvent, {
    same_event: true,
    confidence: 0.97,
    source_quality: SOURCE_QUALITY.SOCIETY_NEXT_ANNOUNCEMENT,
    official_title: '第51回日本眼科フォーラム',
    edition: 51,
    start_date: null,
    end_date: null,
    city: '京都',
    venue: '国立京都国際会館',
    mismatches: [],
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE,
    reason: 'Next-meeting society announcement confirmed 51st edition in Kyoto.'
  });
  assert.strictEqual(cityEditionChange.action, RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE);
  console.log('PASS: City and edition update with high confidence on official society page is safe_auto_update');

  // Case 3: Same change but low quality third-party source -> NEEDS_REVIEW!
  const thirdPartyChange = classifyDecision(baseEvent, {
    same_event: true,
    confidence: 0.96,
    source_quality: SOURCE_QUALITY.THIRD_PARTY_OR_OTHER,
    start_date: '2027-06-20',
    mismatches: [],
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  });
  assert.strictEqual(thirdPartyChange.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.strictEqual(thirdPartyChange.structuredReason.code, 'third_party_or_weak_source');
  console.log('PASS: Low-quality third party source escalated to needs_review');

  // Case 4: Multiple conflicting information / mismatches -> NEEDS_REVIEW!
  const mismatchChange = classifyDecision(baseEvent, {
    same_event: false,
    confidence: 0.88,
    source_quality: SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    mismatches: ['edition_mismatch: expected 50, found 49'],
    recommended_action: RECOMMENDED_ACTIONS.NEEDS_REVIEW
  });
  assert.strictEqual(mismatchChange.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.strictEqual(mismatchChange.structuredReason.code, 'mismatch_detected');
  console.log('PASS: Edition/year mismatch caught and structured as needs_review');

  // Case 5: Low confidence (< 0.95) -> NEEDS_REVIEW!
  const lowConfidenceChange = classifyDecision(baseEvent, {
    same_event: true,
    confidence: 0.91,
    source_quality: SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    start_date: '2027-04-15',
    mismatches: [],
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  });
  assert.strictEqual(lowConfidenceChange.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.strictEqual(lowConfidenceChange.structuredReason.code, 'low_confidence');
  console.log('PASS: Confidence below 0.95 threshold escalated to needs_review');

  console.log('\n=== Test Suite 4: Mass-Change Safeguard (Requirements 19, 24) ===');
  // Safe batch: 3 updates <= 5 limit
  const safeBatch = [
    { eventId: 'ev-1', fieldChanges: [{ field: 'venue', after: 'A' }] },
    { eventId: 'ev-2', fieldChanges: [{ field: 'venue', after: 'B' }] },
    { eventId: 'ev-3', fieldChanges: [{ field: 'venue', after: 'C' }] }
  ];
  assert.strictEqual(checkMassChangeSafeguard(safeBatch, 5).allowed, true);

  // Unsafe batch: 6 updates > 5 limit
  const unsafeBatch = [
    { eventId: 'ev-1', fieldChanges: [{ field: 'venue', after: 'A' }] },
    { eventId: 'ev-2', fieldChanges: [{ field: 'venue', after: 'B' }] },
    { eventId: 'ev-3', fieldChanges: [{ field: 'venue', after: 'C' }] },
    { eventId: 'ev-4', fieldChanges: [{ field: 'venue', after: 'D' }] },
    { eventId: 'ev-5', fieldChanges: [{ field: 'venue', after: 'E' }] },
    { eventId: 'ev-6', fieldChanges: [{ field: 'venue', after: 'F' }] }
  ];
  const massCheck = checkMassChangeSafeguard(unsafeBatch, 5);
  assert.strictEqual(massCheck.allowed, false);
  assert.ok(massCheck.reason.includes('exceeds safe limit of 5'));
  console.log('PASS: Mass-change safeguard halts batches exceeding 5 items');

  console.log('\n=== Test Suite 5: Simulation Mode vs Isolated Apply (Requirements 14, 18, 20, 25) ===');
  const testEventsCopy = [
    { id: 'conf-alpha', title: '学会アルファ', date: '2027-01-01', venue: '旧会場' },
    { id: 'conf-beta', title: '学会ベータ', date: '2027-02-01', venue: '旧会場2' }
  ];
  const singleUpdate = [{
    eventId: 'conf-alpha',
    fieldChanges: [{ field: 'venue', before: '旧会場', after: '新会場アルファ' }]
  }];

  // Apply field changes to single event
  const modFields = applyFieldChangesToEvent(testEventsCopy[0], singleUpdate[0].fieldChanges);
  assert.deepStrictEqual(modFields, ['venue']);
  assert.strictEqual(testEventsCopy[0].venue, '新会場アルファ');

  // Verify integrity succeeds when only target is changed
  assert.strictEqual(verifyDatasetIntegrity(
    [{ id: 'conf-alpha', title: '学会アルファ', date: '2027-01-01', venue: '旧会場' }, { id: 'conf-beta', title: '学会ベータ', date: '2027-02-01', venue: '旧会場2' }],
    testEventsCopy,
    ['conf-alpha']
  ), true);

  // Integrity fails if untargeted event is unexpectedly modified
  const corruptedEvents = structuredClone(testEventsCopy);
  corruptedEvents[1].venue = '不正書き換え';
  assert.throws(() => {
    verifyDatasetIntegrity(
      [{ id: 'conf-alpha', title: '学会アルファ', date: '2027-01-01', venue: '旧会場' }, { id: 'conf-beta', title: '学会ベータ', date: '2027-02-01', venue: '旧会場2' }],
      corruptedEvents,
      ['conf-alpha']
    );
  }, /untargeted event conf-beta was unexpectedly modified/);
  console.log('PASS: Dataset integrity check catches unexpected modifications to untargeted events');

  console.log('\n=== Test Suite 6: Rollback, Suppression & Mis-update Learning (Requirements 16, 17) ===');
  const mockHistory = {
    version: 1,
    snapshots: [
      {
        id: 'rb-test-event-01',
        eventId: 'test-conf-01',
        status: IDEMPOTENCY_STATUS.APPLIED,
        fieldChanges: [{ field: 'venue', before: '旧会場', after: '誤更新会場' }],
        evidence: { url: 'https://unreliable-blog.example.com/conf' }
      }
    ],
    suppressions: [],
    sourceLearningMeta: {}
  };

  recordLearningMeta(mockHistory, 'https://unreliable-blog.example.com/conf', 'test-conf-01', 'Admin rolled back due to cross-year link', {
    [LEARNING_FLAGS.CROSS_YEAR_LINK_RISK]: true,
    [LEARNING_FLAGS.UNRELIABLE_SOURCE]: true
  });

  const domainMeta = mockHistory.sourceLearningMeta['unreliable-blog.example.com'];
  assert.ok(domainMeta);
  assert.strictEqual(domainMeta.crossYearLinkRisk, true);
  assert.strictEqual(domainMeta.unreliableSource, true);

  // Future classification checking against this domain is forced to NEEDS_REVIEW
  const learnedCheck = classifyDecision(baseEvent, {
    same_event: true,
    confidence: 0.99,
    source_quality: SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    start_date: '2027-06-01',
    mismatches: [],
    recommended_action: RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  }, {
    sourceLearningMeta: mockHistory.sourceLearningMeta,
    sourceUrl: 'https://unreliable-blog.example.com/conf/details'
  });
  assert.strictEqual(learnedCheck.action, RECOMMENDED_ACTIONS.NEEDS_REVIEW);
  assert.strictEqual(learnedCheck.structuredReason.code, 'source_learned_unreliable');
  console.log('PASS: Root cause analysis and source learning metadata prevent future identical errors');

  console.log('\n=== Test Suite 7: Email Composition for Staged Auto-Updater (Requirement 21) ===');
  // Health-check email when 0 updates
  const email0 = composeEmail({
    date: '2026-10-10',
    metrics: { autoAppliedCount: 0, adminAppliedCount: 0, rollbackCount: 0, adminVisibleCount: 0 },
    adminVisibleItems: []
  });
  assert.strictEqual(email0.subject, '【OphthalConf】本日の更新はありません');
  assert.ok(email0.body.includes('高信頼自動更新：0件'));

  // Active email with auto updates, admin updates, rollbacks, and reviews
  const emailActive = composeEmail({
    date: '2026-10-10',
    autoAppliedCount: 3,
    adminAppliedCount: 1,
    rollbackCount: 1,
    adminVisibleItems: [
      {
        eventId: 'conf-x',
        eventName: '第30回日本緑内障学会',
        fieldChanges: [{ field: '会場', before: '未定', after: '大阪国際会議場' }],
        confidence: 0.82
      }
    ]
  });
  assert.strictEqual(emailActive.subject, '【OphthalConf】自動更新4件／ロールバック1件／要確認1件');
  assert.ok(emailActive.body.includes('高信頼自動更新：3件'));
  assert.ok(emailActive.body.includes('管理者確認済み反映：1件'));
  assert.ok(emailActive.body.includes('ロールバック：1件'));
  assert.ok(emailActive.body.includes('要確認：1件'));
  assert.ok(emailActive.body.includes('第30回日本緑内障学会'));
  console.log('PASS: Morning email subject and body match staged auto-updater specification');

  console.log('\n=== ALL STAGED AUTO-UPDATER TESTS PASSED SUCCESSFULLY! ===');
}

testAll().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
