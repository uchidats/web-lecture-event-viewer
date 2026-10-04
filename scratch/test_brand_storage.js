const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const legacyPrefix = 'ophthahub_';
const prefix = 'ophthalconf_';
const values = {
  attending_conferences: JSON.stringify(['oph-011']),
  hidden_conferences: JSON.stringify(['conf-jp-jrvs-2026']),
  conference_attendance_history: JSON.stringify({ 'conf-jp-jos-2026': {
    status: 'attended', updatedAt: '2026-10-04T13:00:00Z', roles: ['chair'], notes: '記録を維持'
  } }),
  calendar_settings: JSON.stringify({ calendarProvider: 'icloud', defaultCalendar: 'icloud' })
};
function load(initial = {}, fail = () => false) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  const context = vm.createContext({
    document: { getElementById: () => null, addEventListener: () => {} },
    console: { warn() {} }, setTimeout, clearTimeout,
    localStorage: {
      getItem(key) { if (fail('get', key)) throw new Error('storage denied'); return data.get(key) ?? null; },
      setItem(key, value) { if (fail('set', key)) throw new Error('quota exceeded'); data.set(key, value); writes++; }
    }
  });
  for (const file of ['venues.js', 'events.js', 'script.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return { data, evaluate: code => vm.runInContext(code, context), writes: () => writes };
}
const legacy = Object.fromEntries(Object.entries(values).map(([name, value]) => [legacyPrefix + name, value]));
const first = load(legacy);
first.evaluate('migrateLegacyStorage(); loadAttendingConferences(); loadHiddenConferences(); loadConferenceHistory(); loadCalendarSettings();');
for (const [name, value] of Object.entries(values)) {
  assert.equal(first.data.get(prefix + name), value);
  assert.equal(first.data.get(legacyPrefix + name), value);
}
assert.equal(first.evaluate('state.attendingConferences.has("oph-011")'), true);
assert.equal(first.evaluate('state.hiddenConferences.has("conf-jp-jrvs-2026")'), true);
assert.equal(first.evaluate('state.conferenceHistory.get("conf-jp-jos-2026").notes'), '記録を維持');
assert.equal(first.evaluate('state.calendarSettings.defaultCalendar'), 'icloud');
const writes = first.writes(); first.evaluate('migrateLegacyStorage();'); assert.equal(first.writes(), writes);
first.evaluate('state.attendingConferences.clear(); saveAttendingConferences(); state.hiddenConferences.clear(); saveHiddenConferences(); state.conferenceHistory.clear(); saveConferenceHistory();');
for (const [name, value] of Object.entries(values)) assert.equal(first.data.get(legacyPrefix + name), value);
first.evaluate('migrateLegacyStorage(); loadAttendingConferences();'); assert.equal(first.evaluate('state.attendingConferences.size'), 0);
first.data.delete(prefix + 'attending_conferences'); first.evaluate('migrateLegacyStorage();');
assert.equal(first.data.has(prefix + 'attending_conferences'), false, 'Completed migration must not resurrect cleared data');
for (const current of ['[]', '{}', '"current"']) {
  const existing = load({ ...legacy, [prefix + 'attending_conferences']: current });
  existing.evaluate('migrateLegacyStorage();'); assert.equal(existing.data.get(prefix + 'attending_conferences'), current);
}
const empty = load({ ...legacy, [prefix + 'attending_conferences']: '' });
empty.evaluate('migrateLegacyStorage();'); assert.equal(empty.data.get(prefix + 'attending_conferences'), values.attending_conferences);
const fresh = load(); fresh.evaluate('migrateLegacyStorage();'); assert.equal(fresh.data.size, 0);
let deny = true;
const retry = load(legacy, (op, key) => deny && op === 'set' && key === prefix + 'attending_conferences');
retry.evaluate('migrateLegacyStorage();');
assert.equal(retry.data.has(prefix + 'attending_conferences_legacy_migrated'), false);
assert.equal(retry.data.get(legacyPrefix + 'attending_conferences'), values.attending_conferences);
deny = false; retry.evaluate('migrateLegacyStorage();');
assert.equal(retry.data.get(prefix + 'attending_conferences'), values.attending_conferences);
load(legacy, () => true).evaluate('migrateLegacyStorage();');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
assert.ok(script.indexOf('migrateLegacyStorage();') < script.indexOf('loadCalendarSettings();'));
const oldBrand = ['Ophtha', 'Hub'].join('');
for (const file of ['index.html', 'events.js', 'script.js', 'style.css', 'docs/conference/conference_seed_2026-10-04.txt']) {
  const contents = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!contents.includes(oldBrand), file);
  assert.ok(!contents.includes('眼科医専用'), file);
}
assert.ok(script.includes('PRODID:-//OphthalConf//'));
assert.ok(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('<title>OphthalConf'));
console.log('PASS: brand text; all 4 storage keys; canonical writes; legacy preservation; idempotence; no overwrite; empty values; failed-copy retry; unavailable storage');
