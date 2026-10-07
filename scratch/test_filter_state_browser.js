// Optional Edge/Chrome check for filter changes, reload restoration and reset.
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-state-browser-'));
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
    // Exercise the application's actual listeners; keep URL parameters through reloads.
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href + '?adminReview=1&keep=value#filters' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof saveFilterState === "function"')) break;
      await delay(100);
    }
    await evaluate(`
      localStorage.removeItem(FILTER_STATE_KEY);
      document.getElementById('reset-filter-btn').click();
      localStorage.setItem(ATTENDING_CONFERENCES_KEY, JSON.stringify(['oph-001']));
      localStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify({calendarProvider: 'icloud', defaultCalendar: 'icloud'}));
      const checkbox = (name, value) => document.querySelector('input[name="' + name + '"][value="' + value + '"]');
      for (const [name, value] of [['region','関東'], ['specialty','緑内障'], ['year','2027'], ['eventType','国内学会'], ['format','現地'], ['abstractStatus','open']]) checkbox(name, value).click();
      document.getElementById('filter-include-ended').click();
      document.getElementById('toggle-registered-filter').click();
      elements.sortSelect.value = 'title-asc';
      elements.sortSelect.dispatchEvent(new Event('change', {bubbles: true}));
    `);
    const before = await evaluate('({saved: localStorage.getItem(FILTER_STATE_KEY), url: location.href, attending: localStorage.getItem(ATTENDING_CONFERENCES_KEY), calendar: localStorage.getItem(CALENDAR_SETTINGS_KEY)})');
    const selection = JSON.parse(before.saved);
    assert.deepEqual(selection.filters.region, ['関東']);
    assert.equal(selection.filters.includeEndedConferences, true);
    assert.equal(selection.filters.registeredOnly, true);
    assert.equal(selection.sortBy, 'title-asc');
    const reload = async () => {
      // Navigate to the same URL to ensure a fresh document, even if cached.
      await call('Page.navigate', { url: 'about:blank' });
      await call('Page.navigate', { url: before.url });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('document.readyState === "complete" && typeof saveFilterState === "function"')) return;
        await delay(100);
      }
      throw new Error('App did not initialize');
    };
    await reload();
    const restored = await evaluate(`(() => ({
      saved: localStorage.getItem(FILTER_STATE_KEY), url: location.href,
      checked: ['region','specialty','year','eventType','format','abstractStatus'].map(name => [...document.querySelectorAll('input[name="' + name + '"]:checked')].map(cb => cb.value)),
      sort: elements.sortSelect.value, ended: elements.filterIncludeEnded.checked,
      registered: elements.toggleRegisteredFilter.classList.contains('active'),
      badge: elements.registeredOnlyBadge.style.display,
      attending: state.attendingConferences.has('oph-001'), provider: state.calendarSettings.calendarProvider
    }))()`);
    assert.equal(restored.saved, before.saved);
    assert.equal(restored.url, before.url);
    assert.deepEqual(restored.checked, [['関東'], ['緑内障'], ['2027'], ['国内学会'], ['現地'], ['open']]);
    assert.equal(restored.sort, 'title-asc');
    assert.equal(restored.ended, true);
    assert.equal(restored.registered, true);
    assert.equal(restored.badge, 'inline-flex');
    assert.equal(restored.attending, true);
    assert.equal(restored.provider, 'icloud');

    const handlers = await evaluate(`(() => {
      document.querySelector('.badge-remove[data-group="region"]').click();
      const chipRemoved = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.region.length === 0;
      document.querySelector('.group-select-domestic').click();
      const domestic = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.region;
      document.querySelector('.group-select-all[data-target="region"]').click();
      const allRegions = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.region.length === FILTER_OPTIONS.region.length;
      document.querySelector('.group-select-all[data-target="region"]').click();
      const none = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.region.length === 0;
      elements.clearRegisteredFilter.click();
      const registeredCleared = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.registeredOnly === false;
      elements.keywordSearch.value = 'retina';
      elements.keywordSearch.dispatchEvent(new Event('input', {bubbles: true}));
      const keyword = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.keyword === 'retina';
      elements.clearSearchBtn.click();
      const keywordCleared = JSON.parse(localStorage.getItem(FILTER_STATE_KEY)).filters.keyword === '';
      return {chipRemoved, domestic: !domestic.includes('海外') && domestic.length === FILTER_OPTIONS.region.length - 1,
        allRegions, none, registeredCleared, keyword, keywordCleared};
    })()`);
    assert.ok(Object.values(handlers).every(Boolean), JSON.stringify(handlers));
    await evaluate('elements.resetFilterBtn.click();');
    assert.equal(await evaluate('localStorage.getItem(FILTER_STATE_KEY)'), null);
    assert.equal(await evaluate('elements.sortSelect.value'), 'date-asc');
    await reload();
    const reset = await evaluate(`({saved: localStorage.getItem(FILTER_STATE_KEY), region: state.filters.region.size,
      sort: elements.sortSelect.value, ended: elements.filterIncludeEnded.checked,
      registered: state.filters.registeredOnly, url: location.href,
      attending: localStorage.getItem(ATTENDING_CONFERENCES_KEY), calendar: localStorage.getItem(CALENDAR_SETTINGS_KEY)})`);
    assert.equal(reset.saved, null);
    assert.equal(reset.region, 0);
    assert.equal(reset.sort, 'date-asc');
    assert.equal(reset.ended, false);
    assert.equal(reset.registered, false);
    assert.equal(reset.url, before.url);
    assert.equal(reset.attending, before.attending);
    assert.equal(reset.calendar, before.calendar);
    await evaluate(`document.querySelector('input[name="region"][value="海外"]').click(); elements.emptyResetBtn.click();`);
    assert.equal(await evaluate('localStorage.getItem(FILTER_STATE_KEY)'), null);
    console.log('PASS: actual filter/sort listeners, reload state/UI, toggles, chip removal, domestic/all/none selection, both reset buttons, unchanged URL, attendance and calendar settings');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
