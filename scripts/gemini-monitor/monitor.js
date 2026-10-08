const fs = require('node:fs');
const path = require('node:path');
const { loadEvents, readJson, writeJson } = require('../auto-updater/storage');
const { selectEventsForToday, addDays } = require('./scheduler');
const { fetchAndCheckHash } = require('./fetcher');
const { extractMonitoringContext } = require('./extractor');
const { analyzeEventWithGemini } = require('./gemini-analyzer');
const { classifyDecision, prioritizeAdminReviewItems } = require('./classifier');
const { loadRollbackHistory, saveRollbackHistory, recordSnapshot } = require('./rollback-manager');
const { sendDailyMonitorNotification } = require('./notifier');
const { RECOMMENDED_ACTIONS, THRESHOLDS } = require('./constants');

/**
 * Main Gemini Monitor execution pipeline (Shadow Mode by default).
 *
 * @param {Object} options
 * @param {string} options.root - Repository root directory
 * @param {string} [options.today] - Optional override date YYYY-MM-DD (defaults to Asia/Tokyo current date)
 * @param {boolean} [options.dryRun=true] - Shadow mode (never writes events.js)
 * @param {Function} [options.getPage] - Custom HTTP fetch function (e.g. for offline tests)
 * @param {Function} [options.mockAnalyzer] - Custom mock semantic analyzer (for offline tests)
 * @param {boolean} [options.forceAll=false] - Force check all events regardless of schedule
 * @param {string} [options.singleEventId] - Filter check to single event
 */
async function runGeminiMonitor(options = {}) {
  const root = options.root || path.resolve(__dirname, '../..');
  const now = new Date();
  const todayStr = options.today || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

  const reportsDir = path.join(root, 'reports');
  const monitorDir = path.join(reportsDir, 'gemini-monitor');
  fs.mkdirSync(monitorDir, { recursive: true });

  const stateFile = path.join(reportsDir, 'gemini-monitor-state.json');
  const state = readJson(stateFile, { version: 1, lastRun: null, sources: {} });

  const rollbackHistory = loadRollbackHistory(root);
  const dataset = loadEvents(root);
  const allEvents = dataset.events;

  // 1. Select events to monitor today based on interval rules
  const { selected, skipped } = selectEventsForToday(allEvents, todayStr, state, {
    forceAll: options.forceAll,
    singleEventId: options.singleEventId
  });

  // Track metrics
  const metrics = {
    totalEvents: allEvents.length,
    monitoredToday: selected.length,
    skippedNotDue: skipped.filter(s => s.reason === 'not-due-yet').length,
    skippedEnded: skipped.filter(s => s.reason === 'event-already-ended').length,
    httpFetched: 0,
    hashUnchangedSkipped: 0,
    geminiCalls: 0,
    noChange: 0,
    wouldAutoUpdate: 0,
    needsReview: 0,
    insufficientEvidence: 0,
    adminVisibleCount: 0
  };

  const candidateResults = [];
  const reviewPool = [];
  const wouldAutoUpdatePool = [];

  // 2. Process each selected event
  for (const item of selected) {
    const event = item.event;
    const targetUrl = event.eventOfficialUrl || event.officialUrl || event.sourceUrl;

    // Ignore placeholder / dummy URLs (e.g. example.com) without spamming administrator
    if (!targetUrl || !targetUrl.startsWith('http') || targetUrl.includes('example.com') || targetUrl.includes('example.org')) {
      state.sources[event.id] = {
        ...state.sources[event.id],
        lastChecked: todayStr,
        nextCheckDate: addDays(todayStr, item.intervalDays),
        hasOfficialUrl: Boolean(targetUrl && !targetUrl.includes('example.'))
      };
      metrics.insufficientEvidence++;
      continue;
    }

    // 3. Fetch and check normalized content hash
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
        nextCheckDate: addDays(todayStr, item.intervalDays)
      };
      continue;
    }

    // 4. Hash unchanged check -> skip Gemini!
    if (fetchResult.unchanged && item.lastHash) {
      metrics.hashUnchangedSkipped++;
      metrics.noChange++;
      state.sources[event.id] = {
        ...state.sources[event.id],
        lastChecked: todayStr,
        normalizedHash: fetchResult.hash,
        nextCheckDate: addDays(todayStr, item.intervalDays)
      };
      continue;
    }

    // 5. Content changed or first check -> extract compact context
    const context = extractMonitoringContext(fetchResult.rawHtml, event);

    // 6. Call Gemini 3.8 Flash for semantic validation
    metrics.geminiCalls++;
    const geminiOutput = await analyzeEventWithGemini(event, targetUrl, context, {
      apiKey: options.apiKey,
      offline: options.offline,
      mockAnalyzer: options.mockAnalyzer
    });

    // 7. Classify into auto-update vs review
    const classification = classifyDecision(event, geminiOutput, {
      suppressions: rollbackHistory.suppressions,
      todayStr
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
      nextCheckDate: addDays(todayStr, item.intervalDays)
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
      fieldChanges: classification.fieldChanges,
      priorityScore: classification.priorityScore,
      daysUntil: classification.daysUntil,
      timestamp: now.toISOString()
    };

    candidateResults.push(evaluatedItem);

    if (classification.action === RECOMMENDED_ACTIONS.NO_CHANGE) {
      metrics.noChange++;
    } else if (classification.isShadowAutoUpdate) {
      metrics.wouldAutoUpdate++;
      wouldAutoUpdatePool.push(evaluatedItem);

      // Record snapshot for prospective rollback in shadow mode
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
        isShadow: true
      });
    } else if (classification.action === RECOMMENDED_ACTIONS.NEEDS_REVIEW) {
      metrics.needsReview++;
      reviewPool.push(evaluatedItem);
    } else {
      metrics.insufficientEvidence++;
    }
  }

  // 8. Prioritize review items for administrator (Target: 0-3, Max: 5)
  const { visible: adminVisibleItems, deferred: deferredReviewItems } =
    prioritizeAdminReviewItems(reviewPool, THRESHOLDS.MAX_ADMIN_REVIEW_ITEMS);

  metrics.adminVisibleCount = adminVisibleItems.length;

  // 9. Format daily report
  const dailyReport = {
    date: todayStr,
    generatedAt: now.toISOString(),
    mode: 'shadow',
    description: 'Gemini 3.8 Flash lightweight daily conference monitor report (Shadow Mode)',
    metrics,
    adminVisibleItems: adminVisibleItems.map(item => ({
      ...item,
      rollbackKey: `rb-${item.eventId}`
    })),
    deferredReviewCount: deferredReviewItems.length,
    wouldAutoUpdateCount: wouldAutoUpdatePool.length,
    wouldAutoUpdateSummary: wouldAutoUpdatePool.map(item => ({
      eventId: item.eventId,
      eventName: item.eventName,
      changes: item.fieldChanges.map(c => `${c.field}: ${c.before} -> ${c.after}`),
      confidence: item.confidence
    }))
  };

  // 10. Persist report and state files
  const reportFilePath = path.join(monitorDir, `${todayStr}.json`);
  writeJson(reportFilePath, dailyReport);

  state.lastRun = now.toISOString();
  writeJson(stateFile, state);
  saveRollbackHistory(root, rollbackHistory);

  // 11. Send daily health-check email notification
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
    notification
  };
}

module.exports = {
  runGeminiMonitor
};
