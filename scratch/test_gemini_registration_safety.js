const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const {validRegistration}=require('../scripts/auto-updater/registration');
const {checkRegistrationChange,registrationProblem}=require('../scripts/gemini-monitor/registration-changes');
const {classifyDecision}=require('../scripts/gemini-monitor/classifier');
const {applyBatchUpdates,applyFieldChangesToEvent}=require('../scripts/gemini-monitor/applier');
const {runGeminiMonitor}=require('../scripts/gemini-monitor/monitor');
const incident=require('./fixtures/gemini-invalid-registration-2026-10-15.json');
async function main(){
 const root=path.resolve(__dirname,'..'),dataset=loadEvents(root),event=dataset.events.find(e=>e.id===incident.eventId);
 const legacy=JSON.stringify({earlyRegistrationDeadline:event.earlyRegistrationDeadline,earlyBirdDeadline:event.earlyBirdDeadline});
 assert.equal(event.registration,undefined);
 const broken={deadline:'2026-11-27'};assert.equal(validRegistration(broken),false);assert.ok(registrationProblem(broken).includes('type'));
 const official={same_event:true,source_quality:'official_event_page',confidence:.98,registration_deadline:'2026-11-27',abstract_deadline:'2026-07-31',recommended_action:'safe_auto_update'};
 const decision=classifyDecision(event,official);
 assert.equal(decision.action,'safe_auto_update');assert.deepEqual(decision.fieldChanges.map(c=>c.field),['abstractSubmission.deadline']);assert.equal(decision.registrationReviewChanges.length,1);
 const reviewOnly=classifyDecision(event,{...official,abstract_deadline:null,reason:'Official page confirms a deadline'});
 assert.equal(reviewOnly.action,'needs_review');assert.ok(reviewOnly.reason.includes('registration.periods'));
 const object={type:'domestic',periods:[{label:'公式事前登録',category:'regular',advanceEligible:true,start:'2026-10-01',deadline:'2026-11-27'}]};
 const bad=[{...object,periods:[]},{...object,type:undefined},{...object,periods:[{}]},...[
  {label:''},{start:'2026-13-01'},{deadline:'2026-11-27 12:00'},{deadline:'null'},{start:'2026-12-01'},
  {category:'unknown'},{advanceEligible:'true'},{start:'',deadline:''},{sourceUrl:'http://example.com/'}
 ].map(p=>({...object,periods:[{...object.periods[0],...p}]}))];
 for(const value of bad){assert.equal(validRegistration(value),false);assert.ok(checkRegistrationChange(event,{field:'registration',after:value}).reason);const copy=structuredClone(event),rejected=[];assert.deepEqual(applyFieldChangesToEvent(copy,[{field:'registration',after:value}],rejected),[]);assert.deepEqual(copy,event);assert.equal(rejected.length,1);}
 const structured={...event,registration:structuredClone(object)};
 for(const [field,after] of [['registration.periods.0.deadline','bad'],['registration.periods.0.category','invalid'],['registration.periods.0.advanceEligible','false'],['registration.deadline','2026-11-27']])assert.ok(checkRegistrationChange(structured,{field,after}).reason);
 assert.ok(checkRegistrationChange(structured,{field:'registration.periods.0.deadline',after:'2026-11-28'}).value);
 const validCopy=structuredClone(event);assert.deepEqual(applyFieldChangesToEvent(validCopy,[{field:'registration',after:object}]),['registration']);assert.ok(validRegistration(validCopy.registration));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gemini-registration-safe-'));
 fs.writeFileSync(path.join(tmp,'events.js'),dataset.original);
 const other=dataset.events.find(e=>e.id==='conf-jp-pharmacology-2026');
 const result=applyBatchUpdates(tmp,[{eventId:event.id,fieldChanges:incident.fieldChanges},{eventId:other.id,fieldChanges:[{field:'venue',after:'じゅうろくプラザ'}]}],{dryRun:false});
 assert.equal(result.appliedCount,2);assert.equal(result.reviewItems.length,1);const saved=loadEvents(tmp).events.find(e=>e.id===event.id);assert.equal(saved.registration,undefined);assert.equal(saved.abstractSubmission.deadline,'2026-07-31');assert.equal(JSON.stringify({earlyRegistrationDeadline:saved.earlyRegistrationDeadline,earlyBirdDeadline:saved.earlyBirdDeadline}),legacy);
 fs.writeFileSync(path.join(tmp,'events.js'),dataset.original);const noWrite=applyBatchUpdates(tmp,[{eventId:event.id,fieldChanges:[incident.fieldChanges[1]]}],{dryRun:false});assert.equal(noWrite.appliedCount,0);assert.equal(fs.readFileSync(path.join(tmp,'events.js'),'utf8'),dataset.original);assert.equal(noWrite.reviewItems.length,1);
 const replay=await runGeminiMonitor({root:tmp,today:'2026-10-15',forceAll:true,singleEventId:event.id,apply:true,offline:true,skipEmail:true,getPage:async()=>({status:200,body:'<html><title>第64回 日本神経眼科学会総会</title><p>開催期間 2026年11月26日～27日</p></html>',url:incident.sourceUrl}),mockAnalyzer:async()=>official});
 assert.equal(replay.report.batchApplyResult.success,true);assert.equal(replay.report.batchApplyResult.appliedCount,0);assert.equal(replay.report.adminVisibleItems.length,0);assert.equal(replay.report.metrics.deadlineStatuses['link-not-found'],2);
 assert.ok(Array.isArray(replay.report.deferredReviewItems),'deferred candidate details are retained, not only counted');
 assert.ok(loadEvents(tmp).events.every(e=>!e.registration||validRegistration(e.registration)));
 const history=JSON.parse(fs.readFileSync(path.join(tmp,'reports/gemini-rollback-history.json'),'utf8'));assert.ok(history.snapshots.every(s=>s.fieldChanges.every(c=>!c.field.startsWith('registration'))));
 assert.equal(fs.readFileSync(path.join(root,'events.js'),'utf8'),dataset.original);
 console.log('PASS: real incident replay, proposal/write guards, malformed registration cases, field-level review, other safe fields/events applied, legacy/history preserved and no-write rejection');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
