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
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await navigate('/');
      const result=await evaluate('(()=>{const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,1000)+"px";document.body.append(host);const now=new Date("2026-10-14T12:00:00+09:00"),base=state.events.find(e=>e.id==="oph-001"),registrationRenderer=renderRegistrationHtml,abstractRenderer=renderAbstractSubmissionHtml;renderRegistrationHtml=e=>registrationRenderer(e,now);renderAbstractSubmissionHtml=e=>abstractRenderer(e,now);try{return [["2026-11-05 12:00","11月5日 12:00 締切"],["2026-11-05","11月5日 締切"],["2026-11-14","11月14日 締切"],["2026-11-13","11月13日 締切"],["2026-10-14 13:00","10月14日 13:00 締切"],["2026-10-13 12:00","10月13日 締切済"]].map(([deadline,expected])=>{const event={...base,timeZone:"Asia/Tokyo",registration:{timeZone:"Asia/Tokyo",periods:[{label:"事前参加登録",category:"regular",deadline}]},abstractSubmission:{status:"open",deadline,url:"https://example.com/abstract"}};host.innerHTML=createEventCardHtml(event);const card=host.firstElementChild,registration=card.querySelector(".conf-registration-list"),abstract=card.querySelector(".conf-abstract-deadline-val");return {expected,registrationColor:getComputedStyle(registration.querySelector(".registration-deadline")).color,labelColor:getComputedStyle(registration.querySelector(".conf-label")).color,registration:registration.textContent,abstract:abstract.textContent,fits:card.scrollWidth<=card.clientWidth+1&&registration.scrollWidth<=registration.clientWidth+1&&abstract.scrollWidth<=abstract.clientWidth+1};});}finally{renderRegistrationHtml=registrationRenderer;renderAbstractSubmissionHtml=abstractRenderer;host.remove();}})()');
      for(const row of result){assert.ok(row.fits);assert.notEqual(row.labelColor,'rgb(185, 28, 28)');assert.equal(row.registrationColor,row.expected.includes('締切済')?'rgb(100, 116, 139)':row.expected.includes('11月14日')?'rgb(15, 23, 42)':'rgb(185, 28, 28)');for(const text of [row.registration,row.abstract]){assert.ok(text.includes(row.expected));assert.ok(!text.includes('年'));assert.ok(!text.includes('日前'));assert.ok(!text.includes('本日締切'));if(row.expected.includes('締切済'))assert.ok(!text.includes('12:00'));}}
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      console.log('PASS '+width+'px: registration/abstract short dates, timed/date-only deadlines, expired date only and no overflow');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
