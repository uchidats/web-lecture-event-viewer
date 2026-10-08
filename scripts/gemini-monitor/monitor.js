const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, readJson, writeJson } = require('../auto-updater/storage');
const { selectEventsForToday, calculateNextCheckDate, getEventMonitoringTier } = require('./scheduler');
const { fetchAndCheckHash } = require('./fetcher');
const { extractMonitoringContext } = require('./extractor');
const { analyzeEventWithGemini } = require('./gemini-analyzer');
const { classifyDecision, prioritizeAdminReviewItems } = require('./classifier');
const { loadRollbackHistory, saveRollbackHistory, recordSnapshot, executeRollback } = require('./rollback-manager');
const { sendDailyMonitorNotification } = require('./notifier');
const { getPendingActionsFromFirestore, saveRemoteState } = require('./firestore-client');
const { applyBatchUpdates, checkMassChangeSafeguard } = require('./applier');
const { RECOMMENDED_ACTIONS, THRESHOLDS, IDEMPOTENCY_STATUS } = require('./constants');

/**
 * Main Gemini Monitor execution pipeline.
 * By default runs in Staged / Simulation Mode (never modifies events.js unless apply=true is explicitly requested).
 *
 * @param {Object} options
 * @param {string} [options.root] - Repository root directory
 * @param {string} [options.today] - Override execution date YYYY-MM-DD
 * @param {boolean} [options.apply=false] - If true, applies high-confidence changes and acknowledged items to events.js
 * @param {boolean} [options.dryRun=true] - Defaults to true for staged simulation
 * @param {Function} [options.getPage] - Custom HTTP fetcher (for testing)
 * @param {Function} [options.mockAnalyzer] - Custom mock semantic analyzer (for testing)
 * @param {boolean} [options.forceAll=false] - Force check all events ignoring schedule
 * @param {string} [options.singleEventId] - Filter check to single event
 */
