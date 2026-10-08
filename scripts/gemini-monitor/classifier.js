const { THRESHOLDS, SEVERITY, RECOMMENDED_ACTIONS, SOURCE_QUALITY, LEARNING_FLAGS } = require('./constants');
const { diffDays } = require('./scheduler');

/**
 * Compare proposed changes against current event and classify into:
 * - safe_auto_update (high confidence official source, consistent edition/year)
 * - needs_review (low confidence, third party, edition/year mismatch, cross-year risk)
 * - no_change (content matches existing event)
 * - insufficient_evidence (page lacks verified details)
 *
 * (Requirements 1, 2, 3, 17)
 */
function classifyDecision(currentEvent, geminiResult, options = {}) {
  const suppressions = options.suppressions || [];
  const learningMeta = options.sourceLearningMeta || {};
  const todayStr = options.todayStr || new Date().toISOString().slice(0, 10);
  const sourceUrl = options.sourceUrl || geminiResult.official_url || currentEvent.eventOfficialUrl || '';

  // Extract hostname to check learned risks
  let hostname = '';
  try {
    if (sourceUrl) hostname = new URL(sourceUrl).hostname;
  } catch (_) {}
  const learnedSourceRules = learningMeta[hostname] || {};

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

  // 2. Dates changed (start date & end date)
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

  // 4. City / Country changed
  if (geminiResult.city && currentEvent.cityCountry && !currentEvent.cityCountry.includes(geminiResult.city)) {
    fieldChanges.push({
      field: 'cityCountry',
      before: currentEvent.cityCountry || null,
      after: geminiResult.city,
      severity: SEVERITY.MEDIUM
    });
  }

  // 5. Abstract deadline
  if (geminiResult.abstract_deadline && geminiResult.abstract_deadline !== currentEvent.abstractSubmission?.deadline) {
    fieldChanges.push({
      field: 'abstractSubmission.deadline',
      before: currentEvent.abstractSubmission?.deadline || null,
      after: geminiResult.abstract_deadline,
      severity: SEVERITY.MEDIUM
    });
  }

  // 6. Registration deadline
  if (geminiResult.registration_deadline && geminiResult.registration_deadline !== currentEvent.registration?.deadline) {
    fieldChanges.push({
      field: 'registration.deadline',
      before: currentEvent.registration?.deadline || null,
      after: geminiResult.registration_deadline,
      severity: SEVERITY.MEDIUM
    });
  }

  // 7. Title / Edition
  if (geminiResult.official_title && geminiResult.official_title !== currentEvent.title) {
    const titleSevere = geminiResult.edition && !currentEvent.title.includes(String(geminiResult.edition));
    fieldChanges.push({
      field: 'title',
      before: currentEvent.title,
      after: geminiResult.official_title,
      severity: titleSevere ? SEVERITY.HIGH : SEVERITY.LOW
    });
  }

  // 8. Filter against suppression registry (changes rolled back previously)
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
      reason: 'Proposed update was previously rolled back and is suppressed.',
      structuredReason: { code: 'suppressed_by_rollback', detail: 'Previously rolled back by administrator' },
      fieldChanges: [],
      priorityScore: 0,
      daysUntil: diffDays(currentEvent.date || currentEvent.endDate, todayStr),
      isAutoApplicable: false
    };
  }

  // Calculate highest severity among proposed changes
  let calculatedSeverity = geminiResult.severity || SEVERITY.NONE;
  for (const c of activeChanges) {
    if (c.severity === SEVERITY.HIGH) calculatedSeverity = SEVERITY.HIGH;
    else if (c.severity === SEVERITY.MEDIUM && calculatedSeverity !== SEVERITY.HIGH) calculatedSeverity = SEVERITY.MEDIUM;
    else if (c.severity === SEVERITY.LOW && calculatedSeverity === SEVERITY.NONE) calculatedSeverity = SEVERITY.LOW;
  }

  const confidence = Number(geminiResult.confidence || 0);
  const mismatches = Array.isArray(geminiResult.mismatches) ? geminiResult.mismatches : [];
  const hasMismatches = mismatches.length > 0;
  const isHighQualitySource = [
    SOURCE_QUALITY.OFFICIAL_EVENT_PAGE,
    SOURCE_QUALITY.SOCIETY_NEXT_ANNOUNCEMENT
  ].includes(geminiResult.source_quality);
  const meetsConfidence = confidence >= THRESHOLDS.MIN_CONFIDENCE_AUTO_UPDATE;
  const sameEvent = Boolean(geminiResult.same_event);

  // Check learned risks from previous mis-updates (Requirement 17)
  let learnedRiskCode = null;
  if (learnedSourceRules[LEARNING_FLAGS.UNRELIABLE_SOURCE]) {
    learnedRiskCode = 'source_learned_unreliable';
  } else if (learnedSourceRules[LEARNING_FLAGS.CROSS_YEAR_LINK_RISK] && activeChanges.some(c => c.field === 'date' || c.field === 'title')) {
    learnedRiskCode = 'learned_cross_year_link_risk';
  } else if (learnedSourceRules[LEARNING_FLAGS.CAREFUL_YEAR_JUDGMENT] && activeChanges.some(c => c.field === 'date' || c.field === 'title')) {
    learnedRiskCode = 'learned_careful_year_judgment';
  }

  // Determine final action (Requirements 1, 2, 3)
  let finalAction = RECOMMENDED_ACTIONS.NO_CHANGE;
  let structuredReason = { code: 'clean', detail: geminiResult.reason || '' };

  if (activeChanges.length === 0 && !hasMismatches) {
    finalAction = RECOMMENDED_ACTIONS.NO_CHANGE;
  } else if (
    geminiResult.recommended_action === RECOMMENDED_ACTIONS.INSUFFICIENT_EVIDENCE ||
    !geminiResult.source_quality ||
    geminiResult.source_quality === SOURCE_QUALITY.THIRD_PARTY_OR_OTHER
  ) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: 'third_party_or_weak_source',
      detail: 'Source is third-party or lacks verified official evidence.'
    };
  } else if (hasMismatches) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: 'mismatch_detected',
      detail: `Mismatches detected: ${mismatches.join('; ')}`
    };
  } else if (!sameEvent) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: 'different_event_or_edition',
      detail: 'Gemini determined page does not match the current conference edition.'
    };
  } else if (learnedRiskCode) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: learnedRiskCode,
      detail: `Source domain has historical rollback flags: ${learnedRiskCode}`
    };
  } else if (!meetsConfidence) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: 'low_confidence',
      detail: `Confidence ${(confidence * 100).toFixed(1)}% is below threshold (${THRESHOLDS.MIN_CONFIDENCE_AUTO_UPDATE * 100}%).`
    };
  } else if (isHighQualitySource && sameEvent && meetsConfidence && !hasMismatches && activeChanges.length > 0) {
    // Requirements 1 & 2: High confidence + verified official source + exact match = safe_auto_update,
    // REGARDLESS of the magnitude of change (even date, year, city, venue)!
    finalAction = RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE;
    structuredReason = {
      code: 'safe_auto_update_eligible',
      detail: geminiResult.reason || 'Verified on official source with high confidence.'
    };
  } else if (activeChanges.length > 0) {
    finalAction = RECOMMENDED_ACTIONS.NEEDS_REVIEW;
    structuredReason = {
      code: 'unclassified_review',
      detail: geminiResult.reason || 'Requires manual review'
    };
  }

  // Priority score for admin review ordering (Requirement 4)
  // Higher score = higher priority in top 5 list
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
    reason: geminiResult.reason || structuredReason.detail,
    structuredReason,
    fieldChanges: activeChanges,
    priorityScore,
    daysUntil,
    isAutoApplicable: finalAction === RECOMMENDED_ACTIONS.SAFE_AUTO_UPDATE
  };
}

/**
 * Filter and throttle review items for admin display:
 * - Target: 0 to 3 items typical
 * - Max: strictly capped at 5 items (Requirement 4)
 * - Excess items deferred to subsequent runs
 */
function prioritizeAdminReviewItems(reviewItems, maxCount = THRESHOLDS.MAX_ADMIN_REVIEW_ITEMS) {
  const sorted = [...reviewItems].sort((a, b) => b.priorityScore - a.priorityScore);
  const visible = sorted.slice(0, maxCount);
  const deferred = sorted.slice(maxCount);
  return { visible, deferred };
}

module.exports = {
  classifyDecision,
  prioritizeAdminReviewItems
};
