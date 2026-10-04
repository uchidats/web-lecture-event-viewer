const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { normalizeDate } = require('./extract');

function loadEvents(root) {
  const file = path.join(root, 'events.js');
  const original = fs.readFileSync(file, 'utf8');
  const match = original.match(/^([\s\S]*?\bconst sampleEvents\s*=\s*)(\[[\s\S]*\])(\s*;\s*)$/);
  if (!match) throw new Error('events.js must contain a JSON-compatible sampleEvents array');
  // Parse JSON, never execute a downloaded or modified JS dataset.
  const events = JSON.parse(match[2]);
  validateEvents(events);
  return { file, original, events, serialize: data => match[1] + JSON.stringify(data, null, 2).replace(/\n/g, original.includes('\r\n') ? '\r\n' : '\n') + match[3] };
}

function validateEvents(events, baseline) {
  if (!Array.isArray(events) || !events.length) throw new Error('Empty/invalid event array');
  const ids = new Set();
  for (const e of events) {
    if (!e.id || ids.has(e.id)) throw new Error('Duplicate/missing event ID');
    ids.add(e.id);
    for (const field of ['date', 'endDate']) if (e[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(e[field]) || !normalizeDate(e[field]))) throw new Error('Invalid event date format');
    if (e.date && e.endDate && e.endDate < e.date) throw new Error('Invalid event date order');
  }
  for (const e of events) if (e.parentConferenceId && !events.some(p => p.id === e.parentConferenceId && p.isConference)) throw new Error('Invalid parentConferenceId');
  if (baseline && (events.length !== baseline.length || events.some((e, i) => e.id !== baseline[i].id))) throw new Error('Records/IDs/order must not change');
}

function readJson(file, fallback) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : structuredClone(fallback); }
function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}
function writeJson(file, value) { atomicWrite(file, JSON.stringify(value, null, 2) + '\n'); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function mergeReview(previous, entries, checkedAt) {
  if (!Array.isArray(previous.items)) throw new Error('Invalid review queue schema');
  const items = structuredClone(previous.items);
  for (const entry of entries) {
    const id = hash(JSON.stringify([entry.eventId, entry.field, entry.value, entry.reason, entry.url]));
    const existing = items.find(item => item.id === id);
    if (existing) { existing.lastSeen = checkedAt; existing.occurrences++; }
    else items.push({ ...entry, id, status: 'needs-review', firstSeen: checkedAt, lastSeen: checkedAt, occurrences: 1 });
  }
  // Exceptions are never silently discarded, even if a later fetch cannot reproduce them.
  return { version: 1, updatedAt: checkedAt, items };
}

const checks = [
  ...['events.js', 'script.js', 'companies.js', 'venues.js', 'conference-sources.js', 'scripts/update-conferences.js',
    'scripts/auto-updater/fetch.js', 'scripts/auto-updater/extract.js', 'scripts/auto-updater/policy.js',
    'scripts/auto-updater/storage.js', 'scripts/auto-updater/pipeline.js'].map(file => ['--check', file]),
  ['scratch/test_ended_conferences.js'], ['scratch/test_conference_history.js'],
  ['scratch/test_venue_master.js'], ['scratch/test_comprehensive_regression.js'],
  ['scratch/test_abstract_submission.js'], ['scratch/test_auto_updater.js'],
  ['scratch/test_brand_storage.js'], ['scratch/test_companies.js'], ['scratch/test_time_zones.js']
];
function runChecks(root) {
  const results = [];
  for (const args of checks) {
    const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
    results.push({ command: `node ${args.join(' ')}`, passed: result.status === 0 && !result.error,
      output: (result.stdout + result.stderr).trim(), error: result.error?.message });
    if (!results.at(-1).passed) return { passed: false, results };
  }
  return { passed: true, results };
}

function assertCleanMain(root) {
  const git = args => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'Git check failed');
    return r.stdout.trim();
  };
  if (git(['branch', '--show-current']) !== 'main') throw new Error('Apply requires main');
  if (git(['status', '--porcelain'])) throw new Error('Apply requires a clean working tree');
  return git(['rev-parse', 'HEAD']);
}

module.exports = { loadEvents, validateEvents, readJson, atomicWrite, writeJson, hash, mergeReview, runChecks, assertCleanMain };
