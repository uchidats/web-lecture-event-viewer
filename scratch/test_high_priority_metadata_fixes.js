const assert=require('node:assert/strict'),path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const audit=require('../reports/event-metadata-audit-2026-10-09.json');
const corrections=require('../reports/event-metadata-high-priority-fixes-2026-10-09.json');
const events=loadEvents(path.resolve(__dirname,'..')).events;
assert.equal(events.length,94);assert.equal(corrections.results.length,14);
assert.equal(corrections.results.filter(r=>r.status==='corrected').length,13);
assert.equal(corrections.results.filter(r=>r.status==='held').length,1);
for(const [i,r] of audit.records.entries()){
 const actual=events.find(e=>e.id===r.eventId),expected=structuredClone(r.currentSnapshot);
 const correction=corrections.results.find(c=>c.eventId===r.eventId);
 for(const change of correction?.changes||[]){assert.equal(r.priority,'高');assert.deepEqual(expected[change.field]??null,change.before);if(change.after===null)delete expected[change.field];else expected[change.field]=change.after;}
 assert.deepEqual(actual,expected,r.eventId+' scope and exact recorded changes');
 // Audit records follow the original dataset order.
 assert.equal(events[i].id,r.eventId);
}
const byId=id=>events.find(e=>e.id===id);
assert.equal(byId('oph-010').venueId,undefined);assert.equal(byId('oph-010').abstractSubmission.deadline,null);
assert.equal(byId('oph-010').eventOfficialUrl,'https://apacrs2026.org/');
assert.equal(byId('conf-jp-presbyopia-2027').date,'2026-01-17');
assert.equal(byId('conf-jp-presbyopia-2028').date,'2027-01-16');
assert.equal(byId('oph-014').date,byId('oph-014').endDate);
for(const id of ['conf-jp-iscev-2028','conf-jp-perimetry-2028','conf-jp-myopia-2028','conf-jp-inflammation-2028'])assert.equal(byId(id).eventOfficialUrl,undefined);
console.log('PASS: exactly 13 corrections within 14 high-priority candidates; 81 records unchanged including held AI; IDs/order preserved; date/venue/URL and unknown deadline guards');
