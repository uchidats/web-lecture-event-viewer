const { SCHEDULE_TIERS, FOCUS_FIELDS } = require('./constants');

/**
 * Calculate difference in calendar days between two YYYY-MM-DD dates (UTC/JST date context).
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
 * Calculate the next Tuesday (2) or Friday (5) date string for twice-weekly monitoring.
 * (Requirement 6: 6か月以上〜1年未満：週2回 火曜・金曜)
 */
function getNextTwiceWeeklyDate(currentDateStr) {
  const d = new Date(currentDateStr.slice(0, 10) + 'T00:00:00Z');
  const dayOfWeek = d.getUTCDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

  let daysToAdd = 1;
  if (dayOfWeek === 2) {
    // Tuesday -> next is Friday (+3 days)
    daysToAdd = 3;
  } else if (dayOfWeek === 5) {
    // Friday -> next is Tuesday (+4 days)
    daysToAdd = 4;
  } else if (dayOfWeek === 1) {
    // Monday -> Tuesday (+1 day)
    daysToAdd = 1;
  } else if (dayOfWeek === 3) {
    // Wednesday -> Friday (+2 days)
    daysToAdd = 2;
  } else if (dayOfWeek === 4) {
    // Thursday -> Friday (+1 day)
    daysToAdd = 1;
  } else if (dayOfWeek === 6) {
    // Saturday -> Tuesday (+3 days)
    daysToAdd = 3;
  } else if (dayOfWeek === 0) {
    // Sunday -> Tuesday (+2 days)
    daysToAdd = 2;
  }

  return addDays(currentDateStr, daysToAdd);
}

/**
 * Check if an event is already completed/ended based on today's date.
 * (Requirement 5: endDate < today or date < today if single day)
 */
function isEventEnded(event, todayStr) {
  if (event.endDate) {
    return event.endDate < todayStr;
  }
  if (event.date) {
    return event.date < todayStr;
  }
  return false;
}

/**
 * Determine the tier and focus fields based on days until event.
 * (Requirement 5 & 6)
 */
function getEventMonitoringTier(event, todayStr) {
  const eventDate = event.date || event.endDate;
  const isEnded = isEventEnded(event, todayStr);

  if (isEnded) {
    return {
      tierName: 'ENDED',
      intervalDays: null,
      focusFields: [],
      daysUntil: eventDate ? diffDays(eventDate, todayStr) : -999,
      isEnded: true,
      status: 'completed'
    };
  }

  if (!eventDate) {
    return {
      tierName: 'OVER_2Y',
      intervalDays: 30,
      focusFields: FOCUS_FIELDS.OVER_2Y,
      daysUntil: 999,
      isEnded: false,
      status: 'active'
    };
  }

  const daysUntil = diffDays(eventDate, todayStr);

  if (daysUntil < SCHEDULE_TIERS.LESS_THAN_6M.maxDays) {
    return {
      tierName: 'LESS_THAN_6M',
      intervalDays: SCHEDULE_TIERS.LESS_THAN_6M.intervalDays, // 1 (daily)
      focusFields: FOCUS_FIELDS.LESS_THAN_6M,
      daysUntil,
      isEnded: false,
      status: 'active'
    };
  }

  if (daysUntil < SCHEDULE_TIERS.FROM_6M_TO_1Y.maxDays) {
    return {
      tierName: 'FROM_6M_TO_1Y',
      intervalDays: 'twice-weekly', // Tuesday & Friday
      focusFields: FOCUS_FIELDS.FROM_6M_TO_1Y,
      daysUntil,
      isEnded: false,
      status: 'active'
    };
  }

  if (daysUntil < SCHEDULE_TIERS.FROM_1Y_TO_2Y.maxDays) {
    return {
      tierName: 'FROM_1Y_TO_2Y',
      intervalDays: SCHEDULE_TIERS.FROM_1Y_TO_2Y.intervalDays, // 7 (weekly)
      focusFields: FOCUS_FIELDS.FROM_1Y_TO_2Y,
      daysUntil,
      isEnded: false,
      status: 'active'
    };
  }

  return {
    tierName: 'OVER_2Y',
    intervalDays: SCHEDULE_TIERS.OVER_2Y.intervalDays, // 30 (monthly)
    focusFields: FOCUS_FIELDS.OVER_2Y,
    daysUntil,
    isEnded: false,
    status: 'active'
  };
}

/**
 * Calculate the next check date string based on tier.
 */
function calculateNextCheckDate(tier, currentDateStr) {
  if (tier.isEnded) {
    return null; // Completed, no nextCheckDate
  }

  if (tier.intervalDays === 'twice-weekly') {
    return getNextTwiceWeeklyDate(currentDateStr);
  }

  const days = typeof tier.intervalDays === 'number' ? tier.intervalDays : 1;
  return addDays(currentDateStr, days);
}

/**
 * Select events to monitor today from full dataset, considering state cache.
 * (Requirement 5 & 6)
 *
 * @param {Array} events - Complete list of events from events.js
 * @param {string} todayStr - YYYY-MM-DD
 * @param {Object} state - State cache loaded from reports/gemini-monitor-state.json
 * @param {Object} options - Optional flags (e.g. forceAll, singleEventId)
 */
function selectEventsForToday(events, todayStr, state = {}, options = {}) {
  const sources = state.sources || {};
  const selected = [];
  const skipped = [];

  for (const event of events) {
    // Only monitor conferences (skip co-sponsored seminars, satellite sessions)
    if (!event.isConference || event.parentConferenceId) {
      skipped.push({
        eventId: event.id,
        title: event.title,
        reason: 'non-conference-or-seminar'
      });
      continue;
    }

    if (options.singleEventId && event.id !== options.singleEventId) {
      continue;
    }

    const tier = getEventMonitoringTier(event, todayStr);

    // Requirement 5: Past ended events are completely excluded from monitoring!
    // No regular check, no Gemini call, no review item, no email, no nextCheckDate.
    if (tier.isEnded) {
      skipped.push({
        eventId: event.id,
        title: event.title,
        reason: 'event-already-ended-completed',
        isEnded: true,
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
  getNextTwiceWeeklyDate,
  isEventEnded,
  getEventMonitoringTier,
  calculateNextCheckDate,
  selectEventsForToday
};
