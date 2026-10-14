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
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
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




    await evaluate("getTodayString=()=> '2026-10-05'; state.filters.abstractStatus.clear();");
    const requestedWidth=Number(process.argv.find(arg=>arg.startsWith('--width='))?.split('=')[1]);
    for (const width of requestedWidth ? [requestedWidth] : [1280,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      await evaluate("localStorage.removeItem(CONFERENCE_REGISTRATION_KEY); localStorage.setItem(ATTENDING_CONFERENCES_KEY,'[]'); localStorage.setItem(HIDDEN_CONFERENCES_KEY,'[]'); conferenceRegistrations={};state.attendingConferences.clear();state.hiddenConferences.clear();renderEvents();");
      const check = async expression => assert.equal(await evaluate(expression),true,width+'px '+expression);
      const click = async choice => evaluate('document.querySelector(\'[data-id="oph-001"] [data-choice="'+choice+'"]\').closest("label").querySelector(".choice-text").click()');
      const layout = async () => check('document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll(".conf-planned-choice-group")].every(g=>g.scrollWidth<=g.clientWidth+1)');
      await check('document.querySelectorAll(\'[data-id="oph-001"] [data-action="attend-choice"]\').length===3 && !document.querySelector(\'[data-id="oph-001"] input:checked\')');
      await layout();
      await check('[...document.querySelectorAll(\'[data-id="oph-001"] .conf-choice-btn\')].every(label=>{const radio=label.querySelector("input").getBoundingClientRect(),text=label.querySelector("span").getBoundingClientRect();return Math.abs(radio.top+radio.height/2-text.top-text.height/2)<1 && radio.width===16 && getComputedStyle(label).borderTopWidth==="0px"})');
      await click('yes');
      const comparison=await evaluate('(()=>{const event=state.events.find(e=>e.id==="oph-001"),host=document.createElement("div");host.id="attendance-surface-comparison";host.style.cssText="position:absolute;top:0;left:0;width:100%;padding:16px;box-sizing:border-box;background:#f8fafc;z-index:9999;display:grid;gap:16px";state.attendingConferences.delete(event.id);const normal=createEventCardHtml(event);state.attendingConferences.add(event.id);host.innerHTML=normal+createEventCardHtml(event);document.body.append(host);scrollTo(0,0);return [...host.children].map(card=>{const s=getComputedStyle(card);return {background:s.backgroundColor,border:s.borderTopColor,width:s.borderTopWidth,radius:s.borderRadius,padding:s.padding,shadow:s.boxShadow,color:s.color,fits:card.scrollWidth<=card.clientWidth+1};});})()');
      assert.notEqual(comparison[0].background,comparison[1].background);
      for(const property of ['width','radius','padding','shadow','color'])assert.equal(comparison[0][property],comparison[1][property],property+' same as normal card');
      assert.ok(comparison.every(card=>card.fits));
      if(process.argv.includes('--screenshots')) {
        const clip=await evaluate('(()=>{const r=document.getElementById("attendance-surface-comparison").getBoundingClientRect();return {x:0,y:0,width:r.width,height:Math.min(innerHeight,Math.ceil(r.height)),scale:1};})()');
        const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip});
        const screenshotPath=path.join(profile,'attendance-surface-'+width+'.png');fs.writeFileSync(screenshotPath,Buffer.from(screenshot.data,'base64'));console.log(screenshotPath);
      }
      await evaluate('document.getElementById("attendance-surface-comparison").remove();renderEvents()');
      await check('(()=>{const card=document.querySelector(\'[data-id="oph-001"]\'),style=getComputedStyle(card);return !card.querySelector(".conf-attending-badge") && style.borderTopWidth==="1px" && style.borderTopColor==="rgb(201, 184, 244)" && style.backgroundColor==="rgb(247, 243, 255)" && card.scrollWidth<=card.clientWidth+1;})()');
      await check('state.attendingConferences.has("oph-001") && !!document.querySelector(\'[data-id="oph-001-s2"]\') && document.querySelector(\'[data-id="oph-001"] [data-choice="yes"]\').checked');
      await click('registered');
      await check('(()=>{const card=document.querySelector(\'[data-id="oph-001"]\'),style=getComputedStyle(card);return !card.querySelector(".conf-attending-badge") && style.borderTopWidth==="1px" && style.borderTopColor==="rgb(201, 184, 244)" && style.backgroundColor==="rgb(247, 243, 255)" && card.scrollWidth<=card.clientWidth+1;})()');
      await check('document.querySelectorAll(\'[data-id="oph-001"] [data-action="attend-choice"]\').length===1 && !!document.querySelector(\'[data-id="oph-001-s2"]\')');
      await check('(()=>{const group=document.querySelector(\'[data-id="oph-001"] .conf-planned-choice-group\'),radio=group.querySelector(".conf-choice-btn").getBoundingClientRect(),date=group.querySelector("input[type=date]").getBoundingClientRect();return !group.textContent.includes("登録日：") && (Math.abs(radio.top+radio.height/2-date.top-date.height/2)<1 || innerWidth===320 && date.top>=radio.bottom);})()');
      await check('(()=>{const label=document.querySelector(\'[data-id="oph-001"] .conf-registration-date\'),input=label.querySelector("input"),l=label.getBoundingClientRect(),r=input.getBoundingClientRect();return Math.abs(l.top+l.height/2-r.top-r.height/2)<1 && input.type==="date"})()');
      await layout();
      for (const date of ['2026-10-14','2026-10-15']) {
        await evaluate('(()=>{const dateInput=document.querySelector(\'[data-id="oph-001"] input[type="date"]\');dateInput.value='+JSON.stringify(date)+';dateInput.dispatchEvent(new Event("change",{bubbles:true}));})()');
        await check('JSON.parse(localStorage.getItem(CONFERENCE_REGISTRATION_KEY))["oph-001"].date==='+JSON.stringify(date));
        await check('(()=>{const group=document.querySelector(\'[data-id="oph-001"] .conf-planned-choice-group\'),text=group.querySelector(".conf-registration-date-text"),input=group.querySelector("input[type=date]"),radio=group.querySelector(".conf-choice-btn").getBoundingClientRect(),r=text.getBoundingClientRect();return text.textContent==="10月'+date.slice(-2)+'日" && getComputedStyle(input).opacity==="0" && Math.abs(radio.top+radio.height/2-r.top-r.height/2)<1;})()');
        await check('(()=>{const card=document.querySelector(\'[data-id="oph-001"]\'),input=card.querySelector("input[type=date]");let opened=false;input.showPicker=()=>{HTMLInputElement.prototype.showPicker.call(input);opened=true;};card.querySelector(".conf-registration-date-text").click();return opened;})()');
        await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      }
      await call('Page.reload');
      for(let i=0;i<100;i++){if(await evaluate('typeof createEventCardHtml==="function"'))break;await delay(100);}
      await evaluate("getTodayString=()=> '2026-10-05';renderEvents();");
      await check('conferenceAttendanceStatus("oph-001")==="registered" && document.querySelector(\'[data-id="oph-001"] input[type="date"]\').value==="2026-10-15"');
      await click('registered');
      await check('document.querySelectorAll(\'[data-id="oph-001"] [data-action="attend-choice"]\').length===3');
      await check('conferenceAttendanceStatus("oph-001")==="none" && !document.querySelector(\'[data-id="oph-001"] [data-action="registration-date"]\') && !document.querySelector(\'[data-id="oph-001"] input:checked\') && !document.querySelector(\'[data-id="oph-001"]\').classList.contains("card-attending-conference") && !document.querySelector(\'[data-id="oph-001-s2"]\') && JSON.parse(localStorage.getItem(CONFERENCE_REGISTRATION_KEY))["oph-001"].date==="2026-10-15"');
      await click('registered');
      await check('document.querySelector(\'[data-id="oph-001"] input[type="date"]\').value==="2026-10-15"');
      await check('document.querySelector(\'[data-id="oph-001"] [data-choice="registered"]\').checked && !!document.querySelector(\'[data-id="oph-001-s2"]\')');
      await click('registered');await click('yes');
      await check('conferenceAttendanceStatus("oph-001")==="yes" && !document.querySelector(\'[data-id="oph-001"] [data-action="registration-date"]\')');
      await click('registered');
      await click('registered');await click('no');
      await check('state.hiddenConferences.has("oph-001") && !document.querySelector(\'[data-id="oph-001"]\') && !document.querySelector(\'[data-id="oph-001-s2"]\')');
      await evaluate('conferenceRegistrations={};localStorage.removeItem(CONFERENCE_REGISTRATION_KEY);localStorage.setItem(ATTENDING_CONFERENCES_KEY,JSON.stringify(["oph-001"]));localStorage.setItem(HIDDEN_CONFERENCES_KEY,JSON.stringify(["legacy-no"]));state.attendingConferences.clear();state.hiddenConferences.clear();loadAttendingConferences();loadHiddenConferences();renderEvents();');
      await check('conferenceAttendanceStatus("oph-001")==="yes" && conferenceAttendanceStatus("legacy-no")==="no" && conferenceAttendanceStatus("unset")==="none"');
      await layout();
      console.log('PASS: '+width+'px initial/registered/unregistered/none, related seminars, date edit/reload/restoration, legacy migration, overflow');
    }
    await call('Browser.close');
  } finally {if(socket) socket.close();if(browser.exitCode===null) browser.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
