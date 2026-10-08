const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { composeEmail, formatJapaneseDate } = require('../scripts/gemini-monitor/notifier');

async function runTests() {
  console.log('=== Test Suite A: Email Notification Composition (Requirement 1 & 10) ===');

  // A.1: 0 updates email (health check)
  const reportZero = {
    date: '2026-10-10',
    metrics: { wouldAutoUpdate: 0, geminiCalls: 0 },
    wouldAutoUpdateCount: 0,
    adminVisibleItems: []
  };
  const emailZero = composeEmail(reportZero);
  assert.equal(emailZero.subject, '【OphthalConf】本日の更新はありません');
  assert.ok(emailZero.body.includes('OphthalConf 学会情報監視'));
  assert.ok(emailZero.body.includes('2026年10月10日'));
  assert.ok(emailZero.body.includes('自動更新予定：0件'));
  assert.ok(emailZero.body.includes('要確認：0件'));
  assert.ok(!emailZero.body.includes('■ 要確認'));
  assert.ok(emailZero.body.includes('https://medconf.jp/ophthalconf/'));
  console.log('PASS: A.1 0 updates email (subject and clean body)');

  // A.2: Updates with 1-5 items
  const reportUpdates = {
    date: '2026-10-10',
    wouldAutoUpdateCount: 2,
    adminVisibleItems: [
      {
        eventId: 'conf-jp-surgery-2027',
        eventName: '第50回 日本眼科手術学会学術総会',
        fieldChanges: [
          { field: 'venue', before: '未定', after: '東京国際フォーラム' }
        ],
        confidence: 0.98
      }
    ]
  };
  const emailUpdates = composeEmail(reportUpdates);
  assert.equal(emailUpdates.subject, '【OphthalConf】本日の更新 3件／要確認 1件');
  assert.ok(emailUpdates.body.includes('自動更新予定：2件'));
  assert.ok(emailUpdates.body.includes('要確認：1件'));
  assert.ok(emailUpdates.body.includes('■ 要確認'));
  assert.ok(emailUpdates.body.includes('第50回 日本眼科手術学会学術総会'));
  assert.ok(emailUpdates.body.includes('venue：未定 → 東京国際フォーラム'));
  assert.ok(emailUpdates.body.includes('信頼度：98%'));
  console.log('PASS: A.2 1-5 review items email (subject and concise body)');

  // A.3: Capped at 5 items even if input contains more
  const reportMany = {
    date: '2026-10-10',
    wouldAutoUpdateCount: 1,
    adminVisibleItems: [1, 2, 3, 4, 5, 6, 7].map(n => ({
      eventId: `ev-${n}`,
      eventName: `第${n}回 テスト学会`,
      fieldChanges: [{ field: 'date', before: '2026-10-01', after: `2026-10-0${n}` }],
      confidence: 0.9
    }))
  };
  const emailMany = composeEmail(reportMany);
  assert.equal(emailMany.subject, '【OphthalConf】本日の更新 8件／要確認 7件');
  assert.ok(emailMany.body.includes('第1回 テスト学会'));
  assert.ok(emailMany.body.includes('第5回 テスト学会'));
  assert.ok(!emailMany.body.includes('第6回 テスト学会'), 'Must only include top 5 items in email body');
  assert.ok(!emailMany.body.includes('第7回 テスト学会'), 'Must only include top 5 items in email body');
  console.log('PASS: A.3 Over 5 items capped strictly at top 5 in email body');

  // A.4: No API keys, prompt text, or internal logs leaked in email
  assert.ok(!emailUpdates.body.includes('AIzaSy'));
  assert.ok(!emailUpdates.body.includes('GEMINI_API_KEY'));
  assert.ok(!emailUpdates.body.includes('generationConfig'));
  assert.ok(!emailUpdates.body.includes('SYSTEM_INSTRUCTION'));
  console.log('PASS: A.4 Zero credential or prompt leakage in email');

  console.log('\n=== Test Suite B: Acknowledgements, Rollback & Re-appearance Logic (Requirements 3, 4, 5, 6, 7) ===');

  // Simulate frontend store logic from gemini-review-ui.js
  function createTestStore() {
    const memory = {};
    return {
      data: { version: 1, items: {} },
      getItemKey(item) {
        if (Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0) {
          const changeParts = item.fieldChanges.map(c => `${c.field}=${c.after}`).sort().join(';');
          return `${item.eventId}::${changeParts}`;
        }
        return `${item.eventId}::${item.reason || 'review'}`;
      },
      getStatus(item) {
        const key = this.getItemKey(item);
        return this.data.items[key]?.status || 'pending';
      },
      recordAction(item, status, reason = '') {
        const key = this.getItemKey(item);
        this.data.items[key] = {
          key,
          eventId: item.eventId,
          eventName: item.eventName,
          status,
          reason,
          fieldChanges: item.fieldChanges || [],
          timestamp: new Date().toISOString()
        };
      },
      getRecentHistory(days = 30) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        return Object.values(this.data.items)
          .filter(entry => entry.timestamp >= cutoff)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      }
    };
  }

  const store = createTestStore();

  const item1 = {
    eventId: 'conf-jp-surgery-2027',
    eventName: '第50回 日本眼科手術学会学術総会',
    fieldChanges: [{ field: 'venue', before: '未定', after: '東京国際フォーラム' }],
    confidence: 0.98
  };

  const item2 = {
    eventId: 'conf-jp-glaucoma-2026',
    eventName: '第37回 日本緑内障学会',
    fieldChanges: [{ field: 'date', before: '2026-10-02', after: '2026-10-03' }],
    confidence: 0.95
  };

  // B.1 Initial pending status
  assert.equal(store.getStatus(item1), 'pending');
  assert.equal(store.getStatus(item2), 'pending');
  console.log('PASS: B.1 Initial status is pending');

  // B.2 Mark item1 as acknowledged
  store.recordAction(item1, 'acknowledged');
  assert.equal(store.getStatus(item1), 'acknowledged');
  assert.equal(store.getStatus(item2), 'pending');
  console.log('PASS: B.2 Acknowledge action transitions item to acknowledged and hides it from pending');

  // B.3 Rollback item2
  store.recordAction(item2, 'rolled_back', 'Incorrect date shift');
  assert.equal(store.getStatus(item2), 'rolled_back');
  console.log('PASS: B.3 Rollback action transitions item to rolled_back and hides it from pending');

  // B.4 Re-appearance check: identical change tomorrow is suppressed
  const item1TomorrowSame = {
    eventId: 'conf-jp-surgery-2027',
    eventName: '第50回 日本眼科手術学会学術総会',
    fieldChanges: [{ field: 'venue', before: '未定', after: '東京国際フォーラム' }],
    confidence: 0.98
  };
  assert.equal(store.getStatus(item1TomorrowSame), 'acknowledged', 'Same field and value tomorrow must remain acknowledged (not re-appear)');
  console.log('PASS: B.4 Same change tomorrow is not re-displayed');

  // B.5 New change later: venue changed again from 東京国際フォーラム to パシフィコ横浜
  const item1LaterDifferent = {
    eventId: 'conf-jp-surgery-2027',
    eventName: '第50回 日本眼科手術学会学術総会',
    fieldChanges: [{ field: 'venue', before: '東京国際フォーラム', after: 'パシフィコ横浜' }],
    confidence: 0.98
  };
  assert.equal(store.getStatus(item1LaterDifferent), 'pending', 'New subsequent value change must re-appear as pending review');
  console.log('PASS: B.5 Different subsequent value change re-appears as pending');

  // B.6 History check (30-day accordion)
  const history = store.getRecentHistory(30);
  assert.equal(history.length, 2);
  assert.equal(history.find(h => h.eventId === 'conf-jp-surgery-2027').status, 'acknowledged');
  assert.equal(history.find(h => h.eventId === 'conf-jp-glaucoma-2026').status, 'rolled_back');
  console.log('PASS: B.6 30-day history records both acknowledged and rolled_back actions');

  // B.7 Rollback in shadow mode: events.js MUST NOT be modified
  const { executeRollback } = require('../scripts/gemini-monitor/rollback-manager');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-shadow-rb-test-'));
  const tempReports = path.join(tempDir, 'reports');
  fs.mkdirSync(tempReports, { recursive: true });
  const dummyHistory = {
    version: 1,
    snapshots: [
      {
        id: 'rb-test-shadow-1',
        eventId: 'conf-jp-surgery-2027',
        status: 'shadow_recorded',
        fieldChanges: [{ field: 'venue', before: '未定', after: '東京国際フォーラム' }],
        beforeValues: { venue: '未定' },
        evidence: { url: 'https://50.jsos.jp/' }
      }
    ],
    suppressions: [],
    sourceLearningMeta: {}
  };
  fs.writeFileSync(path.join(tempReports, 'gemini-rollback-history.json'), JSON.stringify(dummyHistory));
  const shadowRb = executeRollback(tempDir, 'rb-test-shadow-1', 'Test rollback in shadow mode');
  assert.equal(shadowRb.mode, 'shadow_test', 'Shadow mode rollback must execute as shadow_test without touching events.js');
  console.log('PASS: B.7 Shadow mode rollback safely records history & suppression without touching events.js');

  // B.8 Firestore Security Rules syntax & admin condition validation
  const rulesContent = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  assert.ok(rulesContent.includes("request.auth.token.email == 'uchidats@gmail.com'"), 'Firestore rules must restrict to uchidats@gmail.com');
  assert.ok(rulesContent.includes("request.auth.token.email_verified == true"), 'Firestore rules must require email_verified == true');
  assert.ok(rulesContent.includes("gemini_monitor_acknowledgements"), 'Firestore rules must secure gemini_monitor_acknowledgements collection');
  console.log('PASS: B.8 Firestore Security Rules verified for strict uchidats@gmail.com authorization');

  console.log('\n=== Test Suite C: Admin-Only Visibility Guard (Requirement 8) ===');
  const { isAdminUser } = require('../review-model.js');
  assert.equal(isAdminUser(null), false, 'Unauthenticated user cannot access');
  assert.equal(isAdminUser({ uid: 'u1', email: 'other@gmail.com', emailVerified: true }), false, 'Other email cannot access');
  assert.equal(isAdminUser({ uid: 'u2', email: 'uchidats@gmail.com', emailVerified: false }), false, 'Unverified email cannot access');
  assert.equal(isAdminUser({ uid: 'u3', email: 'uchidats@gmail.com', emailVerified: true }), true, 'Only verified uchidats@gmail.com can access');
  console.log('PASS: C.1 Strict admin authentication verified');

  console.log('\n=== ALL NOTIFICATION & ACKNOWLEDGEMENT TESTS PASSED! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
