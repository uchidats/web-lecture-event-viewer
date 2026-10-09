#!/usr/bin/env node
const path = require('node:path');
const { runGeminiMonitor } = require('./gemini-monitor/monitor');
const { executeRollback, loadRollbackHistory } = require('./gemini-monitor/rollback-manager');

async function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(__dirname, '..');

  if (args.includes('--help')) {
    console.log(`
OphthalConf Gemini 3.8 Flash Lightweight Daily Conference Monitor
Usage:
  node scripts/run-gemini-monitor.js [options]

Options:
  --dry-run             Run in simulation / shadow mode without modifying events.js (default)
  --apply               Apply verified updates to events.js (production auto-apply mode)
  --date YYYY-MM-DD     Specify execution date (defaults to current Tokyo date)
  --force-all           Force check all events ignoring schedule interval
  --event <id>          Check a specific event ID only
  --offline             Run using local deterministic analyzer (no external API calls)
  --rollback <id> [msg] Execute rollback for a given snapshot ID
  --status              Show recent monitoring report summary
  --help                Display this help message
`);
    return;
  }

  // Handle rollback command
  const rollbackIdx = args.indexOf('--rollback');
  if (rollbackIdx !== -1) {
    const snapshotId = args[rollbackIdx + 1];
    const reason = args[rollbackIdx + 2] || 'Admin rollback via CLI';
    if (!snapshotId) {
      console.error('Error: --rollback requires a snapshot ID.');
      process.exitCode = 1;
      return;
    }
    const result = executeRollback(root, snapshotId, reason);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Parse options
  let targetDate = null;
  const dateIdx = args.indexOf('--date');
  if (dateIdx !== -1 && args[dateIdx + 1]) {
    targetDate = args[dateIdx + 1];
  }

  let singleEventId = null;
  const eventIdx = args.findIndex(arg => arg === '--event' || arg === '--single-event' || arg === '--single-event-id');
  if (eventIdx !== -1 && args[eventIdx + 1]) {
    singleEventId = args[eventIdx + 1];
  }

  const forceAll = args.includes('--force-all');
  const offline = args.includes('--offline');
  const applyMode = args.includes('--apply');

  console.log(`Starting Gemini 3.8 Flash Lightweight Conference Monitor (${applyMode ? 'Production Auto-Apply Mode' : 'Shadow / Simulation Mode'})...`);
  const result = await runGeminiMonitor({
    root,
    today: targetDate,
    forceAll,
    singleEventId,
    offline,
    apply: applyMode
  });

  console.log('\n--- Gemini Monitor Run Summary ---');
  console.log(`Report File: ${result.reportFilePath}`);
  console.log(`Date: ${result.report.date} (Mode: ${result.report.mode})`);
  console.log('Metrics:');
  console.log(`  Total Events:               ${result.metrics.totalEvents}`);
  console.log(`  Monitored Today:            ${result.metrics.monitoredToday}`);
  console.log(`  Skipped (Not Due):          ${result.metrics.skippedNotDue}`);
  console.log(`  Skipped (Ended):            ${result.metrics.skippedEnded}`);
  console.log(`  URL Discovery Checks:       ${result.metrics.urlDiscoveryChecks || 0}`);
  console.log(`  URLs Discovered:            ${result.metrics.urlDiscovered || 0}`);
  console.log(`  HTTP Fetched:               ${result.metrics.httpFetched}`);
  console.log(`  Hash Unchanged (Skipped):   ${result.metrics.hashUnchangedSkipped}`);
  console.log(`  Gemini Calls:               ${result.metrics.geminiCalls}`);
  console.log(`  No Change:                  ${result.metrics.noChange}`);
  console.log(`  Would Auto-Update:          ${result.metrics.wouldAutoUpdate}`);
  console.log(`  Auto-Applied:               ${result.metrics.autoAppliedCount}`);
  console.log(`  Admin Acknowledged Applied: ${result.metrics.adminAppliedCount}`);
  console.log(`  Rollbacks:                  ${result.metrics.rollbackCount}`);
  console.log(`  Needs Review:               ${result.metrics.needsReview}`);
  console.log(`  Insufficient Evidence:      ${result.metrics.insufficientEvidence}`);
  console.log(`  Admin Visible Items:        ${result.metrics.adminVisibleCount} (Max 5)`);

  if (result.report.adminVisibleItems.length > 0) {
    console.log('\n--- Admin Action Required (Top <=5 items) ---');
    for (const item of result.report.adminVisibleItems) {
      console.log(`- [${item.eventId}] ${item.eventName}`);
      console.log(`  Severity: ${item.severity} | Confidence: ${item.confidence} | Reason: ${item.reason}`);
      console.log(`  Source: ${item.sourceUrl}`);
      if (item.fieldChanges.length) {
        for (const c of item.fieldChanges) {
          console.log(`  Change: ${c.field} (${c.before} -> ${c.after})`);
        }
      }
    }
  } else {
    console.log('\nAll checks clear. No administrator intervention needed today (0 items).');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Gemini monitor failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { main };
