const assert=require('node:assert/strict');
const path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const evidence=require('../docs/domestic-conference-chairs-2026-10-13.json');
const events=loadEvents(path.resolve(__dirname,'..')).events;
const domestic=events.filter(e=>e.isConference&&e.conferenceRegion==='domestic');
assert.equal(domestic.length,61);
assert.equal(domestic.filter(e=>e.conferenceChair).length,33);
assert.equal(domestic.filter(e=>!e.conferenceChair).length,28);
assert.equal(evidence.records.filter(r=>!r.preserved).length,31);
assert.equal(evidence.records.filter(r=>r.preserved).length,2);
assert.equal(new Set(evidence.records.map(r=>r.eventId)).size,33);
for(const record of evidence.records){
 const event=domestic.find(e=>e.id===record.eventId);
 assert.ok(event,record.eventId);
 assert.equal(event.conferenceChair,record.conferenceChair);
 assert.equal(event.date,record.date,'Evidence belongs to this edition/year');
 assert.equal(new URL(record.sourceUrl).protocol,'https:');
 for(const person of record.people){
  assert.ok(record.conferenceChair.includes(person.name));
  assert.ok(record.conferenceChair.includes('（'+person.affiliation+'）'));
  assert.ok(person.officialAffiliation,'Full official affiliation remains available in provenance');
  assert.ok(record.officialConferenceChair.includes(person.officialAffiliation));
  assert.doesNotMatch(person.affiliation,/教授|講師|大学院|研究科|講座|教室|研究室|医学部|医学医療系|ビジョンケア部門/);
  assert.doesNotMatch(person.affiliation,/大学[^/]*病院/, 'University hospital affiliations use university name only');
 }
}
const joint=events.find(e=>e.id==='conf-jp-pediatric-2027').conferenceChair;
assert.match(joint,/第83回日本弱視斜視学会総会: 林 思音/);
assert.match(joint,/第52回日本小児眼科学会総会: 彦谷 明子/);
const inflammation=events.find(e=>e.id==='conf-jp-inflammation-2027').conferenceChair;
assert.match(inflammation,/髙瀬 博/);
assert.doesNotMatch(inflammation,/園田|蕪城|堀 裕一|渡辺|三村/);
assert.equal(evidence.records.filter(r=>r.specialHandling).length,2);
const chair=id=>events.find(e=>e.id===id).conferenceChair;
assert.equal(chair('oph-001'),'近藤 峰生（三重大学）');
assert.equal(chair('conf-jp-pharmacology-2026'),'嶋澤 雅光（岐阜薬科大学）');
assert.equal(chair('conf-jp-jsoprs-2027'),'田邉 美香（九州大学）');
assert.equal(chair('conf-jp-cl-2027'),'土至田 宏（聖マリアンナ医科大学）');
assert.equal(chair('conf-jp-surgery-2026'),'宮田 和典（宮田眼科病院）');
assert.equal(chair('conf-jp-strabismus-2026'),'横山 吉美（JCHO中京病院）');
assert.equal(chair('conf-jp-surgery-2027'),'稲富 勉（国立長寿医療研究センター/京都府立医科大学）');
assert.equal(chair('conf-jp-inflammation-2027'),'髙瀬 博（宮田眼科 東京）');
assert.equal(evidence.affiliationSimplification.beforeWithChair,evidence.affiliationSimplification.afterWithChair);
assert.equal(evidence.affiliationSimplification.changedRecords+evidence.affiliationSimplification.unchangedRecords,33);
console.log('PASS: 33 domestic chairs, 31 additions, 28 unknown; official provenance, affiliations and joint meeting attribution');
