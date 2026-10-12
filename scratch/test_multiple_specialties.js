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
  assert.deepEqual(FILTER_OPTIONS.specialty, ['総合', '網膜・硝子体', '緑内障', '白内障', '角膜', '小児・斜視弱視', '神経眼科', '眼形成', '眼光学CL近視', '眼炎症感染', 'ロービジョン', 'その他']);
  assert.equal(getSpecialtyDisplayLabel('眼光学CL近視'), '眼光学・CL・近視');
  assert.equal(getSpecialtyDisplayLabel('白内障'), '白内障・屈折矯正');
  assert.equal(getConferenceCategoryDisplayLabel('白内障屈折'), '白内障・屈折矯正');
  assert.equal(getConferenceCategoryDisplayLabel('形成腫瘍'), '眼形成');
  assert.equal(getConferenceCategoryDisplayLabel('小児斜視'), '小児・斜視弱視');
  assert.equal(getSpecialtyDisplayLabel('小児・斜視弱視'), '小児・斜視弱視');
  assert.equal(getSpecialtyDisplayLabel('眼炎症感染'), '眼炎症・感染');
  assert.equal(getConferenceCategoryDisplayLabel('眼光学CL近視'), '眼光学・CL・近視');
  assert.equal(getConferenceCategoryDisplayLabel('眼炎症感染'), '眼炎症・感染');
  const joint = sampleEvents.find(e => e.id === 'conf-jp-inflammation-2028');
  assert.deepEqual(getEventSpecialties(joint), ['眼炎症感染', 'その他']);
  assert.deepEqual(getEventSpecialties({specialty: 'その他'}), ['その他']);
  assert.deepEqual(getEventSpecialties({}), []);
  assert.equal(sampleEvents.filter(e => getEventSpecialties(e).includes('眼炎症感染')).length, 3);
  assert.equal(sampleEvents.filter(e => getEventSpecialties(e).includes('その他')).length, 14);
  state.events = sampleEvents;
  const chairJoint = sampleEvents.find(e => e.id === 'conf-jp-pediatric-2027');
  assert.equal(getConferenceChairDisplayLabel(chairJoint), '林 思音（山形大学）・彦谷 明子（浜松医科大学）');
  for (const event of sampleEvents.filter(e => e.id !== chairJoint.id)) assert.equal(getConferenceChairDisplayLabel(event), event.conferenceChair || '');
  const threeChairs = {isConference: true, title: '第1回甲学会／第2回乙学会／第3回丙学会', conferenceChair: '第3回丙学会: 丙先生（丙病院）／第1回甲学会: 甲先生（甲大学/甲病院）／第2回乙学会: 乙先生（乙大学）'};
  assert.equal(getConferenceChairDisplayLabel(threeChairs), '甲先生（甲大学/甲病院）・乙先生（乙大学）・丙先生（丙病院）');
  assert.equal(getConferenceChairDisplayLabel({...threeChairs, title: '別大会'}), threeChairs.conferenceChair, 'Unmatched conference labels are not guessed');
  assert.ok(createEventCardHtml(chairJoint).includes('林 思音（山形大学）・彦谷 明子（浜松医科大学）'));
  const pediatricConferences = sampleEvents.filter(e => e.isConference && e.conferenceCategory === '小児斜視');
  assert.ok(pediatricConferences.length > 0);
  for (const event of pediatricConferences) {
    const html = createEventCardHtml(event);
    const classification = html.match(/<span class="conf-val conf-classification-val">([\\s\\S]*?)<\\/span>\\s*<\\/div>/)[1];
    assert.equal((classification.match(/小児・斜視弱視/g) || []).length, 1, event.id + ' has one unified label');
    assert.ok(!classification.includes('小児斜視'));
    const multiple = createEventCardHtml({...event, specialty: ['小児・斜視弱視', 'その他']});
    assert.ok(multiple.includes('conf-category-badge specialty">その他</span>'), 'Distinct specialty is retained');
  }
  for (const event of sampleEvents) {
    const html = createEventCardHtml(event);
    const linkedConference = !!(event.isConference && event.eventOfficialUrl);
    assert.equal(html.includes('data-action="view-pdf"'), !linkedConference, event.id + ' PDF visibility');
    assert.equal(html.includes('class="btn btn-official"'), !linkedConference, event.id + ' application visibility');
    assert.equal(html.includes('class="conference-title-link"'), linkedConference);
    assert.ok(html.includes('data-action="add-calendar"'));
    assert.ok(html.includes('class="schedule-badge '));
  }
  const pdfOnly = createEventCardHtml({...pediatricConferences[0], eventOfficialUrl: '', officialUrl: '', pdfUrl: 'official.pdf'});
  assert.ok(pdfOnly.includes('data-action="view-pdf"'), 'Conference without event URL retains primary PDF');
  assert.ok(!pdfOnly.includes('class="conference-title-link"'));
  getTodayString = () => '2026-10-12';
  for (const key of FILTER_SET_KEYS) state.filters[key].clear();
  state.filters.includeEndedConferences = true;
  state.filters.specialty = new Set(['小児・斜視弱視']);
  assert.equal(getFilteredEvents().length, 5, 'Pediatric specialty filter count is unchanged');
  assert.equal(pediatricConferences.length, 4, 'Internal conference category remains unchanged');
  state.filters.specialty.clear();
  for (const [labels, expected] of [[['眼炎症感染'], 3], [['その他'], 14], [['眼炎症感染', 'その他'], 16]]) {
    state.filters.specialty = new Set(labels);
    const result = getFilteredEvents();
    assert.equal(result.length, expected);
    assert.equal(new Set(result.map(e => e.id)).size, result.length);
    assert.ok(result.some(e => e.id === joint.id));
  }
  state.filters.specialty.clear();
  for (const [keyword, count] of [['眼光学CL近視', 6], ['眼光学・CL・近視', 6], ['眼炎症感染', 3], ['眼炎症・感染', 3]]) {
    state.filters.keyword = keyword.toLowerCase();
    assert.equal(getFilteredEvents().length, count);
  }
`, context);
for (const specialty of ['その他', ['眼炎症感染', 'その他']]) {
  assert.doesNotThrow(() => validateEvents([{ id: 'valid', specialty }]));
}
for (const specialty of [[], ['その他', 'その他'], [''], [42], 42]) {
  assert.throws(() => validateEvents([{ id: 'invalid', specialty }]), /Invalid specialty labels/);
}
console.log('PASS: single/array specialties, 3/14/16 counts, OR filtering, no duplicates and data validation');
