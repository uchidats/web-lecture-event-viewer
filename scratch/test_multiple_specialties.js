const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateEvents } = require('../scripts/auto-updater/storage');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ assert, console,
  document: { getElementById: () => null, addEventListener: () => {} } });
for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
vm.runInContext(`
  const joint = sampleEvents.find(e => e.id === 'conf-jp-inflammation-2028');
  assert.deepEqual(getEventSpecialties(joint), ['眼炎症感染', 'その他']);
  assert.deepEqual(getEventSpecialties({specialty: 'その他'}), ['その他']);
  assert.deepEqual(getEventSpecialties({}), []);
  assert.equal(sampleEvents.filter(e => getEventSpecialties(e).includes('眼炎症感染')).length, 3);
  assert.equal(sampleEvents.filter(e => getEventSpecialties(e).includes('その他')).length, 16);
  state.events = sampleEvents;
  getTodayString = () => '2026-10-12';
  for (const key of FILTER_SET_KEYS) state.filters[key].clear();
  state.filters.includeEndedConferences = true;
  for (const [labels, expected] of [[['眼炎症感染'], 3], [['その他'], 16], [['眼炎症感染', 'その他'], 18]]) {
    state.filters.specialty = new Set(labels);
    const result = getFilteredEvents();
    assert.equal(result.length, expected);
    assert.equal(new Set(result.map(e => e.id)).size, result.length);
    assert.ok(result.some(e => e.id === joint.id));
  }
`, context);
for (const specialty of ['その他', ['眼炎症感染', 'その他']]) {
  assert.doesNotThrow(() => validateEvents([{ id: 'valid', specialty }]));
}
for (const specialty of [[], ['その他', 'その他'], [''], [42], 42]) {
  assert.throws(() => validateEvents([{ id: 'invalid', specialty }]), /Invalid specialty labels/);
}
console.log('PASS: single/array specialties, 3/16/18 counts, OR filtering, no duplicates and data validation');
