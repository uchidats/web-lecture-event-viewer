const assert = require('node:assert/strict');
const path = require('node:path');
const holidays = require('../japan-holidays');
const { toCalendarEvent, toCompactCalendarEvent, nextDate, initialMode, formatCompactDate, formatCompactHeading } = require('../calendar-view');
assert.equal(formatCompactDate(new Date(2027, 6, 3)), '2027年7月3日（土）');
assert.equal(formatCompactDate(new Date(2027, 6, 4)), '2027年7月4日（日）');
assert.equal(formatCompactDate(new Date(2026, 9, 12)), '2026年10月12日（月）');
assert.equal(formatCompactDate(new Date(2026, 9, 12), true), '2026年10月12日（月・祝）');
assert.equal(formatCompactDate(new Date(2027, 2, 21), true), '2027年3月21日（日・祝）');

// formatCompactHeading tests
const ascrsHeading = formatCompactHeading(new Date(2027, 3, 2), new Date(2027, 3, 5), holidays);
assert.equal(ascrsHeading.fullText, '2027年4月2日（金）〜5日（月）');
assert.equal(ascrsHeading.isRange, true);
assert.equal(ascrsHeading.startLabel, '2027年4月2日（金）');
assert.equal(ascrsHeading.endLabel, '5日（月）');
assert.equal(ascrsHeading.start.colorClass, '');
assert.equal(ascrsHeading.end.colorClass, '');

const singleDayHeading = formatCompactHeading(new Date(2027, 3, 15), new Date(2027, 3, 15));
assert.equal(singleDayHeading.fullText, '2027年4月15日（木）');
assert.equal(singleDayHeading.isRange, false);
assert.equal(singleDayHeading.startLabel, '2027年4月15日（木）');
assert.equal(singleDayHeading.end, null);

// Weekend and holiday colors
const satMonHolidayHeading = formatCompactHeading(new Date(2026, 8, 19), new Date(2026, 8, 21), holidays);
assert.equal(satMonHolidayHeading.fullText, '2026年9月19日（土）〜21日（月・祝）');
assert.equal(satMonHolidayHeading.start.colorClass, 'compact-date-saturday');
assert.equal(satMonHolidayHeading.end.colorClass, 'compact-date-holiday');
assert.equal(satMonHolidayHeading.holidays[0].name, '敬老の日');

// Cross-year multi-day range
assert.equal(formatCompactHeading('2026-12-04', '2026-12-06').fullText, '2026年12月4日（金）〜6日（日）');
assert.equal(formatCompactHeading('2026-10-29', '2026-11-01').fullText, '2026年10月29日（木）〜11月1日（日）');
assert.equal(formatCompactHeading('2026-01-03', '2027-01-03').endLabel, '2027年1月3日（日）');
const crossYearHeading = formatCompactHeading(new Date(2026, 11, 31), new Date(2027, 0, 3), holidays);
assert.equal(crossYearHeading.fullText, '2026年12月31日（木）〜2027年1月3日（日）');
assert.equal(crossYearHeading.end.colorClass, 'compact-date-sunday');

for (const mobile of [true, false]) {
  for (const view of ['list', 'calendar', 'compact']) assert.equal(initialMode(view, mobile), view);
  assert.equal(initialMode(null, mobile), mobile ? 'compact' : 'calendar');
}
const { loadEvents } = require('../scripts/auto-updater/storage');
assert.equal(nextDate('2027-03-21'), '2027-03-22');
assert.equal(nextDate('2026-12-31'), '2027-01-01');
assert.equal(nextDate('2028-02-28'), '2028-02-29');
assert.equal(nextDate('2028-02-29'), '2028-03-01');
const fixture = { id: 'four-day', title: '学会', date: '2027-03-18', endDate: '2027-03-21', isConference: true, timeZone: 'America/Los_Angeles' };
const converted = toCalendarEvent(fixture);
assert.equal(converted.start, '2027-03-18');
assert.equal(converted.end, '2027-03-22');
assert.equal(converted.allDay, true);
assert.equal(converted.url, undefined, 'Events must open OphthalConf details, not navigate externally');
assert.equal((Date.parse(converted.end) - Date.parse(converted.start)) / 86400000, 4);
assert.equal(fixture.endDate, '2027-03-21');
assert.equal(toCalendarEvent({ ...fixture, endDate: undefined }).end, '2027-03-19');

const compactConverted = toCompactCalendarEvent(fixture);
assert.equal(compactConverted.start, '2027-03-18');
assert.equal(compactConverted.end, '2027-03-19');
assert.equal(compactConverted.extendedProps.isCompactSingleDay, true);
assert.equal(compactConverted.extendedProps.originalEvent, fixture);

const { events } = loadEvents(path.resolve(__dirname, '..'));
for (const event of events) {
  const result = toCalendarEvent(event);
  assert.equal(result.start, event.date);
  assert.equal(result.end, nextDate(event.endDate || event.date));
  assert.equal(result.extendedProps.originalEvent, event);

  const compactResult = toCompactCalendarEvent(event);
  assert.equal(compactResult.start, event.date);
  assert.equal(compactResult.end, nextDate(event.date));
  assert.equal(compactResult.extendedProps.originalEvent, event);
}
assert.equal(holidays['2026-09-22'], '休日');
assert.equal(holidays['2027-03-21'], '春分の日');
assert.equal(holidays['2027-03-22'], '休日');
assert.equal(holidays['2027-01-11'], '成人の日');
assert.equal(holidays['2028-03-20'], undefined, 'Unpublished holidays are not estimated');
console.log('PASS: all 95 event ranges, four-day inclusive dates, single days, leap/year boundaries, unchanged international dates and published holidays');
