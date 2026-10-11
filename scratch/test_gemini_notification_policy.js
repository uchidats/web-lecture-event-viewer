const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');
const { sendDailyMonitorNotification } = require('../scripts/gemini-monitor/notifier');
const { notifyWorkflowRun } = require('../scripts/send-gemini-monitor-notification');

async function main() {
  const oldEnvironment = { ...process.env };
  const oldConnect = tls.connect;
  let smtpConnections = 0;
  tls.connect = () => { smtpConnections++; throw new Error('Real SMTP forbidden in notification tests'); };
  try {
    process.env.SMTP_USER = 'mock@example.invalid';
    process.env.SMTP_PASS = 'mock-password';
    process.env.NOTIFICATION_EMAIL = 'recipient@example.invalid';
    process.env.ENABLE_AUTO_APPLY = 'false';
    delete process.env.CLOUD_ACCESS_TOKEN;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ophthal-notification-policy-'));
    fs.copyFileSync(path.resolve(__dirname, '../events.js'), path.join(root, 'events.js'));
    let deliveries = [];
    const sendEmail = async message => { deliveries.push(message); return { success: true }; };
    const report = { date: '2040-01-01', metrics: { autoAppliedCount: 2 }, adminVisibleItems: [] };
    for (const notify of [undefined, false, 'true', 1]) {
      const result = await runGeminiMonitor({ root, today: '2040-01-01', offline: true, apply: false, notify, sendEmail });
      assert.equal(result.notification, null);
    }
    assert.equal(deliveries.length, 0, 'SMTP secrets/default OFF never authorize delivery');
    assert.equal((await sendDailyMonitorNotification(report)).reason, 'notification_disabled');
    assert.equal((await sendDailyMonitorNotification(report, { notify: false, sendEmail })).sent, false);

    // Notification integration tests alone opt in, always with a mock transport.
    const monitorResult = await runGeminiMonitor({ root, today: '2040-01-01', offline: true, apply: false, notify: true, sendEmail });
    assert.equal(monitorResult.notification.sent, true);
    assert.equal(deliveries.length, 1, 'Explicit notify works independently of offline/apply');
    assert.equal(deliveries[0].subject, '【OphthalConf】本日の更新はありません');

    const cases = [
      [{ eventName: 'schedule' }, 1],
      [{ eventName: 'schedule', report: monitorResult.report }, 1],
      [{ eventName: 'workflow_dispatch' }, 0],
      [{ eventName: 'workflow_dispatch', sendNotification: 'true' }, 1],
      [{ eventName: 'workflow_dispatch', sendNotification: true, singleEventId: 'test-id' }, 0],
      [{ eventName: 'schedule', singleEventId: 'test-id' }, 0],
      [{ eventName: 'push', sendNotification: true }, 0]
    ];
    for (const [options, expected] of cases) {
      deliveries = [];
      await notifyWorkflowRun({ report, sendEmail, workflowStatus: 'success', ...options });
      assert.equal(deliveries.length, expected, JSON.stringify(options));
    }
    deliveries = [];
    await notifyWorkflowRun({ eventName: 'schedule', reportPath: path.join(root, 'missing.json'),
      workflowStatus: 'failure', sendEmail });
    assert.equal(deliveries.length, 1, 'Failed run also sends one final summary');
    assert.ok(deliveries[0].body.includes('更新結果は未集計'));
    assert.ok(deliveries[0].body.includes('failure'));
    assert.equal(smtpConnections, 0, 'No real SMTP connection, even with secrets present');

    const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/gemini-monitor.yml'), 'utf8');
    const notificationStep = workflow.indexOf('- name: Send one final monitoring summary');
    assert.ok(notificationStep > workflow.indexOf('- name: Upload monitoring report artifacts'));
    assert.ok(!workflow.slice(0, notificationStep).includes('SMTP_USER:'));
    assert.equal((workflow.match(/SMTP_USER:/g) || []).length, 1);
    assert.ok(workflow.includes('always()'));
    assert.ok(workflow.includes('--report-output'));
    assert.ok(!workflow.includes('--notify'));
    console.log('PASS: default/false with secrets=0; explicit mock=1; schedule=1; zero updates=1; manual=0; manual opt-in=1; single event=0; failed run=1; SMTP connections=0; final step only');
  } finally {
    tls.connect = oldConnect;
    for (const key of Object.keys(process.env)) if (!(key in oldEnvironment)) delete process.env[key];
    Object.assign(process.env, oldEnvironment);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