async function runGeminiMonitor(options = {}) {
  const root = options.root || path.resolve(__dirname, '../..');
  const now = new Date();
  const todayStr = options.today || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

  const isApplyMode = Boolean(options.apply || process.env.ENABLE_AUTO_APPLY === 'true');
  const executionMode = isApplyMode ? 'production_apply' : 'shadow_simulation';

  const reportsDir = path.join(root, 'reports');
  const monitorDir = path.join(reportsDir, 'gemini-monitor');
  fs.mkdirSync(monitorDir, { recursive: true });

  const stateFile = path.join(reportsDir, 'gemini-monitor-state.json');
  const state = readJson(stateFile, { version: 1, lastRun: null, sources: {} });

  const rollbackHistory = loadRollbackHistory(root);
  const dataset = loadEvents(root);
  const allEvents = dataset.events;

  // 1. Synchronize with Firestore (Requirements 11, 12, 13, 16)
  const firestoreSync = await getPendingActionsFromFirestore(options);
  let processedRollbacksCount = 0;
  const acknowledgedToApply = firestoreSync.acknowledgedToApply || [];

  // Process any pending rollback requests from Firestore
  if (firestoreSync.rollbackRequests.length > 0) {
    for (const req of firestoreSync.rollbackRequests) {
      const rbResult = executeRollback(root, req.snapshotId || req.eventId, req.reason || 'Admin rollback request', {
        shadowMode: !isApplyMode,
        ...req.meta
      });
      if (rbResult.success) {
        processedRollbacksCount++;
        if (firestoreSync.remoteState?.items?.[req.key]) {
          firestoreSync.remoteState.items[req.key].status = IDEMPOTENCY_STATUS.ROLLED_BACK;
          firestoreSync.remoteState.items[req.key].rolledBackAt = now.toISOString();
        }
      }
    }
    if (firestoreSync.token && firestoreSync.remoteState) {
      await saveRemoteState(firestoreSync.token, firestoreSync.remoteState);
    }
  }

  // 2. Select today's due events (strictly ignoring ended events - Requirement 5 & 6)
  const { selected, skipped } = selectEventsForToday(allEvents, todayStr, state, {
    forceAll: options.forceAll,
    singleEventId: options.singleEventId
  });

  // Track metrics
  const metrics = {
    totalEvents: allEvents.length,
    monitoredToday: selected.length,
    skippedNotDue: skipped.filter(s => s.reason === 'not-due-yet').length,
    skippedEnded: skipped.filter(s => s.isEnded).length,
    httpFetched: 0,
    hashUnchangedSkipped: 0,
    geminiCalls: 0,
    noChange: 0,
    wouldAutoUpdate: 0,
    autoAppliedCount: 0,
    adminAppliedCount: 0,
    rollbackCount: processedRollbacksCount,
    needsReview: 0,
    insufficientEvidence: 0,
    adminVisibleCount: 0,
    massChangeSafeguardTriggered: false
  };

  const reviewPool = [];
  const autoApplyPool = [];

  // 3. Process each selected event
  for (const item of selected) {
    const event = item.event;
    const tier = getEventMonitoringTier(event, todayStr);
    const nextCheck = calculateNextCheckDate(tier, todayStr);

    const targetUrl = event.eventOfficialUrl || event.officialUrl || event.sourceUrl;

    // Ignore placeholder / dummy URLs
    if (!targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('example.com') || targetUrl.includes('example.org')) {
      state.sources[event.id] = {
        ...state.sources[event.id],
        lastChecked: todayStr,
        nextCheckDate: nextCheck,
        hasOfficialUrl: Boolean(targetUrl && !targetUrl.includes('example.'))
      };
      metrics.insufficientEvidence++;
      continue;
    }

    // 4. Fetch and check normalized content hash (Requirement 9)
    metrics.httpFetched++;
    const fetchResult = await fetchAndCheckHash(targetUrl, item.lastHash, {
      getPage: options.getPage,
      source: { id: event.id, allowedHosts: [new URL(targetUrl).hostname] }
    });

    if (!fetchResult.success) {
      metrics.fetchErrors = (metrics.fetchErrors || 0) + 1;
      state.sources[event.id] = {
        ...state.sources[event.id],
        lastChecked: todayStr,
        lastHttpStatus: fetchResult.httpStatus,
        lastError: fetchResult.error,
        nextCheckDate: nextCheck
      };
      continue;
    }

    // 5. Hash unchanged check -> skip Gemini! (Requirement 9)
    if (fetchResult.unchanged && item.lastHash) {
      metrics.hashUnchangedSkipped++;
      metrics.noChange++;
      state.sources[event.id] = {
        ...state.sources[event.id],
        lastChecked: todayStr,
        normalizedHash: fetchResult.hash,
        nextCheckDate: nextCheck
      };
      continue;
    }

    // 6. Content changed -> extract compact structured facts (Requirement 8)
    const context = extractMonitoringContext(fetchResult.rawHtml, event);

    // 7. Call Gemini 3.8 Flash for semantic validation (Requirement 10)
    metrics.geminiCalls++;
    const geminiOutput = await analyzeEventWithGemini(event, targetUrl, context, {
      apiKey: options.apiKey,
      offline: options.offline,
      mockAnalyzer: options.mockAnalyzer
    });

    // 8. Classify decision into safe_auto_update vs needs_review (Requirements 1, 2, 3, 17)
    const classification = classifyDecision(event, geminiOutput, {
      suppressions: rollbackHistory.suppressions,
      sourceLearningMeta: rollbackHistory.sourceLearningMeta,
      todayStr,
      sourceUrl: targetUrl
    });

    // Update state cache
    state.sources[event.id] = {
      ...state.sources[event.id],
      url: targetUrl,
      lastChecked: todayStr,
      lastHttpStatus: fetchResult.httpStatus,
      normalizedHash: fetchResult.hash,
      lastGeminiDecision: classification.action,
      lastGeminiConfidence: classification.confidence,
      nextCheckDate: nextCheck
    };

    const evaluatedItem = {
      eventId: event.id,
      eventName: event.title,
      action: classification.action,
      severity: classification.severity,
      confidence: classification.confidence,
      sourceQuality: classification.sourceQuality,
      sourceUrl: targetUrl,
      reason: classification.reason,
      structuredReason: classification.structuredReason,
      fieldChanges: classification.fieldChanges,
      priorityScore: classification.priorityScore,
      daysUntil: classification.daysUntil,
      timestamp: now.toISOString()
    };

    if (classification.action === RECOMMENDED_ACTIONS.NO_CHANGE) {
      metrics.noChange++;
    } else if (classification.action === RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE) {
      metrics.wouldAutoUpdate++;
      autoApplyPool.push(evaluatedItem);

      // Record snapshot in history
      recordSnapshot(rollbackHistory, {
        eventId: event.id,
        eventName: event.title,
        beforeValues: classification.fieldChanges.reduce((acc, c) => ({ ...acc, [c.field]: c.before }), {}),
        afterValues: classification.fieldChanges.reduce((acc, c) => ({ ...acc, [c.field]: c.after }), {}),
        fieldChanges: classification.fieldChanges,
        evidence: {
          url: targetUrl,
          sourceQuality: classification.sourceQuality,
          confidence: classification.confidence,
          reason: classification.reason
        },
        isShadow: !isApplyMode,
        status: isApplyMode ? IDEMPOTENCY_STATUS.APPLIED : IDEMPOTENCY_STATUS.DETECTED
      });
    } else if (classification.action === RECOMMENDED_ACTIONS.NEEDS_REVIEW) {
      metrics.needsReview++;
      reviewPool.push(evaluatedItem);
    } else {
      metrics.insufficientEvidence++;
    }
  }

  // 9. Prioritize review items for administrator (Target: 0-3, Max: 5 - Requirement 4)
  const { visible: adminVisibleItems, deferred: deferredReviewItems } =
    prioritizeAdminReviewItems(reviewPool, THRESHOLDS.MAX_ADMIN_REVIEW_ITEMS);

  metrics.adminVisibleCount = adminVisibleItems.length;

  // 10. Combine updates for batch application:
  // - High-confidence automated updates
  // - Admin acknowledged updates from Firestore
  const candidateBatchUpdates = [
    ...autoApplyPool.map(item => ({
      eventId: item.eventId,
      fieldChanges: item.fieldChanges,
      reason: item.reason,
      source: 'gemini_high_confidence'
    })),
    ...acknowledgedToApply.map(item => ({
      eventId: item.eventId,
      fieldChanges: Array.isArray(item.fieldChanges) ? item.fieldChanges : [{
        field: item.field,
        before: item.beforeValue,
        after: item.afterValue
      }],
      reason: `Admin acknowledged by ${item.acknowledgedBy || 'uchidats@gmail.com'}`,
      source: 'admin_acknowledged',
      key: item.key
    }))
  ];

  // Mass change safeguard check (Requirement 19)
  const safeguard = checkMassChangeSafeguard(candidateBatchUpdates, THRESHOLDS.MAX_AUTO_APPLY_BATCH);
  let batchApplyResult = null;

  if (!safeguard.allowed) {
    metrics.massChangeSafeguardTriggered = true;
    console.warn(`[MassChangeSafeguard] ${safeguard.reason}. Escalating automated batch to human review.`);
    // Escalate auto-applied items to reviewPool if mass limit exceeded
    for (const item of autoApplyPool) {
      reviewPool.push({
        ...item,
        reason: `[Mass Change Escalated] ${item.reason}`
      });
    }
    batchApplyResult = {
      success: false,
      haltedBySafeguard: true,
      reason: safeguard.reason,
      appliedCount: 0,
      appliedEvents: [],
      mode: executionMode
    };
  } else {
    // Execute batch apply (dryRun simulation or production apply - Requirements 14, 18, 25)
    batchApplyResult = applyBatchUpdates(root, candidateBatchUpdates, {
      dryRun: !isApplyMode
    });

    if (batchApplyResult.success) {
      if (isApplyMode) {
        metrics.autoAppliedCount = autoApplyPool.length;
        metrics.adminAppliedCount = acknowledgedToApply.length;

        // Transition acknowledged items in Firestore to applied
        if (firestoreSync.remoteState && firestoreSync.token) {
          for (const ack of acknowledgedToApply) {
            if (firestoreSync.remoteState.items[ack.key]) {
              firestoreSync.remoteState.items[ack.key].status = IDEMPOTENCY_STATUS.APPLIED;
              firestoreSync.remoteState.items[ack.key].appliedAt = now.toISOString();
            }
          }
          await saveRemoteState(firestoreSync.token, firestoreSync.remoteState);
        }
      } else {
        metrics.autoAppliedCount = 0; // Shadow simulation
      }
    }
  }

  // 11. Format daily report
  const dailyReport = {
    date: todayStr,
    generatedAt: now.toISOString(),
    mode: executionMode,
    isApplyMode,
    description: isApplyMode
      ? 'Gemini 3.8 Flash Daily Conference Monitor Report (Production Auto-Apply Enabled)'
      : 'Gemini 3.8 Flash Daily Conference Monitor Report (Shadow / Simulation Mode)',
    metrics,
    adminVisibleItems: adminVisibleItems.map(item => ({
      ...item,
      rollbackKey: `rb-${item.eventId}`
    })),
    deferredReviewCount: deferredReviewItems.length,
    wouldAutoUpdateCount: autoApplyPool.length,
    wouldAutoUpdateSummary: autoApplyPool.map(item => ({
      eventId: item.eventId,
      eventName: item.eventName,
      changes: item.fieldChanges.map(c => `${c.field}: ${c.before} -> ${c.after}`),
      confidence: item.confidence
    })),
    batchApplyResult
  };

  // 12. Persist report and state files
  const reportFilePath = path.join(monitorDir, `${todayStr}.json`);
  writeJson(reportFilePath, dailyReport);

  state.lastRun = now.toISOString();
  writeJson(stateFile, state);
  saveRollbackHistory(root, rollbackHistory);

  // 13. Send daily morning email notification (Requirement 21)
  let notification = null;
  if (!options.skipEmail) {
    notification = await sendDailyMonitorNotification(dailyReport, {
      smtpUser: options.smtpUser,
      smtpPass: options.smtpPass,
      to: options.notificationEmail
    });
  }

  return {
    reportFilePath,
    report: dailyReport,
    metrics,
    batchApplyResult,
    notification
  };
}

module.exports = {
  runGeminiMonitor
};
