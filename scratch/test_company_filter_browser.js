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
      const container = document.getElementById('filter-company');
      const options = [...container.querySelectorAll('input')].map(input => ({id: input.value, label: input.parentElement.textContent.trim()}));
      const sections = [...container.closest('aside').querySelectorAll('.filter-group')];
      const position = sections.indexOf(container.closest('section'));
      const order = sections[position - 1].querySelector('#filter-region') !== null && sections[position + 1].querySelector('#filter-scheduleStatus') !== null;
      const santen = container.querySelector('input[value="santen"]');
      santen.click();
      const parentFound = getFilteredEvents().some(e => e.id === 'oph-001');
      const seminarHidden = !getFilteredEvents().some(e => e.id === 'oph-001-s2');
      const activeLabel = elements.activeFilterChips.textContent.includes(COMPANY_MASTER.find(c => c.id === 'santen').shortName);
      const remove = elements.activeFilterChips.querySelector('[data-group="company"]');
      remove.click();
      const removed = state.filters.company.size === 0 && !santen.checked;
      santen.click(); container.querySelector('input[value="novartis"]').click();
      const multiple = state.filters.company.size === 2;
      state.attendingConferences.add('oph-001'); renderEvents();
      const seminarVisible = getFilteredEvents().some(e => e.id === 'oph-001-s2');
      elements.resetFilterBtn.click();
      const reset = state.filters.company.size === 0 && [...container.querySelectorAll('input')].every(input => !input.checked);
      return {options, order, parentFound, seminarHidden, activeLabel, removed, multiple, seminarVisible, reset};
    })()`);
    assert.deepEqual(result.options.map(o => o.id), ['santen', 'novartis']);
    for (const option of result.options) assert.ok(option.label.includes('(1)'));
    for (const key of ['order', 'parentFound', 'seminarHidden', 'activeLabel', 'removed', 'multiple', 'seminarVisible', 'reset']) assert.equal(result[key], true, key);
    for (const width of [320, 360, 390, 480, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: width < 500});
      const layout = await evaluate(`(() => {
        document.getElementById('filter-sidebar').classList.add('open');
        const grid = document.getElementById('filter-company');
        const rect = grid.getBoundingClientRect();
        return {visible: rect.width > 0, fits: grid.scrollWidth <= grid.clientWidth + 1 && [...grid.querySelectorAll('.chip-btn')].every(chip => {const r = chip.getBoundingClientRect(); return r.left >= rect.left - 1 && r.right <= rect.right + 1;}), pageFits: document.documentElement.scrollWidth <= innerWidth + 1};
      })()`);
      assert.equal(layout.visible, true, width + 'px visible');
      assert.equal(layout.fits, true, width + 'px company chips fit');
      assert.equal(layout.pageFits, true, width + 'px page fit');
    }
    await evaluate(`state.events = []; renderFilterOptions();`);
    assert.equal(await evaluate('document.querySelectorAll("#filter-company input").length'), 0);
    assert.equal(await evaluate('!!document.querySelector("#filter-company .company-filter-empty")'), true);
    console.log('PASS: company options/counts, section order, parent/attendance gates, OR selection, active-chip removal, reset, empty data, 320/360/390/480/1280px');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
