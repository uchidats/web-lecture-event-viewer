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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-compare-'));
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

    for (const width of [390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: true });
      await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

      await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-04' });
      await delay(800);

      // Measure with holiday label hidden (current state with fix)
      const hiddenStats = await evaluate(`(() => {
        const cell = document.querySelector('[data-date="2027-04-29"]');
        const top = cell.querySelector('.fc-daygrid-day-top');
        const events = cell.querySelector('.fc-daygrid-day-events');
        const label = cell.querySelector('.calendar-holiday-name');
        return {
          cellWidth: cell.getBoundingClientRect().width,
          topHeight: top.getBoundingClientRect().height,
          eventsHeight: events.getBoundingClientRect().height,
          labelDisplay: getComputedStyle(label).display
        };
      })()`);

      // Temporarily toggle display: block to simulate before fix
      const visibleStats = await evaluate(`(() => {
        const cell = document.querySelector('[data-date="2027-04-29"]');
        const label = cell.querySelector('.calendar-holiday-name');
        label.style.display = 'block';
        const top = cell.querySelector('.fc-daygrid-day-top');
        const events = cell.querySelector('.fc-daygrid-day-events');
        const res = {
          topHeight: top.getBoundingClientRect().height,
          eventsHeight: events.getBoundingClientRect().height,
          labelLines: label.getClientRects().length,
          labelHeight: label.getBoundingClientRect().height
        };
        label.style.display = ''; // revert
        return res;
      })()`);

      console.log(`\n【${width}px セル幅 ${hiddenStats.cellWidth.toFixed(1)}px の比較】`);
      console.log(`  祝日名表示時 (修正前): top枠の高さ = ${visibleStats.topHeight.toFixed(1)}px (祝日名ラベル高さ: ${visibleStats.labelHeight.toFixed(1)}px)`);
      console.log(`  祝日名非表示 (修正後): top枠の高さ = ${hiddenStats.topHeight.toFixed(1)}px`);
      console.log(`  改善効果: 日付ヘッダーの専有高さが ${(visibleStats.topHeight - hiddenStats.topHeight).toFixed(1)}px 削減され、イベント表示領域の余白が拡大！`);
    }

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
