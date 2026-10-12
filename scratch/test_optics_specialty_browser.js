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


    const expectedIds=['conf-jp-myopia-2027','conf-jp-cl-2027','conf-jp-optics-2027','conf-jp-myopia-2028','conf-jp-optics-2028','conf-jp-cl-2028'].sort();
    const category=String.fromCharCode(30524,20809,23398)+'CL'+String.fromCharCode(36817,35222),other=String.fromCharCode(12381,12398,20182);
    for(const width of [1280,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await navigate('/');
      await evaluate('document.getElementById("reset-filter-btn").click();state.filters.includeEndedConferences=true;syncCheckboxesWithState();renderEvents()');
      const data=await evaluate('({optics:state.events.filter(e=>e.specialty==='+JSON.stringify(category)+').map(e=>e.id).sort(),other:state.events.filter(e=>e.specialty==='+JSON.stringify(other)+').length})');assert.deepEqual(data.optics,expectedIds);assert.equal(data.other,18);
      await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(category)+`).click()`);
      assert.equal(await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(category)+`).nextElementSibling.querySelector('.chip-count').textContent`),'(6)');
      for(const mode of ['list','calendar','compact']) {
        await evaluate('document.getElementById("view-'+mode+'").click()');
        assert.deepEqual(await evaluate('getFilteredEvents().map(e=>e.id).sort()'),expectedIds);
        if(mode==='list') {
          assert.deepEqual(await evaluate('[...elements.eventList.querySelectorAll(".event-card")].map(e=>e.dataset.id).sort()'),expectedIds);
          assert.ok(await evaluate(`[...elements.eventList.querySelectorAll('.card-meta-item strong')].filter(e=>e.textContent===`+JSON.stringify(category)+`).length===6`));
        } else assert.deepEqual(await evaluate('OphthalCalendarView.getCalendar().getEvents().map(e=>e.id).sort()'),expectedIds);
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
      }
      await evaluate('document.getElementById("view-list").click()');
      await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(category)+`).click();[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(other)+`).click()`);
      assert.equal(await evaluate('getFilteredEvents().length'),18);
      assert.ok(await evaluate('getFilteredEvents().every(e=>!'+JSON.stringify(expectedIds)+'.includes(e.id))'));
      assert.equal(await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(other)+`).nextElementSibling.querySelector('.chip-count').textContent`),'(18)');
      if(width<500){await evaluate('document.getElementById("mobile-filter-btn").click()');await delay(350);assert.ok(await evaluate('document.querySelector(".sidebar-body").scrollWidth<=document.querySelector(".sidebar-body").clientWidth+1'));await evaluate('document.getElementById("close-mobile-filter").click()');}
      console.log('PASS '+width+'px: optics 6, other 18, all card labels, list/calendar/compact filters and no overflow');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
