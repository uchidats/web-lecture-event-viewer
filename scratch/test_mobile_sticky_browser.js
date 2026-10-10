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
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout')), 15000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
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
    const output = path.join(root,'scratch','mobile-sticky-review'); fs.mkdirSync(output,{recursive:true});
    const results=[];
    const measure=()=>evaluate(`(() => {const h=document.querySelector('.app-header').getBoundingClientRect(),t=document.querySelector('.fc-header-toolbar').getBoundingClientRect();return {scrollY,header:h.height,headerTop:h.top,toolbar:t.height,toolbarTop:t.top,title:document.querySelector('.fc-toolbar-title').textContent,overflow:document.documentElement.scrollWidth>innerWidth,compact:document.querySelector('.app-header').classList.contains('is-compact')}})()`);
    for(const width of [320,390]) for(const view of ['calendar','compact']) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:true});
      await call('Page.navigate',{url:origin+'/?view='+view+'&month=2027-07'});
      for(let i=0;i<100 && !await evaluate('!!document.querySelector(".fc-toolbar-title")');i++) await delay(100);
      await delay(400);
      await evaluate('document.getElementById("auth-login").click()'); await delay(300);
      const before=await measure();
      let shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${width}-${view}-initial.png`),Buffer.from(shot.data,'base64'));
      await evaluate('window.scrollTo(0,document.querySelector(".fc-header-toolbar").getBoundingClientRect().top+scrollY-52)'); await delay(400);
      const after=await measure(); console.log("MEASURE",after); assert.equal(after.header,52);assert.equal(after.headerTop,0);assert.ok(Math.abs(after.toolbarTop-52)<1);assert.equal(after.overflow,false);assert.ok(after.title.includes('2027年7月'));
      assert.equal(await evaluate('document.getElementById("mobile-filter-btn").textContent.trim()'),'絞り込み');
      shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${width}-${view}-scrolled.png`),Buffer.from(shot.data,'base64'));
      const startY=await evaluate('scrollY');
      await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:250}]});
      for(const y of [280,320,360,400]) {await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160,y}]});await delay(40);}
      await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(500);
      assert.ok(await evaluate('scrollY')<startY,'native vertical touch scroll');
      assert.ok(await evaluate('location.search.includes("month=2027-07")'),'vertical gesture keeps month');
      await evaluate('window.scrollTo(0,502)');await delay(300);
      await evaluate('document.getElementById("mobile-filter-btn").click()');assert.ok(await evaluate('document.getElementById("filter-sidebar").classList.contains("open")'));await evaluate('document.getElementById("close-mobile-filter").click()');
      await evaluate('document.querySelector(".fc-next-button").click()');assert.ok(await evaluate('location.search.includes("month=2027-08")'));
      await evaluate('document.getElementById("view-list").click()');await evaluate('history.back()');await delay(300);assert.ok(await evaluate('location.search.includes("month=2027-08") && !document.getElementById("calendar-panel").hidden'));
      await evaluate('history.forward()');await delay(300);assert.ok(await evaluate('document.getElementById("calendar-panel").hidden'));
      await evaluate('history.back()');await delay(300);
      await evaluate(`(()=>{const el=document.getElementById('event-calendar');for(const [type,x,y] of [['pointerdown',220,200],['pointermove',100,202],['pointerup',100,202]])el.dispatchEvent(new PointerEvent(type,{pointerType:'touch',isPrimary:true,pointerId:7,clientX:x,clientY:y,bubbles:true}));})()`);
      assert.ok(await evaluate('location.search.includes("month=2027-09")'));
      await delay(700);await evaluate('window.scrollTo(0,0)');
      for(let i=0;i<30 && (await measure()).compact;i++) await delay(100);
      assert.equal((await measure()).compact,false);
      results.push({width,view,before,after});console.log(JSON.stringify(results.at(-1)));
    }
    for(const width of [768,1280]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});
      await evaluate('window.scrollTo(0,300)');await delay(300);assert.equal((await measure()).compact,false);
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".fc-header-toolbar")).position'),'static');
    }
    fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(results,null,2));
    console.log('PASS: mobile sticky, drawer, month URL, history, swipe, expanded restoration, desktop/tablet; '+output);
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

