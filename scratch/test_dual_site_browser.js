// Real local HTTP pages, real Edge layout/storage; Firebase and Google APIs are mocked only in this test server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
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
      await call('Page.navigate', { url: origin + route });
      for (let i = 0; i < 100; i++) {
        if (await evaluate('document.readyState === "complete" && window.OphthalAuth?.snapshot().phase === "ready" && !!document.querySelector(".event-card")')) return;
        await delay(100);
      }
      throw new Error('Page not ready: ' + route);
    };
    await navigate('/');
    // Official high-priority correction cards, rendered with the production card function.
    const corrected=require('../reports/event-metadata-high-priority-fixes-2026-10-09.json').results.filter(r=>r.status==='corrected');
    for(const width of [1280,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      for(const route of ['/','/ophthalconf/']) {
        await navigate(route);
        await evaluate(`elements.eventList.innerHTML = ${JSON.stringify(corrected.map(r=>r.eventId))}.map(id=>createEventCardHtml(sampleEvents.find(e=>e.id===id))).join('');`);
        const cards=await evaluate(`(() => [...document.querySelectorAll('.event-card')].map(card=>{
          const e=sampleEvents.find(e=>e.id===card.dataset.id),link=card.querySelector('.conference-title-link');
          return {id:e.id,title:card.querySelector('.card-title').textContent,expectedTitle:e.title,
            venue:card.querySelector('.location-text').textContent,expectedVenue:getEventVenueName(e),
            dateShown:card.textContent.includes(e.period),url:link?.getAttribute('href')||null,expectedUrl:e.eventOfficialUrl||null,
            fits:card.scrollWidth<=card.clientWidth+1};
        }))()`);
        assert.equal(cards.length,13);
        for(const card of cards){assert.equal(card.title,card.expectedTitle);assert.ok(card.venue.includes(card.expectedVenue),card.id+' venue');assert.ok(card.dateShown,card.id+' date');assert.equal(card.url,card.expectedUrl);assert.ok(card.fits,width+' '+route+' '+card.id);}
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
        const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        fs.writeFileSync(path.join(root,'scratch',`high-priority-${route==='/'?'root':'ophthalconf'}-${width}.png`),Buffer.from(screenshot.data,'base64'));
        console.log(`PASS: 13 corrected cards title/date/venue/link at ${width}px ${route}, no overflow`);
      }
    }
    await navigate('/');
    await evaluate(`localStorage.setItem('ophthalconf_attending_conferences',JSON.stringify(['oph-011']));
      localStorage.setItem('ophthalconf_hidden_conferences',JSON.stringify(['oph-014']));
      localStorage.setItem('ophthalconf_conference_attendance_history',JSON.stringify({'conf-jp-jos-2026':{status:'attended',notes:'keep history',roles:['chair']}}));
      localStorage.setItem('ophthalconf_calendar_settings',JSON.stringify({calendarProvider:'google',defaultCalendar:'google'}));
      localStorage.setItem('ophthalconf_filter_state',JSON.stringify({version:1,filters:{year:['2027'],specialty:['緑内障'],includeEndedConferences:true},sortBy:'date-asc'}));
      localStorage.setItem('ophthalconf.review-decisions.v1',JSON.stringify({version:1,history:[{reviewId:'retained-review',signature:'fixture',reviewerId:'dual-admin',eventId:'oph-011',decision:'deferred',decidedAt:'2026-10-08T00:00:00Z'}]}));migrateLegacyStorage();`);
    await evaluate('document.getElementById("auth-login").click()');
    for (let i = 0; i < 40 && !await evaluate('!!OphthalAuth.snapshot().user'); i++) await delay(100);
    const saved = await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("ophthalconf")).map(k=>[k,localStorage.getItem(k)]))');
    for (const width of [1280, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      for (const route of ['/ophthalconf/', '/']) {
        await navigate(route);
        assert.equal(await evaluate('OphthalAuth.snapshot().user.uid'), 'dual-admin');
        assert.deepEqual(await evaluate('Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("ophthalconf")).map(k=>[k,localStorage.getItem(k)]))'), saved);
        const restored = await evaluate('({attending:state.attendingConferences.has("oph-011"),hidden:state.hiddenConferences.has("oph-014"),history:state.conferenceHistory.get("conf-jp-jos-2026").notes,calendar:state.calendarSettings.defaultCalendar,ended:state.filters.includeEndedConferences,year:state.filters.year.has("2027"),specialty:state.filters.specialty.has("緑内障"),review:JSON.parse(localStorage.getItem("ophthalconf.review-decisions.v1")).history[0].decision})');
        assert.deepEqual(restored, { attending: true, hidden: true, history: 'keep history', calendar: 'google', ended: true, year: true, specialty: true, review: 'deferred' });
        assert.equal(await evaluate('GoogleCalendar.connected()'), false);
        await evaluate('GoogleCalendar.connect()');
        assert.equal(await evaluate('GoogleCalendar.connected()'), true);
        await evaluate('GoogleCalendar.ensure([sampleEvents.find(e=>e.id==="oph-011")])');
        assert.ok(await evaluate('dualApiCalls.some(u=>u.includes("/events"))'));
        await evaluate('document.getElementById("review-entry").click()');
        for (let i = 0; i < 50 && !await evaluate('document.querySelectorAll(".review-card").length > 0'); i++) await delay(100);
        assert.ok(await evaluate('document.getElementById("review-dialog").open && document.querySelectorAll(".review-card").length > 0'));
        assert.ok(await evaluate('document.getElementById("review-dialog").scrollWidth <= document.getElementById("review-dialog").clientWidth'));
        await evaluate('document.getElementById("review-close").click()');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
        const beta = await evaluate(`(() => {
          const badge=document.querySelector('.beta-badge'), footer=document.querySelector('.beta-notice'), title=document.querySelector('.brand-title');
          const inside=el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;};
          return {badge:badge.textContent,notice:footer.textContent.trim(),title:title.textContent,
            badgeFits:inside(badge),footerFits:inside(footer),brandFits:inside(document.querySelector('.brand')),
            background:getComputedStyle(badge).backgroundColor,color:getComputedStyle(badge).color,
            footerFont:parseFloat(getComputedStyle(footer).fontSize),footerLine:parseFloat(getComputedStyle(footer).lineHeight),
            badgeHeight:badge.getBoundingClientRect().height,footerHeight:footer.getBoundingClientRect().height};
        })()`);
        assert.equal(beta.badge, 'β版｜機能・掲載情報を随時改善中');
        assert.equal(beta.notice, '本サイトはβ版です。機能および掲載情報は順次確認・更新しています。参加登録、演題締切、開催日程等の重要情報については、必ず各学会の公式サイトでもご確認ください。');
        assert.equal(beta.title, 'OphthalConf');
        assert.ok(beta.badgeFits && beta.footerFits && beta.brandFits, `${width}px ${route}: beta layout`);
        assert.equal(beta.background, 'rgb(241, 245, 249)'); assert.equal(beta.color, 'rgb(71, 85, 105)');
        assert.ok(beta.footerFont >= 14 && beta.footerLine >= beta.footerFont * 1.6);
        console.log(`Beta layout: ${width}px ${route}, badge ${Math.round(beta.badgeHeight)}px, footer ${Math.round(beta.footerHeight)}px, no overflow`);
        const assets = await evaluate('[...document.querySelectorAll("script[src],link[rel=stylesheet]")].map(e=>new URL(e.src||e.href).pathname)');
        assert.ok(assets.every(p => p.startsWith(route)));
      }
    }
    await navigate('/ophthalconf?adminReview=1#retained');
    assert.equal(await evaluate('location.pathname + location.search + location.hash'), '/ophthalconf/?adminReview=1#retained');
    assert.ok(requests.includes('/reports/auto-update-review.json') && requests.includes('/ophthalconf/reports/auto-update-review.json'));
    console.log('PASS: root and /ophthalconf/ at 1280/390/320px, all relative assets/review JSON, same-origin localStorage restored both directions, mocked Firebase login persisted, mocked Google Calendar reconnect/API, review dialog and slash/query/hash normalization');
    await call('Browser.close');
  } finally { socket?.close(); if (browser.exitCode === null) browser.kill(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
