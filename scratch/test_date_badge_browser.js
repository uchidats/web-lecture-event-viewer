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
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href + '?view=list' });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof createEventCardHtml === "function"')) break;
      await delay(100);
    }
    assert.equal(await evaluate('typeof state === "object" && !!document.querySelector("#filter-region input")'), true, 'App initialized');



    await evaluate(`
      getTodayString = () => '2026-10-09';
      const fixtureBase = sampleEvents.find(e => e.isConference);
      const dateFixtures = [2025, 2026, 2027].map(year => ({...fixtureBase, id: 'badge-' + year, date: year + '-03-18', endDate: year + '-03-21'}));
      const fixtures = [...dateFixtures, {...fixtureBase, id:'badge-single',date:'2027-03-18',endDate:'2027-03-18'}, {...fixtureBase,id:'badge-month',date:'2027-03-30',endDate:'2027-04-02'}];
      elements.eventList.innerHTML = [...fixtures, ...sampleEvents].map(createEventCardHtml).join('');
    `);
    for (const width of [1280, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 480 });
      await evaluate('document.fonts.ready.then(() => true)');
      const measure = await evaluate(`(() => {
        const badges = [...document.querySelectorAll('.date-badge')];
        const cards = [...document.querySelectorAll('.event-card')];
        return { pageOverflow: document.documentElement.scrollWidth > innerWidth,
          overflow: cards.filter(el => el.scrollWidth > el.clientWidth + 1).length,
          badges: badges.slice(0,5).map(b => {const r=b.getBoundingClientRect(); const y=b.querySelector('.date-year');return {text: [...b.children].map(e=>e.textContent),width:r.width,height:r.height,yearSize:y?parseFloat(getComputedStyle(y).fontSize):null,dateSize:parseFloat(getComputedStyle(b.querySelector('.month-day')).fontSize),color:y?getComputedStyle(y).color:null};}),
          badgeOverflow: badges.filter(b => b.scrollWidth > b.clientWidth+1 || [...b.children].some(c=>c.scrollWidth>c.clientWidth+1)).length };
      })()`);
      assert.equal(measure.pageOverflow, false, width + ' page overflow');
      assert.equal(measure.overflow, 0, width + ' card overflow');
      assert.equal(measure.badgeOverflow, 0, width + ' badge overflow');
      assert.deepEqual(measure.badges.map(b=>b.text.length), [3,2,3,3,3]);
      assert.equal(measure.badges[0].text[0], '2025年');
      assert.equal(measure.badges[1].text[0], '3/18–21');
      assert.deepEqual(measure.badges[2].text, ['2027年','3/18–21','(木)–(日)']);
      assert.deepEqual(measure.badges[3].text, ['2027年','3/18','(木)']);
      assert.equal(measure.badges[4].text[1], '3/30–4/2');
      assert.equal(measure.badges[2].width, measure.badges[1].width);
      assert.ok(measure.badges[2].height - measure.badges[1].height <= 9);
      assert.ok(measure.badges[2].yearSize < measure.badges[2].dateSize);
      console.log('PASS: ' + width + 'px ' + JSON.stringify(measure.badges.slice(0,3)));
    }
    await evaluate('getTodayString = () => "2027-01-01"; elements.eventList.innerHTML = dateFixtures.map(createEventCardHtml).join("");');
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".date-badge")].map(b=>b.querySelector(".date-year")?.textContent || "")'), ['2025年','2026年','']);
    console.log('PASS: current-year rollover and shared cards for past/future events');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
