// Registration candidates are reviewed as one object so stages are never flattened.
function validRegistration(value, { minYear = 2020, maxYear = 2035 } = {}) {
  const validDate = raw => {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?$/.test(raw)) return false;
    const [year, month, day] = raw.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return year >= minYear && year <= maxYear && date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 && date.getUTCDate() === day &&
      (!raw.includes('T') || (Number(raw.slice(11, 13)) <= 23 && Number(raw.slice(14)) <= 59));
  };
  return !!value && ['domestic', 'international'].includes(value.type) &&
    Array.isArray(value.periods) && value.periods.length > 0 && value.periods.every(period =>
      period && typeof period.label === 'string' && !!period.label.trim() &&
      (period.start || period.deadline) && (!period.start || validDate(period.start)) &&
      (!period.deadline || validDate(period.deadline)) &&
      (!period.start || !period.deadline || period.start <= (period.deadline.includes('T') ? period.deadline : period.deadline + 'T23:59')));
}

function registrationKey(value) {
  if (!value) return '';
  if (!Array.isArray(value.periods)) return JSON.stringify(value);
  return JSON.stringify({ type: value.type, periods: value.periods.map(p => ({
    label: p.label, start: p.start || null, deadline: p.deadline || null
  })).sort((a, b) => a.label.localeCompare(b.label) || String(a.start).localeCompare(String(b.start))) });
}

module.exports = { validRegistration, registrationKey };
