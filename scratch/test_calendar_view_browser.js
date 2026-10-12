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
  const { output } = buildDualSite();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://test');
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
      const id = ++sequence, timer = setTimeout(() => reject(new Error(method + ' timeout: ' + JSON.stringify(params))), 30000);
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
    const reset = async () => evaluate(`
      getTodayString = () => '2026-10-10';
      state.filters.includeEndedConferences = true;
      for (const key of FILTER_SET_KEYS) state.filters[key].clear();
      state.filters.registeredOnly = false; state.filters.keyword = '';
      state.hiddenConferences.clear(); state.attendingConferences.clear();
      syncCheckboxesWithState(); renderEvents();
    `);
    const calendarIds = () => evaluate('OphthalCalendarView.getCalendar().getEvents().map(e=>e.id).sort()');
    const filteredIds = () => evaluate('getFilteredEvents().map(e=>e.id).sort()');
    const waitForHeadingSync = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const gesture = async (dx, dy, mouse = false) => {
      await evaluate('document.querySelector(".fc-view-harness").scrollIntoView({block:"center"})');
      const point = await evaluate(`(() => {const r=document.querySelector('.fc-view-harness').getBoundingClientRect();const header=document.querySelector('header').getBoundingClientRect();return {x:r.left+r.width*${dx < 0 ? 0.8 : 0.2},y:Math.max(header.bottom+160,Math.min(innerHeight-160,r.top+70))};})()`);
      if (mouse) {
        await call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
        await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+dx,y:point.y+dy,button:'left',buttons:1});
        await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+dx,y:point.y+dy,button:'left',clickCount:1});
      } else {
        await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:point.x,y:point.y}]});
        for (const fraction of [0.25,0.5,0.75,1]) {
          await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:point.x+dx*fraction,y:point.y+dy*fraction}]});
          await delay(30);
        }
        await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      await delay(100);
      await evaluate(`new Promise(resolve => {
        const settled = () => document.getElementById('event-calendar').hasAttribute('aria-busy')
          ? requestAnimationFrame(settled) : resolve();
        settled();
      })`);
    };
    for (const width of [Number(process.env.CALENDAR_TEST_WIDTH)]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 768 });
      await call('Emulation.setTouchEmulationEnabled', { enabled: width <= 768, maxTouchPoints: 5 });
      // Range headings use the real renderer at each device width and both routes.
      const rangeFixtures = [
        { date: '2026-12-04', endDate: '2026-12-06', text: '2026年12月4日（金）〜6日（日）', startClass: '', endClass: 'compact-date-sunday' },
        { date: '2026-10-29', endDate: '2026-11-01', text: '2026年10月29日（木）〜11月1日（日）', startClass: '', endClass: 'compact-date-sunday' },
        { date: '2026-12-31', endDate: '2027-01-03', text: '2026年12月31日（木）〜2027年1月3日（日）', startClass: '', endClass: 'compact-date-sunday' },
        { date: '2026-09-19', endDate: '2026-09-21', text: '2026年9月19日（土）〜21日（月・祝）', startClass: 'compact-date-saturday', endClass: 'compact-date-holiday', holiday: '敬老の日' },
        { date: '2027-02-11', endDate: '2027-02-13', text: '2027年2月11日（木・祝）〜13日（土）', startClass: 'compact-date-holiday', endClass: 'compact-date-saturday', holiday: '建国記念の日' },
        { date: '2026-12-06', endDate: '2026-12-07', text: '2026年12月6日（日）〜7日（月）', startClass: 'compact-date-sunday', endClass: '' }
      ];
      const rangeColors = {
        'compact-date-sunday': 'rgb(180, 83, 83)',
        'compact-date-holiday': 'rgb(180, 83, 83)',
        'compact-date-saturday': 'rgb(71, 122, 158)'
      };
      for (const route of ['/', '/ophthalconf/']) {
        await navigate(route + '?view=list');
        await reset();
        for (const fixture of rangeFixtures) {
          await evaluate(`state.events=[{...sampleEvents.find(e=>e.isConference),id:'range-regression',title:'日付範囲の回帰テスト',date:${JSON.stringify(fixture.date)},endDate:${JSON.stringify(fixture.endDate)}}];renderEvents();document.getElementById('view-compact').click();OphthalCalendarView.getCalendar().gotoDate(${JSON.stringify(fixture.date.slice(0, 7) + '-01')});`);
          await waitForHeadingSync();
          const heading = await evaluate(`(() => {
            const cushion=document.querySelector('.fc-list-day-cushion');
            const start=cushion.querySelector('.compact-date-start'),end=cushion.querySelector('.compact-date-end');
            return {
              text:start.textContent+cushion.querySelector('.compact-date-separator').textContent+end.textContent,
              startClass:start.className,endClass:end.className,
              startColor:getComputedStyle(start).color,endColor:getComputedStyle(end).color,
              weekdayColor:getComputedStyle(cushion).color,
              holiday:cushion.querySelector('.calendar-holiday-name')?.textContent,
              headingFits:cushion.scrollWidth<=cushion.clientWidth+1,
              calendarFits:document.getElementById('event-calendar').scrollWidth<=document.getElementById('event-calendar').clientWidth+1,
              pageFits:document.documentElement.scrollWidth<=innerWidth+1
            };
          })()`);
          assert.equal(heading.text, fixture.text);
          for (const side of ['start', 'end']) {
            const colorClass = fixture[side + 'Class'];
            if (colorClass) assert.ok(heading[side + 'Class'].split(' ').includes(colorClass));
            assert.equal(heading[side + 'Color'], rangeColors[colorClass] || heading.weekdayColor, side + ' date color');
          }
          assert.equal(heading.holiday, fixture.holiday);
          assert.ok(heading.headingFits && heading.calendarFits && heading.pageFits, process.env.CALENDAR_TEST_WIDTH + 'px ' + route + ' ' + fixture.date + ' range fits');
        }
        // Different durations on one start date need distinct headings; equal
        // durations share a heading and retain their original relative order.
        await evaluate(`
          const template=sampleEvents.find(e=>e.isConference);
          state.events=[
            {id:'duration-four',endDate:'2026-11-10'},
            {id:'duration-two-first',endDate:'2026-11-08'},
            {id:'duration-one',endDate:'2026-11-07'},
            {id:'duration-two-second',endDate:'2026-11-08'}
          ].map(e=>({...template,date:'2026-11-07',title:e.id,...e}));
          renderEvents();OphthalCalendarView.getCalendar().gotoDate('2026-11-01');
        `);
        const expectedGroups = [
          { heading: '2026年11月7日（土）', ids: ['duration-one'] },
          { heading: '2026年11月7日（土）〜8日（日）', ids: ['duration-two-first', 'duration-two-second'] },
          { heading: '2026年11月7日（土）〜10日（火）', ids: ['duration-four'] }
        ];
        // Re-rendering must not accumulate duplicate injected headings.
        for (let pass = 0; pass < 2; pass++) {
          if (pass) await evaluate('renderEvents()');
          await waitForHeadingSync();
          const groups = await evaluate(`(() => {
            const groups=[];
            for (const row of document.querySelectorAll('.fc-list-table tbody > tr')) {
              if (row.classList.contains('fc-list-day')) {
                const cushion=row.querySelector('.fc-list-day-cushion');
                if (cushion.scrollWidth>cushion.clientWidth+1) throw Error('Duration heading overflow');
                groups.push({heading:[...cushion.querySelectorAll('.compact-date,.compact-date-separator')].map(e=>e.textContent).join(''),ids:[]});
              } else if (row.classList.contains('fc-list-event')) {
                groups.at(-1).ids.push(row.dataset.eventId);
              }
            }
            return groups;
          })()`);
          assert.deepEqual(groups, expectedGroups, width + 'px ' + route + ' duration groups, render ' + pass);
        }
      }
      console.log('PASS: ' + width + 'px range headings, month/year boundaries, weekend/holiday colors, duration groups and no horizontal overflow on both routes');
      for (const route of ['/', '/ophthalconf/']) {
        await navigate(route + '?month=2027-03');
        assert.equal(await evaluate('OphthalCalendarView.getMode()'), width <= 600 ? 'compact' : 'calendar', 'Width default only applies without explicit URL');
        await navigate(route + '?view=list&month=2027-03');
        assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'list');
        assert.equal(await evaluate('elements.eventList.hidden'), false);
        await reset();
        for (const nextMode of ['calendar', 'compact', 'list']) {
          await evaluate(`document.getElementById('view-${nextMode}').click()`);
          assert.equal(await evaluate('OphthalCalendarView.getMode()'), nextMode);
          assert.equal(await evaluate('new URL(location.href).searchParams.get("view")'), nextMode);
          assert.equal(await evaluate('document.querySelectorAll(".event-view-switch [aria-pressed=true]").length'), 1);
          await evaluate('state.filters.keyword="retina"; renderEvents()');
          assert.deepEqual(await calendarIds(), await filteredIds(), nextMode + ' uses shared filters');
          if (nextMode === 'list') assert.deepEqual(await evaluate('[...elements.eventList.querySelectorAll(".event-card")].map(e=>e.dataset.id).sort()'), await filteredIds());
          await reset();
        }
        for (const displayMode of ['calendar', 'compact']) {
        await navigate(route + `?view=${displayMode}&month=2027-03&keep=yes#calendar-test`);
        await reset();
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().view.type'), displayMode === 'calendar' ? 'dayGridMonth' : 'listMonth');
        assert.equal(await evaluate('elements.eventList.hidden'), true);
        assert.ok(await evaluate('getComputedStyle(elements.eventList).display === "none"'));
        assert.deepEqual(await calendarIds(), await filteredIds());
        assert.equal(await evaluate('document.querySelector(".fc-toolbar-title").textContent'), '2027年3月');
        if(displayMode==='calendar') assert.equal(await evaluate('document.querySelector(\'.fc-daygrid-day[data-date="2027-03-21"]\').dataset.holidayName'), '春分の日');
        assert.ok(await evaluate('!document.getElementById("calendar-month-holidays")&&!document.getElementById("calendar-holiday-note")'),'No redundant holiday footer');
        assert.equal(await evaluate('document.querySelector(".fc-prev-button").textContent'), '前月');
        assert.equal(await evaluate('document.querySelector(".fc-next-button").textContent'), '翌月');
        assert.equal(await evaluate('document.querySelector(".fc-today-button").textContent'), '今月');
        // March fixture spans Thu 18 to Sun 21: exactly four days and two weekly
        // segments in dayGrid, not four independent single-day copies.
        await evaluate(`state.events.push({...sampleEvents.find(e=>e.isConference), id:'calendar-four-day', title:'Calendar four-day fixture', date:'2027-03-18', endDate:'2027-03-21'}); renderEvents();`);
        const range = await evaluate(`(() => {const e=OphthalCalendarView.getCalendar().getEventById('calendar-four-day'); return {start:e.startStr,end:e.endStr,allDay:e.allDay};})()`);
        assert.deepEqual(range, displayMode === 'calendar' ? { start: '2027-03-18', end: '2027-03-22', allDay: true } : { start: '2027-03-18', end: '2027-03-19', allDay: true });
        if (displayMode === 'compact') {
          assert.ok(await evaluate('!!document.querySelector(".fc-list-day.calendar-holiday .calendar-holiday-name")'), 'List date headings mark holidays too');
          await evaluate(`state.events.push({...sampleEvents.find(e=>e.isConference),id:'holiday-position',date:'2027-11-23',endDate:'2027-11-23'});renderEvents();OphthalCalendarView.getCalendar().gotoDate('2027-11-01')`);
          assert.ok(await evaluate(`(() => {const group=document.querySelector('.fc-list-day[data-date="2027-11-23"].calendar-holiday .fc-list-day-cushion'),date=group?.querySelector('.compact-date'),label=group?.querySelector('.calendar-holiday-name');return date?.textContent==='2027年11月23日（火・祝）'&&label?.textContent==='勤労感謝の日'&&date?.nextElementSibling===label&&group?.scrollWidth<=group?.clientWidth+1&&!group?.querySelector('.fc-list-day-side-text');})()`), 'Combined date/weekday precedes holiday and fits');
          if (process.env.CALENDAR_SCREENSHOTS === '1') {
            const holidayScreenshot = await call('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
            fs.writeFileSync(path.join(profile, `holiday-${route==='/'?'root':'subpath'}-${width}.png`),Buffer.from(holidayScreenshot.data,'base64'));
          }
          await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-03-01")');
        }
        if (displayMode === 'calendar') {
          assert.equal(await evaluate('document.querySelectorAll(".fc-col-header-cell").length'), 7);
          assert.ok(await evaluate('document.querySelector(".fc-col-header-cell").textContent.includes("月")'), 'First column is Monday');
          assert.equal(await evaluate('document.querySelectorAll(\'.fc-event[data-event-id="calendar-four-day"]\').length'), 1, 'Thursday-Sunday renders as a continuous weekend segment in Monday-first grid');
        }
        if (width <= 768 && route === '/') {
          await gesture(-140, 8);
          assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 3, 'Left swipe moves exactly one month');
          assert.equal(await evaluate('new URL(location.href).searchParams.get("month")'), '2027-04');
          assert.equal(await evaluate('document.getElementById("calendar-event-dialog").open'), false, 'Swipe does not activate an event');
          await gesture(140, 8);
          assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 2, 'Right swipe moves exactly one month');
          assert.equal(await evaluate('new URL(location.href).searchParams.get("month")'), '2027-03');
          await gesture(-25, 0);
          assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 2, 'Short motion does not navigate');
          await gesture(-70, -110);
          assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 2, 'Vertical scroll does not navigate');
          await evaluate('document.getElementById("calendar-event-dialog").open && document.getElementById("calendar-event-dialog").close()');
          await delay(500);
          await evaluate('document.querySelector(\'.fc-event[data-event-id="calendar-four-day"]\').scrollIntoView({block:"center"})');
          await delay(100);
          const tap = await evaluate(`(() => {const row=document.querySelector('.fc-event[data-event-id="calendar-four-day"]');const r=(row.querySelector('.fc-list-event-title')||row).getBoundingClientRect();return {id:2,x:r.left+r.width/2,y:r.top+r.height/2};})()`);
          await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tap]});
          await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await delay(100);
          assert.equal(await evaluate('document.getElementById("calendar-event-dialog").open'), true, 'A deliberate event touch tap still opens details');
          await evaluate('document.getElementById("calendar-event-close").click()');
        } else if (width > 768) {
          await gesture(-140, 8, true);
          assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 2, 'PC mouse drag does not navigate');
        }
        // Filter changes go through the real input listeners, not a new calendar filter.
        await evaluate('document.querySelector(\'input[name="year"][value="2026"]\').click()');
        assert.deepEqual(await calendarIds(), await filteredIds());
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getFullYear()'), 2026);
        await evaluate('document.querySelector(\'input[name="year"][value="2026"]\').click(); document.querySelector(\'input[name="year"][value="2027"]\').click()');
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getFullYear()'), 2027);
        for (const group of ['region', 'specialty', 'eventType', 'format', 'company']) {
          const changed = await evaluate(`(() => {const box=document.querySelector('input[name=${group}]');if(!box)return false;box.click();return true;})()`);
          assert.ok(changed, group);
          assert.deepEqual(await calendarIds(), await filteredIds(), group + ' instant update');
          await evaluate(`document.querySelector('input[name=${group}]').click()`);
        }
        await evaluate('state.filters.keyword="no matching fixture"; renderEvents()');
        assert.deepEqual(await calendarIds(), []);
        await reset();
        await evaluate('OphthalCalendarView.getCalendar().gotoDate("2026-10-01")');
        const international = await evaluate(`(() => {const e=state.events.find(e=>e.id==='oph-004'), c=OphthalCalendarView.getCalendar().getEventById(e.id);return {date:e.date,end:e.endDate,start:c.startStr,calendarEnd:c.endStr};})()`);
        assert.equal(international.start, international.date);
        assert.equal(international.calendarEnd, require('../calendar-view').nextDate(displayMode === 'calendar' ? international.end : international.date));
        await evaluate('document.querySelector(".fc-next-button").click()');
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 10);
        await evaluate('document.querySelector(".fc-prev-button").click()');
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getMonth()'), 9);
        await evaluate('document.querySelector(".fc-today-button").click()');
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().getDate().getFullYear()'), 2026);
        // A real event click opens the full existing card and its action handlers.
        await evaluate(`document.querySelector('.fc-event[data-event-id="oph-004"]').click()`);
        assert.ok(await evaluate('document.getElementById("calendar-event-dialog").open'));
        assert.ok(await evaluate('!!document.querySelector("#calendar-event-detail .event-card [data-action=add-calendar]")'));
        assert.ok(await evaluate('!!document.querySelector("#calendar-event-detail .card-title")'));
        assert.ok(await evaluate('document.getElementById("calendar-event-dialog").scrollWidth <= document.getElementById("calendar-event-dialog").clientWidth + 1'));
        const id = await evaluate('document.querySelector("#calendar-event-detail .event-card").dataset.id');
        await evaluate('document.querySelector("#calendar-event-detail [data-action=attend-choice][data-choice=yes]").click()');
        assert.ok(await evaluate(`state.attendingConferences.has(${JSON.stringify(id)})`));
        assert.deepEqual(await calendarIds(), await filteredIds());
        await evaluate('document.querySelector("#calendar-event-detail [data-action=attend-choice][data-choice=no]").click()');
        assert.ok(await evaluate(`state.hiddenConferences.has(${JSON.stringify(id)})`));
        assert.equal(await evaluate('document.getElementById("calendar-event-dialog").open'), false);
        assert.deepEqual(await calendarIds(), await filteredIds());
        await evaluate('OphthalCalendarView.getCalendar().gotoDate("2027-03-01")');
        assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width + route + ' page overflow');
        assert.ok(await evaluate('document.getElementById("event-calendar").scrollWidth <= document.getElementById("event-calendar").clientWidth + 1'), width + route + ' calendar overflow');
        if (process.env.CALENDAR_SCREENSHOTS === '1') {
          const screenshot = await call('Page.captureScreenshot', { format:'png',captureBeyondViewport:false });
          fs.writeFileSync(path.join(profile, `calendar-${route==='/'?'root':'subpath'}-${width}.png`), Buffer.from(screenshot.data,'base64'));
        }
        const storage = await evaluate('JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])))');
        await evaluate('document.getElementById("view-list").click()');
        assert.equal(await evaluate('elements.eventList.hidden'), false);
        assert.equal(await evaluate('document.getElementById("calendar-panel").hidden'), true);
        assert.equal(await evaluate('new URL(location.href).searchParams.get("view")'), 'list');
        await evaluate('document.getElementById("view-calendar").click()');
        assert.equal(await evaluate('new URL(location.href).searchParams.get("view")'), 'calendar');
        await evaluate('document.getElementById("view-compact").click()');
        assert.equal(await evaluate('new URL(location.href).searchParams.get("view")'), 'compact');
        await evaluate(`document.getElementById('view-${displayMode}').click()`);
        assert.equal(await evaluate('JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])))'), storage);
        assert.equal(await evaluate('new URL(location.href).searchParams.get("keep")'), 'yes');
        assert.equal(await evaluate('location.hash'), '#calendar-test');
        const previousTimeOrigin = await evaluate('performance.timeOrigin');
        await call('Page.reload');
        for(let i=0;i<100 && !await evaluate(`performance.timeOrigin !== ${previousTimeOrigin} && document.readyState === 'complete' && !!window.OphthalCalendarView?.getCalendar()`);i++) await delay(100);
        assert.equal(await evaluate('OphthalCalendarView.getMode()'), displayMode);
        assert.equal(await evaluate('OphthalCalendarView.getCalendar().view.currentStart.getMonth()'), 2);
        console.log(`PASS: ${width}px ${route} ${displayMode}, 3-mode filters, holidays, navigation/swipes/taps, URL reload and localStorage`);
        }
      }
    }
    // Resizing must retain the explicit mode even across the mobile breakpoint.
    await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getCalendar().view.type'), 'listMonth');
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'compact');
    await evaluate('document.getElementById("view-calendar").click()');
    await call('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:true});
    await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getCalendar().view.type'), 'dayGridMonth');
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'calendar');
    await evaluate('document.getElementById("view-compact").click();document.getElementById("view-list").click(); history.back()');
    await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'compact');
    await evaluate('history.back()'); await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'calendar');
    await evaluate('history.forward()'); await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'compact');
    await evaluate('history.forward()'); await delay(300);
    assert.equal(await evaluate('OphthalCalendarView.getMode()'), 'list');
    console.log('PASS: resize and browser back/forward');
    if (process.env.CALENDAR_SCREENSHOTS === '1') console.log('Screenshots: ' + profile);
    await call('Browser.close');
  } finally { socket?.close(); if (browser.exitCode === null) browser.kill(); await new Promise(resolve => server.close(resolve)); }
}
if (!process.env.CALENDAR_TEST_WIDTH) {
  // Fresh browser per device width avoids carrying native touch-emulation state
  // across desktop/tablet/mobile contexts in headless Chromium on Windows.
  for (const width of [1280, 768, 390, 320]) {
    const result = spawnSync(process.execPath, [__filename], {
      env: { ...process.env, CALENDAR_TEST_WIDTH: String(width) },
      stdio: 'inherit', windowsHide: true
    });
    if (result.status !== 0) { process.exitCode = 1; break; }
  }
} else main().catch(error => { console.error(error); process.exitCode = 1; });
