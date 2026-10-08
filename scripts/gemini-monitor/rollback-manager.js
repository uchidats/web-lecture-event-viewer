const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, atomicWrite, writeJson, readJson } = require('../auto-updater/storage');
const { LEARNING_FLAGS, IDEMPOTENCY_STATUS } = require('./constants');

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
  isShadow = true,
  status = null
}) {
  const timestamp = new Date().toISOString();
  const id = `rb-${eventId}-${timestamp.replace(/[:.]/g, '-')}`;

  const snapshot = {
    id,
    eventId,
    eventName,
    timestamp,
    status: status || (isShadow ? IDEMPOTENCY_STATUS.DETECTED : IDEMPOTENCY_STATUS.APPLIED),
    beforeValues: beforeValues || {},
    afterValues: afterValues || {},
    fieldChanges: fieldChanges || [],
    evidence: {
      url: evidence?.url || null,
      sourceQuality: evidence?.sourceQuality || null,
      confidence: evidence?.confidence || null,
      reason: evidence?.reason || null
    }
  };

  history.snapshots.unshift(snapshot);
  if (history.snapshots.length > 200) {
    history.snapshots = history.snapshots.slice(0, 200);
  }

  return snapshot;
}

/**
 * Update domain-level or source-level learning metadata (Requirement 17).
 */
function recordLearningMeta(history, sourceUrl, eventId, reason, flags = {}) {
  if (!sourceUrl) return;

  try {
    const hostname = new URL(sourceUrl).hostname;
    if (!history.sourceLearningMeta[hostname]) {
      history.sourceLearningMeta[hostname] = {
        rollbackCount: 0,
        [LEARNING_FLAGS.UNRELIABLE_SOURCE]: false,
        [LEARNING_FLAGS.CAREFUL_YEAR_JUDGMENT]: false,
        [LEARNING_FLAGS.CROSS_YEAR_LINK_RISK]: false,
        [LEARNING_FLAGS.BOT_PROTECTED]: false,
        [LEARNING_FLAGS.CONFLICTING_SOURCE]: false,
        notes: []
      };
    }

    const meta = history.sourceLearningMeta[hostname];
    meta.rollbackCount++;

    for (const [flag, val] of Object.entries(flags)) {
      if (val) meta[flag] = true;
    }

    meta.notes.push({
      eventId,
      date: new Date().toISOString(),
      reason: reason || 'Rolled back by administrator',
      flags
    });
  } catch (_) {}
}

/**
 * Execute rollback for a specific snapshot or rollback request.
 * (Requirements 16, 17)
 */
function executeRollback(root, snapshotId, reason = '', options = {}) {
  const history = loadRollbackHistory(root);
  const snapshot = history.snapshots.find(s => s.id === snapshotId || s.eventId === snapshotId);

  if (!snapshot) {
    return {
      success: false,
      reason: `Snapshot not found for ID: ${snapshotId}`
    };
  }

  const rolledBackAt = new Date().toISOString();
  snapshot.status = IDEMPOTENCY_STATUS.ROLLED_BACK;
  snapshot.rolledBackAt = rolledBackAt;
  snapshot.rollbackReason = reason;

  // Record suppressions for all modified fields to prevent re-applying identical values
  if (Array.isArray(snapshot.fieldChanges)) {
    for (const change of snapshot.fieldChanges) {
      history.suppressions.push({
        id: `suppress-${snapshot.eventId}-${change.field}-${rolledBackAt.slice(0, 10)}`,
        eventId: snapshot.eventId,
        field: change.field,
        suppressedValue: change.after,
        suppressedAt: rolledBackAt,
        reason: reason || 'Rolled back by administrator',
        sourceUrl: snapshot.evidence?.url || null,
        meta: {
          [LEARNING_FLAGS.UNRELIABLE_SOURCE]: Boolean(options.unreliableSource),
          [LEARNING_FLAGS.CAREFUL_YEAR_JUDGMENT]: Boolean(options.carefulYearJudgment || change.field === 'title' || change.field === 'date'),
          [LEARNING_FLAGS.CROSS_YEAR_LINK_RISK]: Boolean(options.crossYearLinkRisk),
          [LEARNING_FLAGS.BOT_PROTECTED]: Boolean(options.botProtected),
          [LEARNING_FLAGS.CONFLICTING_SOURCE]: Boolean(options.conflictingSource)
        }
      });
    }
  }

  // Update domain learning metadata
  recordLearningMeta(history, snapshot.evidence?.url, snapshot.eventId, reason, {
    [LEARNING_FLAGS.UNRELIABLE_SOURCE]: Boolean(options.unreliableSource),
    [LEARNING_FLAGS.CAREFUL_YEAR_JUDGMENT]: Boolean(options.carefulYearJudgment),
    [LEARNING_FLAGS.CROSS_YEAR_LINK_RISK]: Boolean(options.crossYearLinkRisk),
    [LEARNING_FLAGS.BOT_PROTECTED]: Boolean(options.botProtected),
    [LEARNING_FLAGS.CONFLICTING_SOURCE]: Boolean(options.conflictingSource)
  });

  // Restore values in events.js if in applied mode
  const isShadowMode = options.shadowMode !== false && snapshot.status !== IDEMPOTENCY_STATUS.APPLIED;
  let restored = false;

  if (!isShadowMode && !options.skipFileRestore) {
    const dataset = loadEvents(root);
    const event = dataset.events.find(e => e.id === snapshot.eventId);
    if (event && snapshot.beforeValues) {
      Object.assign(event, snapshot.beforeValues);
      atomicWrite(dataset.file, dataset.serialize(dataset.events));
      restored = true;
    }
  }

  saveRollbackHistory(root, history);

  return {
    success: true,
    snapshotId,
    mode: isShadowMode ? 'shadow_test' : 'applied_restored',
    restored,
    rolledBackAt,
    suppressionCount: snapshot.fieldChanges.length
  };
}

module.exports = {
  DEFAULT_HISTORY_SCHEMA,
  loadRollbackHistory,
  saveRollbackHistory,
  recordSnapshot,
  recordLearningMeta,
  executeRollback
};
