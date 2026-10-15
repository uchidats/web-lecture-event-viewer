const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {loadEvents}=require('../scripts/auto-updater/storage');
const {registrationLinks,phaseCategory,extractRegistrationPage,followRegistrationPages}=require('../scripts/auto-updater/registration-followup');
const {fetchAndCheckHash}=require('../scripts/gemini-monitor/fetcher');
const {classifyDecision}=require('../scripts/gemini-monitor/classifier');
const {runGeminiMonitor}=require('../scripts/gemini-monitor/monitor');
const {assess}=require('../scripts/auto-updater/policy');
const {runUpdater:runPipeline}=require('../scripts/auto-updater/pipeline');
async function main(){
 const root=path.resolve(__dirname,'..'),data=loadEvents(root),event=data.events.find(e=>e.id==='conf-jp-diabetic-2027');
 const url=event.eventOfficialUrl,child=url+'join/index.html',html=fs.readFileSync(path.join(__dirname,'fixtures/jsod33-registration.html'),'utf8');
 const top='<html><title>第33回日本糖尿病眼学会総会</title><h2>会期</h2><p>2027年3月12日～2027年3月13日</p><a href="join/index.html">参加登録NEW</a></html>';
 const expected={version:2,type:'domestic',timeZone:'Asia/Tokyo',periods:[
  {label:'事前参加登録',start:'2026-09-09T12:00',deadline:'2027-02-02',category:'regular',advanceEligible:true,sourceUrl:child},
  {label:'直前・当日参加登録',start:'2027-02-23T12:00',deadline:'2027-03-13',category:'onsite',advanceEligible:false,sourceUrl:child}]};
 assert.deepEqual(extractRegistrationPage({html,url:child},event).value,expected);
 for(const label of ['参加登録','事前参加登録','参加申込','Registration','Register','参加者の皆様へ'])assert.deepEqual(registrationLinks(`<a href="join/">${label}</a>`,url),[url+'join/']);
 const links=top+'<a href="join/index.html#entry">参加登録</a><a href="https://evil.test/">Register</a><a href="/other-meeting/register/">参加登録</a><a href="privacy/">Privacy</a><a href="second/">Register</a><a href="third/">Registration</a>';
 assert.deepEqual(registrationLinks(links,url),[child,url+'second/']);
 const bounded=[];await followRegistrationPages({document:{url,html:links},event,getPage:async p=>{bounded.push(p.url);return {url:p.url,html};}});assert.deepEqual(bounded,[child,url+'second/']);
 assert.deepEqual(phaseCategory('Early Bird'),{category:'early',advanceEligible:true});
 assert.equal(phaseCategory('Regular').category,'regular');assert.equal(phaseCategory('通常登録').category,'regular');
 assert.equal(phaseCategory('直前登録').advanceEligible,false);assert.equal(phaseCategory('onsite').category,'onsite');assert.equal(phaseCategory('第1次登録').category,null);
 const abroad={...event,registration:undefined,title:'Example Congress 2027',conferenceRegion:'international',timeZone:'Europe/Paris'};
 const english='<html><title>Registration | Example Congress 2027</title><dl><dt>Early Bird</dt><dd>2026-10-01 ~ 2027-01-01</dd><dt>Regular</dt><dd>2027-01-02 ~ 2027-03-01</dd><dt>Onsite</dt><dd>2027-03-12 ~ 2027-03-13</dd></dl></html>';
 const foreign=extractRegistrationPage({html:english,url:child},abroad);assert.deepEqual(foreign.value.periods.map(p=>p.category),['early','regular','onsite']);assert.equal(foreign.value.periods[2].advanceEligible,false);
 assert.ok(extractRegistrationPage({html:english,url:child},{...abroad,timeZone:null}).value,'Date-only periods need no inferred timezone');
 assert.ok(extractRegistrationPage({html:english.replaceAll('Regular','Late'),url:child},abroad).value);
 const document={html:top,url},calls=[];
 const getPage=async p=>{calls.push(p.url);assert.equal(p.url,child);return {url:child,html:html+'<a href="deeper/">Register</a>',httpStatus:200};};
 const follow=await followRegistrationPages({document,event,getPage});assert.deepEqual(calls,[child]);assert.deepEqual(follow.registration.value,expected);
 const mismatch=await followRegistrationPages({document,event,getPage:async()=>({url:child,html:html.replaceAll('第33回','第34回')})});assert.equal(mismatch.registration,null);assert.ok(mismatch.issues.length);
 for(const replacement of ['2027年2月30日','2026年2月2日','未定']) {
  const bad=extractRegistrationPage({url:child,html:html.replaceAll('2027年2月2日',replacement)},event);assert.ok(bad.issue,replacement);
 }
 const ambiguous=extractRegistrationPage({url:child,html:html.replaceAll('2026年9月9日','9月9日')},event);assert.ok(ambiguous.value);
 const redirected=await followRegistrationPages({document,event,getPage:async()=>({url:'https://evil.test/',html})});assert.equal(redirected.registration,null);
 const failing=await followRegistrationPages({document,event,getPage:async()=>{throw Error('404');}});assert.ok(failing.issues.length);assert.equal(failing.registration,null);
 let childHtml=html;const fetcher=async p=>({url:p.url,html:p.role==='overview'?top:childHtml});
 const first=await fetchAndCheckHash(url,null,{event,getPage:fetcher});
 const same=await fetchAndCheckHash(url,first.hash,{event,getPage:fetcher});assert.ok(same.unchanged);
 childHtml=html.replaceAll('2027年2月2日','2027年2月3日');assert.equal((await fetchAndCheckHash(url,first.hash,{event,getPage:fetcher})).unchanged,false,'Child changes bypass unchanged top');
 const baseline={...event};delete baseline.registration;
 const official={same_event:true,source_quality:'official_event_page',confidence:.99,recommended_action:'safe_auto_update',registration_deadline:'2027-03-13'};
 const decision=classifyDecision(baseline,official,{sourceUrl:url,officialRegistration:expected});assert.equal(decision.action,'safe_auto_update');assert.deepEqual(decision.fieldChanges.map(c=>c.field),['registration']);
 assert.equal(classifyDecision(baseline,{...official,same_event:false},{officialRegistration:expected}).action,'needs_review');
 const config=require('../conference-sources'),source={id:event.id,name:event.title,year:2027,identity:['第33回','日本糖尿病眼学会総会'],adapter:'official-html',allowedHosts:[new URL(url).hostname],eventOfficialUrl:url,officialUrl:url,autoUpdateEnabled:true,pages:[{url,role:'overview'}]};
 const candidate={field:'registration',value:expected,url:child,confidence:.99,method:'one-hop-registration',evidence:'Official registration periods'};
 assert.equal(assess(baseline,source,[candidate],[],config.defaults,{today:'2026-10-15'}).accepted.length,1);
 assert.equal(assess(baseline,{...source,autoUpdateEnabled:false},[candidate],[],config.defaults,{today:'2026-10-15'}).accepted.length,0);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'registration-followup-'));fs.writeFileSync(path.join(tmp,'events.js'),data.serialize(data.events.map(e=>e.id===event.id?baseline:e)));
 const replay=await runGeminiMonitor({root:tmp,today:'2026-10-15',forceAll:true,singleEventId:event.id,apply:true,offline:true,skipEmail:true,getPage:fetcher,mockAnalyzer:async()=>official});
 assert.equal(replay.report.batchApplyResult.success,true);assert.equal(replay.report.batchApplyResult.appliedCount,1);
 assert.equal(loadEvents(tmp).events.find(e=>e.id===event.id).registration.periods[0].deadline,'2027-02-03');
 fs.writeFileSync(path.join(tmp,'events.js'),data.serialize(data.events.map(e=>e.id===event.id?baseline:e)));fs.copyFileSync(path.join(root,'venues.js'),path.join(tmp,'venues.js'));
 const pipeline=await runPipeline({root:tmp,config:{...config,sources:[source],discovery:{enabled:false}},getPage:fetcher,apply:false,enforceGit:false,checkedAt:'2026-10-15T00:00:00Z'});
 assert.ok(pipeline.autoChanges.some(c=>c.field==='registration'&&c.value.periods[0].deadline==='2027-02-03'));
 const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}},expected});
 for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 vm.runInContext(`const e={...sampleEvents.find(e=>e.id==='conf-jp-diabetic-2027'),registration:expected};assert.equal(getRegistrationState(e,'2026-10-15T00:00:00Z').next.deadline,'2027-02-02');assert.ok(renderRegistrationHtml(e,'2026-10-15T00:00:00Z').includes('2月2日'));assert.ok(!renderRegistrationHtml(e,'2026-10-15T00:00:00Z').includes('未定'));assert.equal(getRegistrationState(e,'2027-02-02T23:59:59+09:00').next.deadline,'2027-02-02');assert.equal(getRegistrationState(e,'2027-02-03T00:00:00+09:00').next,null);`,context);
 assert.equal(fs.readFileSync(path.join(root,'events.js'),'utf8'),data.original);
 console.log('PASS: official JSOD33 two phases, one-hop/two-fetch/domain/edition guards, ambiguous review, child-page hash, Gemini/pipeline auto-apply and card deadline/Tokyo boundaries');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
