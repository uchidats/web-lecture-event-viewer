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





    for(const width of [1280,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      await navigate('/');
      await evaluate('elements.resetFilterBtn.click();state.filters.keyword="第33回 日本糖尿病眼学会総会";renderEvents()');
      for(const mode of ['list','calendar','compact']) {
        await evaluate('document.getElementById("view-'+mode+'").click()');
        assert.deepEqual(await evaluate('getFilteredEvents().map(e=>e.id)'),['conf-jp-diabetic-2027']);
        if(mode!=='list') {
          await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-03-12")');
          await delay(100);
          await evaluate('document.querySelector(".fc-event[data-event-id=conf-jp-diabetic-2027]").click()');
        }
        const selector=mode==='list'?'#event-list [data-id="conf-jp-diabetic-2027"]':'#calendar-event-detail .event-card';
        const result=await evaluate('(()=>{const card=document.querySelector('+JSON.stringify(selector)+'),row=card.querySelector(".conf-registration-list"),abstract=card.querySelector(".conf-abstract-deadline-val");return {text:row.textContent,abstract:abstract.textContent,abstractUrl:abstract.querySelector("a")?.href,fits:card.scrollWidth<=card.clientWidth+1,pageFits:document.documentElement.scrollWidth<=innerWidth+1};})()');
        assert.ok(result.text.includes('2月2日')&&result.text.includes('締切')&&!result.text.includes('未定')&&!result.text.includes('3月13日'));
        assert.ok(result.abstract.includes('11月11日 12:00')&&result.abstract.includes('受付中')&&!result.abstract.includes('公式'));
        assert.equal(result.abstractUrl,'https://convention.jtbcom.co.jp/jsod33/abstract/index.html');
        assert.ok(result.fits&&result.pageFits);
        if(mode!=='list') await evaluate('new Promise(resolve=>{const d=document.getElementById("calendar-event-dialog");d.addEventListener("close",resolve,{once:true});d.close();})');
      }
      await evaluate('document.getElementById("view-list").click();elements.resetFilterBtn.click();state.filters.keyword="第28回 日本ロービジョン学会学術総会";renderEvents()');
      const lowvision=await evaluate('(()=>{const card=document.querySelector("#event-list [data-id=conf-jp-lowvision-2027]"),row=card.querySelector(".conf-abstract-deadline-val");return {text:row.textContent,url:row.querySelector("a")?.href,fits:card.scrollWidth<=card.clientWidth+1,pageFits:document.documentElement.scrollWidth<=innerWidth+1};})()');
      assert.ok(lowvision.text.includes('1月7日')&&lowvision.text.includes('締切'));
      assert.equal(lowvision.url,'https://www.ganki.jp/lowvision2027/abstracts.html');assert.ok(lowvision.fits&&lowvision.pageFits);
      const closed=await evaluate('renderAbstractSubmissionHtml(state.events.find(e=>e.id==="conf-jp-lowvision-2027"),new Date("2027-01-08T00:00:00+09:00"))');
      assert.ok(closed.includes('1月7日 締切済')&&!closed.includes('受付中'));
      assert.ok((await evaluate('(()=>{const e=state.events.find(e=>e.id==="conf-jp-surgery-2027");return renderAbstractSubmissionHtml({...e,abstractSubmission:{status:"unknown",url:e.eventOfficialUrl}});})()')).includes('公式</span>'));
      console.log('PASS '+width+'px: JSOD33 list/calendar/compact phases and abstract noon; audited lowvision deadline/dedicated URL/closed state; no overflow');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
