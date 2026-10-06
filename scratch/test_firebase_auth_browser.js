// Optional real-browser layout check; no npm dependencies. Edge/Chrome must be installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browserPath = process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  assert.ok(fs.existsSync(browserPath), 'Set CARD_TEST_BROWSER to an installed Edge/Chrome executable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'conference-card-browser-'));
  const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const activePort = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(activePort); i++) await delay(100);
    assert.ok(fs.existsSync(activePort), 'Browser debugging endpoint did not start');
    const port = fs.readFileSync(activePort, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const task = pending.get(message.id); pending.delete(message.id); clearTimeout(task.timeout);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      if (expression.includes('await ')) expression = `(async () => {${expression}})()`;
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    // Use local markup and scripts without network fonts/GIS delaying page readiness.
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
    await call('Page.setDocumentContent',{frameId:(await call('Page.getFrameTree')).frameTree.frame.id,html});
    await evaluate('document.head.appendChild(document.createElement("style")).textContent='+JSON.stringify(fs.readFileSync(path.join(root,'style.css'),'utf8')));
    for(const file of ['venues.js','companies.js','events.js','google-calendar.js','script.js','firebase-config.js','firebase-auth.js']) {
      let expression = fs.readFileSync(path.join(root,file),'utf8');
      if (file === 'google-calendar.js') expression = expression.replace('root.GoogleCalendar =', 'root.testCalendarFactory = createAdapter; root.GoogleCalendar =');
      const result = await call('Runtime.evaluate', {expression});
      assert.ok(!result.exceptionDetails, file + ': ' + JSON.stringify(result.exceptionDetails));
    }
    await evaluate('initApp();');
    assert.equal(await evaluate('OphthalAuth.snapshot().phase'),'unconfigured');
    assert.equal(await evaluate('document.getElementById("auth-login").disabled'),true);
    await evaluate(`window.mockPersisted=null; window.mockObserver=null; window.mockSDK={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>({}),browserLocalPersistence:'local',setPersistence:async()=>{},onAuthStateChanged:(_,fn)=>{mockObserver=fn;fn(mockPersisted);},GoogleAuthProvider:class {setCustomParameters(){}},signInWithPopup:async()=>{mockPersisted={uid:'cross-device-fixture',displayName:'VeryLongGoogleDisplayName'.repeat(12),email:'fixture@example.org'};mockObserver(mockPersisted);},signOut:async()=>{mockPersisted=null;mockObserver(null);}};`);
    const moduleSource=fs.readFileSync(path.join(root,'firebase-auth.js'),'utf8');
    // Export the factory into the browser test context; production has no SDK injection hook.
    await evaluate(moduleSource.replace('root.OphthalAuth = createController(', 'root.testAuthFactory = createController; root.testAuthMount = mount; root.OphthalAuth = createController('));
    await evaluate(`window.testAuth=testAuthFactory({config:{apiKey:'mock',authDomain:'test.firebaseapp.com',projectId:'test',appId:'mock'},load:async()=>mockSDK}); testAuthMount(testAuth,document); await testAuth.init();`);
    await evaluate(`window.calendarSession=testCalendarFactory({config:{clientId:'mock-calendar'},oauth:()=>({hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'mock-calendar-token',expires_in:3600})})})}); await calendarSession.connect();`);
    for(const width of [1280,1024,980,480,360,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      for(const signedIn of [false,true]) {
        await evaluate(signedIn?'await testAuth.login();':'await testAuth.logout();');
        assert.equal(await evaluate('document.getElementById("auth-login").hidden'),signedIn);
        assert.equal(await evaluate('document.getElementById("auth-logout").hidden'),!signedIn);
        assert.equal(await evaluate('calendarSession.connected()'),true,'Firebase login/logout preserves Calendar OAuth session');
        assert.equal(await evaluate('document.querySelector(".header-container").scrollWidth <= document.querySelector(".header-container").clientWidth+1'),true,'header overflow at '+width);
        assert.equal(await evaluate('document.querySelector(".auth-controls").scrollWidth <= document.querySelector(".auth-controls").clientWidth+1'),true,'auth overflow at '+width);
      }
    }
    await evaluate(`window.restoredAuth=testAuthFactory({config:{apiKey:'mock',authDomain:'test.firebaseapp.com',projectId:'test',appId:'mock'},load:async()=>mockSDK}); await restoredAuth.init();`);
    assert.equal(await evaluate('restoredAuth.getUid()'),'cross-device-fixture');
    assert.equal(await evaluate('GoogleCalendar.connected()'),false);
    assert.equal(await evaluate('document.querySelectorAll(".event-card").length > 0'),true);
    await evaluate('await restoredAuth.logout();');
    assert.equal(await evaluate('restoredAuth.getUid()'),null);
    await evaluate('calendarSession.disconnect();');
    console.log('PASS: Firebase mocked login/restoration/logout, placeholders, independent Calendar, event rendering and header layout at 320-1280px.');
    await call('Browser.close');
  } finally { if(socket) socket.close(); if(browser.exitCode===null) browser.kill(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
