// Explicit operator action only; never called by the updater or scheduled workflow.
const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, validateEvents, readJson, atomicWrite, writeJson } = require('./auto-updater/storage');
const model = require('../review-model');

function applyReviewedEventUrls({ root, approvals, apply = false }) {
  if (approvals.version !== 1 || approvals.kind !== 'event-url-human-approvals' || !Array.isArray(approvals.decisions) || !approvals.decisions.length)
    throw new Error('Explicit human approval export required');
  const dataset = loadEvents(root), reviewFile = path.join(root, 'reports/auto-update-review.json');
  const queue = readJson(reviewFile, { version: 1, items: [] }), items = model.normalize(queue), changes = [], seen = new Set();
  for (const approval of approvals.decisions) {
    const item = items.find(item => item.reviewId === approval.reviewId && item.signature === approval.signature);
    if (!item?.actionable || item.field !== 'eventOfficialUrl' || approval.decision !== 'approved' ||
        !approval.reviewerId || !Number.isFinite(Date.parse(approval.decidedAt)) || approval.value !== item.value ||
        approval.eventId !== item.eventId || approval.field !== item.field || approval.oldValue !== item.oldValue || seen.has(item.eventId))
      throw new Error('Missing, stale, mismatched or duplicate human approval');
    const event = dataset.events.find(e => e.id === item.eventId);
    if (!event?.isConference || (event.eventOfficialUrl || null) !== item.oldValue) throw new Error('Event changed since review');
    if (item.reviewSnapshot && Object.entries(item.reviewSnapshot).some(([k, v]) => (event[k] ?? null) !== v))
      throw new Error('Event identity changed since review');
    if (!['discovery-single-high-confidence', 'bot-protected-official-candidate', 'event-url-change-needs-review'].includes(item.reason))
      throw new Error('Unverified review reason');
    if (item.reason === 'bot-protected-official-candidate' &&
        !['officialSocietyDomain', 'yearMatches', 'nameMatches', 'editionMatches'].every(k => item.checks?.[k] === true))
      throw new Error('Official corroboration missing');
    event.eventOfficialUrl = item.value;
    seen.add(item.eventId); changes.push({ eventId: event.id, value: item.value, reviewerId: approval.reviewerId, decidedAt: approval.decidedAt });
  }
  validateEvents(dataset.events);
  if (apply) {
    if (fs.readFileSync(dataset.file, 'utf8') !== dataset.original) throw new Error('Dataset changed during review apply');
    const backup = path.join(root, 'reports', 'auto-update-backups', 'human-urls-' + Date.now());
    fs.mkdirSync(backup, { recursive: true });
    fs.writeFileSync(path.join(backup, 'events.js'), dataset.original);
    fs.writeFileSync(path.join(backup, 'auto-update-review.json'), JSON.stringify(queue, null, 2));
    try {
      atomicWrite(dataset.file, dataset.serialize(dataset.events));
      const updated = structuredClone(queue);
      for (const change of changes) {
        const approval = approvals.decisions.find(a => a.eventId === change.eventId);
        const item = updated.items.find(i => (i.id || model.normalize({ items: [i] })[0]?.reviewId) === approval.reviewId);
        Object.assign(item, { status: 'human-applied', humanApproval: approval, appliedAt: new Date().toISOString() });
      }
      writeJson(reviewFile, updated);
    } catch (error) {
      atomicWrite(dataset.file, dataset.original); writeJson(reviewFile, queue); throw error;
    }
  }
  return { mode: apply ? 'apply' : 'dry-run', changes };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2), index = args.indexOf('--decisions');
    if (index < 0 || !args[index + 1] || args.some((a, i) => i !== index + 1 && !['--decisions', '--apply'].includes(a)))
      throw new Error('Use --decisions <approval-export.json> [--apply]; default dry-run');
    console.log(JSON.stringify(applyReviewedEventUrls({ root: path.resolve(__dirname, '..'),
      approvals: JSON.parse(fs.readFileSync(args[index + 1], 'utf8')), apply: args.includes('--apply') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { applyReviewedEventUrls };
