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



    const label=String.fromCharCode(30524,28814,30151,24863,26579),other=String.fromCharCode(12381,12398,20182),joint='conf-jp-inflammation-2028';
    const inflammatory=['conf-int-iois-2027','conf-jp-inflammation-2027',joint].sort();
    const displayLabel = String.fromCharCode(30524,28814,30151,12539,24863,26579);
    for(const width of [1280,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await navigate('/');
      await evaluate('document.getElementById("reset-filter-btn").click();state.filters.includeEndedConferences=true;syncCheckboxesWithState();renderEvents()');
      for(const [values,count] of [[[label],3],[[other],14],[[label,other],16]]) {
        await evaluate('state.filters.specialty.clear();syncCheckboxesWithState();renderEvents()');
        for(const value of values)await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(value)+`).click()`);
        const expected=await evaluate('state.events.filter(e=>getEventSpecialties(e).some(s=>'+JSON.stringify(values)+'.includes(s))).map(e=>e.id).sort()');assert.equal(expected.length,count);assert.ok(expected.includes(joint));if(values[0]===label&&values.length===1)assert.deepEqual(expected,inflammatory);
        for(const mode of ['list','calendar','compact']) {
          await evaluate('document.getElementById("view-'+mode+'").click()');
          assert.deepEqual(await evaluate('getFilteredEvents().map(e=>e.id).sort()'),expected);
          if(mode==='list') {
            assert.deepEqual(await evaluate('[...elements.eventList.querySelectorAll(".event-card")].map(e=>e.dataset.id).sort()'),expected);
            assert.deepEqual(await evaluate(`[...document.querySelector('[data-id="`+joint+`"] .event-specialty-labels').children].map(e=>e.textContent)`),[displayLabel,other]);
          } else {
            assert.deepEqual(await evaluate('OphthalCalendarView.getCalendar().getEvents().map(e=>e.id).sort()'),expected);
            await evaluate('OphthalCalendarView.getCalendar().gotoDate(state.events.find(e=>e.id==='+JSON.stringify(joint)+').date)');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
            assert.equal(await evaluate(`document.querySelectorAll('.fc-event[data-event-id="`+joint+`"]').length`),1);
            await evaluate(`document.querySelector('.fc-event[data-event-id="`+joint+`"]').click()`);
            assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#calendar-event-detail .event-specialty-labels strong"),e=>e.textContent)'),[displayLabel,other]);
            assert.equal(await evaluate('document.querySelector("#calendar-event-detail .conf-category-badge.category").textContent'), displayLabel);
            await evaluate('document.getElementById("calendar-event-close").click()');
          }
          assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        }
      }
      for(const [value,count] of [[label,3],[other,14]])assert.equal(await evaluate(`[...document.querySelectorAll('#filter-specialty input')].find(e=>e.value===`+JSON.stringify(value)+`).nextElementSibling.querySelector('.chip-count').textContent`),'('+count+')');
      if(width<500){await evaluate('document.getElementById("mobile-filter-btn").click()');await delay(350);assert.ok(await evaluate('document.querySelector(".sidebar-body").scrollWidth<=document.querySelector(".sidebar-body").clientWidth+1'));await evaluate('document.getElementById("close-mobile-filter").click()');}
      console.log('PASS '+width+'px: inflammation 3, other 14, union 16, joint labels, three modes and no duplicate cards/overflow');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
