const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {loadEvents}=require('../scripts/auto-updater/storage');
const root=path.resolve(__dirname,'..'),dataset=loadEvents(root),event=dataset.events.find(e=>e.id==='conf-int-ascrs-2027');
const official='https://annualmeeting.ascrs.org/';
assert.equal(event.eventOfficialUrl,official);assert.equal(event.officialUrl,official);assert.equal(event.societyUrl,'https://ascrs.org/');
assert.equal(event.date,'2027-04-02');assert.equal(event.endDate,'2027-04-05');
assert.equal(event.venue,'San Diego Convention Center, San Diego, CA');assert.equal(event.cityCountry,'サンディエゴ（カリフォルニア州） / 米国');
assert.equal(event.abstractSubmission.status,'unknown','No unrequested inferred deadline changes');
const context=vm.createContext({document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const html=vm.runInContext('createEventCardHtml(sampleEvents.find(e=>e.id==="conf-int-ascrs-2027"))',context);
assert.ok(html.includes('class="conference-title-link" href="'+official+'"'));assert.ok(html.includes('San Diego Convention Center'));
assert.ok(!html.includes('data-action="view-pdf"'));assert.ok(!html.includes('class="btn btn-official"'));
// Exercise the real monitoring URL selection in an isolated workspace, with all external writes disabled.
const firestore=require('../scripts/gemini-monitor/firestore-client');
firestore.getPendingActionsFromFirestore=async()=>({authenticated:false,acknowledgedToApply:[],rollbackRequests:[],remoteState:null,token:null});
firestore.saveRemoteState=async()=>{throw Error('Unexpected remote write');};
const {runGeminiMonitor}=require('../scripts/gemini-monitor/monitor');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ascrs-url-monitor-'));fs.writeFileSync(path.join(temp,'events.js'),dataset.original);
 const requests=[];const previous=process.env.ENABLE_AUTO_APPLY;process.env.ENABLE_AUTO_APPLY='false';
 try{
  await runGeminiMonitor({root:temp,today:'2026-10-13',forceAll:true,singleEventId:event.id,offline:true,apply:false,notify:false,getPage:async page=>{requests.push(page.url);return {...page,html:'<html><title>ASCRS 2027 Annual Meeting</title><p>April 2-5, 2027 San Diego</p></html>'};}});
  assert.deepEqual(requests,[official]);assert.equal(fs.readFileSync(path.join(temp,'events.js'),'utf8'),dataset.original);
 }finally{if(previous===undefined)delete process.env.ENABLE_AUTO_APPLY;else process.env.ENABLE_AUTO_APPLY=previous;}
 assert.equal(fs.readFileSync(dataset.file,'utf8'),dataset.original);
 console.log('PASS: ASCRS 2027 official/title URLs, unchanged schedule/venue, card actions and real monitor target with no production mutation');
})().catch(error=>{console.error(error);process.exitCode=1;});
