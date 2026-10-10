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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-mobile-check-'));
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

    const results = {};

    for (const width of [1280, 768, 390, 320]) {
      console.log(`\n================ Testing width: ${width}px ================`);
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
      await call('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, maxTouchPoints: 5 });

      // 1. dayGridMonth (月間グリッド)
      await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-04' });
      await delay(800);

      // Add events spanning across multiple days to check event display area
      await evaluate(`(() => {
        const base = state.events[0] || {};
        state.events = [
          { ...base, id: 'ev-apr29', title: '学会イベントA', date: '2027-04-29', endDate: '2027-04-29', isConference: true, conferenceRegion: 'domestic' },
          { ...base, id: 'ev-apr29b', title: '学会イベントB', date: '2027-04-29', endDate: '2027-04-30', isConference: true, conferenceRegion: 'domestic' }
        ];
        renderEvents();
      })()`);
      await delay(300);

      const gridInfo = await evaluate(`(() => {
        const cell = document.querySelector('[data-date="2027-04-29"]');
        if (!cell) return null;
        const numberEl = cell.querySelector('.fc-daygrid-day-number');
        const label = cell.querySelector('.calendar-holiday-name');
        const top = cell.querySelector('.fc-daygrid-day-top');
        const events = cell.querySelector('.fc-daygrid-day-events');
        const frame = cell.querySelector('.fc-daygrid-day-frame');
        const satCell = document.querySelector('[data-date="2027-04-24"] .fc-daygrid-day-number');
        const sunCell = document.querySelector('[data-date="2027-04-25"] .fc-daygrid-day-number');

        return {
          holidayColor: numberEl ? getComputedStyle(numberEl).color : '',
          satColor: satCell ? getComputedStyle(satCell).color : '',
          sunColor: sunCell ? getComputedStyle(sunCell).color : '',
          labelText: label ? label.textContent : null,
          labelDisplay: label ? getComputedStyle(label).display : 'none',
          topHeight: top ? top.getBoundingClientRect().height : 0,
          eventsHeight: events ? events.getBoundingClientRect().height : 0,
          frameHeight: frame ? frame.getBoundingClientRect().height : 0
        };
      })()`);

      console.log(`[${width}px dayGridMonth] 4/29 色: ${gridInfo.holidayColor} (赤系)`);
      console.log(`[${width}px dayGridMonth] 土曜色: ${gridInfo.satColor} (青系)`);
      console.log(`[${width}px dayGridMonth] 日曜色: ${gridInfo.sunColor} (赤系)`);
      console.log(`[${width}px dayGridMonth] 祝日名「${gridInfo.labelText}」 display: ${gridInfo.labelDisplay}`);
      console.log(`[${width}px dayGridMonth] 日付枠(top)高さ: ${gridInfo.topHeight.toFixed(2)}px, 全体枠(frame)高さ: ${gridInfo.frameHeight.toFixed(2)}px`);

      assert.equal(gridInfo.holidayColor, 'rgb(180, 83, 83)', '祝日は赤');
      assert.equal(gridInfo.sunColor, 'rgb(180, 83, 83)', '日曜は赤');
      assert.equal(gridInfo.satColor, 'rgb(2, 132, 199)', '土曜は青');

      if (width <= 600) {
        assert.equal(gridInfo.labelDisplay, 'none', `スマホ幅(${width}px)では祝日名が非表示(display:none)であること`);
      } else {
        assert.notEqual(gridInfo.labelDisplay, 'none', `PC/タブレット幅(${width}px)では祝日名が表示されること`);
      }

      // 2. listMonth (簡易表示)
      await evaluate('document.getElementById("view-compact").click()');
      await delay(400);

      const compactInfo = await evaluate(`(() => {
        const rows = Array.from(document.querySelectorAll('.fc-list-day.calendar-holiday'));
        if (rows.length === 0) return null;
        const targetRow = rows.find(r => r.textContent.includes('4月29日') || r.textContent.includes('昭和の日'));
        if (!targetRow) return null;
        const label = targetRow.querySelector('.calendar-holiday-name');
        const dateSpan = targetRow.querySelector('.compact-date');
        return {
          dateText: dateSpan ? dateSpan.textContent : null,
          labelText: label ? label.textContent : null,
          labelDisplay: label ? getComputedStyle(label).display : 'none',
          dateColor: dateSpan ? getComputedStyle(dateSpan).color : ''
        };
      })()`);

      console.log(`[${width}px listMonth] 簡易表示日付: ${compactInfo?.dateText}, 祝日名: ${compactInfo?.labelText}, display: ${compactInfo?.labelDisplay}`);
      assert.ok(compactInfo, '簡易表示で祝日行が存在すること');
      assert.equal(compactInfo.labelText, '昭和の日', '祝日名テキストが「昭和の日」であること');
      assert.notEqual(compactInfo.labelDisplay, 'none', `簡易表示では(${width}px)でも祝日名が表示されること`);
      assert.equal(compactInfo.dateColor, 'rgb(180, 83, 83)', '簡易表示の祝日日付色は赤');

      results[width] = { grid: gridInfo, compact: compactInfo };
    }

    console.log('\n================ まとめ・余白比較 ================');
    console.log(`PC (1280px): 祝日名表示あり, top高さ = ${results[1280].grid.topHeight.toFixed(2)}px`);
    console.log(`Tablet (768px): 祝日名表示あり, top高さ = ${results[768].grid.topHeight.toFixed(2)}px`);
    console.log(`Mobile (390px): 祝日名非表示 (display: none), top高さ = ${results[390].grid.topHeight.toFixed(2)}px`);
    console.log(`Mobile (320px): 祝日名非表示 (display: none), top高さ = ${results[320].grid.topHeight.toFixed(2)}px`);

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
