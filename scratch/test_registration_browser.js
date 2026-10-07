// Optional Edge/Chrome check for multi-stage cards at mobile and desktop widths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browserPath = process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  assert.ok(fs.existsSync(browserPath));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'registration-card-browser-'));
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
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id); clearTimeout(task.timeout);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof createEventCardHtml === "function"')) break;
      await delay(100);
    }
    await evaluate(`
      getTodayString = () => '2026-10-07';
      const fixture = sampleEvents.find(e => e.id === 'conf-jp-jrvs-2026');
      const overseas = { ...fixture, id: 'registration-overseas-test', conferenceRegion: 'international', registration: {
        type: 'international', periods: [{ label: 'Early bird', deadline: '2026-09-30' }, { label: 'Regular', deadline: '2026-10-31' },
          { label: 'Late', start: '2026-11-01', deadline: '2026-11-30' }, { label: 'On-site', start: '2026-12-04', deadline: '2026-12-06' }]
      } };
      elements.eventList.innerHTML = [...sampleEvents, overseas].map(createEventCardHtml).join('');
    `);
    for (const width of [320, 360, 390, 480, 768, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 480 });
      const layout = await evaluate(`(() => {
        const domestic = document.querySelector('[data-id="conf-jp-jrvs-2026"]');
        const international = document.querySelector('[data-id="registration-overseas-test"]');
        const rows = [...domestic.querySelectorAll('.conf-registration-period')];
        return {
          text: rows.map(row => row.textContent),
          overseas: [...international.querySelectorAll('.conf-registration-period')].map(row => row.textContent),
          stageFollows: rows[1].getBoundingClientRect().top >= rows[0].getBoundingClientRect().bottom,
          overflow: [...document.querySelectorAll('.event-card,.conf-registration-list,.conf-registration-period,.conf-registration-period .conf-val')].filter(el => el.scrollWidth > el.clientWidth + 1).length,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          actions: domestic.querySelectorAll('.card-actions-row [data-action],.card-actions-row .btn-official').length,
          titleLinkCorrect: domestic.querySelector('.card-title a').getAttribute('href') === sampleEvents.find(e => e.id === 'conf-jp-jrvs-2026').officialUrl
        };
      })()`);
      assert.deepEqual(layout.text, ['事前参加登録：2026年10月16日まで', '直前・当日登録：2026年11月12日開始']);
      assert.equal(layout.overseas.length, 4);
      assert.ok(layout.overseas[0].includes('締切済'));
      assert.ok(layout.overseas[1].includes('まで'));
      assert.ok(layout.stageFollows);
      assert.equal(layout.overflow, 0, `${width}px card overflow`);
      assert.equal(layout.pageOverflow, false, `${width}px page overflow`);
      assert.equal(layout.actions, 3);
      assert.ok(layout.titleLinkCorrect);
    }
    console.log('PASS: registration cards at 320/360/390/480/768/1280px, both JRVS stages, four overseas stages, no overflow, action buttons and title link');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
