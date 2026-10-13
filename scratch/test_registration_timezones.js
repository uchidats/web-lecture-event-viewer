const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
if(!process.env.REGISTRATION_TZ_CHILD){
 for(const tz of ['UTC','Asia/Tokyo']){
  const result=spawnSync(process.execPath,[__filename],{env:{...process.env,TZ:tz,REGISTRATION_TZ_CHILD:'1'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);process.stdout.write(result.stdout);
 }
}else{
 let clock=Date.parse('2026-10-13T16:00:00Z');
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const context=vm.createContext({assert,console,Date:ClockDate,document:{getElementById:()=>null,addEventListener:()=>{}}});
 for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 context.setClock=iso=>{clock=Date.parse(iso);};
 vm.runInContext(`
 const make=(zone,deadline)=>({registration:{type:'international',timeZone:zone,periods:[{label:'Regular',category:'regular',advanceEligible:true,deadline}]}});
 // Original failure: UTC's Oct 13 is already Oct 14 in Tokyo. Explicit snapshot dates must never read the wall clock.
 assert.ok(getRegistrationState(make('Asia/Tokyo','2026-10-13'),'2026-10-13').next);
 assert.equal(getRegistrationState(make('Asia/Tokyo','2026-10-13')).next,null,'Actual instant is correctly after Tokyo deadline');
 for(const [zone,offset,endUtc,nextUtc] of [
  ['Asia/Tokyo','+09:00','2026-10-13T14:59:59.999Z','2026-10-13T15:00:00Z'],
  ['America/Los_Angeles','-07:00','2026-10-14T06:59:59.999Z','2026-10-14T07:00:00Z']
 ]){
  const today=make(zone,'2026-10-13');
  assert.equal(registrationTimestamp('2026-10-13',zone,true),Date.parse(endUtc));
  setClock('2026-10-13T12:00:00'+offset);
  assert.ok(getRegistrationState(today).next,'Date-only today remains valid');
  assert.ok(!renderRegistrationHtml(today).includes('締切済'));
  assert.ok(getRegistrationState(make(zone,'2026-10-14')).next,'Tomorrow');
  assert.equal(getRegistrationState(make(zone,'2026-10-12')).next,null,'Yesterday');
  setClock(endUtc);assert.ok(getRegistrationState(today).next,'Last millisecond of deadline day');
  setClock(nextUtc);assert.equal(getRegistrationState(today).next,null,'Next local midnight');
  const timed=make(zone,'2026-10-13T17:00');
  setClock('2026-10-13T16:59:59'+offset);assert.ok(getRegistrationState(timed).next,'Before explicit cutoff');
  setClock('2026-10-13T17:00:00'+offset);assert.ok(getRegistrationState(timed).next,'At exact cutoff');
  setClock('2026-10-13T17:00:01'+offset);assert.equal(getRegistrationState(timed).next,null,'After explicit cutoff');
  assert.ok(renderRegistrationHtml(timed).includes('締切済'));
  const absolute=make(zone,'2026-10-13T17:00'+offset);
  assert.equal(getRegistrationState(absolute).next,null,'Offset timestamp agrees with zone-local timestamp');
 }
 // Sorting must use one actual instant and each event's registration timezone.
 setClock('2026-10-13T16:00:00Z');getTodayString=()=> '2026-10-13';
 for(const key of FILTER_SET_KEYS)state.filters[key].clear();state.filters.includeEndedConferences=true;
 const base=sampleEvents.find(e=>e.id==='conf-jp-jrvs-2026');
 state.events=[{...base,...make('Asia/Tokyo','2026-10-13'),id:'tokyo-expired'}, {...base,...make('America/Los_Angeles','2026-10-13'),id:'la-today'}, {...base,...make('Asia/Tokyo','2026-10-14'),id:'tokyo-tomorrow'}];
 state.sortBy='registration-deadline-asc';assert.deepEqual(getFilteredEvents().map(e=>e.id),['la-today','tokyo-tomorrow','tokyo-expired']);
 `,context);
 console.log('PASS host TZ='+process.env.TZ+': Tokyo/Los Angeles today, yesterday, tomorrow, day-end, timed cutoff and sorting');
}
