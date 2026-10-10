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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-verify-'));
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

    // Device emulation: mobile viewport with touch emulation enabled
    await call('Emulation.setDeviceMetricsOverride', { width: 768, height: 900, deviceScaleFactor: 1, mobile: true });
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

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

    const getCellInfo = async (dateStr) => {
      return await evaluate(`(() => {
        const cell = document.querySelector('[data-date="${dateStr}"]');
        if (!cell) return null;
        const numberEl = cell.querySelector('.fc-daygrid-day-number');
        const color = numberEl ? getComputedStyle(numberEl).color : '';
        const hasHolidayClass = cell.classList.contains('calendar-holiday');
        const labels = Array.from(cell.querySelectorAll('.calendar-holiday-name')).map(x => x.textContent);
        const dayOfWeek = new Date('${dateStr}T00:00:00Z').getUTCDay();
        return { date: '${dateStr}', dayOfWeek, color, hasHolidayClass, labels, classes: Array.from(cell.classList) };
      })()`);
    };

    const checkDays = async (context) => {
      const apr29 = await getCellInfo('2027-04-29');
      const apr28 = await getCellInfo('2027-04-28');
      const apr30 = await getCellInfo('2027-04-30');
      const sat = await getCellInfo('2027-04-24');
      const sun = await getCellInfo('2027-04-25');

      console.log(`[${context}] 4/29 (昭和の日):`, apr29.color, 'holidayClass:', apr29.hasHolidayClass, 'labels:', apr29.labels);
      console.log(`[${context}] 4/28 (平日):`, apr28.color, 'holidayClass:', apr28.hasHolidayClass, 'labels:', apr28.labels);
      console.log(`[${context}] 4/30 (平日):`, apr30.color, 'holidayClass:', apr30.hasHolidayClass, 'labels:', apr30.labels);
      console.log(`[${context}] 4/24 (土曜):`, sat.color, 'classes:', sat.classes.filter(c => c.startsWith('fc-day-')));
      console.log(`[${context}] 4/25 (日曜):`, sun.color, 'classes:', sun.classes.filter(c => c.startsWith('fc-day-')));

      // Requirement 1 & 2: 4/29 is always red holiday regardless of direction
      assert.equal(apr29.hasHolidayClass, true, `${context}: 4/29 must have calendar-holiday class`);
      assert.equal(apr29.color, 'rgb(180, 83, 83)', `${context}: 4/29 must be red`);
      assert.deepEqual(apr29.labels, ['昭和の日'], `${context}: 4/29 must have single 昭和の日 label`);

      // Requirement 3 & 5: Weekdays are normal, Saturday is blue, Sunday is red, no stale holiday class
      assert.equal(apr28.hasHolidayClass, false, `${context}: 4/28 must NOT have holiday class`);
      assert.equal(apr28.color, 'rgb(15, 23, 42)', `${context}: 4/28 must be regular color`);
      assert.deepEqual(apr28.labels, [], `${context}: 4/28 must have no holiday labels`);

      assert.equal(apr30.hasHolidayClass, false, `${context}: 4/30 must NOT have holiday class`);
      assert.equal(apr30.color, 'rgb(15, 23, 42)', `${context}: 4/30 must be regular color`);
      assert.deepEqual(apr30.labels, [], `${context}: 4/30 must have no holiday labels`);

      assert.equal(sat.color, 'rgb(2, 132, 199)', `${context}: Saturday must be blue`);
      assert.equal(sun.color, 'rgb(180, 83, 83)', `${context}: Sunday must be red`);
    };

    // Test 1: Swipe from March (2027-03 -> 2027-04)
    console.log('\n=== TEST 1: Swipe 2027-03 -> 2027-04 (翌月スワイプ) ===');
    await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-03' });
    await delay(1000);
    await gesture(-150, 0); // left swipe -> next
    assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
    await checkDays('Swipe March->April');

    // Test 2: Swipe from May (2027-05 -> 2027-04)
    console.log('\n=== TEST 2: Swipe 2027-05 -> 2027-04 (前月スワイプ) ===');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-05-01")');
    await delay(300);
    assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年5月');
    await gesture(150, 0); // right swipe -> prev
    assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
    await checkDays('Swipe May->April');

    // Test 3: Button next (2027-03 -> 2027-04)
    console.log('\n=== TEST 3: Button Next 2027-03 -> 2027-04 (翌月ボタン) ===');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-03-01")');
    await delay(300);
    await evaluate('document.querySelector(".fc-next-button").click()');
    await delay(300);
    assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
    await checkDays('Button Next 2027-03->04');

    // Test 4: Button prev (2027-05 -> 2027-04)
    console.log('\n=== TEST 4: Button Prev 2027-05 -> 2027-04 (前月ボタン) ===');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-05-01")');
    await delay(300);
    await evaluate('document.querySelector(".fc-prev-button").click()');
    await delay(300);
    assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年4月');
    await checkDays('Button Prev 2027-05->04');

    // Test 5: Verify compact mode (簡易表示) is unaffected
    console.log('\n=== TEST 5: Verify compact mode (簡易表示) is unaffected ===');
    await evaluate('document.getElementById("view-compact").click()');
    await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'compact');
    const compactCheck = await evaluate(`(() => {
      const dates = Array.from(document.querySelectorAll('.fc-list-day')).map(el => {
        const text = el.querySelector('.compact-date')?.textContent || '';
        const holiday = el.querySelector('.calendar-holiday-name')?.textContent || '';
        return { text, holiday, isHoliday: el.classList.contains('calendar-holiday') };
      });
      return dates;
    })()`);
    console.log('Compact mode sample entries count:', compactCheck.length);

    console.log('\n========================================');
    console.log('>>> ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! <<<');
    console.log('========================================');

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
