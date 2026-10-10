const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    let file = path.resolve(output, '.' + new URL(req.url, 'http://test').pathname);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    let data = fs.readFileSync(file);
    const bootstrap = `
      window.dualApiCalls = [];
      window.dualFirebaseSDK = {
        getApps:()=>[{name:'ophthalconf-auth'}], initializeApp:(config,name)=>({name}), getAuth:()=>({}),
        browserLocalPersistence:'local', setPersistence:async()=>{},
        onAuthStateChanged:(auth,fn)=>{fn(null);},
        GoogleAuthProvider:class{}, signInWithPopup:async()=>{}, signOut:async()=>{}
      };
      window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:()=>({})}}};
    `;
    if (file.endsWith('index.html')) {
      data = Buffer.from(data.toString().replace(/<link[^>]*https:[^>]*>/g, '')
        .replace(/<script[^>]*src="https:[^>]*><\/script>/g, '').replace('<head>', '<head><script>' + bootstrap + '</script>'));
    }
    const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    res.setHeader('Content-Type', type + '; charset=utf-8'); res.end(data);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-ss-check-'));
  const browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id); if (!task) return;
      pending.delete(result.id); clearTimeout(task.timer); result.error ? task.reject(result.error) : task.resolve(result.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout')), 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };

    const gesture = async (dx, dy) => {
      await evaluate('document.querySelector(".fc-view-harness").scrollIntoView({block:"center"})');
      const point = await evaluate(`(() => {
        const r = document.querySelector('.fc-view-harness').getBoundingClientRect();
        return { x: ${dx < 0 ? 'r.right - 50' : 'r.left + 50'}, y: r.top + r.height / 2 };
      })()`);
      const touchId = 1;
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: touchId }] });
      for (const fraction of [0.25, 0.5, 0.75, 1]) {
        await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * fraction, y: point.y + dy * fraction, id: touchId }] });
        await delay(30);
      }
      await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await delay(400);
    };

    for (const width of [1280, 768, 390, 320]) {
      console.log(`Checking navigation controls at ${width}px...`);
      await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width <= 768 });
      await call('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, maxTouchPoints: 5 });
      await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-04' });
      await delay(800);

      if (width <= 768) {
        // Swipe next
        await gesture(-120, 0);
        assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年5月');
        // Swipe prev
        await gesture(120, 0);
        assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
      }

      // Button next
      await evaluate('document.querySelector(".fc-next-button").click()');
      assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年5月');
      // Button prev
      await evaluate('document.querySelector(".fc-prev-button").click()');
      assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
      // Button today
      await evaluate('document.querySelector(".fc-today-button").click()');
      assert.ok(await evaluate('document.querySelector(".fc-toolbar-title").textContent.includes("2026年")'));
    }

    console.log('ALL NAV CONTROLS INCLUDING 320PX SWIPE VERIFIED!');
    socket.close();
  } finally {
    browser.kill();
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
