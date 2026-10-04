// Optional real-browser layout check; no npm dependencies. Edge/Chrome must be installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn, spawnSync } = require('node:child_process');
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



    const oldScript = spawnSync('git',['show','c38e0f7:script.js'],{cwd:root,encoding:'utf8'});
    const oldCss = spawnSync('git',['show','c38e0f7:style.css'],{cwd:root,encoding:'utf8'});
    assert.equal(oldScript.status,0); assert.equal(oldCss.status,0);
    const oldCard = oldScript.stdout.slice(oldScript.stdout.indexOf('function createEventCardHtml('), oldScript.stdout.indexOf('function attachCardActionListeners('));
    const currentCss = fs.readFileSync(path.join(root,'style.css'),'utf8');
    await evaluate(`getTodayString = () => '2026-10-05'; state.attendingConferences.clear(); state.hiddenConferences.clear(); state.filters.abstractStatus.clear(); const attendanceTemplate = sampleEvents.find(e=>e.id==='oph-001'); const baselineCard = (` + oldCard + `); document.querySelector('link[href="style.css"]').disabled=true; const attendanceStyle=document.createElement('style'); document.head.appendChild(attendanceStyle);`);
    const measurements=[];
    for(const width of [320,360,480,1280]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      await evaluate('attendanceStyle.textContent = '+JSON.stringify(oldCss.stdout)+'; elements.eventList.innerHTML=baselineCard(attendanceTemplate);');
      const before=await evaluate('({bar:document.querySelector(".conf-attendance-bar").getBoundingClientRect().height,card:document.querySelector(".event-card").getBoundingClientRect().height})');
      await evaluate('attendanceStyle.textContent = '+JSON.stringify(currentCss)+'; elements.eventList.innerHTML=createEventCardHtml(attendanceTemplate);');
      const after=await evaluate(`(() => {
        const bar=document.querySelector('.conf-attendance-bar'); const group=bar.querySelector('.conf-choice-group'); const label=group.firstElementChild; const buttons=[...group.querySelectorAll('button')];
        return {bar:bar.getBoundingClientRect().height,card:document.querySelector('.event-card').getBoundingClientRect().height,
          noOverflow:group.scrollWidth<=group.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth+1,
          labelFirst: label.classList.contains('conf-attendance-main-text'),
          sameRow: buttons.every(b=>Math.abs(b.getBoundingClientRect().top-label.getBoundingClientRect().top)<15),
          touch:buttons.every(b=>b.getBoundingClientRect().height>=36),
          unselected:buttons.every(b=>b.getAttribute('aria-pressed')==='false'),
          hints:bar.querySelectorAll('.conf-attendance-hint,.conf-attending-active-tag').length};
      })()`);
      assert.equal(after.noOverflow,true,width+'px overflow'); assert.equal(after.labelFirst,true); assert.equal(after.touch,true); assert.equal(after.unselected,true); assert.equal(after.hints,0);
      if(width===1280) assert.equal(after.sameRow,true,'PC single row');
      assert.ok(after.bar<before.bar,width+'px bar height '+JSON.stringify({before,after}));
      assert.ok(after.card<before.card,width+'px card height');
      measurements.push({width,before:before.bar,after:after.bar});
    }
    const behavior=await evaluate(`(() => {
      renderEvents();
      const button=choice=>document.querySelector('[data-id="oph-001"] [data-choice="'+choice+'"]');
      const child=()=>!!document.querySelector('[data-id="oph-001-s2"]');
      const initial=!child() && button('yes').getAttribute('aria-pressed')==='false' && button('no').getAttribute('aria-pressed')==='false';
      const labels=[button('yes').closest('.conf-choice-group').firstElementChild.textContent, button('yes').querySelector('.choice-text').textContent, button('no').querySelector('.choice-text').textContent];
      button('yes').querySelector('.choice-text').click();
      const yes=child() && button('yes').getAttribute('aria-pressed')==='true' && button('no').getAttribute('aria-pressed')==='false' && !state.hiddenConferences.has('oph-001');
      const savedYes=JSON.parse(localStorage.getItem(ATTENDING_CONFERENCES_KEY)).includes('oph-001');
      state.attendingConferences.clear(); loadAttendingConferences(); const restoredYes=state.attendingConferences.has('oph-001');
      button('yes').click(); const cleared=!child() && !state.attendingConferences.has('oph-001');
      button('yes').click(); button('no').querySelector('.choice-text').click();
      const no=!document.querySelector('[data-id="oph-001"]') && !child() && !state.attendingConferences.has('oph-001') && state.hiddenConferences.has('oph-001');
      const savedNo=JSON.parse(localStorage.getItem(HIDDEN_CONFERENCES_KEY)).includes('oph-001') && !JSON.parse(localStorage.getItem(ATTENDING_CONFERENCES_KEY)).includes('oph-001');
      state.hiddenConferences.clear(); loadHiddenConferences(); const restoredNo=state.hiddenConferences.has('oph-001');
      unhideConference('oph-001');
      return {initial,yes,savedYes,restoredYes,cleared,no,savedNo,restoredNo,labels};
    })()`);
    assert.deepEqual(behavior.labels, ['参加予定：', 'あり（関連セミナー表示）', 'なし（非表示）']);
    for(const [key,value] of Object.entries(behavior)) if(key!=='labels') assert.equal(value,true,key);
    console.log('PASS: compact attendance label/chips, no overflow, smaller bars/cards at 320/360/480/1280px, initial/yes/no/exclusivity, child visibility, storage save/load');
    console.log(JSON.stringify(measurements));
    await call('Browser.close');
  } finally {if(socket) socket.close();if(browser.exitCode===null) browser.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
