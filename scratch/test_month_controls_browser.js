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
    const output=path.join(root,'scratch','month-controls-review');fs.mkdirSync(output,{recursive:true});
    const results=[];
    const measure=()=>evaluate(`(()=>{const toolbar=document.querySelector('.fc-header-toolbar').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,toolbar:{x:toolbar.x,y:toolbar.y,width:toolbar.width},buttons:['prev','today','next'].map(name=>{const b=document.querySelector('.fc-'+name+'-button'),r=b.getBoundingClientRect(),s=getComputedStyle(b);return {name,x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color,border:s.borderLeftColor,text:b.textContent,outline:s.outlineStyle,opacity:s.opacity,overflow:b.scrollWidth>b.clientWidth}})}})()`);
    for(const width of [320,390,768,1280]) for(const view of ['calendar','compact']) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
      await call('Page.navigate',{url:origin+'/?view='+view+'&month=2027-07'});
      for(let i=0;i<100 && !await evaluate('!!document.querySelector(".fc-toolbar-title")');i++)await delay(100);
      await delay(300);
      if(width<600) await evaluate('window.scrollTo(0,Math.max(0,document.querySelector(".fc-header-toolbar").getBoundingClientRect().top+scrollY-52))');
      await delay(300);
      const normal=await measure();assert.equal(normal.overflow,false);
      for(const b of normal.buttons){assert.equal(b.overflow,false);assert.ok(b.x>=0&&b.x+b.width<=width);assert.equal(b.border,'rgb(2, 132, 199)');assert.equal(b.background,b.name==='today'?'rgb(2, 132, 199)':'rgb(255, 255, 255)');assert.equal(b.color,b.name==='today'?'rgb(255, 255, 255)':'rgb(2, 132, 199)');}
      for(let i=1;i<3;i++)assert.ok(Math.abs(normal.buttons[i].x-(normal.buttons[i-1].x+normal.buttons[i-1].width))<=1,'connected segments');
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:width-2,y:850});
      let shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`${width}-${view}.png`),Buffer.from(shot.data,'base64'));
      const prev=normal.buttons[0],x=prev.x+prev.width/2,y=prev.y+prev.height/2;
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});const hover=await measure();assert.equal(hover.buttons[0].background,'rgb(240, 249, 255)');
      await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});const active=await measure();assert.equal(active.buttons[0].background,'rgb(224, 242, 254)');
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});assert.ok(await evaluate('location.search.includes("month=2027-06")'));
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:width-2,y:850});
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await evaluate('document.querySelector(".fc-prev-button").focus()');assert.equal((await measure()).buttons[0].outline,'solid');
      if(width===390&&view==='calendar'){shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'390-calendar-focus.png'),Buffer.from(shot.data,'base64'));}
      await evaluate('document.querySelector(".fc-today-button").click()');assert.equal(await evaluate('document.querySelector(".fc-today-button").disabled'),true);const today=await measure();assert.equal(today.buttons[1].opacity,'1');assert.equal(today.buttons[1].background,'rgb(2, 132, 199)');
      results.push({width,view,normal});console.log('PASS '+width+' '+view);
    }
    fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(results,null,2));console.log(output);
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
