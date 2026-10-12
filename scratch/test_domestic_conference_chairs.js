const assert=require('node:assert/strict');
const path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const evidence=require('../docs/domestic-conference-chairs-2026-10-13.json');
const events=loadEvents(path.resolve(__dirname,'..')).events;
const domestic=events.filter(e=>e.isConference&&e.conferenceRegion==='domestic');
assert.equal(domestic.length,61);
assert.equal(domestic.filter(e=>e.conferenceChair).length,34);
assert.equal(domestic.filter(e=>!e.conferenceChair).length,27);
assert.equal(evidence.records.filter(r=>!r.preserved).length,32);
assert.equal(evidence.records.filter(r=>r.preserved).length,2);
assert.equal(new Set(evidence.records.map(r=>r.eventId)).size,34);
for(const record of evidence.records){
 const event=domestic.find(e=>e.id===record.eventId);
 assert.ok(event,record.eventId);
 assert.equal(event.conferenceChair,record.conferenceChair);
 assert.equal(event.date,record.date,'Evidence belongs to this edition/year');
 assert.equal(new URL(record.sourceUrl).protocol,'https:');
 for(const person of record.people){assert.ok(record.conferenceChair.includes(person.name));if(person.affiliation)assert.ok(record.conferenceChair.includes(person.affiliation));}
}
const joint=events.find(e=>e.id==='conf-jp-pediatric-2027').conferenceChair;
assert.match(joint,/第83回日本弱視斜視学会総会: 林 思音/);
assert.match(joint,/第52回日本小児眼科学会総会: 彦谷 明子/);
const inflammation=events.find(e=>e.id==='conf-jp-inflammation-2027').conferenceChair;
assert.match(inflammation,/髙瀬 博/);
assert.doesNotMatch(inflammation,/園田|蕪城|堀 裕一|渡辺|三村/);
assert.equal(evidence.records.filter(r=>r.specialHandling).length,2);
console.log('PASS: 34 domestic chairs, 32 additions, 27 unknown; official provenance, affiliations and joint meeting attribution');
