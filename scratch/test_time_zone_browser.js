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



    await evaluate(`getTodayString = () => '2026-10-05'; const template = sampleEvents.find(e => e.id === 'oph-004'); const multi = {...template, id:'dst-test', date:'2026-03-07', endDate:'2026-03-09', timeZone:'America/Chicago'}; elements.eventList.innerHTML = [template, sampleEvents.find(e => e.id === 'oph-010'), multi, sampleEvents.find(e => e.id === 'conf-int-wgc-2027'), sampleEvents.find(e => e.id === 'oph-001'), sampleEvents.find(e => e.id === 'conf-int-fujiretina-2027')].map(createEventCardHtml).join('');`);
    for (const width of [320, 360, 480, 1280]) {
      await call('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width<500});
      const layout = await evaluate(`(() => {
        const zones = [...document.querySelectorAll('.event-time-zones')];
        return {count:zones.length, noOverflow: zones.every(e=>e.scrollWidth<=e.clientWidth+1), pageFits:document.documentElement.scrollWidth<=innerWidth+1,
          stacked: zones.every(e=>e.querySelector('.japan-time').getBoundingClientRect().top>e.querySelector('.local-time').getBoundingClientRect().top),
          multi: document.querySelector('[data-id="dst-test"]').querySelectorAll('.japan-time').length};
      })()`);
      assert.equal(layout.count,2); assert.equal(layout.multi,3);
      assert.equal(layout.noOverflow,true,width+'px time overflow'); assert.equal(layout.pageFits,true,width+'px page overflow');
      if(width<500) assert.equal(layout.stacked,true,width+'px times stacked');
      const cities = await evaluate(`['conf-int-wgc-2027', 'oph-004'].map(id => {
        const card = document.querySelector('[data-id="'+id+'"]');
        const label = card.querySelector('.conf-city-label');
        return {label: label.innerText, value: label.nextElementSibling.textContent,
          maps: !!card.querySelector('a[href*="google.com/maps"]'),
          countryLabel: card.querySelector('.location-text').textContent};
      })`);
      assert.equal(cities[0].label, '開催都市：');
      assert.equal(cities[0].value, '京都市（京都府）');
      assert.equal(cities[1].label, width <= 480 ? '都市：' : '開催都市・国：');
      assert.ok(cities[1].value.endsWith('/ 米国'));
      assert.ok(cities[1].countryLabel.includes('[米国]'));
      assert.ok(cities.every(city => city.maps));
      const credits = await evaluate(`['oph-001', 'oph-004', 'conf-int-wgc-2027'].map(id => {
        return [...document.querySelector('[data-id="'+id+'"]').querySelectorAll('.card-meta-label')].some(label => label.textContent === '認定単位:');
      })`);
      assert.deepEqual(credits, [true, false, false], width + 'px domestic/overseas credit visibility');
      const descriptions = await evaluate(`['oph-001', 'oph-004', 'conf-int-wgc-2027'].map(id => {
        const card = document.querySelector('[data-id="'+id+'"]');
        const event = sampleEvents.find(e => e.id === id);
        return {visible: !!card.querySelector('.card-desc'), subtitle: card.querySelector('.card-subtitle').textContent === event.subtitle};
      })`);
      assert.deepEqual(descriptions.map(item => item.visible), [false, true, true], width + 'px domestic/overseas description visibility');
      assert.ok(descriptions.every(item => item.subtitle), width + 'px subtitles preserved');
      const fuji = await evaluate(`(() => {
        const event = sampleEvents.find(e => e.id === 'conf-int-fujiretina-2027');
        const card = document.querySelector('[data-id="'+event.id+'"]');
        const venue = getEventVenue(event);
        const map = card.querySelector('.location-text a');
        return {venue: event.venue, id: event.venueId, masterName: venue.name,
          query: new URL(map.href).searchParams.get('query'), name: map.textContent,
          dates: [event.date,event.endDate], noWrongVenue: !card.textContent.includes('東京国際フォーラム')};
      })()`);
      assert.equal(fuji.venue, '虎ノ門ヒルズフォーラム');
      assert.equal(fuji.id, 'toranomon-hills-forum');
      assert.equal(fuji.masterName, fuji.venue); assert.equal(fuji.name, fuji.venue);
      assert.ok(fuji.query.includes(fuji.venue)); assert.equal(fuji.noWrongVenue, true);
      assert.deepEqual(fuji.dates, ['2027-03-26','2027-03-28']);
    }
    const modal = await evaluate(`(() => {showPdfModal(sampleEvents.find(e => e.id === 'oph-004')); return document.querySelector('dialog[open]').innerHTML.includes('japan-time');})()`);
    assert.equal(modal,true);
    console.log('PASS: international times, DST daily rows, domestic/overseas city labels, Maps and country labels at 320/360/480/1280px, mobile stacked, no overflow, detail modal');
    await call('Browser.close');
  } finally { if(socket) socket.close(); if(browser.exitCode===null) browser.kill(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
