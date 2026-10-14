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
  const { output } = buildDualSite(), requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test'); requests.push(url.pathname);
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
    let port;
    for (let i = 0; i < 150; i++) {
      try {
        const candidate = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
        if (/^\d+$/.test(candidate)) { port = candidate; break; }
      } catch (error) {
        if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error;
      }
      await delay(100);
    }
    assert.ok(port, 'Browser debugging port must be readable after startup');
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id); if (!task) return;
      pending.delete(result.id); clearTimeout(task.timer); result.error ? task.reject(result.error) : task.resolve(result.result);
    });
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout')), 15000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? {sessionId} : {}) }));
    });
    const evaluate = async (expression, sessionId) => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const navigate = async route => {
      await call('Page.navigate', { url: origin + route + (['/', '/ophthalconf/'].includes(route) ? '?view=list' : '') });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('document.readyState === "complete" && window.OphthalAuth?.snapshot().phase === "ready" && !!document.querySelector(".event-card")')) return;
        await delay(100);
      }
      throw new Error('Page not ready: ' + route);
    };






    for(const width of [1280,900,768]) {
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
      await call('Emulation.setDeviceMetricsOverride',{width,height:650,deviceScaleFactor:1,mobile:false});await navigate('/?view=calendar&month=2026-10');
      const month=()=>evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()');
      const send=async(x,y,target='event-calendar')=>evaluate('(()=>{const event=new WheelEvent("wheel",{deltaX:'+x+',deltaY:'+y+',bubbles:true,cancelable:true});document.getElementById('+JSON.stringify(target)+').dispatchEvent(event);return event.defaultPrevented;})()');
      assert.equal(await month(),9);
      assert.equal(await send(20,100),false);assert.equal(await month(),9);
      assert.equal(await send(20,0),true);assert.equal(await month(),9);
      await send(35,1);
      const transition=await evaluate('(()=>{const el=document.getElementById("event-calendar");el.dispatchEvent(new WheelEvent("wheel",{deltaX:40,deltaY:1,bubbles:true,cancelable:true}));const old=el.querySelector(".calendar-slide-snapshot"),incoming=el.querySelector(".calendar-slide-incoming");return {old:!!old,incoming:!!incoming,animations:old?.getAnimations().map(a=>({duration:a.effect.getTiming().duration,easing:a.effect.getTiming().easing,frames:a.effect.getKeyframes().map(f=>f.transform)}))};})()');
      assert.ok(transition.old&&transition.incoming);assert.equal(transition.animations[0].duration,200);assert.equal(transition.animations[0].easing,'ease-out');assert.ok(transition.animations[0].frames.at(-1).includes('-100%'));
      for(let i=0;i<15;i++){await send(80-i*3,1);await delay(60);}
      assert.equal(await month(),10,'inertia only one month');await delay(650);
      assert.ok(await evaluate('(()=>{document.getElementById("event-calendar").dispatchEvent(new WheelEvent("wheel",{deltaX:-95,deltaY:2,bubbles:true,cancelable:true}));return document.querySelector(".calendar-slide-snapshot").getAnimations()[0].effect.getKeyframes().at(-1).transform.includes("100%");})()'));assert.equal(await month(),9);
      await delay(650);
      assert.equal(await send(120,0,'view-calendar'),false);assert.equal(await month(),9);
      await evaluate('const spacer=document.createElement("div");spacer.style.height="500px";document.body.append(spacer);scrollTo(0,0)');
      const point=await evaluate('(()=>{const r=document.getElementById("event-calendar").getBoundingClientRect();return {x:r.left+50,y:Math.min(innerHeight-30,r.top+50)};})()');
      await call('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:150});await delay(150);
      assert.ok(await evaluate('scrollY>0'),'native vertical scrolling preserved');assert.equal(await month(),9);
      await evaluate('scrollTo(0,0)');await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:10,y:10,deltaX:0,deltaY:120});await delay(150);assert.ok(await evaluate('scrollY>0'),'outside scroll preserved');
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await delay(650);await send(90,0);assert.equal(await month(),10);assert.equal(await evaluate('!!document.querySelector(".calendar-slide-snapshot")'),false);
      await delay(650);await evaluate('document.getElementById("view-compact").click()');assert.equal(await send(100,0),false,'compact not affected');
      await call('Emulation.setEmulatedMedia',{features:[]});
      console.log('PASS '+width+'px: pixel trackpad bursts, left/right slides, inertia lock, repeated gestures, native vertical/outside scroll, reduced motion and compact exclusion');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
