// Optional real-browser layout check; no npm dependencies. Edge/Chrome must be installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
      if (expression.includes('await ')) expression = `(async () => {${expression}})()`;
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    // Render the published page's local assets without external OAuth/font requests.
    const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
    await call('Page.setDocumentContent',{frameId:(await call('Page.getFrameTree')).frameTree.frame.id,html});
    await evaluate('document.head.appendChild(document.createElement("style")).textContent='+JSON.stringify(fs.readFileSync(path.join(root,'style.css'),'utf8')));
    for(const file of ['venues.js','companies.js','events.js','google-calendar.js','script.js']){
      const result=await call('Runtime.evaluate',{expression:fs.readFileSync(path.join(root,file),'utf8')});assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
    }
    await evaluate('initApp();');
    await evaluate(`window.liveFixture={...sampleEvents.find(e=>!e.isConference&&!e.parentConferenceId),date:'2026-11-07',time:'18:00 - 19:00',calendarStatus:{google:{status:'busy',conflicts:[{title:'Dummy Google',start:'18:00',end:'19:00'}]},icloud:{status:'busy',conflicts:[{title:'???????????',start:'18:00',end:'19:00'}]}}};state.events=[liveFixture];Object.values(state.filters).forEach(value=>{if(value instanceof Set)value.clear();});state.filters.keyword='';state.filters.registeredOnly=false;window.originalFixture=JSON.stringify(liveFixture);`);
    for(const width of [1280,1024,480,360,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      for(const provider of ['google','both','icloud','none'])for(const status of ['disconnected','free','partial','busy']){
        await evaluate('state.calendarSettings.calendarProvider='+JSON.stringify(provider)+';GoogleCalendar.snapshot=()=>({state:'+JSON.stringify(status==='disconnected'?'disconnected':'ready')+',status:'+JSON.stringify(status)+',registered:false,conflicts:'+JSON.stringify(['partial','busy'].includes(status)?[{providerLabel:'Google',title:'Live Google meeting',start:'18:00',end:'19:00'}]:[])+ '});renderEvents();');
        const result=await evaluate(`(() => {const card=document.querySelector('.event-card');return {text:card.textContent,icloud:card.querySelectorAll('.conflict-provider-tag.icloud').length,google:card.querySelectorAll('.conflict-provider-tag.google').length,status:computeEffectiveScheduleStatus(liveFixture).statusKey,overflow:card.scrollWidth>card.clientWidth+1};})()`);
        assert.ok(!result.text.includes('???????????'));assert.ok(!result.text.includes('Dummy Google'));assert.equal(result.icloud,0);assert.equal(result.overflow,false,width+'px card overflow');
        const selected=['google','both'].includes(provider),hasConflict=selected&&['partial','busy'].includes(status);
        assert.equal(result.google,hasConflict?1:0);assert.equal(result.status,selected&&status!=='disconnected'?(status==='busy'?'conflict':status==='partial'?'partial_conflict':'free'):'unlinked');
      }
    }
    assert.equal(await evaluate('JSON.stringify(liveFixture)===originalFixture'),true);
    console.log('PASS: public card markup at 320-1280px, four providers, disconnected/free/partial/busy; no iCloud samples or dummy Google rows; live Google conflicts preserved.');
    await call('Browser.close');
  }finally{if(socket)socket.close();if(browser.exitCode===null)browser.kill();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
