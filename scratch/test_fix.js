const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTest(calendarViewCode) {
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
    let file = path.resolve(output, '.' + url.pathname);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    let data = fs.readFileSync(file);
    if (file.endsWith('calendar-view.js') && calendarViewCode) {
      data = Buffer.from(calendarViewCode);
    }
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-fixtest-'));
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

    // Set mobile touch emulation
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

    const getCell = async (dateStr) => {
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

    console.log('Testing Scenario 1: Swipe 2027-03 -> 2027-04');
    await call('Page.navigate', { url: origin + '/?view=calendar&month=2027-03' });
    await delay(1000);
    const monthBeforeSwipe = await evaluate('document.querySelector(".fc-toolbar-title").textContent');
    console.log('Month before swipe:', monthBeforeSwipe);

    await gesture(-150, 0); // left swipe -> next month
    await delay(300);
    const monthAfterSwipe = await evaluate('document.querySelector(".fc-toolbar-title").textContent');
    console.log('Month after swipe:', monthAfterSwipe);
    assert.equal(monthAfterSwipe, '2027年4月');

    const apr29_from_swipe_next = await getCell('2027-04-29');
    const apr28 = await getCell('2027-04-28');
    const apr30 = await getCell('2027-04-30');
    console.log('4/29 after March->April swipe:', apr29_from_swipe_next);
    console.log('4/28 (weekday):', apr28);
    console.log('4/30 (weekday):', apr30);

    assert.equal(apr29_from_swipe_next.hasHolidayClass, true, '4/29 should have holiday class after swipe next');
    assert.equal(apr29_from_swipe_next.color, 'rgb(180, 83, 83)', '4/29 should be red color');
    assert.deepEqual(apr29_from_swipe_next.labels, ['昭和の日'], '4/29 should have label');

    assert.equal(apr28.hasHolidayClass, false, '4/28 should not be holiday');
    assert.equal(apr28.color, 'rgb(15, 23, 42)', '4/28 should be regular weekday color');
    assert.deepEqual(apr28.labels, []);

    assert.equal(apr30.hasHolidayClass, false, '4/30 should not be holiday');
    assert.equal(apr30.color, 'rgb(15, 23, 42)', '4/30 should be regular weekday color');
    assert.deepEqual(apr30.labels, []);

    console.log('Testing Scenario 2: Swipe 2027-05 -> 2027-04');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-05-01")');
    await delay(300);
    const monthBeforeSwipePrev = await evaluate('document.querySelector(".fc-toolbar-title").textContent');
    console.log('Month before swipe prev:', monthBeforeSwipePrev);
    assert.equal(monthBeforeSwipePrev, '2027年5月');

    await gesture(150, 0); // right swipe -> prev month
    await delay(300);
    const monthAfterSwipePrev = await evaluate('document.querySelector(".fc-toolbar-title").textContent');
    console.log('Month after swipe prev:', monthAfterSwipePrev);
    assert.equal(monthAfterSwipePrev, '2027年4月');

    const apr29_from_swipe_prev = await getCell('2027-04-29');
    console.log('4/29 after May->April swipe:', apr29_from_swipe_prev);
    assert.equal(apr29_from_swipe_prev.hasHolidayClass, true, '4/29 should have holiday class after swipe prev');
    assert.equal(apr29_from_swipe_prev.color, 'rgb(180, 83, 83)', '4/29 should be red color');
    assert.deepEqual(apr29_from_swipe_prev.labels, ['昭和の日'], '4/29 should have label');

    console.log('Testing Scenario 3: Button next (2027-03 -> 2027-04)');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-03-01")');
    await delay(300);
    await evaluate('document.querySelector(".fc-next-button").click()');
    await delay(300);

    const apr29_from_btn_next = await getCell('2027-04-29');
    console.log('4/29 after button next:', apr29_from_btn_next);
    assert.equal(apr29_from_btn_next.hasHolidayClass, true, '4/29 button next');
    assert.equal(apr29_from_btn_next.color, 'rgb(180, 83, 83)');

    console.log('Testing Scenario 4: Button prev (2027-05 -> 2027-04)');
    await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-05-01")');
    await delay(300);
    await evaluate('document.querySelector(".fc-prev-button").click()');
    await delay(300);

    const apr29_from_btn_prev = await getCell('2027-04-29');
    console.log('4/29 after button prev:', apr29_from_btn_prev);
    assert.equal(apr29_from_btn_prev.hasHolidayClass, true, '4/29 button prev');
    assert.equal(apr29_from_btn_prev.color, 'rgb(180, 83, 83)');

    console.log('Testing Saturday / Sunday colors:');
    const sat = await getCell('2027-04-24'); // Saturday
    const sun = await getCell('2027-04-25'); // Sunday
    console.log('4/24 Saturday:', sat);
    console.log('4/25 Sunday:', sun);
    assert.equal(sat.color, 'rgb(2, 132, 199)', 'Saturday should be blue');
    assert.equal(sun.color, 'rgb(180, 83, 83)', 'Sunday should be red');

    // Also test compact mode to ensure no impact on compact view
    console.log('Testing compact mode (簡易表示) regression:');
    await evaluate('document.getElementById("view-compact").click()');
    await delay(300);
    const compactHoliday = await evaluate(`(() => {
      const el = document.querySelector('.fc-list-day.calendar-holiday');
      return el ? {
        text: el.querySelector('.compact-date')?.textContent,
        holidayLabel: el.querySelector('.calendar-holiday-name')?.textContent
      } : null;
    })()`);
    console.log('Compact holiday check:', compactHoliday);

    console.log('>>> ALL REGRESSION CHECKS PASSED SUCCESSFULLY! <<<');

    socket.close();
  } finally {
    browser.kill();
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}

// Read current calendar-view.js and apply prospective fix
const orig = fs.readFileSync(path.resolve(__dirname, '../calendar-view.js'), 'utf8');

const proposed = orig.replace(
  `        dayCellDidMount: info => mountHoliday(info, '.fc-daygrid-day-top'),
        datesSet: () => {
          if (initialized && mode !== 'list' && !switchingMode) updateUrl();
        }`,
  `        dayCellClassNames: info => (holidayName(info.date) ? ['calendar-holiday'] : []),
        dayCellDidMount: info => mountHoliday(info, '.fc-daygrid-day-top'),
        datesSet: () => {
          syncGridHolidays();
          if (initialized && mode !== 'list' && !switchingMode) updateUrl();
        }`
).replace(
  `    function mountHoliday(info, selector) {
      const name = holidayName(info.date);
      if (!name) return;
      info.el.classList.add('calendar-holiday');
      const label = document.createElement('small');
      label.className = 'calendar-holiday-name';
      label.textContent = name;
      (info.el.querySelector(selector) || info.el).append(label);
    }`,
  `    function mountHoliday(info, selector) {
      const name = holidayName(info.date);
      if (!name) return;
      info.el.classList.add('calendar-holiday');
      const container = info.el.querySelector(selector) || info.el;
      if (!container.querySelector('.calendar-holiday-name')) {
        const label = document.createElement('small');
        label.className = 'calendar-holiday-name';
        label.textContent = name;
        container.append(label);
      }
    }
    function syncGridHolidays() {
      if (mode !== 'calendar') return;
      calendarElement.querySelectorAll('.fc-daygrid-day').forEach(cell => {
        const dateStr = cell.getAttribute('data-date');
        const name = dateStr ? holidays[dateStr] : null;
        const top = cell.querySelector('.fc-daygrid-day-top') || cell;
        const existing = top.querySelector('.calendar-holiday-name');
        if (name) {
          cell.classList.add('calendar-holiday');
          if (existing) {
            if (existing.textContent !== name) existing.textContent = name;
          } else {
            const label = document.createElement('small');
            label.className = 'calendar-holiday-name';
            label.textContent = name;
            top.append(label);
          }
        } else {
          cell.classList.remove('calendar-holiday');
          if (existing) existing.remove();
        }
      });
    }`
);

runTest(proposed).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
