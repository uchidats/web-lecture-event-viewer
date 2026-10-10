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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-ss-after-'));
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
        return { x: r.left + r.width * ${dx < 0 ? 0.8 : 0.2}, y: r.top + 70 };
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
      await call('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width <= 768 });
      await call('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, maxTouchPoints: 5 });

      await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-04' });
      await delay(800);

      // Add:
      // 1. Weekend conference (Sat-Sun: 2027-04-24 to 2027-04-25)
      // 2. Cross-month conference (2027-04-30 to 2027-05-02)
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
      console.log(`[after ${width}px] Headers:`, headerText);
      assert.equal(headerText, '月 火 水 木 金 土 日', 'Header order must be Mon Tue Wed Thu Fri Sat Sun');

      // Check Saturday and Sunday positions:
      // In Monday-first: Saturday is column 6 (index 5), Sunday is column 7 (index 6, rightmost column)
      const colIndices = await evaluate(`(() => {
        const satHeader = document.querySelector('.fc-col-header-cell.fc-day-sat');
        const sunHeader = document.querySelector('.fc-col-header-cell.fc-day-sun');
        const allHeaders = Array.from(document.querySelectorAll('.fc-col-header-cell'));
        return {
          satIndex: allHeaders.indexOf(satHeader),
          sunIndex: allHeaders.indexOf(sunHeader),
          satColor: getComputedStyle(satHeader.querySelector('.fc-col-header-cell-cushion')).color,
          sunColor: getComputedStyle(sunHeader.querySelector('.fc-col-header-cell-cushion')).color
        };
      })()`);
      console.log(`[after ${width}px] Saturday col index: ${colIndices.satIndex} (color: ${colIndices.satColor}), Sunday col index: ${colIndices.sunIndex} (color: ${colIndices.sunColor})`);
      assert.equal(colIndices.satIndex, 5, 'Saturday must be 6th column (index 5)');
      assert.equal(colIndices.sunIndex, 6, 'Sunday must be 7th column (index 6)');
      assert.equal(colIndices.satColor, 'rgb(2, 132, 199)', 'Saturday header must be blue');
      assert.equal(colIndices.sunColor, 'rgb(180, 83, 83)', 'Sunday header must be red');

      // Check that 4/24(Sat) and 4/25(Sun) event is rendered continuously on the right side of the row
      const weekendEventSegments = await evaluate(`(() => {
        const segs = Array.from(document.querySelectorAll('.fc-event[data-event-id="conf-weekend"]'));
        return segs.map(el => {
          const rect = el.getBoundingClientRect();
          const harness = el.closest('tr');
          return { left: rect.left, right: rect.right, width: rect.width };
        });
      })()`);
      console.log(`[after ${width}px] Weekend event segments count: ${weekendEventSegments.length} (In Monday-first, Sat-Sun is in the same row, so 1 continuous segment!)`);
      assert.equal(weekendEventSegments.length, 1, 'Sat-Sun event must be 1 continuous segment in the same week row!');

      // Check cross-month event
      const crossMonthEvent = await evaluate(`(() => {
        const segs = Array.from(document.querySelectorAll('.fc-event[data-event-id="conf-cross-month"]'));
        return segs.length;
      })()`);
      console.log(`[after ${width}px] Cross-month event rendered successfully: ${crossMonthEvent > 0}`);
      assert.ok(crossMonthEvent > 0, 'Cross-month event must be rendered');

      // Check 4/29 Showa Day column position
      const apr29Pos = await evaluate(`(() => {
        const cell = document.querySelector('[data-date="2027-04-29"]');
        const row = cell.closest('tr');
        const cells = Array.from(row.querySelectorAll('.fc-daygrid-day'));
        const numberEl = cell.querySelector('.fc-daygrid-day-number');
        return {
          colIndex: cells.indexOf(cell),
          color: getComputedStyle(numberEl).color,
          hasHolidayClass: cell.classList.contains('calendar-holiday'),
          isThursday: cell.classList.contains('fc-day-thu')
        };
      })()`);
      console.log(`[after ${width}px] 4/29 (木) colIndex: ${apr29Pos.colIndex} (Thursday is col 4, index 3), color: ${apr29Pos.color}`);
      assert.equal(apr29Pos.colIndex, 3, '2027-04-29 Thursday must be 4th column (index 3)');
      assert.equal(apr29Pos.isThursday, true);
      assert.equal(apr29Pos.hasHolidayClass, true);
      assert.equal(apr29Pos.color, 'rgb(180, 83, 83)');

      // Capture screenshot
      const ss = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const filename = path.join(artifactDir, `after-${width}.png`);
      fs.writeFileSync(filename, Buffer.from(ss.data, 'base64'));
      console.log(`Saved screenshot: ${filename}`);

      // Test navigation controls (prev, next, today, swipe)
      if (width <= 768) {
        // Swipe next
        await gesture(-150, 0);
        assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年5月');
        // Swipe prev
        await gesture(150, 0);
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

    console.log('\n>>> ALL MONDAY-FIRST VERIFICATIONS PASSED SUCCESSFULLY! <<<');
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
