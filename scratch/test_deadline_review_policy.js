const assert=require('node:assert/strict');
const fixture=require('./fixtures/h1-deadline-review-baseline.json');
const {extractAbstract,extractRegistration,issueCategory,dates,validAbstract}=require('../scripts/auto-updater/deadline-evidence');
const {registrationLinks}=require('../scripts/auto-updater/registration-followup');
const images=require('../scripts/auto-updater/verified-image-evidence.json');
const results=[];
for(const record of fixture.records){
 const top=record.pages.find(p=>p.document?.role==='overview')?.document;
 for(const original of record.originalIssues){
  let outcome;
  const role=original.field==='abstractSubmission'?'abstract':'registration';
  let saved=record.pages.find(p=>p.requestedUrl===original.url);
  if(original.reason==='no-recognized-one-hop-link'){
   const link=registrationLinks(top.html,top.url,role)[0];
   saved=record.pages.find(p=>p.requestedUrl===link);
   if(!saved)outcome='link-not-found';
  }
  if(!outcome&&saved?.error)outcome='unavailable';
  if(!outcome){
   assert.ok(saved?.document,original.id);
   const doc=structuredClone(saved.document);
   for(const asset of record.pages.filter(p=>p.document?.role==='evidence-image')){
    const verified=images.images.find(i=>i.url===asset.document.url&&i.sha256===asset.document.fingerprint);
    if(verified)doc.verifiedImageText=verified.text;
   }
   const result=role==='abstract'?extractAbstract(doc,record.event,top):extractRegistration(doc,record.event,top);
   outcome=result.issue?issueCategory(result):'automatic';
   results.push({id:original.id,eventId:record.event.id,field:original.field,outcome,reason:result.issue});continue;
  }
  results.push({id:original.id,eventId:record.event.id,field:original.field,outcome});
 }
}
assert.equal(results.length,34);
const review=results.filter(r=>r.outcome==='review');
assert.deepEqual(review.map(r=>[r.eventId,r.field,r.reason]),[
 ['conf-int-wgc-2027','abstractSubmission','abstract-conflicting-timezones'],
 ['conf-int-wgc-2027','registration','registration-conflicting-deadlines'],
 ['conf-int-soe-2027','registration','registration-ambiguous-boundary']
]);
assert.equal(results.filter(r=>r.outcome!=='review').length,31);
const event={title:'Example Congress 2027',date:'2027-03-12',endDate:'2027-03-13',conferenceRegion:'international',eventOfficialUrl:'https://official.test/2027/'};
const doc=html=>({url:event.eventOfficialUrl+'abstract',html:'<html><title>Example Congress 2027</title>'+html+'</html>'});
assert.equal(extractAbstract(doc('<h2>Abstract submission deadline</h2><p>5 January 2027, 23:59 (UTC+8)</p>'),event).value.deadline,'2027-01-05T23:59');
assert.equal(extractAbstract(doc('<h2>Abstract submission deadline</h2><p>5 January 2027</p>'),event).value.startDate,undefined);
assert.equal(dates('2027-01-01 25:01',event)[0].value,undefined);
assert.equal(validAbstract({deadline:'2027-02-30',url:event.eventOfficialUrl},event),false);
assert.equal(extractAbstract({...doc('<h2>Abstract submission deadline</h2><p>5 January 2027</p>'),html:'<html><title>Different Congress 2027</title></html>'},event).issue,'abstract-conference-identity-unconfirmed');
for(const reason of ['http-404','bot-protected','registration-not-published','registration-link-not-found','registration-extraction-failed'])assert.notEqual(issueCategory({reason}),'review');
const {classifyDecision}=require('../scripts/gemini-monitor/classifier');
const known={...event,abstractSubmission:{startDate:'2026-09-01',deadline:'2026-12-01T12:00',url:event.eventOfficialUrl+'abstract',status:'open'}};
const partial=classifyDecision(known,{same_event:true,source_quality:'official_event_page',confidence:.99},{todayStr:'2026-10-15',officialAbstract:{deadline:'2026-12-01',url:known.abstractSubmission.url,status:'unknown'}});
assert.deepEqual(partial.fieldChanges,[],'Missing start/time/status must not degrade accepted precision or status');
console.log('PASS: all original 34 live-audit cases replayed: exactly 3 semantic reviews and 31 automatic/status outcomes; partial/invalid/identity guards');
console.log(JSON.stringify(results.reduce((counts,r)=>({...counts,[r.outcome]:(counts[r.outcome]||0)+1}),{})));
