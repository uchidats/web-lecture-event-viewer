const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function load(original = false) {
  const context = vm.createContext({
    document: { getElementById: () => null, addEventListener: () => {} },
    console, setTimeout, clearTimeout
  });
  vm.runInContext(read('venues.js'), context);
  vm.runInContext(read('events.js'), context);
  vm.runInContext(original && process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : read('script.js'), context);
  return code => vm.runInContext(code, context);
}
const run = load();
const before = load(true);
assert.equal(run('Object.keys(venueMaster).length'), 6);
assert.equal(run('sampleEvents.filter(e => e.venueId).length'), 6);
assert.ok(run('sampleEvents.every(e => !e.venueId || getEventVenue(e)?.venueId === e.venueId)'));
assert.equal(run('getEventVenue({venueId:"toString"})'), null);
assert.equal(run('getEventVenue({venueId:"missing"})'), null);
assert.ok(run('Object.values(venueMaster).every(v => v.name && v.city && v.prefecture && v.country && v.googleMaps.searchQuery && Array.isArray(v.access.airports) && Array.isArray(v.accommodation.hotels))'));

const events = JSON.parse(run('JSON.stringify(sampleEvents)'));
for (const event of events) {
  if (!event.venueId) {
    const expr = `renderVenueHtml(${JSON.stringify(event)})`;
    assert.equal(run(expr), before(expr), event.id);
  } else {
    const html = run(`renderVenueHtml(${JSON.stringify(event)})`);
    const query = run(`getEventVenue(${JSON.stringify(event)}).googleMaps.searchQuery`);
    assert.ok(html.includes(encodeURIComponent(query)), event.id);
    assert.ok(html.includes(event.venue), event.id);
  }
}
for (const venue of ['', '未定', 'Web', 'オンライン', 'Zoom会議', '東京国際フォーラム / Web同時配信', '<会場>&"']) {
  const event = { venue, venueId: 'missing', cityCountry: '東京 / 日本' };
  const expr = `renderVenueHtml(${JSON.stringify(event)})`;
  assert.equal(run(expr), before(expr));
}
assert.ok(run('renderVenueHtml({venueId:"tokyo-international-forum"})').includes('東京国際フォーラム</a>'));
assert.equal(run('getEventVenueName({venueId:"tokyo-international-forum"})'), '東京国際フォーラム');
assert.equal(run('getEventVenueName({venueId:"tokyo-international-forum",venue:"Room A"})'), 'Room A');

// 実際のフィルター・カード生成を変更前の実装と比較する。
for (const setup of [
  '',
  'state.filters.includeEndedConferences = true;',
  'state.filters.year.add("2027");',
  'state.filters.keyword = "眼科";',
  'state.filters.region.add("関西");',
  'state.filters.registeredOnly = true;',
  'state.attendingConferences.add("conf-jp-jos-2026");',
  'state.hiddenConferences.add("conf-jp-jrvs-2026");'
]) {
  const current = load();
  const baseline = load(true);
  for (const evaluate of [current, baseline]) {
    evaluate('getTodayString = () => "2026-10-04";');
    evaluate(setup);
  }
  assert.equal(current('JSON.stringify(getFilteredEvents().map(e => e.id))'), baseline('JSON.stringify(getFilteredEvents().map(e => e.id))'));
}
assert.ok(run('sampleEvents.every(e => typeof createEventCardHtml(e) === "string")'));
const html = read('index.html');
assert.ok(html.indexOf('src="venues.js"') < html.indexOf('src="events.js"'));
// Google Calendar / ICS の場所と登録状態を実際の関数で検証する。
run(`
  renderEvents = () => {};
  updateRegisteredBadge = () => {};
  showToast = () => {};
  var openedUrl, downloadedIcs;
  var window = { open: url => { openedUrl = url; } };
  var Blob = class { constructor(parts) { downloadedIcs = parts.join(''); } };
  var URL = { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} };
  document.createElement = () => ({ click() {} });
  document.body = { appendChild() {}, removeChild() {} };
`);
for (const event of [events.find(e => e.venueId), events.find(e => !e.venueId), {
  ...events.find(e => e.venueId), venue: ''
}]) {
  const serialized = JSON.stringify(event);
  const location = run(`getEventVenueName(${serialized})`);
  run(`state.calendarSettings.defaultCalendar = 'google'; var calendarEvent = ${serialized}; addToCalendar(calendarEvent);`);
  const url = new URL(run('openedUrl'));
  assert.equal(url.searchParams.get('location'), location);
  assert.ok(run('calendarEvent.calendarStatus.isAdded'));
  run(`state.calendarSettings.defaultCalendar = 'icloud'; addToCalendar(${serialized});`);
  assert.ok(run('downloadedIcs').includes(`LOCATION:${location}\r\n`));
}
console.log('PASS: venue master, Maps fallback, all event cards and filter regressions');
