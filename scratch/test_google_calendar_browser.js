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
      if (expression.includes('await ')) expression = `(async () => {${expression}})()`;
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await call('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });
    for (let i = 0; i < 100; i++) {
      if (await evaluate('document.readyState === "complete" && typeof createEventCardHtml === "function"')) break;
      await delay(100);
    }

    await evaluate(`openCalendarSettingsModal();`);
    for(const width of [1280,480,360,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      for(const provider of ['google','icloud','both','none']) {
        const result=await evaluate(`(() => {document.querySelector('input[name="calendarProvider"][value="${provider}"]').click(); return {hidden:document.getElementById('google-calendar-connection').hidden,overflow:document.querySelector('#calendar-settings-modal .dialog-body').scrollWidth > document.querySelector('#calendar-settings-modal .dialog-body').clientWidth+1};})()`);
        assert.equal(result.hidden,!['google','both'].includes(provider));assert.equal(result.overflow,false);
      }
    }
    assert.equal(await evaluate('GoogleCalendar.connected()'),false);
    const moduleSource=fs.readFileSync(path.join(root,'google-calendar.js'),'utf8').replace('const config = typeof GOOGLE_CALENDAR_CONFIG !== "undefined" ? GOOGLE_CALENDAR_CONFIG : {};','const config = {clientId:"browser-test"};');
    await evaluate(`document.querySelectorAll('#google-calendar-connection button').forEach(button=>button.replaceWith(button.cloneNode(true))); window.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test',expires_in:3600})}),hasGrantedAllScopes:()=>true}}}; window.calendarTestRows=[];window.fetch=async(url,options)=>({ok:true,status:200,json:async()=> options.method==='POST'?{id:'new',...JSON.parse(options.body)}:url.includes('/events?')?{items:calendarTestRows}:{timeZone:'Asia/Tokyo'}});`);
    await evaluate(moduleSource);
    await evaluate(`GoogleCalendar.setupUI(()=>{updateRegisteredBadge();renderEvents();}); document.querySelector('input[name="calendarProvider"][value="google"]').click();document.getElementById('google-calendar-connect').click();`);
    assert.equal(await evaluate('GoogleCalendar.connected()'),true);
    await evaluate(`window.fixture={...sampleEvents.find(e=>!e.isConference&&!e.parentConferenceId),date:'2026-10-15',endDate:undefined,time:'19:00 - 20:00',region:'全国Web'}; state.calendarSettings={calendarProvider:'google',defaultCalendar:'google'};state.events=[fixture]; await GoogleCalendar.ensure([fixture]);renderEvents();`);
    assert.equal(await evaluate('computeEffectiveScheduleStatus(fixture).statusKey'),'free');
    await evaluate(`calendarTestRows=[{id:'busy',summary:'private fixture',start:{dateTime:'2026-10-15T18:30:00+09:00'},end:{dateTime:'2026-10-15T19:30:00+09:00'}}];GoogleCalendar.refresh();await GoogleCalendar.ensure([fixture]);renderEvents();`);
    assert.equal(await evaluate('computeEffectiveScheduleStatus(fixture).statusKey'),'partial_conflict');
    await evaluate('await addToCalendar(fixture)');assert.equal(await evaluate('computeEffectiveScheduleStatus(fixture).statusKey'),'registered');
    await evaluate(`GoogleCalendar.disconnect(); renderEvents();`);assert.equal(await evaluate('computeEffectiveScheduleStatus(fixture).statusKey'),'unlinked');
    assert.equal(await evaluate(`Object.values(localStorage).some(value=>value.includes('private fixture')||value.includes('access_token'))`),false);
    console.log('PASS: browser Google connection UI, four providers, 320-1280px modal, mocked GIS/API, partial conflict, direct registration, disconnect, privacy');
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
