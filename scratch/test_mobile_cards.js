// Optional real-browser layout check; no npm dependencies. Edge/Chrome must be installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const browserPath = process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// Pin the layout before compacting details across desktop, tablet and mobile.
const baselineRef = process.env.CARD_TEST_BASE_REF || 'c9496d8';
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
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href + '?view=list' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof createEventCardHtml === "function"')) break;
      await delay(100);
    }
    await evaluate(`
      getTodayString = () => '2026-10-04';
      const template = sampleEvents.find(e => e.isConference && !isConferenceEnded(e));
      const fixtures = ['2026-11-04', '2026-11-03', '2026-10-11', '2026-10-05', '2026-10-04', '2026-10-03'].map(deadline => ({
        ...template, abstractSubmission: {status: 'open', deadline, url: 'https://example.com/abstract'},
        sponsor: 'VeryLongSponsorNameWithoutSpaces'.repeat(8),
        credits: 'VeryLongCreditDescriptionWithoutSpaces'.repeat(8),
        cityCountry: 'VeryLongCityNameWithoutSpaces'.repeat(4) + ' / USA',
        venue: 'VeryLongVenueNameWithoutSpaces'.repeat(5)
      }));
      elements.eventList.innerHTML = [...sampleEvents, ...fixtures].map(createEventCardHtml).join('');
    `);
    const oldCss = spawnSync('git', ['show', `${baselineRef}:style.css`], { cwd: root, encoding: 'utf8' });
    assert.equal(oldCss.status, 0);
    const currentCss = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    await evaluate(`document.querySelector('link[href="style.css"]').disabled = true; const layoutStyle = document.createElement('style'); document.head.appendChild(layoutStyle);`);
    const measure = async () => evaluate(`(() => {
      const cards = [...document.querySelectorAll('.event-card')];
      const rows = [...document.querySelectorAll('.conf-item,.card-meta-item')];
      return {
        width: innerWidth, cards: cards.length,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        overflow: [...document.querySelectorAll('.event-card,.conf-val,.card-meta-item')].filter(el => el.scrollWidth > el.clientWidth + 1).length,
        stacked: rows.filter(row => {const [label, value] = row.children; return value.getBoundingClientRect().left < label.getBoundingClientRect().right - 1;}).length,
        heights: cards.map(card => card.getBoundingClientRect().height),
        maps: document.querySelectorAll('a[href*="google.com/maps"]').length,
        actions: [...cards[0].querySelector('.card-actions-row').children].map(button => ({
          text: button.innerText.trim(), top: button.getBoundingClientRect().top,
          width: button.getBoundingClientRect().width, icons: button.querySelectorAll('svg').length,
          overflow: button.scrollWidth > button.clientWidth + 1
        })),
        badges: document.querySelectorAll('.abstract-status-tag').length
      };
    })()`);
    const results = [];
    for (const width of [1280, 1024, 980, 768, 600, 480, 360, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 480 });
      // Long fixtures widen the old grid's intrinsic column; compare cards at the current available width.
      await evaluate(`layoutStyle.textContent = ${JSON.stringify(currentCss)}; document.querySelectorAll('.event-card').forEach(card => card.style.width = '');`);
      const cardWidth = await evaluate('document.querySelector(".event-card").getBoundingClientRect().width');
      await evaluate(`document.querySelectorAll('.event-card').forEach(card => card.style.width = '${cardWidth}px');`);
      await evaluate(`layoutStyle.textContent = ${JSON.stringify(oldCss.stdout)};`);
      await evaluate('document.fonts.ready.then(() => true)');
      await delay(350);
      const before = await measure();
      await evaluate(`layoutStyle.textContent = ${JSON.stringify(currentCss)};`);
      await evaluate('document.fonts.ready.then(() => true)');
      await delay(350);
      const after = await measure();
      assert.equal(after.width, width); assert.equal(after.cards, 101);
      assert.equal(after.maps, before.maps); assert.ok(after.badges > 0); assert.equal(after.badges, before.badges);
      assert.equal(after.pageOverflow, false, `${width}px page overflow`);
      assert.equal(after.overflow, 0, `${width}px card/value overflow`);
      assert.equal(after.stacked, 0, `${width}px rows should be horizontal`);
      assert.deepEqual(after.actions.map(action=>action.text), width <= 480 ? ['追加','PDF','申込'] : ['カレンダーに追加','案内PDF','公式申込ページ']);
      assert.ok(after.actions.every(action=>action.icons===1 && !action.overflow), `${width}px action icons and content fit`);
      if (width <= 480) {
        assert.ok(after.actions.every(action=>Math.abs(action.top-after.actions[0].top)<1), `${width}px single action row`);
        assert.ok(after.actions.every(action=>Math.abs(action.width-after.actions[0].width)<1), `${width}px equal action widths`);
      }
      assert.ok(after.heights[0] <= before.heights[0], `${width}px card should not grow: ${before.heights[0]} -> ${after.heights[0]}`);
      if (width >= 600) assert.ok(after.heights[0] < before.heights[0], `${width}px card should be shorter`);
      results.push({ width, cards: after.cards, overflow: after.overflow, horizontalRows: after.stacked === 0,
        firstCardBefore: before.heights[0], firstCardAfter: after.heights[0] });
    }
    console.log('PASS: real browser 320-1280px (8 widths); 95 events + 6 long sponsor/credit/deadline fixtures; horizontal detail rows, no overflow, compact cards, Maps and deadline badges preserved');
    console.log(JSON.stringify(results));
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
