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
  vm.runInContext(read('companies.js'), context);
  vm.runInContext(read('events.js'), context);
  vm.runInContext(original && process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : read('script.js'), context);
  return code => vm.runInContext(code, context);
}
const run = load();
const before = load(true);
assert.equal(run('Object.keys(venueMaster).length'), 10);
assert.equal(run('sampleEvents.filter(e => e.venueId).length'), 11);
assert.ok(run('sampleEvents.every(e => !e.venueId || getEventVenue(e)?.venueId === e.venueId)'));
assert.equal(run('getEventVenue({venueId:"toString"})'), null);
assert.equal(run('getEventVenue({venueId:"missing"})'), null);
assert.ok(run('Object.values(venueMaster).every(v => v.name && v.city && v.prefecture && v.country && v.googleMaps.searchQuery && Array.isArray(v.access.airports) && Array.isArray(v.accommodation.hotels))'));

const events = JSON.parse(run('JSON.stringify(sampleEvents)'));
const originalData = run('JSON.stringify(sampleEvents)');
for (const event of events) {
  const card = run(`createEventCardHtml(${JSON.stringify(event)})`);
  const overseasConference = event.isConference && (event.conferenceRegion === 'international' || event.eventType === '海外学会');
  assert.equal(card.includes('<span class="card-meta-label">認定単位:</span>'), !overseasConference && typeof event.creditUnits === 'number', event.id);
  assert.equal(card.includes('<p class="card-desc">'), !event.isConference || overseasConference, event.id);
  assert.ok(card.includes(`<p class="card-subtitle">${run(`escapeHtml(${JSON.stringify(event.subtitle)})`)}</p>`), event.id);
  if (!event.isConference || overseasConference) {
    assert.ok(card.includes(`<p class="card-desc">${run(`escapeHtml(${JSON.stringify(event.description)})`)}</p>`), event.id);
  }
}
assert.equal(run('JSON.stringify(sampleEvents)'), originalData, 'Card display must not modify stored credits');
for (const units of [null, '', '未定', '未確認', '2', undefined, -1, NaN, Infinity]) {
  run('var creditFixture = {...sampleEvents.find(e => e.id === "oph-001")};');
  run(`creditFixture.creditUnits = ${units === undefined ? 'undefined' : Number.isNaN(units) ? 'NaN' : units === Infinity ? 'Infinity' : JSON.stringify(units)};`);
  assert.equal(run('getEventCreditLabel(creditFixture)'), '');
  assert.ok(!run('createEventCardHtml(creditFixture)').includes('認定単位:'));
}
for (const units of [0, 2, 1.5]) {
  run(`creditFixture.creditUnits = ${units}; creditFixture.credits = "日本眼科学会専門医制度";`);
  assert.equal(run('getEventCreditLabel(creditFixture)'), `日本眼科学会専門医制度 ${units}単位`);
  assert.ok(run('createEventCardHtml(creditFixture)').includes('認定単位:'));
}
run('creditFixture.creditUnits = null;');
assert.ok(!run('createEventCardHtml(creditFixture)').includes('認定単位:'));
run('creditFixture.creditUnits = 2;');
assert.ok(run('createEventCardHtml(creditFixture)').includes('日本眼科学会専門医制度 2単位'));
for (const [event, label, value] of [
  [{ cityCountry: '京都市（京都府） / 日本', region: '関西' }, '開催都市', '京都市（京都府）'],
  [{ cityCountry: '東京 ／ 日本', region: '関東', conferenceRegion: 'international' }, '開催都市', '東京'],
  [{ cityCountry: 'New Orleans, LA / 米国', region: '海外' }, '開催都市・国', 'New Orleans, LA / 米国'],
  [{ cityCountry: 'ウィーン / オーストリア', venueId: 'messe-wien' }, '開催都市・国', 'ウィーン / オーストリア'],
  [{ cityCountry: '京都市（京都府）', venueId: 'kyoto-international-conference-center' }, '開催都市', '京都市（京都府）'],
  [{ region: '関東', venue: '会場未定' }, '開催都市', '会場未定'],
  [{ cityCountry: '未定 / 欧州', region: '海外' }, '開催都市・国', '未定 / 欧州'],
  [{ cityCountry: null, venueId: 'tokyo-international-forum' }, '開催都市', '東京国際フォーラム']
]) {
  const display = JSON.parse(run(`JSON.stringify(getEventCityDisplay(${JSON.stringify(event)}))`));
  assert.deepEqual(display, { label, value });
}
for (const event of events.filter(e => e.isConference)) {
  const serialized = JSON.stringify(event);
  const display = JSON.parse(run(`JSON.stringify(getEventCityDisplay(${serialized}))`));
  const card = run(`createEventCardHtml(${serialized})`);
  const cityLabel = display.label === '開催都市・国'
    ? '<span class="city-label-full">開催都市・国：</span><span class="city-label-mobile">都市：</span>'
    : `${display.label}：`;
  assert.ok(card.includes(`<span class="conf-label conf-city-label">${cityLabel}</span>`), event.id);
  assert.ok(card.includes(`<span class="conf-val">${run(`escapeHtml(${JSON.stringify(display.value)})`)}</span>`), event.id);
  if (event.cityCountry?.split(/[/／]/)[1]?.trim() === '日本') {
    assert.equal(display.label, '開催都市');
    assert.ok(!display.value.includes('/ 日本'));
  }
}
for (const event of events) {
  if (!event.venueId) {
    const expr = `renderVenueHtml(${JSON.stringify(event)})`;
    assert.equal(run(expr), before(expr), event.id);
  } else {
    const html = run(`renderVenueHtml(${JSON.stringify(event)})`);
    const query = run(`getEventVenue(${JSON.stringify(event)}).googleMaps.searchQuery`);
    assert.ok(html.includes(encodeURIComponent(query)), event.id);
    assert.ok(html.includes(run(`escapeHtml(${JSON.stringify(event.venue)})`)), event.id);
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

// 国名表示は開催地を参照し、国際学会分類やフィルター値を変えない。
for (const [event, expected] of [
  [{ region: '海外', cityCountry: 'ウィーン / オーストリア' }, 'オーストリア'],
  [{ region: '海外', cityCountry: 'ニューオーリンズ / 米国' }, '米国'],
  [{ region: '海外', cityCountry: 'シンガポール / シンガポール共和国' }, 'シンガポール'],
  [{ region: '海外', cityCountry: 'マニラ ／ フィリピン', venueId: 'missing' }, 'フィリピン'],
  [{ region: '海外', cityCountry: '未定 / 欧州' }, '海外'],
  [{ region: '海外', cityCountry: '未定 / 未定' }, '海外'],
  [{ region: '海外', cityCountry: 'ウィーン' }, '海外'],
  [{ region: '海外', cityCountry: null }, '海外'],
  [{ region: '国内', cityCountry: '東京 / 日本' }, '国内'],
  [{ region: '関東', conferenceRegion: 'international', cityCountry: '東京 / 日本' }, '関東'],
  [{ region: '海外', cityCountry: 'ウィーン / オーストリア', venueId: 'tokyo-international-forum' }, '国内']
]) {
  assert.equal(run(`getEventVenueRegionLabel(${JSON.stringify(event)})`), expected);
}
run('venueMaster["test-foreign"] = {country:"シンガポール共和国", name:"Test", googleMaps:{searchQuery:"Test Singapore"}};');
assert.equal(run('getEventVenueRegionLabel({region:"海外",venueId:"test-foreign",cityCountry:"Vienna / オーストリア"})'), 'シンガポール');
run('venueMaster["test-foreign"].country = " ";');
assert.equal(run('getEventVenueRegionLabel({region:"海外",venueId:"test-foreign",cityCountry:"Vienna / オーストリア"})'), 'オーストリア');
run('delete venueMaster["test-foreign"];');
for (const event of events) {
  const serialized = JSON.stringify(event);
  const label = run(`getEventVenueRegionLabel(${serialized})`);
  const card = run(`createEventCardHtml(${serialized})`);
  assert.ok(card.includes(`[${run(`escapeHtml(${JSON.stringify(label)})`)}]`), event.id);
  if (process.argv[2]) {
    // 国名ラベルを除き、全94カードのHTMLとMapsリンクが変更前と一致する。
    const normalized = card.replace(`[${run(`escapeHtml(${JSON.stringify(label)})`)}]`, `[${event.region}]`);
    assert.equal(normalized, before(`createEventCardHtml(${serialized})`), event.id);
  }
}
const escapedEvent = { ...events.find(e => e.region === '海外'), venueId: 'missing', cityCountry: 'City / <国>&"' };
assert.ok(run(`createEventCardHtml(${JSON.stringify(escapedEvent)})`).includes('[&lt;国&gt;&amp;&quot;]'));

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
for (const event of [events.find(e => e.venueId), events.find(e => !e.venueId), events.find(e => e.id === 'oph-004'), {
  ...events.find(e => e.venueId), venue: ''
}]) {
  const serialized = JSON.stringify(event);
  const location = run(`getEventVenueName(${serialized})`);
  run(`state.calendarSettings.defaultCalendar = 'google'; var calendarEvent = ${serialized}; addToCalendar(calendarEvent);`);
  const url = new URL(run('openedUrl'));
  assert.equal(url.searchParams.get('location'), location);
  assert.ok(url.searchParams.get('details').includes('単位: ' + event.credits));
  assert.ok(url.searchParams.get('details').includes(event.description));
  assert.equal(run('JSON.stringify(calendarEvent)'), serialized, 'Opening a Google template must not mark the event as registered');
  run(`state.calendarSettings.defaultCalendar = 'icloud'; addToCalendar(${serialized});`);
  assert.ok(run('downloadedIcs').includes(`LOCATION:${location}\r\n`));
  assert.ok(run('downloadedIcs').includes(`(${event.credits})\\n公式:`));
  assert.ok(run('downloadedIcs').includes(`DESCRIPTION:${event.description.replace(/\n/g, ' ')}`));
}
console.log('PASS: venue master, Maps fallback, all event cards and filter regressions');
