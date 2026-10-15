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
  const timedConference={...sampleEvents.find(e=>e.isConference),time:'09:00 - 18:00（全日程）'};
  assert.equal(shouldDisplayEventTime(timedConference),false);
  assert.ok(!createEventCardHtml(timedConference).includes('class="time-text"'));
  assert.equal(shouldDisplayEventTime({...timedConference,showConferenceTime:true}),true);
  assert.ok(createEventCardHtml({...timedConference,showConferenceTime:true}).includes('class="time-text"'));
  assert.equal(shouldDisplayEventTime({...timedConference,showConferenceTime:true,time:'全日程'}),false);
  assert.equal(shouldDisplayEventTime({...timedConference,isConference:false}),true);
  assert.equal(timedConference.time,'09:00 - 18:00（全日程）');
  const ringan = sampleEvents.find(e=>e.id==='oph-001');
  assert.equal(ringan.title,'第80回 日本臨床眼科学会');
  assert.ok(createEventCardHtml(ringan).includes('>第80回 日本臨床眼科学会</a>'));
  assert.ok(!createEventCardHtml(ringan).includes('conference-title-ringan-suffix'));
  for(const format of ['現地','onsite','Onsite','ハイブリッド','Web']) {
    const conference={...sampleEvents.find(e=>e.isConference),format};
    const expected=!['現地','onsite','Onsite'].includes(format);
    assert.equal(shouldDisplayEventFormat(conference),expected);
    assert.equal(createEventCardHtml(conference).includes('class="format-badge '),expected);
    const card=createEventCardHtml(conference),top=card.match(/<div class="card-top-row">([\\s\\S]*?)<!-- 予定重複/)[1];
    assert.ok(!top.includes('class="format-badge '),'Conference top row has no format badge');
    assert.ok(!card.match(/<h3 class="card-title">([\\s\\S]*?)<\\/h3>/)[1].includes('class="format-badge '),'Title contains no format badge');
    if(expected)assert.ok(card.match(/<span class="conf-val conf-classification-val">([\\s\\S]*?)<\\/span>\\s*<\\/div>/)[1].includes('class="format-badge '),'Conference badge follows classification chips');
    assert.equal(conference.format,format,'Stored format remains unchanged');
    assert.ok(createEventCardHtml({...conference,isConference:false}).includes('class="format-badge '),'Standalone event retains format badge');
  }
  const internationalDescription = {isConference:true,conferenceRegion:'international',description:'前半。後半。'};
  assert.equal(getEventDescriptionDisplayText(internationalDescription),'前半。後半');
  assert.equal(internationalDescription.description,'前半。後半。','Original description unchanged');
  assert.equal(getEventDescriptionDisplayText({...internationalDescription,description:'末尾。。'}),'末尾。','Remove exactly one punctuation character');
  for (const description of ['句点なし','英語.','末尾。 ', '']) assert.equal(getEventDescriptionDisplayText({...internationalDescription,description}),description);
  assert.equal(getEventDescriptionDisplayText({...internationalDescription,conferenceRegion:'domestic'}),'前半。後半。');
  assert.equal(getEventDescriptionDisplayText({...internationalDescription,isConference:false}),'前半。後半。');
  assert.equal(getEventDescriptionDisplayText({...internationalDescription,conferenceRegion:undefined,eventType:'海外学会'}),'前半。後半');
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
  assert.equal(getFilteredEvents().length, 4, 'Pediatric specialty excludes the removed demo lecture');
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
