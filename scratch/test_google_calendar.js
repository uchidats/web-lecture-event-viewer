const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logs=[];
const ctx = vm.createContext({console:{info:(...args)=>logs.push(args),error:(...args)=>logs.push(args)}, URLSearchParams, AbortController, setTimeout, clearTimeout,
 document: {getElementById:()=>null, addEventListener:()=>{}}, module:{exports:{}}});
for (const f of ['venues.js','companies.js','events.js','google-calendar.js','script.js']) vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const {createAdapter,eventRange} = ctx.module.exports;
const event={id:'fixture',date:'2026-10-15',time:'19:00 - 20:00',region:'全国Web',title:'眼科講演',venue:'Web',officialUrl:'https://example.org',description:'概要'};
const appointment=(id,start,end,extra={})=>({id,status:'confirmed',summary:'医局会',start:{dateTime:`2026-10-15T${start}:00+09:00`},end:{dateTime:`2026-10-15T${end}:00+09:00`},...extra});
function fixture(items=[],options={}) {
 let calls=[],clock=0,callback,inserted;
 const timers={setTimeout:()=>1,clearTimeout:()=>{}};
 const oauth=()=>({initTokenClient: opts=>{callback=opts;return {requestAccessToken:()=>opts.callback({access_token:'test-memory-only',expires_in:3600})};},hasGrantedAllScopes:()=>options.scopes!==false});
 const adapter=createAdapter({config:{clientId:'test.apps.googleusercontent.com'},oauth,now:()=>clock,timers,
 fetchImpl:async(url,opts)=>{calls.push({url,opts});const error=options.error || (opts.method==='POST' && options.postError) || (/\/events\/[^/?]+$/.test(url) && options.getError);
 if(error) return {status:error,ok:false,json:async()=>({error:{code:error,message:'fixture error',errors:[{reason:'insufficientPermissions'}]}})};
 if(options.delayPost && opts.method==='POST') await options.delayPost;
 if(options.delayGet && /\/events\/[^/?]+$/.test(url)) await options.delayGet;
 let result;
 if(opts.method==='POST') result=inserted={id:'inserted',htmlLink:'https://calendar.google.com/calendar/event?eid=mock',status:'confirmed',...JSON.parse(opts.body),...options.postResponse};
 else if(/\/events\/[^/?]+$/.test(url)) result={...(inserted || items.find(item=>url.endsWith('/'+item.id))),...options.getResponse};
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
 assert.equal(f.calls.find(c=>c.opts.method==='POST').url,'https://www.googleapis.com/calendar/v3/calendars/primary/events');
 assert.ok(f.calls.some(c=>c.url.endsWith('/calendars/primary/events/inserted')));
 assert.equal(f.adapter.getLastWriteResult().id,'inserted');assert.equal(f.adapter.getLastWriteResult().verified,true);assert.equal(f.adapter.getLastWriteResult().status,'confirmed');
 assert.match(JSON.parse(f.calls.find(c=>c.opts.method==='POST').opts.body).description,/OphthalConf-ID: fixture/);
 f.expire();assert.equal(f.adapter.snapshot(event).state,'error');assert.equal(f.adapter.connected(),false);
 for(const error of [401,403,500]){const f=fixture([],{error});await f.adapter.connect();await f.adapter.ensure([event]);assert.equal(f.adapter.snapshot(event).state,'error');f.adapter.disconnect();}
 for(const options of [{postError:400},{postError:403},{postError:500},{getError:404},{getError:500},{postResponse:{id:null}},{getResponse:{id:'wrong'}},{getResponse:{status:'cancelled'}},{getResponse:{start:{dateTime:'2026-10-15T18:00:00+09:00'}}},{getResponse:{extendedProperties:{},description:''}}]) {
   const f=fixture([],options);await f.adapter.connect();await assert.rejects(f.adapter.insert(event));assert.ok(!f.adapter.snapshot(event).registered);f.adapter.disconnect();
 }
 let release;const options={delayGet:new Promise(resolve=>release=resolve)};const pending=fixture([],options);await pending.adapter.connect();const task=pending.adapter.insert(event);
 while(!pending.calls.some(c=>c.url.endsWith('/events/inserted'))) await new Promise(resolve=>setImmediate(resolve));
 assert.equal(pending.adapter.snapshot(event).registered,false);assert.equal(pending.adapter.getLastWriteResult().verified,false);release();await task;assert.equal(pending.adapter.snapshot(event).registered,true);pending.adapter.disconnect();
 const retryOptions={getError:500};const retry=fixture([],retryOptions);await retry.adapter.connect();await assert.rejects(retry.adapter.insert(event));retryOptions.getError=null;await retry.adapter.insert(event);assert.equal(retry.calls.filter(c=>c.opts.method==='POST').length,1);retry.adapter.disconnect();
 await assert.rejects(fixture([],{scopes:false}).adapter.connect(),/authorization-failed/);
 await assert.rejects(createAdapter({config:{},timers:{setTimeout:()=>1,clearTimeout:()=>{}}}).connect(),/client-id-missing/);
 ctx.GoogleCalendar=fixture().adapter;ctx.e=event;vm.runInContext('state.calendarSettings.calendarProvider="google"',ctx);assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),'unlinked');
 ctx.GoogleCalendar={snapshot:()=>({state:'ready',status:'partial',registered:false,conflicts:Array.from({length:6},(_,i)=>({providerLabel:'Google',dateLabel:'10/15',start:'13:00',end:'17:00',title:`mock-${i}`}))})};
 ctx.e={...JSON.parse(vm.runInContext('JSON.stringify(sampleEvents.find(e=>e.isConference))',ctx)),date:'2026-10-15',endDate:'2026-10-17'};
 const card=vm.runInContext('createEventCardHtml(e)',ctx);
 assert.ok(card.includes('会期中に予定あり'));assert.ok(card.includes('ほか3件'));assert.ok(card.includes('mock-2'));assert.ok(!card.includes('mock-3'));assert.ok(card.includes('10/15'));
 ctx.GoogleCalendar=fixture().adapter;
 for(const provider of ['icloud','none']){vm.runInContext(`state.calendarSettings.calendarProvider="${provider}"`,ctx);assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).statusKey',ctx),provider==='none'?'unlinked':'free');}
 vm.runInContext('var registrationToasts=[]; renderEvents=()=>{};updateRegisteredBadge=()=>{};showToast=message=>registrationToasts.push(message);state.calendarSettings={calendarProvider:"google",defaultCalendar:"google"};',ctx);
 let releaseUi;const ui=fixture([],{delayGet:new Promise(resolve=>releaseUi=resolve)});await ui.adapter.connect();ctx.GoogleCalendar=ui.adapter;
 ctx.e={...event,calendarStatus:{isAdded:false},scheduleStatus:'free'};
 const unchanged=JSON.stringify(ctx.e);const uiTask=ctx.addToCalendar(ctx.e);
 while(!ui.calls.some(c=>c.url.endsWith('/events/inserted'))) await new Promise(resolve=>setImmediate(resolve));
 assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isAdding',ctx),true);
 assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isRegistered',ctx),false);
 assert.equal(vm.runInContext('registrationToasts[0]',ctx),'カレンダーに追加中…');
 releaseUi();await uiTask;assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isRegistered',ctx),true);assert.equal(JSON.stringify(ctx.e),unchanged);ui.adapter.disconnect();
 const failed=fixture([],{postError:403});await failed.adapter.connect();ctx.GoogleCalendar=failed.adapter;await ctx.addToCalendar(ctx.e);
 assert.equal(vm.runInContext('registrationToasts.at(-1)',ctx),'Google Calendarへの登録に失敗しました');assert.equal(JSON.stringify(ctx.e),unchanged);assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isRegistered',ctx),false);failed.adapter.disconnect();
 const destination=fixture();await destination.adapter.connect();ctx.GoogleCalendar=destination.adapter;
 vm.runInContext('state.calendarSettings={calendarProvider:"icloud",defaultCalendar:"google"};',ctx);
 await ctx.addToCalendar(ctx.e);assert.equal(destination.calls.filter(call=>call.opts.method==='POST').length,1,'Google destination must POST even when availability uses iCloud');assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isRegistered',ctx),true);destination.adapter.disconnect();
 vm.runInContext('state.calendarSettings={calendarProvider:"google",defaultCalendar:"google"};',ctx);
 ctx.document.createElement=()=>({click(){}});ctx.document.body={appendChild(){},removeChild(){}};
 ctx.Blob=class {};ctx.URL={createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}};
 await ctx.addToCalendar(ctx.e);assert.equal(JSON.stringify(ctx.e),unchanged,'ICS fallback must not change registration flags');
 ctx.e.calendarStatus.isAdded=true;ctx.e.scheduleStatus='registered';assert.equal(vm.runInContext('computeEffectiveScheduleStatus(e).isRegistered',ctx),false,'Live Google must ignore dummy registration flags');
 const text=fs.readFileSync('google-calendar.js','utf8');assert.ok(!/localStorage|sessionStorage|\.revoke\(/.test(text));
 assert.ok(!JSON.stringify(logs).includes('test-memory-only'));assert.ok(!JSON.stringify(logs).includes('医局会'));assert.ok(JSON.stringify(logs).includes('insufficientPermissions'));
 console.log('Google Calendar: OAuth, scopes, expiry, cache, pagination, overlap union, all-day/DST, ID+time registration, insertion, provider combinations and errors passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
