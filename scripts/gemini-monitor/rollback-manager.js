const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, atomicWrite, writeJson, readJson } = require('../auto-updater/storage');

const DEFAULT_HISTORY_SCHEMA = {
  version: 1,
  updatedAt: null,
  snapshots: [],
  suppressions: [],
  sourceLearningMeta: {}
};

/**
 * Load rollback history JSON file.
 */
function loadRollbackHistory(root) {
  const filePath = path.join(root, 'reports', 'gemini-rollback-history.json');
  return readJson(filePath, DEFAULT_HISTORY_SCHEMA);
}

/**
 * Save rollback history JSON file atomically.
 */
function saveRollbackHistory(root, history) {
  const filePath = path.join(root, 'reports', 'gemini-rollback-history.json');
  history.updatedAt = new Date().toISOString();
  writeJson(filePath, history);
}

/**
 * Create a new snapshot for proposed or applied changes.
 */
function recordSnapshot(history, {
  eventId,
  eventName,
  beforeValues,
  afterValues,
  fieldChanges,
  evidence,
  isShadow = true
}) {
  const timestamp = new Date().toISOString();
  const id = `rb-${eventId}-${timestamp.replace(/[:.]/g, '-')}`;

  const snapshot = {
    id,
    eventId,
    eventName,
    timestamp,
    status: isShadow ? 'shadow_recorded' : 'applied',
    beforeValues,
    afterValues,
    fieldChanges,
    evidence: {
      url: evidence.url || null,
      sourceQuality: evidence.sourceQuality || null,
      confidence: evidence.confidence || null,
      reason: evidence.reason || ''
    },
    rollback: null
  };

  history.snapshots.unshift(snapshot);
  // Cap stored history snapshots at 200
  if (history.snapshots.length > 200) history.snapshots.pop();

  return snapshot;
}

/**
 * Roll back an update by snapshot ID.
 * - Restores values prior to the update
 * - Records rollback timestamp and reason
 * - Registers to suppressions list so the identical change is not reapplied tomorrow
 * - Updates sourceLearningMeta for future adaptive learning
 */
function executeRollback(root, snapshotId, reason, options = {}) {
  const history = loadRollbackHistory(root);
  const snapshot = history.snapshots.find(s => s.id === snapshotId);
  if (!snapshot) throw new Error(`Snapshot not found: ${snapshotId}`);

  if (snapshot.rollback) {
    throw new Error(`Snapshot ${snapshotId} has already been rolled back on ${snapshot.rollback.rolledBackAt}`);
  }

  const rolledBackAt = new Date().toISOString();
  snapshot.status = 'rolled_back';
  snapshot.rollback = {
    rolledBackAt,
    reason: reason || 'Admin manual rollback',
    actor: options.actor || 'admin'
  };

  // Add all changed fields to suppression registry to prevent reapplying tomorrow
  for (const change of (snapshot.fieldChanges || [])) {
    const existing = history.suppressions.find(s =>
      s.eventId === snapshot.eventId && s.field === change.field && s.suppressedValue === change.after
    );
    if (!existing) {
      history.suppressions.push({
        id: `suppress-${snapshot.eventId}-${change.field}-${rolledBackAt.slice(0, 10)}`,
        eventId: snapshot.eventId,
        field: change.field,
        suppressedValue: change.after,
        suppressedAt: rolledBackAt,
        reason: reason || 'Rolled back by administrator',
        sourceUrl: snapshot.evidence.url,
        meta: {
          unreliableSource: Boolean(options.unreliableSource),
          carefulYearJudgment: Boolean(options.carefulYearJudgment || change.field === 'edition' || change.field === 'date'),
          crossYearLinkRisk: Boolean(options.crossYearLinkRisk)
        }
      });
    }
  }

  // Update domain-level or source-level learning metadata
  if (snapshot.evidence.url) {
    try {
      const hostname = new URL(snapshot.evidence.url).hostname;
      if (!history.sourceLearningMeta[hostname]) {
        history.sourceLearningMeta[hostname] = {
          rollbackCount: 0,
          notes: []
        };
      }
      history.sourceLearningMeta[hostname].rollbackCount++;
      history.sourceLearningMeta[hostname].notes.push({
        eventId: snapshot.eventId,
        date: rolledBackAt,
        reason: reason || 'Rolled back by admin'
      });
    } catch (_) {}
  }

  // During shadow mode, rollback tests the history & suppression update without modifying events.js.
  // Full dataset restoration in events.js will be connected once production auto-apply is officially enabled.
  const isShadowMode = options.shadowMode !== false && snapshot.status !== 'applied';
  if (!isShadowMode && snapshot.status === 'applied' && !options.skipFileRestore) {
    const dataset = loadEvents(root);
    const event = dataset.events.find(e => e.id === snapshot.eventId);
    if (event && snapshot.beforeValues) {
      Object.assign(event, snapshot.beforeValues);
      atomicWrite(dataset.file, dataset.serialize(dataset.events));
    }
  }

  saveRollbackHistory(root, history);

  return {
    success: true,
    snapshotId,
    mode: isShadowMode ? 'shadow_test' : 'applied_restored',
    rolledBackAt,
    suppressionCount: snapshot.fieldChanges.length
  };
}

module.exports = {
  DEFAULT_HISTORY_SCHEMA,
  loadRollbackHistory,
  saveRollbackHistory,
  recordSnapshot,
  executeRollback
};
