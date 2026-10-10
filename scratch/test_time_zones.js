const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ assert, console,
  document: { getElementById: () => null, addEventListener: () => {} } });
for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
vm.runInContext(`
  const event = (date, timeZone, extra = {}) => ({date, timeZone, region: '海外', time: '08:00 - 17:30（現地時間）', ...extra});
  const text = e => getEventJapanTimes(e)[0]?.text;
  for (const [zone, date, expected] of [
    ['America/Chicago', '2026-07-01', '22:00 - 翌07:30（日本時間）'],
    ['America/Chicago', '2026-01-01', '23:00 - 翌08:30（日本時間）'],
    ['America/Los_Angeles', '2026-07-01', '翌00:00 - 翌09:30（日本時間）'],
    ['America/New_York', '2026-07-01', '21:00 - 翌06:30（日本時間）'],
    ['Europe/Vienna', '2026-07-01', '15:00 - 翌00:30（日本時間）'],
    ['Europe/Vienna', '2026-01-01', '16:00 - 翌01:30（日本時間）'],
    ['Asia/Singapore', '2026-07-01', '09:00 - 18:30（日本時間）'],
    ['Asia/Singapore', '2026-01-01', '09:00 - 18:30（日本時間）'],
    ['America/Chicago', '2026-03-07', '23:00 - 翌08:30（日本時間）'],
    ['America/Chicago', '2026-03-08', '22:00 - 翌07:30（日本時間）'],
    ['America/Chicago', '2026-10-31', '22:00 - 翌07:30（日本時間）'],
    ['America/Chicago', '2026-11-01', '23:00 - 翌08:30（日本時間）'],
    ['Europe/Vienna', '2026-03-28', '16:00 - 翌01:30（日本時間）'],
    ['Europe/Vienna', '2026-03-29', '15:00 - 翌00:30（日本時間）'],
    ['Europe/Vienna', '2026-10-24', '15:00 - 翌00:30（日本時間）'],
    ['Europe/Vienna', '2026-10-25', '16:00 - 翌01:30（日本時間）']
  ]) assert.equal(text(event(date, zone)), expected, zone + ' ' + date);
  assert.equal(text(event('2026-07-01', 'Pacific/Auckland', {time: '00:30 - 08:00'})), '前日21:30 - 05:00（日本時間）');
  assert.equal(text(event('2026-07-01', 'Asia/Singapore', {time: '23:00 - 01:00'})), '翌00:00 - 翌02:00（日本時間）');
  assert.equal(text(event('2026-07-01', 'Asia/Singapore', {time: '20:00 - 24:00'})), '21:00 - 翌01:00（日本時間）');
  // A range spanning the DST jump must resolve each endpoint separately.
  assert.equal(text(event('2026-03-08', 'America/Chicago', {time: '01:30 - 03:30'})), '16:30 - 17:30（日本時間）');
  assert.equal(getEventJapanTimes(event('2026-03-08', 'America/Chicago', {time: '02:30 - 04:00'})).length, 0);
  assert.equal(getEventJapanTimes(event('2026-11-01', 'America/Chicago', {time: '01:30 - 04:00'})).length, 0);
  const multi = event('2026-03-07', 'America/Chicago', {endDate: '2026-03-09'});
  const rows = getEventJapanTimes(multi);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].text, '23:00 - 翌08:30（日本時間）');
  assert.equal(rows[1].text, '22:00 - 翌07:30（日本時間）');
  assert.equal(rows[2].text, rows[1].text);
  const multiHtml = renderEventTimeHtml(multi);
  for (const date of ['2026-03-07', '2026-03-08', '2026-03-09']) assert.ok(multiHtml.includes(date));
  assert.ok(!renderEventTimeHtml(event('2026-07-01', 'Asia/Singapore', {endDate: '2026-07-03'})).includes('各日'));
  for (const e of [event('2026-07-01', undefined), event('2026-07-01', 'Bad/Zone'),
    event('2026-07-01', '+09:00'), event('2026-07-01', 'Etc/GMT+6'),
    event('2026-07-01', 'Asia/Tokyo'), event('2026-07-01', 'America/Chicago', {cityCountry: '東京 / 日本'}),
    event('2026-07-01', 'America/Chicago', {venueId: 'tokyo-international-forum'}),
    event('2026-07-01', 'America/Chicago', {region: '関東', conferenceRegion: 'domestic'}),
    event('2026-02-30', 'America/Chicago'), event('2026-07-01', 'America/Chicago', {endDate: '2026-06-30'})]) {
    assert.equal(getEventJapanTimes(e).length, 0);
    assert.equal(renderEventTimeHtml(e), escapeHtml(e.time));
  }
  for (const time of ['', null, '現地時間', '全日程', '25:00 - 26:00', '08:60 - 17:30', '08:00 - 24:30', '<script>']) {
    const e = event('2026-07-01', 'America/Chicago', {time});
    assert.equal(getEventJapanTimes(e).length, 0);
    assert.equal(renderEventTimeHtml(e), escapeHtml(time || ''));
  }
  assert.equal(text(event('2026-07-01', undefined, {venueId: 'new-orleans-convention-center'})), '22:00 - 翌07:30（日本時間）');
  assert.equal(text(event('2026-07-01', 'Asia/Singapore', {venueId: 'missing'})), '09:00 - 18:30（日本時間）');
  const before = JSON.stringify(sampleEvents);
  for (const e of sampleEvents) {
    const html = createEventCardHtml(e);
    if (e.id === 'oph-004') assert.ok(html.includes('日本時間'));
    else assert.ok(!html.includes('class="japan-time"'), e.id);
  }
  assert.equal(JSON.stringify(sampleEvents), before);
`, context);
console.log('PASS: US/EU summer/winter, Singapore, day rollover, per-day DST and endpoint changes, ambiguous/nonexistent times, invalid/unknown zones, domestic fallback, all 95 cards/data preserved');
