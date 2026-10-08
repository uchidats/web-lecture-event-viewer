const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fetchOfficialPage } = require('./fetch');
const { adapters } = require('./extract');
const { assess, applyChanges } = require('./policy');
const { eventSourceUrl } = require('./event-urls');
const { discoverMissingEventUrls } = require('./discovery');
const { trustedUrl } = require('./fetch');
const { evaluateMassChanges } = require('./mass-change');
const { loadEvents, validateEvents, readJson, atomicWrite, writeJson, hash, mergeReview, runChecks, assertCleanMain } = require('./storage');

function validateConfig(config, events) {
  if (config.version !== 1 || !Array.isArray(config.sources) || config.sources.length < 1) throw new Error('Invalid source registry');
  const ids = new Set();
  for (const key of ['minConfidence', 'maxAutoChanges', 'maxChangedConferences', 'maxTotalAutoChanges', 'maxFieldsPerEvent', 'maxDateShiftDays', 'maxDeadlineShiftDays', 'timeoutMs', 'maxResponseBytes', 'minYear', 'maxYear']) {
    if (!Number.isFinite(config.defaults[key]) || config.defaults[key] <= 0) throw new Error(`Invalid limit ${key}`);
  }
  if (config.defaults.minConfidence > 1) throw new Error('Invalid confidence threshold');
  if (config.discovery?.enabled && (!Array.isArray(config.discovery.entries) ||
      !Array.isArray(config.discovery.allowedEventHosts) ||
      !Number.isInteger(config.discovery.maxPagesPerEvent) || config.discovery.maxPagesPerEvent < 1 ||
      !Number.isInteger(config.discovery.maxLinksPerIndex) || config.discovery.maxLinksPerIndex < 1)) throw new Error('Invalid discovery registry');
  for (const s of config.sources) {
    if (ids.has(s.id) || !events.some(e => e.id === s.id && e.isConference)) throw new Error('Unknown/duplicate configured ID');
    ids.add(s.id);
    if (!adapters[s.adapter] || !s.identity?.length || !Number.isInteger(s.year) || !s.pages?.some(p => p.role === 'overview')) throw new Error('Invalid adapter/identity/pages');
    if (Number(events.find(e => e.id === s.id).date?.slice(0, 4)) !== s.year) throw new Error('Source edition year differs from event year');
    if (!trustedUrl(eventSourceUrl(s), s)) throw new Error('Invalid event source URL');
    if (s.societyUrl && !trustedUrl(s.societyUrl, s, 'society')) throw new Error('Invalid society source URL');
  }
}

