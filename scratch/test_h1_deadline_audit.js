const assert=require('node:assert/strict');
const {loadEvents}=require('../scripts/auto-updater/storage');
const {inScope,allowed,validateAbstract}=require('../scripts/audit-2027-h1-deadlines');
const report=require('../reports/deadline-audit-2027-h1-2026-10-15.json');
const {events}=loadEvents(require('node:path').resolve(__dirname,'..'));
const fs=require('node:fs'),vm=require('node:vm'),context=vm.createContext({console,URL,Intl,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),context);
assert.ok(vm.runInContext('(()=>{const e=sampleEvents.find(e=>e.id==="conf-jp-surgery-2027");return renderAbstractSubmissionHtml({...e,abstractSubmission:{status:"unknown",url:e.eventOfficialUrl}});})()',context).includes('公式</span>'));
assert.ok(vm.runInContext('renderAbstractUnknownHtml({...sampleEvents.find(e=>e.id==="conf-jp-lowvision-2027"),abstractSubmission:{url:"https://www.ganki.jp/lowvision2027/abstracts.html"}})',context).includes('詳細</span>'));
assert.equal(events.filter(inScope).length,20);
assert.deepEqual(report.records.map(r=>r.eventId),events.filter(inScope).map(e=>e.id));
for(const record of report.records){
 const event=events.find(e=>e.id===record.eventId);
 assert.ok(record.pages.length<=5);
 assert.ok(record.review.every(i=>i.status==='needs-review'));
 for(const change of record.changes){assert.ok(allowed(change.field));const [field,key]=change.field.split('.');assert.deepEqual(key?event[field][key]:event[field],change.after);}
 validateAbstract(event,record.changes);
}
const low=events.find(e=>e.id==='conf-jp-lowvision-2027'),changes=[{field:'abstractSubmission.deadline'}];
for(const sub of [null,{...low.abstractSubmission,deadline:'2027-02-30'},{...low.abstractSubmission,deadline:'2026-01-01'},{...low.abstractSubmission,url:'javascript:alert(1)'},{...low.abstractSubmission,timeZone:'Invalid/Zone'}])assert.throws(()=>validateAbstract({...low,abstractSubmission:sub},changes));
assert.equal(allowed('date'),false);assert.equal(allowed('eventOfficialUrl'),false);
assert.equal(inScope({isConference:true,date:'2026-12-31'}),false);
assert.equal(inScope({isConference:true,date:'2027-07-01'}),false);
assert.equal(inScope({isConference:false,date:'2027-01-01'}),false);
console.log('PASS: H1 scope, report/dataset agreement, one-hop page bound, saved abstract validation and invalid proposal rejection');
