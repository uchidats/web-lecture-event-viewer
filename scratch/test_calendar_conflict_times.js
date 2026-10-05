const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({console, URLSearchParams, AbortController, setTimeout, clearTimeout,
  document: {getElementById: () => null, addEventListener() {}}, module: {exports: {}}});
for (const file of ['venues.js', 'companies.js', 'events.js', 'google-calendar.js', 'script.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
const {createAdapter} = ctx.module.exports;
const event = {...JSON.parse(vm.runInContext('JSON.stringify(sampleEvents.find(e=>!e.isConference&&!e.parentConferenceId))', ctx)),
  date: '2026-11-07', endDate: undefined, time: '11:00 - 14:00', region: '全国Web', timeZone: 'Asia/Tokyo'};
const cases = [
  [{start: {dateTime: '2026-11-07T11:00:00+09:00'}, end: {dateTime: '2026-11-07T14:00:00+09:00'}},
    {start: '11:00', end: '14:00'}, '11:00–14:00'],
  [{start: {dateTime: '2026-11-07T11:00:00+09:00'}, end: {dateTime: '2026-11-08T16:00:00+09:00'}},
    {start: '11:00', end: '16:00', startDate: '2026-11-07', endDate: '2026-11-08'}, '11/7 11:00–11/8 16:00'],
  [{start: {date: '2026-11-07'}, end: {date: '2026-11-08'}},
    {allDay: true, startDate: '2026-11-07', endDate: '2026-11-07'}, '11/7 終日'],
  [{start: {date: '2026-11-07'}, end: {date: '2026-11-09'}},
    {allDay: true, startDate: '2026-11-07', endDate: '2026-11-08'}, '11/7–11/8 終日'],
  [{start: {dateTime: '2026-11-07T02:00:00Z'}, end: {dateTime: '2026-11-07T15:00:00Z'}},
    {start: '11:00', end: '00:00', startDate: '2026-11-07', endDate: '2026-11-08'}, '11/7 11:00–11/8 00:00']
];
(async () => {
  for (const [raw, dummy, expected] of cases) {
    const adapter = createAdapter({config: {clientId: 'test'}, timers: {setTimeout: () => 1, clearTimeout() {}},
      oauth: () => ({hasGrantedAllScopes: () => true, initTokenClient: options => ({requestAccessToken: () => options.callback({access_token: 'mock', expires_in: 3600})})}),
      fetchImpl: async url => ({ok: true, status: 200, json: async () => url.includes('/events?')
        ? {items: [{id: 'mock', summary: 'Mock Google', ...raw}]} : {timeZone: 'Asia/Tokyo'}})});
    await adapter.connect(); await adapter.ensure([event]);
    const google = adapter.snapshot(event).conflicts[0];
    assert.ok(google, expected);
    ctx.googleConflict = google; ctx.icloudConflict = {...dummy, title: 'Mock iCloud'}; ctx.fixture = event;
    assert.equal(vm.runInContext('formatCalendarConflictTime(googleConflict,fixture)', ctx), expected);
    assert.equal(vm.runInContext('formatCalendarConflictTime(icloudConflict,fixture)', ctx), expected);
    ctx.GoogleCalendar = {snapshot: () => ({state: 'ready', status: 'partial', registered: false, conflicts: [google]})};
    vm.runInContext('state.calendarSettings.calendarProvider="both";fixture.calendarStatus={icloud:{status:"partial",conflicts:[icloudConflict]}};', ctx);
    const html = vm.runInContext('createEventCardHtml(fixture)', ctx);
    assert.equal(html.split(expected).length - 1, 2, 'Both provider rows must use the same display');
    adapter.disconnect();
  }
  ctx.fixture = event;
  assert.equal(vm.runInContext('formatCalendarConflictTime({start:"11:00",end:"11/8 16:00"},fixture)', ctx), '11/7 11:00–11/8 16:00');
  console.log('PASS: shared Google/iCloud timed, overnight, midnight, single/multiple all-day formats and exclusive all-day end dates; both provider card rows');
})().catch(error => {console.error(error); process.exitCode = 1;});
