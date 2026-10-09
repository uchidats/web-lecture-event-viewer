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
    const baselineRef = process.env.HEADER_TEST_BASE_REF || '4128960';
    const baseline = spawnSync('git', ['show', `${baselineRef}:style.css`], {cwd:root,encoding:'utf8'});
    assert.equal(baseline.status,0);
    const current = fs.readFileSync(path.join(root,'style.css'),'utf8');
    await navigate('/?view=list');
    await evaluate('document.getElementById("auth-login").click()');
    for(let i=0;i<50 && !await evaluate('!!OphthalAuth.snapshot().user && !document.getElementById("review-entry").hidden');i++) await delay(100);
    await delay(300);
    await evaluate(`document.getElementById('review-entry').textContent='更新確認 134件';document.querySelector('link[href="style.css"]').disabled=true;window.headerLayoutStyle=document.createElement('style');document.head.append(headerLayoutStyle);`);
    await evaluate(`const stableStyle=document.createElement('style');stableStyle.textContent='.app-header * {transition:none !important;}';document.head.append(stableStyle);`);
    const output = fs.mkdtempSync(path.join(os.tmpdir(),'ophthalconf-header-review-'));
    const measure = () => evaluate(`(() => {
      const selectors=['.brand','.auth-controls','#review-entry','#calendar-settings-btn','#toggle-registered-filter','#conference-history-btn','#mobile-filter-btn'];
      const items=Object.fromEntries(selectors.map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height,visible:r.width>0&&r.height>0}];}));
      const header=document.querySelector('.app-header');
      return {width:header.clientWidth,height:header.getBoundingClientRect().height,overflow:header.scrollWidth>header.clientWidth+1,items};
    })()`);
    const screenshot = async (width,label,height) => {
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(height+180),scale:1}});
      fs.writeFileSync(path.join(output,`header-${width}-${label}.png`),Buffer.from(shot.data,'base64'));
    };
    const results=[];
    for(const width of [1280,1024,900,768,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      await evaluate(`headerLayoutStyle.textContent=${JSON.stringify(baseline.stdout)}`);await delay(300);
      const before=await measure();
      if(width===1024) await screenshot(width,'before',before.height);
      await evaluate(`headerLayoutStyle.textContent=${JSON.stringify(current)}`);await delay(300);
      const after=await measure();
      if(width===1280||width<=480) assert.deepEqual(after,before,width+'px existing layout stays identical');
      else {
        assert.equal(after.overflow,false,width+'px header overflow');
        assert.ok(after.height<before.height,width+'px header height reduced');
        assert.ok(after.height<=180,width+'px compact header height');
        const boxes=after.items;
        assert.ok(boxes['.brand'].y<boxes['#review-entry'].y);
        assert.ok(boxes['.auth-controls'].y+boxes['.auth-controls'].height<=boxes['#review-entry'].y+1);
        const tools=['#review-entry','#calendar-settings-btn','#toggle-registered-filter','#conference-history-btn'].map(s=>boxes[s]);
        assert.ok(Math.max(...tools.map(b=>b.y))-Math.min(...tools.map(b=>b.y))<=2,width+'px compact action row');
        assert.ok(boxes['#review-entry'].width<160,'Review count is a compact status');
        if(width<=980) assert.ok(boxes['#mobile-filter-btn'].width>=after.width-34,'Full width filter button');
        for(const box of Object.values(boxes).filter(b=>b.visible)) assert.ok(box.x>=0&&box.x+box.width<=width+1,width+'px item fits');
      }
      await screenshot(width,'after',after.height);
      results.push({width,before:before.height,after:after.height,reduction:before.height-after.height});
      console.log('PASS: '+width+'px '+JSON.stringify(results.at(-1)));
    }
    // The drawer is still operated by its original handler at tablet widths.
    await call('Emulation.setDeviceMetricsOverride',{width:900,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate('document.getElementById("mobile-filter-btn").click()');
    assert.ok(await evaluate('document.getElementById("filter-sidebar").classList.contains("open")'));
    await evaluate('document.getElementById("close-mobile-filter").click()');
    await evaluate('document.getElementById("calendar-settings-btn").click()');
    assert.ok(await evaluate('elements.calendarSettingsModal.open'));
    await evaluate('elements.calendarSettingsModal.close()');
    await evaluate('document.getElementById("conference-history-btn").click()');
    assert.ok(await evaluate('elements.conferenceHistoryModal.open'));
    await evaluate('elements.conferenceHistoryModal.close()');
    await evaluate('document.getElementById("review-entry").click()');
    assert.ok(await evaluate('document.getElementById("review-dialog").open'));
    await evaluate('document.getElementById("review-dialog").close()');
    await evaluate('document.getElementById("auth-logout").click()');
    for(let i=0;i<30 && await evaluate('!!OphthalAuth.snapshot().user');i++) await delay(100);
    assert.equal(await evaluate('document.getElementById("auth-login").hidden'),false);
    for(const width of [1024,900,768]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      const publicHeader=await measure();assert.equal(publicHeader.overflow,false);assert.ok(publicHeader.height<=180);
    }
    fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(results,null,2));
    console.log('PASS: unchanged 1280/390/320 layouts, compact intermediate header, login/logout and original drawer/settings/history/review handlers; '+output);
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
