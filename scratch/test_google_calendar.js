const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({console, URLSearchParams, AbortController, setTimeout, clearTimeout,
 document: {getElementById:()=>null, addEventListener:()=>{}}, module:{exports:{}}});
for (const f of ['venues.js','companies.js','events.js','google-calendar.js','script.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const {createAdapter,eventRange} = ctx.module.exports;
const event={id:'fixture',date:'2026-10-15',time:'19:00 - 20:00',region:'全国Web',title:'眼科講演',venue:'Web',officialUrl:'https://example.org',description:'概要'};
const appointment=(id,start,end,extra={})=>({id,summary:'医局会',start:{dateTime:`2026-10-15T${start}:00+09:00`},end:{dateTime:`2026-10-15T${end}:00+09:00`},...extra});
function fixture(items=[],options={}) {
 let calls=[],clock=0,callback;
 const timers={setTimeout:()=>1,clearTimeout:()=>{}};
 const oauth=()=>({initTokenClient: opts=>{callback=opts;return {requestAccessToken:()=>opts.callback({access_token:'test-memory-only',expires_in:3600})};},hasGrantedAllScopes:()=>options.scopes!==false});
 const adapter=createAdapter({config:{clientId:'test.apps.googleusercontent.com'},oauth,now:()=>clock,timers,
 fetchImpl:async(url,opts)=>{calls.push({url,opts});if(options.error) return {status:options.error,ok:false};
 let result;
 if(opts.method==='POST') result={id:'inserted',...JSON.parse(opts.body)};
 else if(!url.includes('/events?')) result={timeZone:'Asia/Tokyo'};
 else result={items, ...(options.pages && !url.includes('pageToken=') ? {nextPageToken:'next'}:{})};
 return {ok:true,status:200,json:async()=>result};}});
 return {adapter,calls,expire:()=>clock=3600001};
}
(async()=>{
 assert.equal(eventRange({...event,region:'海外'}),null);
 assert.equal(eventRange({...event,time:'bad'}),null);
 assert.equal(new Date(eventRange({...event,timeZone:'America/Chicago',date:'2026-07-01',time:'08:00 - 17:30'}).start).toISOString(),'2026-07-01T13:00:00.000Z');
 assert.equal(new Date(eventRange({...event,timeZone:'America/Chicago',date:'2026-01-01',time:'08:00 - 17:30'}).start).toISOString(),'2026-01-01T14:00:00.000Z');
 const dst=eventRange({...event,timeZone:'America/Chicago',date:'2026-03-07',endDate:'2026-03-08',time:'終日'});
 assert.equal(dst.end-dst.start,47*3600000);
 assert.equal(eventRange({...event,date:'2026-03-08',timeZone:'America/Chicago',time:'02:30 - 04:00'}),null);
 for(const [items,status] of [[[], 'free'],[[appointment('a','18:30','19:30')],'partial'],[[appointment('a','19:00','20:00')],'busy'],[[appointment('a','19:00','19:30'),appointment('b','19:30','20:00')],'busy'],[[appointment('a','19:00','19:30'),appointment('b','19:00','19:30')],'partial'],[[appointment('a','18:00','19:00')],'free'],[[appointment('a','19:00','20:00',{transparency:'transparent'})],'free'],[[{id:'all',summary:'休暇',start:{date:event.date},end:{date:'2026-10-16'}}],'busy']]) {
 const f=fixture(items);assert.equal(f.adapter.snapshot(event).state,'disconnected');await f.adapter.connect();assert.equal(f.adapter.snapshot(event).state,'loading');
 await Promise.all([f.adapter.ensure([event,event]),f.adapter.ensure([event])]);assert.equal(f.adapter.snapshot(event).status,status);
 const count=f.calls.length;await f.adapter.ensure([{...event,id:'second'}]);assert.equal(f.calls.length,count);
 vm.runInContext('state.calendarSettings.calendarProvider="google"',ctx);ctx.GoogleCalendar=f.adapter;ctx.e=event;
 assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),status==='busy'?'conflict':status==='partial'?'partial_conflict':'free');
 vm.runInContext('state.calendarSettings.calendarProvider="both"',ctx);ctx.e={...event,calendarStatus:{icloud:{status:'busy',conflicts:[]}}};assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),'conflict');
 f.adapter.disconnect();assert.equal(f.adapter.snapshot(event).state,'disconnected');
 }
 const registered=fixture([appointment('registered','19:00','20:00',{extendedProperties:{private:{ophthalconfEventId:event.id}}})]);await registered.adapter.connect();await registered.adapter.ensure([event]);assert.equal(registered.adapter.snapshot(event).registered,true);await registered.adapter.insert(event);assert.equal(registered.calls.filter(c=>c.opts.method==='POST').length,0);registered.adapter.disconnect();
 const different=fixture([appointment('different','19:00','19:30',{extendedProperties:{private:{ophthalconfEventId:event.id}}})]);await different.adapter.connect();await different.adapter.ensure([event]);assert.equal(different.adapter.snapshot(event).registered,false);different.adapter.disconnect();
 const f=fixture([], {pages:true});await f.adapter.connect();await f.adapter.ensure([event]);assert.equal(f.calls.length,3);await Promise.all([f.adapter.insert(event),f.adapter.insert(event)]);assert.equal(f.calls.filter(c=>c.opts.method==='POST').length,1);assert.equal(f.adapter.snapshot(event).registered,true);
 assert.match(JSON.parse(f.calls.find(c=>c.opts.method==='POST').opts.body).description,/OphthalConf-ID: fixture/);
 f.expire();assert.equal(f.adapter.snapshot(event).state,'error');assert.equal(f.adapter.connected(),false);
 for(const error of [401,403,500]){const f=fixture([],{error});await f.adapter.connect();await f.adapter.ensure([event]);assert.equal(f.adapter.snapshot(event).state,'error');f.adapter.disconnect();}
 await assert.rejects(fixture([],{scopes:false}).adapter.connect(),/authorization-failed/);
 await assert.rejects(createAdapter({config:{},timers:{setTimeout:()=>1,clearTimeout:()=>{}}}).connect(),/client-id-missing/);
 ctx.GoogleCalendar=fixture().adapter;ctx.e=event;vm.runInContext('state.calendarSettings.calendarProvider="google"',ctx);assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),'unlinked');
 ctx.GoogleCalendar={snapshot:()=>({state:'ready',status:'partial',registered:false,conflicts:Array.from({length:6},(_,i)=>({providerLabel:'Google',dateLabel:'10/15',start:'13:00',end:'17:00',title:`mock-${i}`}))})};
 ctx.e={...JSON.parse(vm.runInContext('JSON.stringify(sampleEvents.find(e=>e.isConference))',ctx)),date:'2026-10-15',endDate:'2026-10-17'};
 const card=vm.runInContext('createEventCardHtml(e)',ctx);
 assert.ok(card.includes('会期中に予定あり'));assert.ok(card.includes('ほか3件'));assert.ok(card.includes('mock-2'));assert.ok(!card.includes('mock-3'));assert.ok(card.includes('10/15'));
 ctx.GoogleCalendar=fixture().adapter;
 for(const provider of ['icloud','none']){vm.runInContext(`state.calendarSettings.calendarProvider="${provider}"`,ctx);assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),provider==='none'?'unlinked':'free');}
 const text=fs.readFileSync('google-calendar.js','utf8');assert.ok(!/localStorage|sessionStorage|console\.(log|error)|\.revoke\(/.test(text));
 console.log('Google Calendar: OAuth, scopes, expiry, cache, pagination, overlap union, all-day/DST, ID+time registration, insertion, provider combinations and errors passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
