const assert=require('node:assert/strict'),path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const audit=require('../reports/event-metadata-audit-2026-10-09.json');
const corrections=require('../reports/event-metadata-high-priority-fixes-2026-10-09.json');
const events=loadEvents(path.resolve(__dirname,'..')).events;
assert.equal(events.length,95);assert.equal(corrections.results.length,14);
assert.equal(corrections.results.filter(r=>r.status==='corrected').length,13);
assert.equal(corrections.results.filter(r=>r.status==='held').length,1);
for(const [i,r] of audit.records.entries()){
 if(r.eventId==='oph-003'){assert.equal(events.find(e=>e.id===r.eventId),undefined,'Erroneous demo joint meeting removed after official 2026 audit');continue;}
 const actual=events.find(e=>e.id===r.eventId),expected=structuredClone(r.currentSnapshot);
 const correction=corrections.results.find(c=>c.eventId===r.eventId);
 for(const change of correction?.changes||[]){assert.equal(r.priority,'高');assert.deepEqual(expected[change.field]??null,change.before);if(change.after===null)delete expected[change.field];else expected[change.field]=change.after;}
 assert.deepEqual(actual,expected,r.eventId+' scope and exact recorded changes');
 // Audit records follow the original dataset order.
}
assert.deepEqual(events.filter(e=>!['conf-jp-pediatric-2026','conf-jp-strabismus-2026'].includes(e.id)).map(e=>e.id),audit.records.filter(r=>r.eventId!=='oph-003').map(r=>r.eventId),'Surviving historical records retain order');
const byId=id=>events.find(e=>e.id===id);
assert.equal(byId('oph-010').venueId,undefined);assert.equal(byId('oph-010').abstractSubmission.deadline,null);
assert.equal(byId('oph-010').eventOfficialUrl,'https://apacrs2026.org/');
assert.equal(byId('conf-jp-presbyopia-2027').date,'2026-01-17');
assert.equal(byId('conf-jp-presbyopia-2028').date,'2027-01-16');
assert.equal(byId('oph-014').date,byId('oph-014').endDate);
for(const id of ['conf-jp-iscev-2028','conf-jp-perimetry-2028','conf-jp-myopia-2028','conf-jp-inflammation-2028'])assert.equal(byId(id).eventOfficialUrl,undefined);
console.log('PASS: 13 prior corrections preserved; surviving historical records/order unchanged, removed demo ID excluded; date/venue/URL and unknown deadline guards');
