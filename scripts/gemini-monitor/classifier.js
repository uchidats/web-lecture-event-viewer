const { THRESHOLDS, SEVERITY, RECOMMENDED_ACTIONS, SOURCE_QUALITY } = require('./constants');
const { diffDays } = require('./scheduler');

/**
 * Compare proposed changes against current event and classify into:
 * - would_auto_update (shadow mode equivalent of safe_auto_update)
 * - needs_review
 * - no_change
 * - insufficient_evidence
 */
function classifyDecision(currentEvent, geminiResult, options = {}) {
  const suppressions = options.suppressions || [];
  const todayStr = options.todayStr || new Date().toISOString().slice(0, 10);

  // Detect proposed field changes
  const fieldChanges = [];

  // 1. Official URL added or changed
  if (geminiResult.official_url && geminiResult.official_url !== currentEvent.eventOfficialUrl) {
    fieldChanges.push({
      field: 'eventOfficialUrl',
      before: currentEvent.eventOfficialUrl || null,
      after: geminiResult.official_url,
      severity: SEVERITY.LOW
    });
  }

  // 2. Dates changed
  if (geminiResult.start_date && geminiResult.start_date !== currentEvent.date) {
    const shiftDays = Math.abs(diffDays(geminiResult.start_date, currentEvent.date || geminiResult.start_date));
    fieldChanges.push({
      field: 'date',
      before: currentEvent.date || null,
      after: geminiResult.start_date,
      severity: shiftDays > 14 ? SEVERITY.HIGH : SEVERITY.MEDIUM
    });
  }
  if (geminiResult.end_date && geminiResult.end_date !== currentEvent.endDate) {
    fieldChanges.push({
      field: 'endDate',
      before: currentEvent.endDate || null,
      after: geminiResult.end_date,
      severity: SEVERITY.MEDIUM
    });
  }

  // 3. Venue changed
  if (geminiResult.venue && geminiResult.venue !== currentEvent.venue) {
    fieldChanges.push({
      field: 'venue',
      before: currentEvent.venue || null,
      after: geminiResult.venue,
      severity: SEVERITY.MEDIUM
    });
  }

  // 4. Abstract deadline
  if (geminiResult.abstract_deadline && geminiResult.abstract_deadline !== currentEvent.abstractSubmission?.deadline) {
    fieldChanges.push({
      field: 'abstractSubmission.deadline',
      before: currentEvent.abstractSubmission?.deadline || null,
      after: geminiResult.abstract_deadline,
      severity: SEVERITY.MEDIUM
    });
  }

  // 5. Title / Edition
  if (geminiResult.official_title && geminiResult.official_title !== currentEvent.title) {
    const titleSevere = geminiResult.edition && !currentEvent.title.includes(String(geminiResult.edition));
    fieldChanges.push({
      field: 'title',
      before: currentEvent.title,
      after: geminiResult.official_title,
      severity: titleSevere ? SEVERITY.HIGH : SEVERITY.LOW
    });
  }

  // Filter against suppression registry (changes rolled back in the past)
  const suppressedChanges = [];
  const activeChanges = [];
  for (const c of fieldChanges) {
    const matched = suppressions.find(s =>
      s.eventId === currentEvent.id &&
      s.field === c.field &&
      String(s.suppressedValue) === String(c.after)
    );
    if (matched) {
      suppressedChanges.push(c);
    } else {
      activeChanges.push(c);
    }
  }

  if (fieldChanges.length > 0 && activeChanges.length === 0) {
    return {
      status: 'suppressed',
      action: RECOMMENDED_ACTIONS.NO_CHANGE,
      severity: SEVERITY.NONE,
      reason: 'Update candidate was previously rolled back and is currently suppressed.',
      fieldChanges: [],
      priorityScore: 0,
      daysUntil: diffDays(currentEvent.date || currentEvent.endDate, todayStr),
      isShadowAutoUpdate: false
    };
  }

  // Calculate highest severity among proposed changes
  let calculatedSeverity = geminiResult.severity || SEVERITY.NONE;
  for (const c of fieldChanges) {
    if (c.severity === SEVERITY.HIGH) calculatedSeverity = SEVERITY.HIGH;
    else if (c.severity === SEVERITY.MEDIUM && calculatedSeverity !== SEVERITY.HIGH) calculatedSeverity = SEVERITY.MEDIUM;
    else if (c.severity === SEVERITY.LOW && calculatedSeverity === SEVERITY.NONE) calculatedSeverity = SEVERITY.LOW;
  }

  // Determine final status
  const confidence = Number(geminiResult.confidence || 0);
  const isHighQualitySource = [
    SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    SOURCE_QUALITY.SOCIETY_NEXT_ANNOUNCEMENT
  ].includes(geminiResult.source_quality);

  const hasMismatches = Array.isArray(geminiResult.mismatches) && geminiResult.mismatches.length > 0;
  const meetsConfidence = confidence >= THRESHOLDS.MIN_CONFIDENCE_AUTO_UPDATE;

  let finalAction = geminiResult.recommended_action || RECOMMENDED_ACTIONS.NO_CHANGE;

  if (geminiResult.recommended_action === RECOMMENDED_ACTIONS.NEEDS_REVIEW ||
      geminiResult.recommended_action === RECOMMENDED_ACTIONS.INSUFFICIENT_EVIDENCE) {
    finalAction = geminiResult.recommended_action;
  } else if (hasMismatches || !isHighQualitySource || !meetsConfidence || calculatedSeverity === SEVERITY.HIGH) {
    if (fieldChanges.length > 0 || hasMismatches) {
      finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    }
  } else if (fieldChanges.length === 0) {
    finalAction = RECOMMENDED_ACTIONS.NO_CHANGE;
  }

  // Priority score for admin review ordering:
  // higher score = shown first to admin
  const severityWeight = calculatedSeverity === SEVERITY.HIGH ? 300 : calculatedSeverity === SEVERITY.MEDIUM ? 200 : 100;
  const confidenceWeight = Math.round((1 - confidence) * 100);
  const daysUntil = diffDays(currentEvent.date || currentEvent.endDate, todayStr);
  const urgencyWeight = Math.max(0, 100 - Math.min(100, daysUntil));
  const priorityScore = severityWeight + confidenceWeight + urgencyWeight;

  return {
    action: finalAction,
    severity: calculatedSeverity,
    confidence,
    sourceQuality: geminiResult.source_quality,
    reason: geminiResult.reason || '',
    fieldChanges,
    priorityScore,
    daysUntil,
    isShadowAutoUpdate: finalAction === RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  };
}

/**
 * Filter and limit needs-review items for admin presentation:
 * - Target: 0 to 3 items typical
 * - Max: strictly capped at 5 items
 * - Excess items deferred to subsequent runs
 */
function prioritizeAdminReviewItems(reviewItems, maxCount = THRESHOLDS.MAX_ADMIN_REVIEW_ITEMS) {
  // Sort descending by priorityScore
  const sorted = [...reviewItems].sort((a, b) => b.priorityScore - a.priorityScore);

  const visible = sorted.slice(0, maxCount);
  const deferred = sorted.slice(maxCount);

  return { visible, deferred };
}

module.exports = {
  classifyDecision,
  prioritizeAdminReviewItems
};
