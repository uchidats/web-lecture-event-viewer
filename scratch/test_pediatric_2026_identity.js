const assert = require('node:assert/strict');
const path = require('node:path');
const { loadEvents, validateEvents } = require('../scripts/auto-updater/storage');
const { auditConferenceIdentities } = require('../scripts/conference-identity');
const events = loadEvents(path.resolve(__dirname, '..')).events;
assert.equal(events.length, 95);
assert.ok(!events.some(e => e.id === 'oph-003'));
const pediatric = events.find(e => e.id === 'conf-jp-pediatric-2026');
const strabismus = events.find(e => e.id === 'conf-jp-strabismus-2026');
assert.equal(pediatric.title, '第51回 日本小児眼科学会総会');
assert.deepEqual([pediatric.date, pediatric.endDate], ['2026-07-24', '2026-07-25']);
assert.equal(pediatric.eventOfficialUrl, 'https://www.congre.co.jp/japo2026/');
assert.equal(strabismus.title, '第82回 日本弱視斜視学会総会');
assert.deepEqual([strabismus.date, strabismus.endDate], ['2026-06-05', '2026-06-06']);
assert.equal(strabismus.eventOfficialUrl, 'https://convention.jtbcom.co.jp/jasa2026/');
assert.deepEqual(auditConferenceIdentities(events), []);
const oldJoint = { id:'bad-joint', isConference:true, title:'第35回 日本小児眼科学会・日本弱視斜視学会 合同学会', date:'2026-10-30', endDate:'2026-10-31' };
assert.ok(auditConferenceIdentities([oldJoint]).some(i => i.historicalYear === 2010));
assert.ok(auditConferenceIdentities([oldJoint]).some(i => i.code === 'unsupported-joint-conference'));
assert.throws(() => validateEvents([...events, oldJoint]), /Conference identity conflict/);
for (const year of [2027,2028,2030]) assert.ok(auditConferenceIdentities([{...oldJoint,date:year+'-10-30'}]).length);
assert.deepEqual(auditConferenceIdentities([{...oldJoint,date:'2010-07-02',title:'第66回日本弱視斜視学会総会・第35回日本小児眼科学会総会合同学会'}]), []);
for(const year of [2027,2028]) {
  const joint=events.find(e=>e.date.startsWith(String(year))&&e.title.includes('日本小児眼科学会')&&e.title.includes('日本弱視斜視学会'));
  assert.ok(joint);assert.deepEqual(auditConferenceIdentities([joint]), []);
}
assert.ok(!events.some(e=>e.date==='2026-10-30'&&e.title.includes('日本小児眼科学会')));
console.log('PASS: official separate 2026 meetings; 2010 editions/joint information rejected for future years; genuine 2010/2027/2028 joint meetings retained');
