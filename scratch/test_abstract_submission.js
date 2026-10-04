const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const context = vm.createContext({
  assert, console, setTimeout, clearTimeout,
  document: { getElementById: () => null, addEventListener: () => {} }
});
for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) vm.runInContext(read(file), context);
vm.runInContext(`
  getTodayString = () => '2026-10-04';
  const template = sampleEvents.find(e => e.isConference && !isConferenceEnded(e));
  const make = (status, deadline, url = '') => ({
    ...template, abstractSubmission: { status, deadline, url, startDate: '2026-10-01' }
  });
  for (const [deadline, days, urgency] of [
    ['2026-11-04', 31, 'normal'], ['2026-11-03', 30, 'soon'],
    ['2026-10-11', 7, 'urgent'], ['2026-10-05', 1, 'urgent'],
    ['2026-10-04', 0, 'today'], ['2026-10-03', -1, 'normal']
  ]) {
    const event = make('open', deadline + ' 13:00');
    const info = getAbstractSubmissionState(event);
    assert.equal(info.days, days);
    assert.equal(info.urgency, urgency);
    assert.equal(info.status, days < 0 ? 'closed' : 'open');
    const html = createEventCardHtml(event);
    assert.ok(html.includes(days < 0 ? '演題募集終了' : days === 0 ? '本日締切' : '締切まで' + days + '日'));
    assert.equal(matchesAbstractFilter(event, 'open'), days >= 0);
    assert.equal(matchesAbstractFilter(event, 'deadline_30d'), days >= 0 && days <= 30);
    assert.equal(matchesAbstractFilter(event, 'deadline_7d'), days >= 0 && days <= 7);
  }
  for (const [status, label] of [
    ['open', '演題募集中'], ['upcoming', '演題募集予定'],
    ['closed', '演題募集終了'], ['unknown', '演題募集情報未確認']
  ]) {
    const event = make(status, status === 'unknown' ? null : '2026-11-05');
    assert.ok(createEventCardHtml(event).includes(label));
    const linked = renderAbstractSubmissionHtml({ ...event, abstractSubmission: {
      ...event.abstractSubmission, url: 'https://example.com/abstract?a=1&b=2'
    }});
    assert.ok(linked.includes('target="_blank" rel="noopener noreferrer"'));
    assert.ok(linked.includes('https://example.com/abstract?a=1&amp;b=2'));
    assert.ok(!renderAbstractSubmissionHtml(event).includes('<a '));
  }
  assert.ok(renderAbstractSubmissionHtml(make('open', '2026-11-05')).includes('演題締切 11/5'));
  assert.ok(renderAbstractSubmissionHtml(make('open', '2027-01-05')).includes('演題締切 2027/1/5'));
  assert.equal(getDaysUntilAbstractDeadline(make('open', '2026-10-04'), new Date(2026, 9, 4, 23, 59)), 0);
  for (const deadline of [null, '', 'invalid', '2026-02-30']) {
    assert.equal(getDaysUntilAbstractDeadline(make('open', deadline)), null);
    assert.ok(!renderAbstractSubmissionHtml(make('open', deadline)).includes('NaN'));
  }
  assert.ok(renderAbstractSubmissionHtml(make('unknown', '2026-11-05')).includes('演題締切 11/5'));
  const originalEvents = state.events;
  state.events = [
    {...make('open', '2026-10-05'), id: 'match', date: '2027-04-01', specialty: 'test', region: 'test'},
    {...make('open', '2026-10-05'), id: 'wrong-year', date: '2026-12-01', specialty: 'test', region: 'test'},
    {...make('open', '2026-10-03'), id: 'expired', date: '2027-04-01', specialty: 'test', region: 'test'},
    {...make('upcoming', '2026-10-05'), id: 'upcoming', date: '2027-04-01', specialty: 'test', region: 'test'},
    {...make('open', '2026-10-05'), id: 'wrong-region', date: '2027-04-01', specialty: 'test', region: 'other'}
  ];
  state.filters.year.add('2027'); state.filters.specialty.add('test'); state.filters.region.add('test');
  state.filters.abstractStatus.add('deadline_7d');
  assert.equal(JSON.stringify(getFilteredEvents().map(e => e.id)), JSON.stringify(['match']));
  state.hiddenConferences.add('match'); assert.equal(getFilteredEvents().length, 0);
  state.hiddenConferences.clear();
  for (const key of ['year', 'specialty', 'region', 'abstractStatus']) state.filters[key].clear();
  const before = JSON.stringify(getFilteredEvents().map(e => e.id));
  state.filters.abstractStatus.add('open'); state.filters.abstractStatus.add('deadline_7d');
  assert.equal(JSON.stringify(getFilteredEvents().map(e => e.id)), JSON.stringify(['wrong-year', 'match', 'wrong-region']));
  state.filters.abstractStatus.clear(); assert.equal(JSON.stringify(getFilteredEvents().map(e => e.id)), before);
  // Deadline sorting uses calendar days, puts missing/invalid dates last, and preserves filter gates.
  assert.equal(state.sortBy, 'date-asc');
  const sortingEvent = (id, date, deadline, extra = {}) => ({
    ...make('open', deadline), id, date, endDate: date, region: '関西',
    specialty: '網膜・硝子体', sponsors: [{companyId: 'santen', role: 'co-sponsor'}], ...extra
  });
  state.events = [
    sortingEvent('missing-late', '2027-05-01', null),
    sortingEvent('same-late', '2027-04-20', '2026-10-10 09:00'),
    sortingEvent('invalid', '2027-04-10', '2026-02-30'),
    sortingEvent('soon', '2027-06-01', '2026-10-05'),
    sortingEvent('same-early', '2027-04-15', '2026-10-10 17:00'),
    sortingEvent('missing-early', '2027-04-01', undefined),
    sortingEvent('past', '2027-07-01', '2026-10-01', {abstractSubmission: {status: 'closed', deadline: '2026-10-01'}}),
    sortingEvent('wrong-region', '2027-04-01', '2026-10-06', {region: '海外'}),
    sortingEvent('wrong-company', '2027-04-01', '2026-10-06', {sponsors: [{companyId: 'bayer', role: 'co-sponsor'}]})
  ];
  const sortedIds = () => getFilteredEvents().map(e => e.id).join(',');
  const dateOrder = sortedIds();
  state.sortBy = 'abstract-deadline-asc';
  assert.equal(sortedIds(), 'past,soon,wrong-region,wrong-company,same-early,same-late,missing-early,invalid,missing-late');
  state.filters.region.add('関西'); state.filters.year.add('2027');
  state.filters.specialty.add('網膜・硝子体'); state.filters.company.add('santen');
  state.filters.abstractStatus.add('open');
  assert.equal(sortedIds(), 'soon,same-early,same-late,missing-early,invalid,missing-late');
  state.filters.abstractStatus.clear();
  state.hiddenConferences.add('soon');
  assert.equal(sortedIds(), 'past,same-early,same-late,missing-early,invalid,missing-late');
  state.hiddenConferences.clear();
  for (const key of ['region', 'year', 'specialty', 'company']) state.filters[key].clear();
  state.sortBy = 'date-asc'; assert.equal(sortedIds(), dateOrder);
  state.events = originalEvents;
  assert.equal(sampleEvents.length, 94);
  assert.equal(new Set(sampleEvents.map(e => e.id)).size, 94);
  for (const event of sampleEvents) assert.ok(createEventCardHtml(event).includes('data-id="' + event.id + '"'));
  console.log('PASS: statuses, date boundaries, links, combined filters, unchanged order, all 94 cards');
`, context);
const css = read('style.css');
assert.ok(css.includes('@media (max-width: 480px)'));
assert.ok(css.includes('overflow-wrap: anywhere'));
const html = read('index.html');
assert.ok(html.includes('<option value="date-asc">開催日（近い順）</option>'));
assert.ok(html.includes('<option value="abstract-deadline-asc">演題締切（近い順）</option>'));
assert.ok(!html.includes('value="date-desc"'));
console.log('PASS: deadline sorting, missing/invalid dates last, same-day tie breaks, combined filters, default and menu');
