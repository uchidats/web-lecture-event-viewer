const { SCHEDULE_TIERS, FOCUS_FIELDS } = require('./constants');

/**
 * Calculate difference in calendar days between two YYYY-MM-DD dates (Asia/Tokyo context).
 */
function diffDays(targetDateStr, baseDateStr) {
  if (!targetDateStr) return 999;
  const target = new Date(targetDateStr.slice(0, 10) + 'T00:00:00Z');
  const base = new Date(baseDateStr.slice(0, 10) + 'T00:00:00Z');
  return Math.round((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Add days to YYYY-MM-DD date and return next YYYY-MM-DD string.
 */
function addDays(dateStr, days) {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Determine the tier and focus fields based on days until event.
 */
function getEventMonitoringTier(event, todayStr) {
  const eventDate = event.date || event.endDate;
  if (!eventDate) {
    return {
      tierName: 'UNKNOWN',
      intervalDays: 30,
      focusFields: FOCUS_FIELDS.DISTANT,
      daysUntil: 999,
      isEnded: false
    };
  }

  const daysUntil = diffDays(eventDate, todayStr);
  const isEnded = (event.endDate && event.endDate < todayStr) || (!event.endDate && event.date < todayStr);

  if (isEnded) {
    return {
      tierName: 'ENDED',
      intervalDays: 9999,
      focusFields: [],
      daysUntil,
      isEnded: true
    };
  }

  if (daysUntil <= SCHEDULE_TIERS.IMMINENT.maxDays) {
    return {
      tierName: 'IMMINENT',
      intervalDays: SCHEDULE_TIERS.IMMINENT.intervalDays,
      focusFields: FOCUS_FIELDS.IMMINENT,
      daysUntil,
      isEnded: false
    };
  }
  if (daysUntil <= SCHEDULE_TIERS.NEAR.maxDays) {
    return {
      tierName: 'NEAR',
      intervalDays: SCHEDULE_TIERS.NEAR.intervalDays,
      focusFields: FOCUS_FIELDS.NEAR,
      daysUntil,
      isEnded: false
    };
  }
  if (daysUntil <= SCHEDULE_TIERS.MEDIUM.maxDays) {
    return {
      tierName: 'MEDIUM',
      intervalDays: SCHEDULE_TIERS.MEDIUM.intervalDays,
      focusFields: FOCUS_FIELDS.MEDIUM,
      daysUntil,
      isEnded: false
    };
  }
  return {
    tierName: 'DISTANT',
    intervalDays: SCHEDULE_TIERS.DISTANT.intervalDays,
    focusFields: FOCUS_FIELDS.DISTANT,
    daysUntil,
    isEnded: false
  };
}

/**
 * Select events to monitor today from full dataset, considering state cache.
 *
 * @param {Array} events - Complete list of events (e.g. 94 items from events.js)
 * @param {string} todayStr - YYYY-MM-DD
 * @param {Object} state - State cache loaded from reports/gemini-monitor-state.json
 * @param {Object} options - Optional flags (e.g. forceAll, singleEventId)
 */
function selectEventsForToday(events, todayStr, state = {}, options = {}) {
  const sources = state.sources || {};
  const selected = [];
  const skipped = [];

  for (const event of events) {
    // Only monitor conference events (skip co-sponsored seminars, satellite sessions)
    if (!event.isConference || event.parentConferenceId) {
      skipped.push({
        eventId: event.id,
        title: event.title,
        reason: 'non-conference-or-seminar'
      });
      continue;
    }

    // Only monitor conferences or events with an official URL or designated ID
    if (options.singleEventId && event.id !== options.singleEventId) {
      continue;
    }

    const tier = getEventMonitoringTier(event, todayStr);

    // If event is already ended, skip it unless specifically targeted
    if (tier.isEnded && !options.includeEnded && !options.singleEventId) {
      skipped.push({
        eventId: event.id,
        title: event.title,
        reason: 'event-already-ended',
        daysUntil: tier.daysUntil
      });
      continue;
    }

    const cached = sources[event.id];
    const nextCheckDate = cached?.nextCheckDate;
    const isDue = !nextCheckDate || nextCheckDate <= todayStr;

    if (options.forceAll || isDue) {
      selected.push({
        event,
        eventId: event.id,
        title: event.title,
        tier: tier.tierName,
        daysUntil: tier.daysUntil,
        intervalDays: tier.intervalDays,
        focusFields: tier.focusFields,
        lastChecked: cached?.lastChecked || null,
        lastHash: cached?.normalizedHash || null,
        cachedNextCheckDate: nextCheckDate || null
      });
    } else {
      skipped.push({
        eventId: event.id,
        title: event.title,
        reason: 'not-due-yet',
        nextCheckDate,
        tier: tier.tierName,
        intervalDays: tier.intervalDays,
        daysUntil: tier.daysUntil
      });
    }
  }

  return { selected, skipped };
}

module.exports = {
  diffDays,
  addDays,
  getEventMonitoringTier,
  selectEventsForToday
};
