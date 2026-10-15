// Scoped live audit using the production one-hop extractors; never edits other fields.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadEvents,validateEvents,atomicWrite,mergeReview,readJson}=require('./auto-updater/storage');
const {validRegistration}=require('./auto-updater/registration');
const {fetchOfficialPage}=require('./auto-updater/fetch');
const {followImportantPages}=require('./auto-updater/important-followup');
const {registrationLinks}=require('./auto-updater/registration-followup');
const {classifyDecision}=require('./gemini-monitor/classifier');
const {applyFieldChangesToEvent,applyBatchUpdates}=require('./gemini-monitor/applier');
const root=path.resolve(__dirname,'..'),reportPath=path.join(root,'reports/deadline-audit-2027-h1-2026-10-15-v2.json');
const today='2026-10-15';
const inScope=e=>e.isConference&&e.date>='2027-01-01'&&e.date<='2027-06-30';
const allowed=f=>f==='registration'||f.startsWith('abstractSubmission.');
function unrelated(e){const copy=structuredClone(e);delete copy.abstractSubmission;delete copy.registration;return copy;}
function validateAbstract(event,changes){
 if(!changes.some(c=>c.field.startsWith('abstractSubmission.')))return;
 const sub=event.abstractSubmission;
 assert.ok(sub&&validRegistration({type:'domestic',timeZone:sub.timeZone,periods:[{label:'abstract',start:sub.startDate,deadline:sub.deadline}]}),'Invalid abstract period');
 assert.ok(['open','upcoming','closed','unknown'].includes(sub.status));
 assert.ok(sub.deadline.slice(0,10)<=(event.endDate||event.date));
 const url=new URL(sub.url);assert.equal(url.protocol,'https:');assert.ok(!url.username&&!url.password);
}
async function main(){
 const apply=process.argv.includes('--apply'),replay=process.argv.includes('--replay');
 const data=loadEvents(root),targets=data.events.filter(inScope),records=[];
 const raw=path.join(root,'reports/auto-update-raw/h1-2027-2026-10-15-v2');fs.mkdirSync(raw,{recursive:true});
 for(const event of targets){
  const officialUrl=event.eventOfficialUrl||event.officialUrl;
  const topUrl=/\/information\.html$/.test(officialUrl)?new URL('.',officialUrl).href:officialUrl;
  const record={eventId:event.id,title:event.title,date:event.date,topUrl,requests:[],pages:[],review:[],changes:[]};records.push(record);
  let seq=0;
  const savedPages=fs.readdirSync(raw).filter(f=>f.startsWith(event.id+'-')).map(f=>JSON.parse(fs.readFileSync(path.join(raw,f),'utf8')));
  const getPage=async page=>{
   seq++;
   const saved=savedPages.find(p=>p.requestedUrl===page.url);
   if(saved){if(saved.error)throw Error(saved.error);return saved.document;}
   if(replay)throw Error('Missing cached page: '+page.url);
   const file=path.join(raw,event.id+'-'+savedPages.length+'.json');
   try{const document=page.role==='evidence-image'?await require('./auto-updater/image-evidence').fetchVerifiedImagePage(page):await fetchOfficialPage(page,{allowedHosts:[new URL(record.topUrl).hostname]},{timeoutMs:20000,maxResponseBytes:3e6,onRequest:r=>record.requests.push(r)});const saved={requestedUrl:page.url,document};savedPages.push(saved);fs.writeFileSync(file,JSON.stringify(saved));return document;}
   catch(error){const saved={requestedUrl:page.url,error:error.message};savedPages.push(saved);fs.writeFileSync(file,JSON.stringify(saved));throw error;}
  };
  try{
   const top=await getPage({url:record.topUrl,role:'overview'});record.pages.push({url:top.url,role:'overview',fingerprint:top.fingerprint});
   const followed=await followImportantPages({document:top,event,getPage,getImagePage:getPage});
   assert.ok(seq<=5,'Top plus at most four follow-ups');
   record.pages.push(...followed.pages.map(p=>({url:p.url,role:p.role,fingerprint:p.fingerprint})));
   record.review.push(...followed.abstractIssues.map(i=>({field:'abstractSubmission',...i})),...followed.registrationIssues.map(i=>({field:'registration',...i})));
   record.evidence={abstract:followed.abstractSubmission||null,registration:followed.registration||null};
   const decision=classifyDecision(event,{same_event:true,source_quality:'official_event_page',confidence:.99,recommended_action:'safe_auto_update'},{todayStr:today,sourceUrl:top.url,officialAbstract:followed.abstractSubmission?.value,officialRegistration:followed.registration?.value,abstractIssues:followed.abstractIssues,registrationIssues:followed.registrationIssues});
   if(decision.isAutoApplicable)record.changes=decision.fieldChanges.filter(c=>allowed(c.field)&&!c.validationReason);
   record.changes=record.changes.filter(c=>{if(c.before!=null&&c.after==null){record.review.push({...c,reason:'missing-information-must-not-erase-existing-value'});return false;}return true;});
   const proposed=structuredClone(event),rejected=[];
   applyFieldChangesToEvent(proposed,record.changes,rejected);
   if(rejected.length){record.review.push(...rejected);record.changes=record.changes.filter(c=>!rejected.some(r=>r.field===c.field));}
   validateEvents(data.events.map(e=>e.id===event.id?proposed:e),data.events);
   validateAbstract(proposed,record.changes);
   assert.deepEqual(unrelated(proposed),unrelated(event));
  }catch(error){record.review.push({field:'both',reason:error.message,url:record.topUrl});record.changes=[];}
  const partition=require('./auto-updater/deadline-evidence').partitionIssues(record.review);record.observations=partition.observations;record.review=partition.review;
  record.review=record.review.map((item,index)=>({status:'needs-review',id:event.id+'-'+index,...item}));
  console.log(event.id,JSON.stringify({changes:record.changes.length,review:record.review.map(i=>i.reason),observations:record.observations.map(i=>({category:i.category,reason:i.reason}))}));
 }
 const batches=records.filter(r=>r.changes.length).map(r=>({eventId:r.eventId,fieldChanges:r.changes,source:'official-one-hop-h1-audit'}));
 // Validate the whole scoped proposal and revalidate again inside the production writer.
 const proposed=structuredClone(data.events);
 for(const b of batches){const event=proposed.find(e=>e.id===b.eventId);applyFieldChangesToEvent(event,b.fieldChanges);validateAbstract(event,b.fieldChanges);}
 validateEvents(proposed,data.events);for(let i=0;i<proposed.length;i++)assert.deepEqual(unrelated(proposed[i]),unrelated(data.events[i]));
 if(apply)for(let i=0;i<batches.length;i+=5){const result=applyBatchUpdates(root,batches.slice(i,i+5),{dryRun:false});assert.ok(result.success);assert.equal(result.reviewItems?.length||0,0);}
 const actual=loadEvents(root).events;if(apply)assert.deepEqual(actual,proposed);
 if(apply){
  const file=path.join(root,'reports/auto-update-review.json'),queue=readJson(file,{version:1,items:[]}),now=new Date().toISOString();
  for(const item of queue.items)if(item.method==='official-one-hop-h1-audit'&&records.some(r=>r.eventId===item.eventId))Object.assign(item,{status:'reclassified',resolvedAt:now,resolution:'deadline-policy-v2; see scoped audit report'});
  const entries=records.flatMap(r=>r.review.map(({id,status,...item})=>({...item,eventId:r.eventId,value:item.proposed||null,oldValue:data.events.find(e=>e.id===r.eventId)[item.field]||null,method:'official-one-hop-h1-audit-v2'})));
  const merged=mergeReview(queue,entries,now);for(const item of merged.items)if(entries.some(e=>e.eventId===item.eventId&&e.field===item.field&&e.reason===item.reason&&e.url===item.url))item.status='needs-review';
  merged.observations=[...(queue.observations||[]).filter(i=>!records.some(r=>r.eventId===i.eventId)),...records.flatMap(r=>r.observations.map(i=>({...i,eventId:r.eventId,checkedAt:now})))];
  atomicWrite(file,JSON.stringify(merged,null,2)+'\n');
 }

 const summary={targetConferences:targets.length,abstractNewlyConfirmed:records.filter(r=>r.changes.some(c=>c.field==='abstractSubmission.deadline'&&c.before==null)).length,abstractChanged:records.filter(r=>r.changes.some(c=>c.field.startsWith('abstractSubmission.'))).length,registrationNewlyConfirmed:records.filter(r=>r.changes.some(c=>c.field==='registration'&&c.before==null)).length,registrationChanged:records.filter(r=>r.changes.some(c=>c.field==='registration')).length,reviewConferences:records.filter(r=>r.review.length).length,reviewItems:records.reduce((n,r)=>n+r.review.length,0),unchangedConferences:records.filter(r=>!r.changes.length).length,unchangedWithoutReview:records.filter(r=>!r.changes.length&&!r.review.length).length};
 summary.autoConfirmedItems=records.reduce((n,r)=>n+Number(r.changes.some(c=>c.field.startsWith('abstractSubmission.')))+Number(r.changes.some(c=>c.field==='registration')),0);
 summary.unchangedItems=records.reduce((n,r)=>n+['abstractSubmission','registration'].filter(field=>!r.changes.some(c=>c.field===field||c.field.startsWith(field+'.'))&&![...r.review,...r.observations].some(i=>i.field==='both'||i.field===field)).length,0);
 summary.observationCounts=records.flatMap(r=>r.observations).reduce((n,i)=>({...n,[i.category]:(n[i.category]||0)+1}),{unavailable:0,unpublished:0,'link-not-found':0,'extraction-failed':0});
 atomicWrite(reportPath,JSON.stringify({checkedAt:today,mode:apply?'applied':'proposal',scope:{from:'2027-01-01',through:'2027-06-30',fields:['abstractSubmission','registration'],maxDepth:1,maxAdditionalPages:4},summary,records},null,2)+'\n');console.log(JSON.stringify(summary));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={inScope,allowed,unrelated,validateAbstract};
