// Real local HTTP pages, real Edge layout/storage; Firebase and Google APIs are mocked only in this test server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');
const root = path.resolve(__dirname, '..'), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bootstrap = `
  window.dualApiCalls = [];
  window.dualFirebaseSDK = {
    getApps:()=>[{name:'ophthalconf-auth'}], initializeApp:(config,name)=>({name}), getAuth:()=>({}),
    browserLocalPersistence:'local', setPersistence:async()=>{},
    onAuthStateChanged:(auth,fn)=>{window.dualAuthObserver=fn;fn(JSON.parse(localStorage.getItem('__dual_test_user')||'null'));},
    GoogleAuthProvider:class{setCustomParameters(){}},
    signInWithPopup:async()=>{const user={uid:'dual-admin',email:'uchidats@gmail.com',emailVerified:true,displayName:'Fixture Admin'};localStorage.setItem('__dual_test_user',JSON.stringify(user));window.dualAuthObserver(user);},
    signOut:async()=>{localStorage.removeItem('__dual_test_user');window.dualAuthObserver(null);}
  };
  window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'fixture-only',expires_in:3600,scope:options.scope})})}}};
  const dualNativeFetch=window.fetch.bind(window);
  window.fetch=async(input,options)=>{
    if(String(input).startsWith('https://www.googleapis.com/calendar/v3/')){
      window.dualApiCalls.push(String(input));return new Response(JSON.stringify(String(input).includes('/events')?{items:[],timeZone:'Asia/Tokyo'}:{timeZone:'Asia/Tokyo'}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return dualNativeFetch(input,options);
  };
`;
async function main() {
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
    let file = path.resolve(output, '.' + url.pathname);
    if (file !== output && !file.startsWith(output + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    let data = fs.readFileSync(file);
    if (file.endsWith('index.html')) data = Buffer.from(data.toString().replace(/<link[^>]*https:[^>]*>/g, '')
      .replace(/<script[^>]*src="https:[^>]*><\/script>/g, '').replace('<head>', '<head><script>' + bootstrap + '</script>'));
    if (file.endsWith('firebase-auth.js')) data = Buffer.from(data.toString().replace(
      'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}});',
      'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}, load:async()=>root.dualFirebaseSDK});'));
    const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html';
    res.setHeader('Content-Type', type + '; charset=utf-8'); res.end(data);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-site-edge-'));
  const browser = spawn(process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
    assert.ok(fs.existsSync(portFile));
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id); if (!task) return;
      pending.delete(result.id); clearTimeout(task.timer); result.error ? task.reject(result.error) : task.resolve(result.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout: ' + JSON.stringify(params))), 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const navigate = async route => {
      await call('Page.navigate', { url: origin + route });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('document.readyState === "complete" && window.OphthalAuth?.snapshot().phase === "ready" && !!document.querySelector(".event-card")')) return;
        await delay(100);
      }
      throw new Error('Page not ready: ' + route);
    };

    const out=path.join(root,'scratch/calendar-slide-review');fs.mkdirSync(out,{recursive:true});
    const swipe=async(forward,native=false)=>{
      await evaluate('document.getElementById("event-calendar").scrollIntoView({block:"start"})');
      const p=await evaluate(`(() => {const r=document.querySelector('.fc-view-harness').getBoundingClientRect();return {x:r.left+r.width*.75,y:Math.max(document.querySelector('header').getBoundingClientRect().bottom+70,r.top+70)};})()`);
      if(native) {
        const x=forward?p.x:p.x-140;
        await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y:p.y}]});
        await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x+(forward?-140:140),y:p.y+4}]});
        await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      } else await evaluate(`(() => {const e=document.getElementById('event-calendar');e.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,pointerType:'touch',isPrimary:true,clientX:200,clientY:300,bubbles:true}));e.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,pointerType:'touch',isPrimary:true,clientX:`+(forward?60:340)+`,clientY:304,bubbles:true}));})()`);
    };
    for(const width of [390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});
      await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
      await navigate('/?view=list');
      await evaluate(`getTodayString=()=> '2027-03-01';state.filters.includeEndedConferences=true;for(const k of FILTER_SET_KEYS)state.filters[k].clear();renderEvents();document.getElementById('view-calendar').click();OphthalCalendarView.getCalendar().gotoDate('2027-03-01');window.slideAnimations=[];const originalAnimate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const a=originalAnimate.call(this,frames,options);if(this.classList.contains('calendar-slide-snapshot')||this.classList.contains('calendar-slide-incoming')){a.pause();window.slideAnimations.push(a);}return a;};`);
      for(const forward of [true,false]) {
        await evaluate('window.slideAnimations=[]');
        await swipe(forward,true);
        const expected=forward?3:2;
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'),expected);
        const info=await evaluate(`(() => {const old=document.querySelector('.calendar-slide-snapshot'),incoming=document.querySelector('.calendar-slide-incoming');return {count:slideAnimations.length,duration:slideAnimations.map(a=>a.effect.getTiming().duration),easing:slideAnimations.map(a=>a.effect.getTiming().easing),frames:slideAnimations.map(a=>a.effect.getKeyframes().map(f=>f.transform)),oldTitle:old?.querySelector('.fc-toolbar-title').textContent,newTitle:incoming?.querySelector('.fc-toolbar-title').textContent,oldDays:old?.querySelectorAll('.fc-daygrid-day').length,newDays:incoming?.querySelectorAll('.fc-daygrid-day').length,oldBars:old?.querySelectorAll('.fc-event').length,busy:document.getElementById('event-calendar').getAttribute('aria-busy')};})()`);
        assert.equal(info.count,2);assert.deepEqual(info.duration,[200,200]);assert.deepEqual(info.easing,['ease-out','ease-out']);assert.equal(info.frames[0][1],forward?'translateX(-100%)':'translateX(100%)');assert.equal(info.frames[1][0],forward?'translateX(100%)':'translateX(-100%)');assert.ok(info.oldDays>=28&&info.newDays>=28&&info.oldBars>0);assert.equal(info.busy,'true');assert.notEqual(info.oldTitle,info.newTitle);
        for(let i=0;i<3;i++)await swipe(forward);
        await evaluate('document.querySelector(".calendar-slide-incoming .fc-next-button").click()');
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'),expected,'Busy gestures/buttons do not navigate');
        await evaluate('slideAnimations.forEach(a=>a.currentTime=100)');
        const transforms=await evaluate('slideAnimations.map(a=>getComputedStyle(a.effect.target).transform)');assert.ok(transforms.every(t=>t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)'));
        const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,width+(forward?'-left':'-right')+'.png'),Buffer.from(shot.data,'base64'));
        await evaluate('Promise.all(slideAnimations.map(a=>{a.play();return a.finished;}))');await delay(50);
        assert.equal(await evaluate('document.querySelectorAll(".calendar-slide-snapshot,.calendar-slide-incoming").length'),0);assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'),expected);
        console.log(JSON.stringify({width,forward,...info,transforms}));
      }
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await swipe(true);assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'),3);assert.equal(await evaluate('document.querySelectorAll(".calendar-slide-snapshot,.calendar-slide-incoming").length'),0);
      await swipe(false);assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'),2);
      console.log('PASS '+width+'px native left/right, visible halfway transforms, busy lock, cleanup, reduced motion');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
