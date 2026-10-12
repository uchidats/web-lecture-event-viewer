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



    const measure=()=>evaluate(`(() => {const cells=[...document.querySelectorAll('.fc-daygrid-day')],bars=[...document.querySelectorAll('.fc-daygrid-event')].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>({r:e.getBoundingClientRect(),id:e.dataset.eventId})).filter(e=>e.r.width&&e.r.height);const height=d=>cells.find(e=>e.dataset.date===d).getBoundingClientRect().height;return {visible:bars.length,ids:[...new Set(bars.map(e=>e.id))].sort(),height:height('2027-02-11'),quiet:height('2027-02-04'),more:[...document.querySelectorAll('.fc-more-link')].filter(e=>e.getBoundingClientRect().height).length,overlap:bars.some((a,i)=>bars.slice(i+1).some(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)),fits:document.documentElement.scrollWidth<=innerWidth+1};})()`);
    for(const width of [1280,1024,900]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await navigate('/');await evaluate('state.filters.includeEndedConferences=true;for(const k of FILTER_SET_KEYS)state.filters[k].clear();document.getElementById("view-calendar").click()');
      const heights=[];
      for(const count of [0,1,2,3,4,5]) {
        await evaluate('state.events=Array.from({length:'+count+'},(_,i)=>({...sampleEvents.find(e=>e.isConference),id:"stack-"+i,title:"Event "+i,date:"2027-02-11",endDate:"2027-02-11"}));renderEvents();OphthalCalendarView.getCalendar().gotoDate("2027-02-01")');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const m=await measure();assert.equal(m.visible,count);assert.equal(m.more,0);assert.ok(!m.overlap&&m.fits);heights.push(m.height);
        if(count<=2){await evaluate('OphthalCalendarView.getCalendar().setOption("dayMaxEvents",3)');const baseline=await measure();assert.ok(Math.abs(m.height-baseline.height)<=1);assert.ok(Math.abs(m.quiet-baseline.quiet)<=1);await evaluate('OphthalCalendarView.getCalendar().setOption("dayMaxEvents",false)');}
        if(count>=3)assert.ok(m.height>heights[count-1]);assert.ok(Math.abs(m.quiet-heights[0])<=1);console.log(JSON.stringify({width,count,...m}));
      }
      await evaluate('state.events=Array.from({length:5},(_,i)=>({...sampleEvents.find(e=>e.isConference),id:"mixed-"+i,title:"Mixed "+i,date:i<2?"2027-02-10":"2027-02-11",endDate:i<2?"2027-02-16":"2027-02-11"}));renderEvents()');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const mixed=await measure();assert.equal(mixed.ids.length,5);assert.equal(mixed.more,0);assert.ok(!mixed.overlap&&mixed.fits);assert.ok(Math.abs(mixed.quiet-heights[0])<=1);
      await call('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await delay(200);assert.equal(await evaluate('OphthalCalendarView.getCalendar().getOption("dayMaxEvents")'),3);await call('Emulation.setDeviceMetricsOverride',{width:width,height:900,deviceScaleFactor:1,mobile:false});await delay(200);assert.equal(await evaluate('OphthalCalendarView.getCalendar().getOption("dayMaxEvents")'),false);
      console.log('PASS '+width+'px mixed events, quiet week preserved, mobile cap restored after resize');
    }
    for (const width of [390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});
      await navigate('/');
      await evaluate('state.filters.includeEndedConferences=true;for(const k of FILTER_SET_KEYS)state.filters[k].clear();state.events=Array.from({length:5},(_,i)=>({...sampleEvents.find(e=>e.isConference),id:"mobile-"+i,title:"Event "+i,date:"2027-02-11",endDate:"2027-02-11"}));renderEvents();document.getElementById("view-calendar").click();OphthalCalendarView.getCalendar().gotoDate("2027-02-01")');
      await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const mobile=await measure();
      assert.equal(await evaluate('OphthalCalendarView.getCalendar().getOption("dayMaxEvents")'),3);
      assert.equal(mobile.visible,3);assert.equal(mobile.more,1);assert.ok(!mobile.overlap&&mobile.fits);
      console.log('PASS '+width+'px: existing three-event cap and more link preserved');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
