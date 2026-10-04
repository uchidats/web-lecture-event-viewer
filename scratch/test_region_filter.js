// Optional real-browser layout check; no npm dependencies. Edge/Chrome must be installed.
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
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await call('Page.enable');
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof createEventCardHtml === "function"')) break;
      await delay(100);
    }
    assert.equal(await evaluate('typeof state === "object" && !!document.querySelector("#filter-region input")'), true, 'App initialized');

    const result = await evaluate(`(() => {
      const domestic = document.querySelector('.group-select-domestic');
      const all = document.querySelector('.group-select-all[data-target="region"]');
      const selected = () => [...state.filters.region];
      const otherBefore = JSON.stringify([...state.filters.abstractStatus]);
      all.click();
      const allRegions = selected();
      domestic.click();
      const domesticRegions = selected();
      domestic.click();
      const repeated = selected();
      const foreign = document.querySelector('#filter-region input[value="海外"]');
      foreign.click();
      const individual = selected();
      domestic.click();
      const specialty = document.querySelector('#filter-specialty input');
      specialty.click();
      const filtered = getFilteredEvents();
      const andMatches = filtered.every(e => e.region !== '海外' && e.specialty === specialty.value);
      const hasResults = filtered.length > 0;
      const otherAfter = JSON.stringify([...state.filters.abstractStatus]);
      all.click();
      const allAfterDomestic = selected();
      all.click();
      const cleared = selected();
      return {allRegions, domesticRegions, repeated, individual, andMatches, hasResults, otherBefore, otherAfter, allAfterDomestic, cleared};
    })()`);
    const expected = ['全国Web', '北海道', '東北', '関東', '中部', '関西', '中国', '四国', '九州・沖縄'];
    assert.deepEqual(result.domesticRegions, expected);
    assert.deepEqual(result.repeated, expected);
    assert.deepEqual(result.allRegions, [...expected, '海外']);
    assert.deepEqual(result.allAfterDomestic, [...expected, '海外']);
    assert.ok(result.individual.includes('海外'));
    assert.equal(result.andMatches, true);
    assert.equal(result.hasResults, true);
    assert.equal(result.otherBefore, result.otherAfter);
    assert.deepEqual(result.cleared, []);
    for (const width of [320, 360, 390, 480, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      const layout = await evaluate(`(() => {
        document.getElementById('filter-sidebar').classList.add('open');
        const actions = document.querySelector('.region-select-actions');
        const header = actions.parentElement;
        const label = header.querySelector('h3').getBoundingClientRect();
        const a = actions.getBoundingClientRect();
        const h = header.getBoundingClientRect();
        return { noOverflow: actions.scrollWidth <= actions.clientWidth + 1, fits: a.right <= h.right + 1 && a.left >= label.right, sameRow: Math.abs(actions.children[0].getBoundingClientRect().top - actions.children[1].getBoundingClientRect().top) < 10 };
      })()`);
      assert.equal(layout.noOverflow, true, width + 'px overflow');
      assert.equal(layout.fits, true, width + 'px header fit');
      assert.equal(layout.sameRow, true, width + 'px actions row');
    }
    console.log('PASS: domestic selection, overseas exclusion, repeat clicks, all toggle, individual selection, AND filters, headers at 320/360/390/480/1280px');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
