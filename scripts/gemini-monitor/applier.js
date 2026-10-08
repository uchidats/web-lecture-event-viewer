const path = require('node:path');
const { loadEvents, atomicWrite } = require('../auto-updater/storage');
const { THRESHOLDS } = require('./constants');

/**
 * Apply field changes to a single event object.
 */
function applyFieldChangesToEvent(event, fieldChanges) {
  const appliedFields = [];

  for (const change of fieldChanges) {
    const { field, after } = change;
    if (field.includes('.')) {
      const parts = field.split('.');
      let current = event;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = after;
      appliedFields.push(field);
    } else {
      event[field] = after;
      appliedFields.push(field);
    }
  }

  return appliedFields;
}

/**
 * Verify dataset integrity after update:
 * - Event count unchanged
 * - Event IDs and order unchanged
 * - Only specified event IDs were touched
 */
function verifyDatasetIntegrity(originalEvents, modifiedEvents, targetEventIds) {
  if (originalEvents.length !== modifiedEvents.length) {
    throw new Error(`Integrity error: event count changed from ${originalEvents.length} to ${modifiedEvents.length}`);
  }

  const targetSet = new Set(targetEventIds);

  for (let i = 0; i < originalEvents.length; i++) {
    const orig = originalEvents[i];
    const mod = modifiedEvents[i];

    if (orig.id !== mod.id) {
      throw new Error(`Integrity error: event order mismatch at index ${i} (${orig.id} vs ${mod.id})`);
    }

    if (!targetSet.has(orig.id)) {
      // Ensure untargeted event was NOT modified
      if (JSON.stringify(orig) !== JSON.stringify(mod)) {
        throw new Error(`Integrity error: untargeted event ${orig.id} was unexpectedly modified`);
      }
    }
  }

  return true;
}

/**
 * Mass change safeguard check (Requirement 19):
 * If more than MAX_AUTO_APPLY_BATCH (5) events are scheduled to update at once,
 * halt automated apply and escalate to needs_review.
 */
function checkMassChangeSafeguard(updateBatches, limit = THRESHOLDS.MAX_AUTO_APPLY_BATCH) {
  if (updateBatches.length > limit) {
    return {
      allowed: false,
      reason: `Batch contains ${updateBatches.length} events, which exceeds safe limit of ${limit}`,
      count: updateBatches.length,
      limit
    };
  }
  return { allowed: true, count: updateBatches.length, limit };
}

/**
 * Execute automated update batch against events.js.
 * Supports simulation/dry-run mode (Requirement 25) and real apply mode.
 *
 * @param {string} root - Repository root path
 * @param {Array} updateBatches - [{ eventId, fieldChanges, reason, source }]
 * @param {Object} options - { dryRun, massChangeLimit }
 */
function applyBatchUpdates(root, updateBatches = [], options = {}) {
  if (updateBatches.length === 0) {
    return {
      success: true,
      appliedCount: 0,
      appliedEvents: [],
      mode: options.dryRun !== false ? 'simulation' : 'production'
    };
  }

  // 1. Mass change safeguard
  const limit = options.massChangeLimit || THRESHOLDS.MAX_AUTO_APPLY_BATCH;
  const safeguard = checkMassChangeSafeguard(updateBatches, limit);
  if (!safeguard.allowed) {
    return {
      success: false,
      haltedBySafeguard: true,
      reason: safeguard.reason,
      appliedCount: 0,
      appliedEvents: [],
      mode: options.dryRun !== false ? 'simulation' : 'production'
    };
  }

  // 2. Load dataset
  const dataset = loadEvents(root);
  const originalEventsClone = structuredClone(dataset.events);
  const targetIds = updateBatches.map(b => b.eventId);

  const appliedSummary = [];

  for (const batch of updateBatches) {
    const event = dataset.events.find(e => e.id === batch.eventId);
    if (!event) {
      throw new Error(`Target event ID not found in dataset: ${batch.eventId}`);
    }

    const appliedFields = applyFieldChangesToEvent(event, batch.fieldChanges);
    appliedSummary.push({
      eventId: batch.eventId,
      eventName: event.title,
      appliedFields,
      fieldChanges: batch.fieldChanges,
      source: batch.source || 'auto_update'
    });
  }

  // 3. Verify integrity
  verifyDatasetIntegrity(originalEventsClone, dataset.events, targetIds);

  const isDryRun = options.dryRun !== false;

  // 4. Atomic write if real apply mode
  if (!isDryRun) {
    const serialized = dataset.serialize(dataset.events);
    atomicWrite(dataset.file, serialized);
  }

  return {
    success: true,
    appliedCount: appliedSummary.length,
    appliedEvents: appliedSummary,
    mode: isDryRun ? 'simulation' : 'production'
  };
}

module.exports = {
  applyFieldChangesToEvent,
  verifyDatasetIntegrity,
  checkMassChangeSafeguard,
  applyBatchUpdates
};
