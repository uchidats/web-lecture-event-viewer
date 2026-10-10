const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const artifactDir = 'C:\\Users\\uchid\\.gemini\\antigravity\\brain\\56120c00-6ae8-470b-9b84-7d0b83b643cc';

async function captureScreenshots(prefix) {
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
    let file = path.resolve(output, '.' + url.pathname);
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-ss-'));
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

    for (const width of [1280, 768, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width <= 768 });
      await call('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, maxTouchPoints: 5 });

      await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-04' });
      await delay(800);

      // Add a weekend conference (Sat-Sun: 2027-04-24 to 2027-04-25) and a cross-month conference (2027-04-30 to 2027-05-02)
      await evaluate(`(() => {
        const base = state.events[0] || {};
        state.events = [
          { ...base, id: 'conf-weekend', title: '第35回 週末眼科学会', date: '2027-04-24', endDate: '2027-04-25', isConference: true, conferenceRegion: 'domestic' },
          { ...base, id: 'conf-cross-month', title: '第50回 月跨ぎ網膜シンポジウム', date: '2027-04-30', endDate: '2027-05-02', isConference: true, conferenceRegion: 'international' }
        ];
        renderEvents();
      })()`);
      await delay(400);

      const headerText = await evaluate('Array.from(document.querySelectorAll(".fc-col-header-cell")).map(el => el.textContent.trim()).join(" ")');
      console.log(`[${prefix} ${width}px] Headers:`, headerText);

      const ss = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const filename = path.join(artifactDir, `${prefix}-${width}.png`);
      fs.writeFileSync(filename, Buffer.from(ss.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);
    }

    socket.close();
  } finally {
    browser.kill();
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

captureScreenshots('before').catch(console.error);
