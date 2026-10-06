const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({console,document:{getElementById:()=>null,addEventListener(){}},setTimeout,clearTimeout,URLSearchParams,AbortController});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
ctx.fixture=JSON.parse(vm.runInContext('JSON.stringify(sampleEvents.find(e=>!e.isConference&&!e.parentConferenceId))',ctx));
ctx.fixture.calendarStatus={google:{status:'busy',conflicts:[{title:'Dummy Google',start:'18:00',end:'19:00'}]},icloud:{status:'busy',conflicts:[{title:'当直引継ぎミーティング',start:'18:00',end:'19:00'}]}};
const original=JSON.stringify(ctx.fixture);
function evaluate(code){return vm.runInContext(code,ctx);}
for(const provider of ['google','both','icloud','none']){
  evaluate(`state.calendarSettings.calendarProvider="${provider}"`);
  for(const liveState of [null,'disconnected','loading','error','unknown','ready']){
    if(liveState===null)delete ctx.GoogleCalendar;
    else ctx.GoogleCalendar={snapshot:()=>({state:liveState,status:'free',registered:false,conflicts:[]})};
    const status=evaluate('computeEffectiveScheduleStatus(fixture)');
    assert.equal(status.statusKey,liveState==='ready'&&['google','both'].includes(provider)?'free':'unlinked');assert.equal(status.conflicts.length,0);
    const html=evaluate('createEventCardHtml(fixture)');assert.ok(!html.includes('当直引継ぎミーティング'));assert.ok(!html.includes('Dummy Google'));assert.ok(!html.includes('conflict-provider-tag'));
  }
}
for(const [status,key]of [['partial','partial_conflict'],['busy','conflict']]){
  ctx.GoogleCalendar={snapshot:()=>({state:'ready',status,registered:false,conflicts:[{providerLabel:'Google',title:'Live Google meeting',start:'18:00',end:'19:00'}]})};
  evaluate('state.calendarSettings.calendarProvider="both"');assert.equal(evaluate('computeEffectiveScheduleStatus(fixture).statusKey'),key);
  const html=evaluate('createEventCardHtml(fixture)');assert.ok(html.includes('Live Google meeting'));assert.ok(!html.includes('当直引継ぎミーティング'));
}
assert.equal(JSON.stringify(ctx.fixture),original,'sample settings/data are preserved');
assert.equal(evaluate('typeof computeLegacyCalendarMockStatus'),'function');
ctx.GoogleCalendar={snapshot:()=>({state:'ready',status:'free',registered:false,conflicts:[]})};
evaluate('state.events=[fixture]; state.filters.scheduleStatus=new Set(["conflict"]); state.filters.year.clear();');
assert.equal(evaluate('getFilteredEvents().length'),0,'iCloud-only dummy busy must not match the conflict filter');
evaluate('state.filters.scheduleStatus.clear();state.filters.keyword="当直引継ぎミーティング"');
assert.equal(evaluate('getFilteredEvents().length'),0,'hidden mock appointments must not participate in keyword search');
console.log('PASS: no mock conflicts in cards for all providers and all Google connection states; live Google conflicts and legacy data/helpers preserved.');
