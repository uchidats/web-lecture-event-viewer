const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {validRegistration,registrationKey}=require('../scripts/auto-updater/registration');
const {assess}=require('../scripts/auto-updater/policy');
const config=require('../conference-sources');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 const event={conferenceRegion:'domestic',earlyBirdDeadline:'2029-01-01',registration:{type:'domestic',version:2,timeZone:'Asia/Tokyo',periods:[
  {label:'Early Bird',category:'early',advanceEligible:true,start:'2027-01-01',deadline:'2027-03-31'},
  {label:'Regular',category:'regular',advanceEligible:true,start:'2027-04-10T12:00',deadline:'2027-06-30T17:00'},
  {label:'当日登録',category:'onsite',advanceEligible:false,start:'2027-07-10',deadline:'2027-07-12'}
 ]}};
 assert.equal(getRegistrationState(event,'2027-03-31T23:59:59+09:00').next.label,'Early Bird');
 assert.equal(getRegistrationState(event,'2027-04-01T00:00:00+09:00').next.label,'Regular');
 assert.ok(renderRegistrationHtml(event,'2027-04-01T00:00:00+09:00').includes('4月10日 12:00開始／6月30日 17:00締切'));
 assert.equal(getRegistrationState(event,'2027-06-30T16:59:00+09:00').next.label,'Regular');
 assert.equal(getRegistrationState(event,'2027-06-30T17:01:00+09:00').next,null);
 assert.equal(getRegistrationState(event,'2027-06-30T08:01:00Z').next,null,'Offset-independent expiry');
 assert.ok(renderRegistrationHtml(event,'2027-07-01').includes('事前登録終了'));
 assert.ok(renderRegistrationHtml(event,'2027-07-01').includes('事前参加登録'));assert.equal(getRegistrationState(event,'2027-07-01').display.label,'当日登録');
 assert.equal((renderRegistrationHtml(event,'2027-03-01').match(/conf-registration-period/g)||[]).length,1);
 assert.ok(renderRegistrationHtml(event,'2027-07-13').includes('締切済'));
 const unknown={registration:{type:'domestic',periods:[{label:'第1次登録',category:null,deadline:'2027-05-01'}]}};
 assert.equal(getRegistrationState(unknown,'2027-04-01').next,null,'Unknown eligibility is not inferred');
 assert.ok(renderRegistrationHtml(unknown,'2027-04-01').includes('事前参加登録'));assert.equal(unknown.registration.periods[0].label,'第1次登録');
 unknown.registration.periods[0].advanceEligible=true;assert.equal(getRegistrationState(unknown,'2027-04-01').next.label,'第1次登録');
 unknown.registration.periods[0].advanceEligible=false;assert.equal(getRegistrationSortDeadline(unknown,'2027-04-01'),null);
 assert.equal(getRegistrationState({registration:{type:'domestic',periods:[{label:'Regular',category:'regular',advanceEligible:false,deadline:'2027-05-01'}]}},'2027-04-01').next,null);
 assert.equal(getRegistrationState({registration:{type:'domestic',periods:[{label:'当日登録',category:'onsite',advanceEligible:true,deadline:'2027-05-01'}]}},'2027-04-01').next,null,'Onsite cannot become an advance deadline');
 assert.equal(getRegistrationState({...event,registration:{type:'domestic',periods:[]}},'2027-04-01').periods.length,0,'Structured empty data never falls back to stale legacy');
 assert.equal(getRegistrationPeriods({earlyBirdDeadline:'未定'}).length,0);
 assert.equal(getRegistrationSortDeadline(event,'2027-04-01'),parseAbstractDate('2027-06-30').timestamp);
 assert.equal(registrationTimestamp('2027-02-30'),null);assert.equal(registrationTimestamp('2027-06-30T24:00'),null);
 assert.equal(registrationTimestamp('2027-03-14T02:30','America/New_York'),null,'Nonexistent DST time is not silently normalized');
 const snapshot=JSON.stringify(event);getRegistrationState(event,'2027-04-01');assert.equal(JSON.stringify(event),snapshot);
`,context);
const stored=JSON.parse(vm.runInContext('JSON.stringify(sampleEvents.find(e=>e.id==="conf-jp-jrvs-2026"))',context));
assert.equal(vm.runInContext('sampleEvents.filter(e=>e.registration?.version===2).length',context),2,'Only existing structured events migrated');
assert.ok(validRegistration(stored.registration));
const source=config.sources.find(s=>s.id===stored.id),url=source.pages.find(p=>p.role==='registration').url;
for(const [field,value] of [['category','early'],['advanceEligible',false]]){
 const changed=structuredClone(stored.registration);changed.periods[0][field]=value;
 assert.notEqual(registrationKey(stored.registration),registrationKey(changed));
 const result=assess(stored,source,[{field:'registration',value:changed,url}],[],config.defaults,{today:'2026-10-13'});
 assert.equal(result.review.length,1,field+' change must be reviewed');assert.equal(result.accepted.length,0);
}
const older={type:stored.registration.type,periods:stored.registration.periods.map(({label,start,deadline})=>({label,start,deadline}))};
assert.equal(assess(stored,source,[{field:'registration',value:older,url}],[],config.defaults,{today:'2026-10-13'}).review.length,0,'Old extractor cannot erase reviewed metadata');
for(const [field,value] of [['category','invalid'],['advanceEligible','yes'],['sourceUrl','javascript:alert(1)']]){
 const invalid=structuredClone(stored.registration);invalid.periods[0][field]=value;assert.equal(validRegistration(invalid),false);
}
assert.equal(validRegistration({...stored.registration,timeZone:'Invalid/Zone'}),false);
console.log('PASS: phase switching, upcoming regular, onsite fallback, date/timed deadlines, unknown/false eligibility, legacy precedence, validation and monitor metadata diffs');
