const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bootstrap = `
  window.dualApiCalls = [];
  window.dualFirebaseSDK = {
    getApps:()=>[{name:'ophthalconf-auth'}], initializeApp:(config,name)=>({name}), getAuth:()=>({}),
    browserLocalPersistence:'local', setPersistence:async()=>{},
    onAuthStateChanged:(auth,fn)=>{window.dualAuthObserver=fn;fn(null);},
    GoogleAuthProvider:class{},
    signInWithPopup:async()=>{}, signOut:async()=>{}
  };
  window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:()=>({})}}};
`;

async function main() {
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
    let file = path.resolve(output, '.' + url.pathname);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    let data = fs.readFileSync(file);
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-repro-'));
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

    await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-03' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && !!window.FullCalendar && !!OphthalCalendarView.getCalendar()')) break;
      await delay(100);
    }

    // Instrument dayCellDidMount or examine DOM
    const inspectAllCells = async (title) => {
      const cells = await evaluate(`(() => {
        return Array.from(document.querySelectorAll('.fc-daygrid-day')).map((el, i) => {
          const date = el.getAttribute('data-date');
          const numberEl = el.querySelector('.fc-daygrid-day-number');
          const labels = Array.from(el.querySelectorAll('.calendar-holiday-name')).map(l => l.textContent);
          const color = numberEl ? getComputedStyle(numberEl).color : null;
          return {
            index: i,
            date,
            classes: Array.from(el.classList).filter(c => !c.startsWith('fc-day-20')),
            color,
            labels
          };
        });
      })()`);
      console.log('=== ' + title + ' ===');
      cells.filter(c => c.labels.length > 0 || c.classes.includes('calendar-holiday') || c.date === '2027-04-29').forEach(c => {
        console.log(JSON.stringify(c));
      });
    };

    await inspectAllCells('March initial');

    await evaluate('OphthalCalendarView.getCalendar().next()');
    await delay(300);
    await inspectAllCells('April after next() from March');

    await evaluate('OphthalCalendarView.getCalendar().next()');
    await delay(300);
    await inspectAllCells('May after next() from April');

    await evaluate('OphthalCalendarView.getCalendar().prev()');
    await delay(300);
    await inspectAllCells('April after prev() from May');

    socket.close();
  } finally {
    browser.kill();
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

main().catch(err => { console.error(err); process.exit(1); });