async function runPipeline({ root, config, apply = false, getPage = fetchOfficialPage, checkedAt = new Date().toISOString(),
  check = runChecks, enforceGit = true } = {}) {
  const dataset = loadEvents(root);
  validateConfig(config, dataset.events);
  const reports = path.join(root, 'reports');
  const summaryFile = path.join(reports, 'auto-update-report.json');
  const reviewFile = path.join(reports, 'auto-update-review.json');
  const stateFile = path.join(reports, 'auto-update-source-state.json');
  const historyFile = path.join(reports, 'auto-update-history.json');
  const previousQueue = readJson(reviewFile, { version: 1, items: [] });
  const previousState = readJson(stateFile, { version: 1, sources: {} });
  const previousHistory = readJson(historyFile, { version: 1, changes: [] });
  if (!previousState.sources || !Array.isArray(previousHistory.changes)) throw new Error('Invalid metadata/history JSON');
  const summary = { version: 1, checkedAt, mode: apply ? 'apply' : 'dry-run', outcome: 'dry-run',
  sourceCount: config.sources.length, autoChanges: [], needsReview: [], blockedAutoChanges: [], sources: [], requests: [], stopped: false, stopReason: null, tests: null };
  const finish = () => {
    writeJson(reviewFile, mergeReview(previousQueue, summary.needsReview, checkedAt));
    writeJson(summaryFile, summary);
    return summary;
  };
  if (!config.enabled || process.env.AUTO_UPDATE_DISABLED === '1') { summary.outcome = 'disabled'; return finish(); }
  if (apply && enforceGit) assertCleanMain(root);
  const venueContext = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'venues.js'), 'utf8') + '\nthis.venues = venueMaster;', venueContext, { timeout: 1000 });
  const state = structuredClone(previousState);
  // Calendar-date derivation is fixed to Japan, independent of CI machine timezone.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(checkedAt));
  for (const source of config.sources) {
    const event = dataset.events.find(e => e.id === source.id);
    const candidates = [], issues = [], documents = [];
    for (const page of source.pages) {
      try {
        const document = await getPage(page, source, { ...config.defaults,
          onRequest: request => summary.requests.push({ eventId: source.id, ...request }) });
        documents.push({ url: document.url, fingerprint: document.fingerprint || hash(document.html) });
        const result = adapters[source.adapter](document, { ...source, registrationType: event.registration?.type || event.conferenceRegion || 'domestic' });
        candidates.push(...result.candidates); issues.push(...result.issues);
      } catch (error) {
        summary.needsReview.push({ eventId: source.id, field: null, oldValue: null, url: page.url,
          confidence: 0, reason: 'fetch-failed', error: error.message });
        issues.push(`fetch-failed:${page.role}`);
      }
    }
    const decision = assess(event, source, candidates, [...new Set(issues)], config.defaults, { today, venues: venueContext.venues });
    summary.autoChanges.push(...decision.accepted.map(change => ({ ...change, eventId: source.id })));
    summary.needsReview.push(...decision.review.map(item => ({ ...item, eventId: source.id })));
    summary.stopped ||= decision.halt;
    const fingerprint = documents.length ? hash(JSON.stringify(documents)) : previousState.sources[source.id]?.fingerprint || null;
    const meta = { ...previousState.sources[source.id], officialUrl: source.officialUrl,
      eventOfficialUrl: eventSourceUrl(source), societyUrl: source.societyUrl || null,
      lastChecked: checkedAt, lastChanged: previousState.sources[source.id]?.lastChanged || null,
      confidence: candidates.length ? Math.min(...candidates.map(c => c.confidence)) : 0,
      fingerprint, extractionMethod: source.adapter, autoUpdateEnabled: source.autoUpdateEnabled,
      fetchSucceeded: documents.length === source.pages.length, pages: documents };
    state.sources[source.id] = meta;
    summary.sources.push({ eventId: source.id, ...meta, candidateCount: candidates.length });
  }
  summary.discovery = await discoverMissingEventUrls({ events: dataset.events, config, getPage, checkedAt });
  summary.needsReview.push(...summary.discovery.review);
  summary.massChangeAssessment = evaluateMassChanges(summary.autoChanges, config);
  if (summary.massChangeAssessment.stopped) {
    summary.stopped = true; summary.stopReason = 'mass-change-limit';
  }
  if (summary.stopped) {
    summary.outcome = 'stopped'; summary.stopReason ||= 'abnormal-date-or-structured-data';
    summary.blockedAutoChanges = summary.autoChanges.splice(0).map(c => ({ ...c, reason: summary.stopReason }));
    return finish();
  }
  const updated = applyChanges(dataset.events, summary.autoChanges);
  validateEvents(updated, dataset.events);
  const serialized = dataset.serialize(updated);
  // Syntax-check projected output before replacing the original, including dry-run.
  new vm.Script(serialized);
  if (!apply) return finish();
  if (!summary.autoChanges.length) { summary.outcome = 'no-changes'; writeJson(stateFile, state); return finish(); }
  const backupDir = path.join(reports, 'auto-update-backups', checkedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'events.js'), dataset.original);
  for (const file of [reviewFile, stateFile, historyFile]) if (fs.existsSync(file)) fs.copyFileSync(file, path.join(backupDir, path.basename(file)));
  summary.backup = path.relative(root, backupDir).replace(/\\/g, '/');
  let datasetWritten = false;
  try {
    if (fs.readFileSync(dataset.file, 'utf8') !== dataset.original) throw new Error('Dataset changed during fetch');
    if (enforceGit) assertCleanMain(root);
    atomicWrite(dataset.file, serialized);
    datasetWritten = true;
    summary.tests = check(root);
    if (!summary.tests.passed) throw new Error('Regression tests failed');
    for (const id of new Set(summary.autoChanges.map(c => c.eventId))) state.sources[id].lastChanged = checkedAt;
    const history = { version: 1, changes: [...previousHistory.changes, ...summary.autoChanges.map(c => ({
      ...c, newValue: c.value, changedAt: checkedAt, status: 'auto-applied', fingerprint: state.sources[c.eventId].fingerprint
    }))] };
    writeJson(stateFile, state); writeJson(historyFile, history);
    summary.outcome = 'applied';
  } catch (error) {
    if (datasetWritten) atomicWrite(dataset.file, dataset.original);
    // Restore all persisted metadata as well as the event dataset.
    for (const file of [stateFile, historyFile]) {
      const backup = path.join(backupDir, path.basename(file));
      if (fs.existsSync(backup)) atomicWrite(file, fs.readFileSync(backup, 'utf8'));
      else if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    summary.outcome = 'rolled-back'; summary.stopped = true; summary.stopReason = error.message;
    summary.needsReview.push(...summary.autoChanges.map(c => ({ ...c, reason: 'apply-or-test-failed', error: error.message })));
  }
  return finish();
}

async function runUpdater(options) {
  if (!options.apply) return runPipeline(options);
  const lock = path.join(options.root, 'reports', 'auto-update.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const fd = fs.openSync(lock, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await runPipeline(options);
  } finally {
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

module.exports = { runUpdater, validateConfig };
