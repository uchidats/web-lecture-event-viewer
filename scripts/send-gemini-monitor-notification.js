const fs = require('node:fs');
const { sendDailyMonitorNotification } = require('./gemini-monitor/notifier');

function shouldNotify({ eventName, sendNotification, singleEventId } = {}) {
  if (singleEventId) return false;
  return eventName === 'schedule' ||
    (eventName === 'workflow_dispatch' && (sendNotification === true || sendNotification === 'true'));
}

async function notifyWorkflowRun(options = {}) {
  if (!shouldNotify(options)) return { sent: false, reason: 'notification_disabled' };
  // Only read the current run's private snapshot, never a checked-in daily/test report.
  const report = options.report || (options.reportPath && fs.existsSync(options.reportPath)
    ? JSON.parse(fs.readFileSync(options.reportPath, 'utf8'))
    : { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      metrics: {}, adminVisibleItems: [], monitorIncomplete: true });
  const result = await sendDailyMonitorNotification({ ...report,
    workflowStatus: options.workflowStatus, runUrl: options.runUrl }, {
    notify: true, sendEmail: options.sendEmail,
    smtpUser: options.smtpUser, smtpPass: options.smtpPass, to: options.to
  });
  return result;
}

async function main() {
  const result = await notifyWorkflowRun({
    eventName: process.env.GITHUB_EVENT_NAME,
    sendNotification: process.env.SEND_NOTIFICATION,
    singleEventId: process.env.SINGLE_EVENT_ID,
    reportPath: process.env.MONITOR_REPORT_PATH,
    workflowStatus: process.env.WORKFLOW_STATUS,
    runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  });
  if (!result.sent && result.reason !== 'notification_disabled') {
    throw new Error('Daily notification was not delivered; see notification step output');
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { shouldNotify, notifyWorkflowRun };
