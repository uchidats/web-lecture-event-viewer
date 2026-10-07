const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const key = 'ophthalconf_filter_state';
const unrelated = {
  ophthalconf_attending_conferences: '["oph-001"]',
  ophthalconf_hidden_conferences: '["oph-011"]',
  ophthalconf_calendar_settings: '{"calendarProvider":"google","defaultCalendar":"google"}',
  ophthalconf_conference_attendance_history: '{}'
};
function load(initial = {}, denied = false) {
  const data = new Map(Object.entries(initial));
  const context = vm.createContext({
    console: { warn() {} }, setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener: () => {} },
    localStorage: {
      getItem(k) { if (denied) throw new Error('denied'); return data.get(k) ?? null; },
      setItem(k, v) { if (denied) throw new Error('quota exceeded'); data.set(k, v); },
      removeItem(k) { if (denied) throw new Error('denied'); data.delete(k); }
    }
  });
  for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return { data, evaluate: code => vm.runInContext(code, context) };
}
const original = load(unrelated);
original.evaluate(`
  state.filters.region = new Set(['関東', '海外']);
  state.filters.specialty = new Set(['緑内障']);
  state.filters.year = new Set(['2027']);
  state.filters.eventType = new Set(['国内学会', '海外学会']);
  state.filters.format = new Set(['現地']);
  state.filters.abstractStatus = new Set(['open', 'deadline_7d']);
  state.filters.company = new Set([getCoSponsorCompanyOptions(state.events)[0].id]);
  state.filters.scheduleStatus = new Set(['free']);
  state.filters.registeredOnly = true;
  state.filters.includeEndedConferences = true;
  state.filters.keyword = 'retina';
  state.sortBy = 'abstract-deadline-asc';
  saveFilterState();
`);
const saved = original.data.get(key);
assert.equal(JSON.parse(saved).version, 1);
const restored = load({ ...unrelated, [key]: saved });
restored.evaluate('loadFilterState(); saveFilterState();');
assert.deepEqual(JSON.parse(restored.data.get(key)), JSON.parse(saved));
assert.equal(restored.evaluate('state.filters.region instanceof Set'), true);
assert.equal(restored.evaluate('state.filters.registeredOnly'), true);
assert.equal(restored.evaluate('state.sortBy'), 'abstract-deadline-asc');
for (const [k, value] of Object.entries(unrelated)) assert.equal(restored.data.get(k), value);
restored.evaluate('clearSavedFilterState();');
assert.equal(restored.data.has(key), false);
for (const [k, value] of Object.entries(unrelated)) assert.equal(restored.data.get(k), value);
const reloaded = load(Object.fromEntries(restored.data));
reloaded.evaluate('loadFilterState();');
assert.equal(reloaded.evaluate('state.filters.region.size'), 0);
assert.equal(reloaded.evaluate('state.sortBy'), 'date-asc');

for (const bad of ['broken JSON', 'null', '[]', '{}', '{"version":99,"filters":{"region":["海外"]}}']) {
  const context = load({ [key]: bad });
  context.evaluate('loadFilterState();');
  assert.equal(context.evaluate('state.filters.region.size'), 0);
  assert.equal(context.evaluate('state.sortBy'), 'date-asc');
}
const stale = load({ [key]: JSON.stringify({ version: 1, filters: {
  region: ['関東', 'invalid', null, {}], year: ['1900', '2027'], specialty: '緑内障',
  abstractStatus: ['open', 'invalid'], company: ['unknown-company'], scheduleStatus: ['unknown'],
  registeredOnly: 'true', includeEndedConferences: true, keyword: ' RETINA ',
  attendingConferences: ['unrelated'], calendarSettings: { calendarProvider: 'none' }
}, sortBy: 'unknown-sort' }) });
stale.evaluate('loadFilterState();');
assert.equal(stale.evaluate('JSON.stringify([...state.filters.region])'), '["関東"]');
assert.equal(stale.evaluate('JSON.stringify([...state.filters.year])'), '["2027"]');
assert.equal(stale.evaluate('state.filters.specialty.size'), 0);
assert.equal(stale.evaluate('state.filters.company.size'), 0);
assert.equal(stale.evaluate('state.filters.scheduleStatus.size'), 4);
assert.equal(stale.evaluate('state.filters.registeredOnly'), false);
assert.equal(stale.evaluate('state.filters.keyword'), 'retina');
assert.equal(stale.evaluate('state.attendingConferences.size'), 0);
assert.equal(stale.evaluate('state.calendarSettings.calendarProvider'), 'both');
assert.equal(stale.evaluate('state.sortBy'), 'date-asc');
const empty = load({ [key]: JSON.stringify({ version: 1, filters: { scheduleStatus: [], region: [] }, sortBy: 'title-asc' }) });
empty.evaluate('loadFilterState();');
assert.equal(empty.evaluate('state.filters.scheduleStatus.size'), 0);
assert.equal(empty.evaluate('state.sortBy'), 'title-asc');
const unavailable = load({}, true);
assert.doesNotThrow(() => unavailable.evaluate('loadFilterState(); saveFilterState(); clearSavedFilterState();'));
console.log('PASS: filter/sort round-trip, Sets, both toggles, defaults, stale options, corrupt storage, storage failures, reset deletion and unrelated storage isolation');
