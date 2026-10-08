#!/usr/bin/env node
const path = require('node:path');
const { runUpdater } = require('./auto-updater/pipeline');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--dry-run', '--help'].includes(arg)) || args.includes('--apply') && args.includes('--dry-run')) throw new Error('Use --dry-run (default) or --apply');
  if (args.includes('--help')) { console.log('node scripts/update-conferences.js [--dry-run | --apply]\nDefault: dry-run. AUTO_UPDATE_DISABLED=1 stops all fetch/apply.'); return; }
  const result = await runUpdater({ root: path.resolve(__dirname, '..'), config: require('../conference-sources'), apply: args.includes('--apply') });
  console.log(JSON.stringify({ outcome: result.outcome, mode: result.mode, sources: result.sourceCount,
    autoChanges: result.autoChanges.length, needsReview: result.needsReview.length,
    missingUrlDiscovery: result.discovery ? { events: result.discovery.records.length,
      highConfidence: result.discovery.review.filter(r => r.reason === 'discovery-single-high-confidence').length,
      reviewItems: result.discovery.review.length } : null,
    blockedAutoChanges: result.blockedAutoChanges.length, stopReason: result.stopReason,
    report: 'reports/auto-update-report.json', review: 'reports/auto-update-review.json' }, null, 2));
  if (result.stopped) process.exitCode = 2;
}
if (require.main === module) main().catch(error => { console.error(`Updater stopped: ${error.message}`); process.exitCode = 1; });
module.exports = { main };
