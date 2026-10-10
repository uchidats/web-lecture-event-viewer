// Real local HTTP pages, real Edge layout/storage; Firebase and Google APIs are mocked only in this test server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { buildDualSite } = require('../scripts/build-dual-site');
const root = path.resolve(__dirname, '..'), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const bootstrap = `
  window.dualApiCalls = [];
  window.dualFirebaseSDK = {
    getApps:()=>[{name:'ophthalconf-auth'}], initializeApp:(config,name)=>({name}), getAuth:()=>({}),
    browserLocalPersistence:'local', setPersistence:async()=>{},
    onAuthStateChanged:(auth,fn)=>{window.dualAuthObserver=fn;fn(JSON.parse(localStorage.getItem('__dual_test_user')||'null'));},
    GoogleAuthProvider:class{setCustomParameters(){}},
    signInWithPopup:async()=>{const user={uid:'dual-admin',email:'uchidats@gmail.com',emailVerified:true,displayName:'Fixture Admin'};localStorage.setItem('__dual_test_user',JSON.stringify(user));window.dualAuthObserver(user);},
    signOut:async()=>{localStorage.removeItem('__dual_test_user');window.dualAuthObserver(null);}
  };
  window.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'fixture-only',expires_in:3600,scope:options.scope})})}}};
  const dualNativeFetch=window.fetch.bind(window);
  window.fetch=async(input,options)=>{
    if(String(input).startsWith('https://www.googleapis.com/calendar/v3/')){
      window.dualApiCalls.push(String(input));return new Response(JSON.stringify(String(input).includes('/events')?{items:[],timeZone:'Asia/Tokyo'}:{timeZone:'Asia/Tokyo'}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    return dualNativeFetch(input,options);
  };
`;
async function main() {
  const { output } = buildDualSite(), requests = [];
  const headingOldFiles=new Map(['index.html','calendar-view.js','style.css'].map(name=>[name,Buffer.from(spawnSync('git',['show','7b239f6:'+name],{cwd:root,encoding:'utf8'}).stdout)]));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test'); requests.push(url.pathname);
    let file = path.resolve(output, '.' + url.pathname);
    if (file !== output && !file.startsWith(output + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    let data = fs.readFileSync(file);
    if((url.searchParams.has('headingBaseline') || req.headers.referer && new URL(req.headers.referer).searchParams.has('headingBaseline')) && headingOldFiles.has(path.basename(file))) data=headingOldFiles.get(path.basename(file));
    if (file.endsWith('index.html')) data = Buffer.from(data.toString().replace(/<link[^>]*https:[^>]*>/g, '')
      .replace(/<script[^>]*src="https:[^>]*><\/script>/g, '').replace('<head>', '<head><script>' + bootstrap + '</script>'));
    if (file.endsWith('firebase-auth.js')) data = Buffer.from(data.toString().replace(
      'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}});',
      'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}, load:async()=>root.dualFirebaseSDK});'));
    const type = file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html';
    res.setHeader('Content-Type', type + '; charset=utf-8'); res.end(data);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-site-edge-'));
  const browser = spawn(process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
    assert.ok(fs.existsSync(portFile));
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id); if (!task) return;
      pending.delete(result.id); clearTimeout(task.timer); result.error ? task.reject(result.error) : task.resolve(result.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout')), 15000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const navigate = async route => {
      await call('Page.navigate', { url: origin + route + (['/', '/ophthalconf/'].includes(route) ? '?view=list' : '') });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('document.readyState === "complete" && window.OphthalAuth?.snapshot().phase === "ready" && !!document.querySelector(".event-card")')) return;
        await delay(100);
      }
      throw new Error('Page not ready: ' + route);
    };
    const output=fs.mkdtempSync(path.join(os.tmpdir(),'ophthalconf-compact-heading-'));
    const summaries=[];
    for(const width of [1280,768,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});
      for(const month of ['2027-07','2026-10','2027-03']) {
        const variants={};
        for(const baseline of [true,false]) {
          await navigate('/?view=compact&month='+month+(baseline?'&headingBaseline=1':''));
          const dates=month==='2027-07'?['2027-07-02','2027-07-03','2027-07-04']:month==='2026-10'?['2026-10-12']:['2027-03-19','2027-03-20','2027-03-21','2027-03-22'];
          await evaluate(`state.filters.includeEndedConferences=true;for(const key of FILTER_SET_KEYS)state.filters[key].clear();state.filters.keyword='';state.filters.registeredOnly=false;state.hiddenConferences.clear();const template=sampleEvents.find(e=>e.isConference);state.events=${JSON.stringify(dates)}.map((date,index)=>({...template,id:'heading-'+index,title:'表示確認用イベント',date,endDate:date}));renderEvents();`);
          variants[baseline?'before':'after']=await evaluate(`(() => [...document.querySelectorAll('.fc-list-day')].map(row=>{const c=row.querySelector('.fc-list-day-cushion'),d=c.querySelector('.compact-date');return {date:row.dataset.date,text:c.textContent,height:c.getBoundingClientRect().height,overflow:c.scrollWidth>c.clientWidth+1,combined:d?.textContent||null,dateFits:d?d.scrollWidth<=d.clientWidth+1:true,hasSide:!!c.querySelector('.fc-list-day-side-text'),color:getComputedStyle(d||c.querySelector('.fc-list-day-text')).color,background:getComputedStyle(c).backgroundColor,holiday:c.querySelector('.calendar-holiday-name')?.textContent||null,holidayColor:c.querySelector('.calendar-holiday-name')?getComputedStyle(c.querySelector('.calendar-holiday-name')).color:null};}))()`);
          if(!baseline) {
            assert.ok(await evaluate('!document.getElementById("calendar-month-holidays")&&!document.getElementById("calendar-holiday-note")'),'Only per-date holiday labels remain');
            const expected=month==='2027-07'?['2027年7月2日（金）','2027年7月3日（土）','2027年7月4日（日）']:month==='2026-10'?['2026年10月12日（月・祝）']:['2027年3月19日（金）','2027年3月20日（土）','2027年3月21日（日・祝）','2027年3月22日（月・祝）'];
            assert.deepEqual(variants.after.map(r=>r.combined),expected);
            assert.ok(variants.after.every(r=>!r.overflow&&r.dateFits&&!r.hasSide));
            for(let i=0;i<variants.after.length;i++) assert.ok(variants.after[i].height<=variants.before[i].height+(width<=390?21:1),'Heading height stays compact (one holiday-name line may wrap)');
            if(month==='2026-10') assert.equal(variants.after[0].holiday,'スポーツの日');
            for(let i=0;i<dates.length;i++) {
              const row=variants.after[i],weekday=new Date(dates[i]+'T12:00:00').getDay();
              const expectedColor=row.holiday||weekday===0?'rgb(180, 83, 83)':weekday===6?'rgb(71, 122, 158)':variants.before[i].color;
              assert.equal(row.color,expectedColor,'Weekday/weekend/holiday date color');
              assert.equal(row.background,variants.before[i].background,'Background unchanged');
              if(row.holiday)assert.equal(row.holidayColor,variants.before[i].holidayColor,'Holiday name color unchanged');
            }
            if(month==='2027-03')assert.equal(variants.after[2].holiday,'春分の日','Sunday holiday retains its name');
            await delay(150);
            const clip=await evaluate(`(() => {const r=document.getElementById('event-calendar').getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`);
            const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
            fs.writeFileSync(path.join(output,`compact-${width}-${month}.png`),Buffer.from(shot.data,'base64'));
          }
        }
        summaries.push({width,month,...variants});
        console.log('PASS: '+width+'px '+month+' '+JSON.stringify(variants.after.map(r=>({text:r.text,height:r.height}))));
      }
      // Default month-grid heading content remains identical to the previous implementation.
      const grid=[];
      for(const baseline of [true,false]) {
        await navigate('/?view=calendar&month=2027-07'+(baseline?'&headingBaseline=1':''));
        grid.push(await evaluate('[...document.querySelectorAll(".fc-col-header-cell,.fc-daygrid-day-number")].map(e=>({text:e.textContent,color:getComputedStyle(e).color}))'));
      }
      assert.deepEqual(grid[1],grid[0]);
    }
    fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(summaries,null,2));
    console.log('PASS: compact weekday/weekend/holiday headers at all four widths; month-grid headings unchanged; '+output);
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
