const { trustedUrl } = require('./fetch');

const completionFields = new Set(['abstractSubmission.startDate', 'abstractSubmission.deadline',
  'abstractSubmission.status', 'abstractSubmission.url']);

// Input is the policy's accepted candidates; its evidence/method checks still apply.
function evaluateMassChanges(changes, config) {
  const fieldsPerEvent = {};
  let lowRiskCompletions = 0;
  for (const change of changes) {
    fieldsPerEvent[change.eventId] = (fieldsPerEvent[change.eventId] || 0) + 1;
    const source = config.sources.find(s => s.id === change.eventId);
    if (change.oldValue === null && completionFields.has(change.field) &&
        change.value != null && change.value !== '' && Number.isFinite(change.confidence) &&
        change.confidence >= config.defaults.minConfidence && source && trustedUrl(change.url, source)) {
      lowRiskCompletions++;
    }
  }
  const limits = config.defaults;
  const metrics = { changedEvents: Object.keys(fieldsPerEvent).length, totalFields: changes.length,
    fieldsPerEvent, maxFieldsPerEvent: Math.max(0, ...Object.values(fieldsPerEvent)),
    lowRiskCompletions, regularRiskChanges: changes.length - lowRiskCompletions,
    riskWeightedFields: changes.length - lowRiskCompletions * 0.75 };
  const exceeded = [];
  if (metrics.changedEvents > limits.maxChangedConferences) exceeded.push('changed-events');
  if (metrics.riskWeightedFields > limits.maxAutoChanges) exceeded.push('risk-weighted-fields');
  // Hard caps bound even batches consisting entirely of low-risk completions.
  if (metrics.totalFields > limits.maxTotalAutoChanges) exceeded.push('total-fields');
  if (metrics.maxFieldsPerEvent > limits.maxFieldsPerEvent) exceeded.push('fields-per-event');
  return { ...metrics, exceeded, stopped: exceeded.length > 0 };
}

module.exports = { evaluateMassChanges };
