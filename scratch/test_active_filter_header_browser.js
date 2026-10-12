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

    const out=path.join(root,'scratch/active-filter-header-review');fs.mkdirSync(out,{recursive:true});
    const choices=[['specialty',String.fromCharCode(32207,21512)],['year','2027'],['eventType',String.fromCharCode(22269,20869,23398,20250)],['format',String.fromCharCode(29694,22320)],['region',String.fromCharCode(38306,26481)]];
    for(const width of [1280,900,768,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await navigate('/');
      await evaluate('document.getElementById("reset-filter-btn").click();window.scrollTo(0,0)');await delay(200);
      for(const [group,value] of choices)await evaluate(`[...document.querySelectorAll('#filter-sidebar input')].find(e=>e.name===`+JSON.stringify(group)+`&&e.value===`+JSON.stringify(value)+`).click()`);
      const m=await evaluate(`(() => {
        const row=document.querySelector('.filter-trigger-row'),b=document.getElementById('mobile-filter-btn').getBoundingClientRect(),chips=[...row.querySelectorAll('.active-filter-badge')],rects=chips.map(e=>e.getBoundingClientRect());
        return {order:[...row.querySelectorAll('.badge-remove')].map(e=>e.dataset.group),unique:document.querySelectorAll('#active-filter-chips').length===1&&!document.querySelector('.content-area #active-filter-chips'),aligned:rects.filter(r=>Math.abs(r.top-b.top)<42&&r.left>=b.right).every(r=>Math.abs(r.top+r.height/2-b.top-b.height/2)<1),wrap:rects.some(r=>r.top>=b.bottom),fits:document.documentElement.scrollWidth<=innerWidth+1,count:getFilteredEvents().length};
      })()`);
      assert.deepEqual(m.order,choices.map(c=>c[0]));assert.ok(m.unique&&m.aligned&&m.fits);if(width<500)assert.ok(m.wrap);
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,width+'-normal.png'),Buffer.from(shot.data,'base64'));
      if(width<500) {
        const conditions=await evaluate('JSON.stringify([...state.filters.year,...state.filters.specialty,...state.filters.eventType,...state.filters.format,...state.filters.region])');
        await evaluate('elements.eventList.style.minHeight="2000px";window.scrollTo(0,240)');await evaluate("new Promise(resolve=>{const ready=()=>window.scrollY>96&&document.querySelector('header').classList.contains('is-compact')?resolve():requestAnimationFrame(ready);ready();})");
        const compact=await evaluate('({height:document.querySelector("header").getBoundingClientRect().height,hidden:getComputedStyle(document.getElementById("active-filter-chips")).display==="none",compact:document.querySelector("header").classList.contains("is-compact"),scrollY,innerWidth,overflow:document.body.style.overflow,fits:document.documentElement.scrollWidth<=innerWidth+1})');
        assert.equal(compact.height,52);assert.ok(compact.hidden&&compact.compact&&compact.fits);assert.equal(await evaluate('JSON.stringify([...state.filters.year,...state.filters.specialty,...state.filters.eventType,...state.filters.format,...state.filters.region])'),conditions);
        const s=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,width+'-compact.png'),Buffer.from(s.data,'base64'));
        await evaluate('window.scrollTo(0,0)');await delay(300);assert.equal(await evaluate('getComputedStyle(document.getElementById("active-filter-chips")).display'),'contents');
        await evaluate('document.getElementById("mobile-filter-btn").click()');assert.ok(await evaluate('document.getElementById("filter-sidebar").classList.contains("open")'));await evaluate('document.getElementById("close-mobile-filter").click()');
      }
      await evaluate('document.querySelector("#active-filter-chips .badge-remove").click()');assert.equal(await evaluate('state.filters.specialty.size'),0);assert.equal(await evaluate('document.querySelectorAll("#active-filter-chips .badge-remove").length'),4);
      await evaluate('document.getElementById("reset-filter-btn").click()');assert.equal(await evaluate('document.getElementById("active-filter-chips").children.length'),0);
      console.log(JSON.stringify({width,...m}));
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
