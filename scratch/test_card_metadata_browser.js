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
    let port;
    for (let i = 0; i < 150; i++) {
      try {
        const candidate = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
        if (/^\d+$/.test(candidate)) { port = candidate; break; }
      } catch (error) {
        if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error;
      }
      await delay(100);
    }
    assert.ok(port, 'Browser debugging port must be readable after startup');
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





    const aao='oph-004';
    for(const width of [1280,900,768,390,320]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});await navigate('/');
      await evaluate('document.getElementById("reset-filter-btn").click();state.filters.includeEndedConferences=true;syncCheckboxesWithState();renderEvents()');
      const addedVenues=await evaluate('(() => {const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,1100)+"px";host.style.margin="0 16px";document.body.append(host);const results=["conf-jp-ringan-2027","conf-jp-jos-2028","oph-011"].map(id=>{const event=state.events.find(e=>e.id===id);host.innerHTML=createEventCardHtml(event);const card=host.querySelector(".event-card"),location=card.querySelector(".location-text"),group=location.querySelector(".venue-links"),links=Array.from(group.querySelectorAll("a")),rects=links.map(e=>e.getBoundingClientRect()),pin=location.querySelector("svg").getBoundingClientRect(),g=group.getBoundingClientRect();return {id,names:links.map(e=>e.textContent),expectedNames:event.venues.map(v=>v.name),urls:links.map(e=>e.getAttribute("href")),expectedUrls:event.venues.map(v=>v.mapUrl),pins:location.querySelectorAll("svg").length,stacked:rects.every((r,i)=>!i||r.top>=rects[i-1].bottom),horizontal:rects.every(r=>Math.abs(r.top-rects[0].top)<1),center:Math.abs(pin.top+pin.height/2-g.top-g.height/2),fits:card.scrollWidth<=card.clientWidth+1};});host.remove();return results;})()');
      for(const result of addedVenues){assert.deepEqual(result.names,result.expectedNames);assert.deepEqual(result.urls,result.expectedUrls);assert.equal(new Set(result.urls).size,result.urls.length);assert.equal(result.pins,1);assert.ok(result.fits);if(width<=480){assert.ok(result.stacked);assert.ok(result.center<1);}else assert.ok(result.horizontal);}
      const longVenues=await evaluate('(() => {const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,900)+"px";host.style.margin="0 16px";document.body.append(host);const base=state.events.find(e=>e.id==="oph-001"),event={...base,venues:base.venues.map(v=>({...v,name:v.name+"（長い会場名の折り返し確認用・大会会議室および講演会場）"}))};host.innerHTML=createEventCardHtml(event);const card=host.querySelector(".event-card"),location=card.querySelector(".location-text"),group=location.querySelector(".venue-links"),pin=location.querySelector("svg"),rects=Array.from(group.querySelectorAll("a"),e=>e.getBoundingClientRect()),p=pin.getBoundingClientRect(),g=group.getBoundingClientRect();const result={fits:card.scrollWidth<=card.clientWidth+1,pins:location.querySelectorAll("svg").length,center:Math.abs(p.top+p.height/2-g.top-g.height/2),stacked:rects[1].top>=rects[0].bottom};host.remove();return result;})()');
      assert.ok(longVenues.fits);assert.equal(longVenues.pins,1);assert.ok(longVenues.center<1);if(width<=480)assert.ok(longVenues.stacked);
      const timeCases=await evaluate('(() => {const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,900)+"px";host.style.margin="0 16px";document.body.append(host);const base={...state.events.find(e=>e.id==="conf-jp-jrvs-2026"),time:"09:00 - 18:00（全日程）"};const result=[base,{...base,showConferenceTime:true},{...base,isConference:false}].map(event=>{host.innerHTML=createEventCardHtml(event);const card=host.querySelector(".event-card"),date=card.querySelector(".date-badge").getBoundingClientRect(),region=card.querySelector(".time-and-region").getBoundingClientRect();return {hasTime:!!card.querySelector(".time-text"),hasVenue:!!card.querySelector(".location-text"),center:Math.abs(date.top+date.height/2-region.top-region.height/2),fits:card.scrollWidth<=card.clientWidth+1};});host.remove();return result;})()');
      assert.deepEqual(timeCases.map(e=>e.hasTime),[false,true,true]);assert.ok(timeCases.every(e=>e.hasVenue&&e.center<1&&e.fits));
      const conferenceFormats=await evaluate('(() => {const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,900)+"px";host.style.margin="0 16px";document.body.append(host);const base=state.events.find(e=>e.id==="conf-jp-jrvs-2026");const measure=e=>{const s=getComputedStyle(e);return {height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,letterSpacing:s.letterSpacing,padding:s.padding,font:s.fontSize,weight:s.fontWeight,line:s.lineHeight,color:s.color,background:s.backgroundColor,radius:s.borderRadius};};const results=[];for(const format of ["ハイブリッド","Web"]){host.innerHTML=createEventCardHtml({...base,isConference:false,format});const reference=measure(host.querySelector(".format-badge"));for(const title of ["短い学会名", "第83回日本弱視斜視学会総会／第52回日本小児眼科学会総会・合同開催の長い学会名", "第80回 日本臨床眼科学会"]){host.innerHTML=createEventCardHtml({...base,format,title});const card=host.querySelector(".event-card"),heading=card.querySelector(".card-title"),badge=card.querySelector(".conf-classification-val .format-badge");results.push({format,title,inTop:!!card.querySelector(".card-top-row .format-badge"),reference,classification:measure(card.querySelector(".conf-category-badge.region")),actual:measure(badge),align:getComputedStyle(badge).alignItems,last:card.querySelector(".conf-classification-val").lastElementChild===badge,titleBadge:!!heading.querySelector(".format-badge"),within:badge.getBoundingClientRect().right<=card.getBoundingClientRect().right,fits:card.scrollWidth<=card.clientWidth+1});}}host.remove();return results;})()');
      for(const result of conferenceFormats){assert.ok(!result.inTop);assert.ok(result.last);assert.equal(result.align,'center');assert.ok(!result.titleBadge);for(const key of ['color','background','radius','weight','letterSpacing'])assert.equal(result.actual[key],result.reference[key],key+' unchanged');for(const key of ['height','font','line'])assert.equal(result.actual[key],result.classification[key],key+' matches classification');assert.equal(result.actual.padding,'2px 10px');assert.ok(result.within);assert.ok(result.fits);}
      const abstractStates=await evaluate('(() => {const host=document.createElement("div");host.style.width=Math.min(innerWidth-32,800)+"px";host.style.margin="0 16px";const base=state.events.find(e=>e.id==="conf-jp-jrvs-2026");host.innerHTML=createEventCardHtml(base);document.body.append(host);const card=host.querySelector(".event-card"),target=card.querySelector(".conf-abstract-deadline-val"),badge=card.querySelector(".conf-category-badge.region");const measure=e=>{const s=getComputedStyle(e);return {height:e.getBoundingClientRect().height,padding:s.padding,lineHeight:s.lineHeight,fontSize:s.fontSize,borderRadius:s.borderRadius,alignItems:s.alignItems};};const rows=["open","normal","soon","urgent","today","upcoming","closed"].map(state=>{target.innerHTML="<span class=\\"abstract-status-tag "+state+"\\">"+(state==="open"?"演題募集中":"注意・締切まで10日")+"</span> <a class=\\"abstract-submit-link\\" href=\\"https://example.com/\\">演題登録詳細 ↗</a>";const tag=target.querySelector("span"),link=target.querySelector("a"),s=getComputedStyle(tag);return {state,tag:measure(tag),link:measure(link),badge:measure(badge),border:s.borderTopWidth,color:s.color,background:s.backgroundColor,fits:card.scrollWidth<=card.clientWidth+1};});host.remove();return rows;})()');
      const statusColors={open:['rgb(4, 120, 87)','rgb(236, 253, 245)'],normal:['rgb(30, 64, 175)','rgb(239, 246, 255)'],soon:['rgb(180, 83, 9)','rgb(255, 251, 235)'],urgent:['rgb(185, 28, 28)','rgb(254, 242, 242)'],today:['rgb(255, 255, 255)','rgb(153, 27, 27)'],upcoming:['rgb(30, 64, 175)','rgb(239, 246, 255)'],closed:['rgb(71, 85, 105)','rgb(241, 245, 249)']};
      for(const result of abstractStates){assert.deepEqual(result.tag,result.badge,result.state+' status dimensions');assert.deepEqual(result.link,result.badge,'Link dimensions');assert.equal(result.border,result.state==='today'?'2px':'1px');assert.deepEqual([result.color,result.background],statusColors[result.state]);assert.ok(result.fits);}
      const sortControl=await evaluate('(() => {const select=document.getElementById("sort-select"),r=select.getBoundingClientRect();return {options:Array.from(select.options,e=>e.textContent),fits:r.right<=innerWidth&&select.scrollWidth<=select.clientWidth+2};})()');
      assert.deepEqual(sortControl.options,['開催日（近い順）','事前参加登録締切（近い順）','演題締切（近い順）','イベント名（50音順）']);assert.ok(sortControl.fits);
      await evaluate('elements.sortSelect.value="registration-deadline-asc";elements.sortSelect.dispatchEvent(new Event("change",{bubbles:true}))');
      assert.equal(await evaluate('state.sortBy'),'registration-deadline-asc');
      const webinar=await evaluate('state.events.find(e=>!e.isConference&&!e.parentConferenceId&&e.specialty===String.fromCharCode(32209,20869,38556)).id');
      for(const mode of ['list','calendar','compact']) {
        await evaluate('document.getElementById("view-'+mode+'").click()');
        if(mode==='compact') {
          await evaluate('OphthalCalendarView.getCalendar().gotoDate("2026-10-01")');
          const typography=await evaluate('(() => {const title=document.querySelector(".fc-list-event-title"),heading=document.querySelector(".fc-list-day-cushion"),measure=e=>{const s=getComputedStyle(e);return {fontSize:parseFloat(s.fontSize),lineHeight:parseFloat(s.lineHeight),fontWeight:s.fontWeight,padding:s.padding};};const after={title:measure(title),heading:measure(heading)};const baseline=document.createElement("style");baseline.textContent="@media(min-width:601px){#calendar-panel[data-view=compact] .fc-list-event-title{font-size:.75rem;line-height:1.55}}";document.head.append(baseline);const before={title:measure(title),heading:measure(heading)};baseline.remove();return {before,after};})()');
          assert.equal(typography.after.title.fontSize,width>600?13:13.92);
          assert.equal(typography.after.title.lineHeight,typography.before.title.lineHeight);
          assert.equal(typography.after.title.padding,typography.before.title.padding);assert.equal(typography.after.title.fontWeight,typography.before.title.fontWeight);
          assert.deepEqual(typography.after.heading,typography.before.heading);assert.ok(typography.after.title.fontSize<typography.after.heading.fontSize);
        }
        for(const id of [aao,webinar,'oph-001','conf-jp-pediatric-2027','conf-jp-myopia-2028','conf-jp-cornea-2026','conf-jp-jrvs-2026','conf-jp-eyelid-2027','conf-int-ascrs-2027']) {
          if(mode==='calendar'&&id==='conf-jp-cornea-2026')continue; // Pre-October ended events are outside monthly calendar history.
          let selector='[data-id="'+id+'"]';
          if(mode!=='list') {
            await evaluate('OphthalCalendarView.getCalendar().gotoDate(state.events.find(e=>e.id==='+JSON.stringify(id)+').date)');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');await evaluate('document.querySelector('+JSON.stringify('.fc-event[data-event-id="'+id+'"]')+').click()');selector='#calendar-event-detail '+selector;
          }
          const result=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+');return {labels:Array.from(card.querySelectorAll(".card-meta-label"),e=>e.textContent),top:!!card.querySelector(".conf-classification-val"),classification:Array.from(card.querySelectorAll(".conf-classification-val .conf-category-badge"),e=>e.textContent),sponsor:card.querySelector(".card-meta-list").textContent, fits:card.scrollWidth<=card.clientWidth+1,pageFits:document.documentElement.scrollWidth<=innerWidth+1};})()');
          const specialty=String.fromCharCode(23554,38272,38936,22495)+':',type=String.fromCharCode(31278,21029)+':',sponsor=String.fromCharCode(20027,20652)+'/'+String.fromCharCode(20849,20652)+':';
          assert.equal(result.labels.includes(specialty),id===webinar);assert.equal(result.labels.includes(type),id===webinar);assert.ok(result.labels.includes(sponsor));assert.equal(result.top,id!==webinar);assert.ok(result.fits);assert.ok(result.pageFits);if(id===aao)assert.ok(result.sponsor.includes('American Academy of Ophthalmology'));
          const actions=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+');const event=state.events.find(e=>e.id==='+JSON.stringify(id)+');return {linked:!!(event.isConference&&event.eventOfficialUrl),titleUrl:card.querySelector(".conference-title-link")?.getAttribute("href")||null,expectedUrl:event.eventOfficialUrl||null,pdf:!!card.querySelector("[data-action=view-pdf]"),official:!!card.querySelector(".btn-official"),calendar:!!card.querySelector("[data-action=add-calendar]"),status:!!card.querySelector(".card-actions-row .schedule-badge")};})()');
          assert.equal(actions.pdf,!actions.linked);assert.equal(actions.official,!actions.linked);assert.ok(actions.calendar);assert.ok(actions.status);if(actions.linked)assert.equal(actions.titleUrl,actions.expectedUrl);
          const formatBadge=await evaluate('(() => {const event=state.events.find(e=>e.id==='+JSON.stringify(id)+');return {shown:document.querySelector('+JSON.stringify(selector)+').querySelector(".format-badge")?.textContent||null,expected:shouldDisplayEventFormat(event)?event.format:null};})()');
          assert.equal(formatBadge.shown,formatBadge.expected);
          const timeLayout=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+'),event=state.events.find(e=>e.id==='+JSON.stringify(id)+'),date=card.querySelector(".date-badge").getBoundingClientRect(),region=card.querySelector(".time-and-region").getBoundingClientRect();return {conference:event.isConference,hasTime:!!card.querySelector(".time-text"),expected:shouldDisplayEventTime(event),venue:!!card.querySelector(".location-text"),center:Math.abs(date.top+date.height/2-region.top-region.height/2)};})()');
          assert.equal(timeLayout.hasTime,timeLayout.expected);if(timeLayout.conference)assert.ok(!timeLayout.hasTime);assert.ok(timeLayout.venue);assert.ok(timeLayout.center<1,'Time/location block centered against date');
          if(id==='oph-001') {
            const title=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+'),event=state.events.find(e=>e.id==="oph-001"),link=card.querySelector(".conference-title-link");return {visible:link.innerText,full:event.title,url:link.getAttribute("href"),expectedUrl:event.eventOfficialUrl,suffix:!!link.querySelector(".conference-title-ringan-suffix")};})()');
            assert.equal(title.visible,'第80回 日本臨床眼科学会');assert.equal(title.full,title.visible);assert.ok(!title.suffix);assert.equal(title.url,title.expectedUrl);
            if(mode!=='list')assert.equal(await evaluate('OphthalCalendarView.getCalendar().getEventById("oph-001").title'),'第80回 日本臨床眼科学会');
            const venues=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+'),location=card.querySelector(".location-text"),group=location.querySelector(".venue-links"),pin=location.querySelector("svg"),links=Array.from(group.querySelectorAll("a")),rects=links.map(e=>e.getBoundingClientRect()),p=pin.getBoundingClientRect(),g=group.getBoundingClientRect();return {names:links.map(e=>e.textContent),urls:links.map(e=>e.getAttribute("href")),expected:state.events.find(e=>e.id==="oph-001").venues.map(v=>v.mapUrl),pins:location.querySelectorAll("svg").length,stacked:rects[1].top>=rects[0].bottom,sameRow:Math.abs(rects[0].top-rects[1].top)<1,pinCenter:Math.abs(p.top+p.height/2-g.top-g.height/2),fits:card.scrollWidth<=card.clientWidth+1};})()');
            assert.deepEqual(venues.names,['国立京都国際会館','ザ・プリンス 京都宝ヶ池']);assert.deepEqual(venues.urls,venues.expected);assert.notEqual(...venues.urls);assert.equal(venues.pins,1);assert.ok(venues.fits);
            if(width<=480){assert.ok(venues.stacked);assert.ok(venues.pinCenter<1);}else assert.ok(venues.sameRow);
          }
          const formatPlacement=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+'),event=state.events.find(e=>e.id==='+JSON.stringify(id)+'),badge=card.querySelector(".format-badge");return {conference:event.isConference,inTitle:!!card.querySelector(".card-title .format-badge"),inClassification:!!card.querySelector(".conf-classification-val .format-badge"),inTop:!!card.querySelector(".card-top-row .format-badge"),align:badge?getComputedStyle(badge).verticalAlign:null,padding:badge?getComputedStyle(badge).padding:null,font:badge?getComputedStyle(badge).fontSize:null};})()');
          if(formatBadge.shown){assert.ok(!formatPlacement.inTitle);assert.equal(formatPlacement.inClassification,!!formatPlacement.conference);assert.equal(formatPlacement.inTop,!formatPlacement.conference);if(formatPlacement.conference){assert.equal(formatPlacement.align,'baseline');assert.equal(formatPlacement.padding,'2px 10px');assert.equal(formatPlacement.font,'11.52px');}}
          if(id===aao||id===webinar) {
            const description=await evaluate('(() => {const event=state.events.find(e=>e.id==='+JSON.stringify(id)+');return {shown:document.querySelector('+JSON.stringify(selector)+').querySelector(".card-desc").textContent,original:event.description};})()');
            assert.equal(description.shown,id===aao&&description.original.endsWith('。')?description.original.slice(0,-1):description.original);
          }
          if(id==='conf-jp-jrvs-2026'||id==='conf-jp-eyelid-2027') {
            const registration=await evaluate('(() => {const event=state.events.find(e=>e.id==='+JSON.stringify(id)+');const rows=Array.from(document.querySelector('+JSON.stringify(selector)+').querySelectorAll(".conf-registration-period"));return {labels:rows.map(e=>e.querySelector(".conf-label").textContent),expected:getRegistrationState(event).display.label+"：",fits:rows.every(e=>e.scrollWidth<=e.clientWidth+1)};})()');
            assert.deepEqual(registration.labels,[registration.expected]);assert.ok(registration.fits,'Single next registration phase fits');
          }
          const abstractChip=await evaluate('(() => {const card=document.querySelector('+JSON.stringify(selector)+');const link=card.querySelector(".abstract-submit-link"),badge=card.querySelector(".conf-category-badge.region");if(!link||!badge)return null;const measure=e=>{const s=getComputedStyle(e);return {height:e.getBoundingClientRect().height,padding:s.padding,borderRadius:s.borderRadius,fontSize:s.fontSize,lineHeight:s.lineHeight};};const status=card.querySelector(".abstract-status-tag.closed");return {link:measure(link),badge:measure(badge),status:status?measure(status):null,statusColors:status?[getComputedStyle(status).color,getComputedStyle(status).backgroundColor]:null,href:link.getAttribute("href"),expected:state.events.find(e=>e.id==='+JSON.stringify(id)+').abstractSubmission.url,external:link.textContent.includes("↗"),target:link.target,aligned:!status||Math.abs(status.getBoundingClientRect().y+status.getBoundingClientRect().height/2-link.getBoundingClientRect().y-link.getBoundingClientRect().height/2)<1};})()');
          if(abstractChip){assert.deepEqual(abstractChip.link,abstractChip.badge,'Abstract and category chip dimensions match');if(abstractChip.status){assert.deepEqual(abstractChip.status,abstractChip.badge,'Closed status chip dimensions match');assert.deepEqual(abstractChip.statusColors,['rgb(71, 85, 105)','rgb(241, 245, 249)']);}assert.equal(abstractChip.href,abstractChip.expected);assert.equal(abstractChip.target,'_blank');assert.ok(abstractChip.external);assert.ok(abstractChip.aligned,'Closed status and link remain on same row');}
          if(id==='conf-jp-pediatric-2027') {
            assert.equal(result.classification.filter(label=>label==='小児・斜視弱視').length,1);assert.ok(!result.classification.includes('小児斜視'));
            const order=await evaluate('Array.from(document.querySelector('+JSON.stringify(selector)+').querySelectorAll(".conf-label"),e=>e.textContent)');
            const period=order.indexOf('会期:'),chair=order.indexOf('会長:'),category=order.indexOf('学会分類:'),abstract=order.indexOf('演題募集:');
            assert.equal(chair,period+2,'City row precedes chair');assert.equal(category,chair+1);assert.ok(abstract>category);
            const chairText=await evaluate('Array.from(document.querySelector('+JSON.stringify(selector)+').querySelectorAll(".conf-item")).find(e=>e.querySelector(".conf-label")?.textContent==="会長:").querySelector(".conf-val").textContent');
            assert.equal(chairText,'林 思音（山形大学）・彦谷 明子（浜松医科大学）');
            assert.ok(!chairText.includes('医学部'));assert.ok(!chairText.includes('講座'));
            const withoutChair=await evaluate('createEventCardHtml({...state.events.find(e=>e.id==='+JSON.stringify(id)+'),conferenceChair:""})');
            assert.ok(!withoutChair.includes('>会長:</span>'),'Missing chair has no row');
          }
          if(mode!=='list')await evaluate('document.getElementById("calendar-event-close").click()');
        }
      }
      console.log('PASS '+width+'px: AAO hides redundant fields, glaucoma webinar keeps fields, sponsor retained in all three modes');
      await evaluate('getTodayString=()=>"2026-11-02";state.filters.includeEndedConferences=false;syncCheckboxesWithState();document.getElementById("view-list").click();renderEvents()');
      for(const enabled of [false,true]) {
        await evaluate('state.filters.includeEndedConferences='+enabled+';syncCheckboxesWithState();renderEvents()');
        for(const mode of ['calendar','compact','list','calendar']) {
          await evaluate('document.getElementById("view-'+mode+'").click()');
          const history=await evaluate('({ids:getFilteredEvents().map(e=>e.id),count:Number(elements.eventCount.textContent),calendar:OphthalCalendarView.getCalendar().getEvents().map(e=>e.id),overflow:document.documentElement.scrollWidth>innerWidth+1})');
          assert.equal(history.ids.includes('oph-004'),mode==='calendar'||enabled,'AAO ended visibility');
          assert.equal(history.ids.includes('conf-jp-lowvision-2026'),mode!=='calendar'&&enabled,'September cutoff and checkbox');
          assert.equal(history.count,history.ids.length);assert.ok(!history.overflow);
          if(mode!=='list')assert.deepEqual(history.calendar.sort(),history.ids.sort());
          if(mode==='calendar') {await evaluate('OphthalCalendarView.getCalendar().gotoDate("2026-10-01")');assert.ok(await evaluate('!!document.querySelector(".fc-event[data-event-id=oph-004]")'),'AAO visible in October grid');}
        }
      }
      console.log('PASS '+width+'px: ended AAO retained only in monthly calendar by default; September cutoff, checkbox and switch counts');
      await evaluate('getTodayString=()=>"2026-10-13"');
    }
    await call('Browser.close');
  } finally {socket?.close();if(browser.exitCode===null)browser.kill();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
