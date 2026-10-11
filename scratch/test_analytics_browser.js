// Real Edge + local source at the production URL. All external requests are intercepted;
// GA transport is mocked so tests never create production analytics data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sdkFixture = `window.__analyticsTestSDK = {
  getApps:()=>[], initializeApp:()=>({}), getAuth:()=>({}), browserLocalPersistence:'local',
  setPersistence:async()=>{}, onAuthStateChanged:(_,fn)=>{window.__authObserver=fn;fn({uid:'private-test-uid',displayName:'PrivateLoginName',email:'private@example.invalid'});},
  GoogleAuthProvider:class {setCustomParameters(){}}, signInWithPopup:async()=>{}, signOut:async()=>window.__authObserver(null)
};`;
const tagFixture = `(() => {
  const consume = args => { if(args[0] !== 'event') return;
    fetch('https://www.google-analytics.com/g/collect?' + new URLSearchParams({tid:'G-JXE3ZH9PVS',en:args[1],payload:JSON.stringify(args[2])}), {mode:'no-cors'});
  };
  dataLayer.forEach(consume); dataLayer.push = function(...rows) { rows.forEach(consume); return Array.prototype.push.apply(this,rows); };
  window.__gaMockReady=true;
})();`;
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ophthal-analytics-browser-'));
  const browser = spawn(process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
    assert.ok(fs.existsSync(portFile), 'Edge debugging endpoint must start');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map(), requests = [], exceptions = [], interceptionErrors = [], results = [];
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')); }, 15000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const fulfill = (requestId, text, type = 'application/javascript', status = 200) => call('Fetch.fulfillRequest', {
      requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: type + '; charset=utf-8' }], body: Buffer.from(text).toString('base64') });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data), task = pending.get(message.id);
      if (task) { pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(Error(JSON.stringify(message.error))) : task.resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
      if (message.method !== 'Fetch.requestPaused') return;
      (async () => {
        const { requestId, request } = message.params, url = new URL(request.url);
        if (/google-analytics\.com$|googletagmanager\.com$/.test(url.hostname)) {
          requests.push(request.url);
          if (url.hostname === 'www.googletagmanager.com') await fulfill(requestId, tagFixture);
          else await fulfill(requestId, '', 'text/plain', 204);
        } else if (url.hostname === 'medconf.jp') {
          const relative = url.pathname.replace(/^\/ophthalconf\//, '/').replace(/^\//, '') || 'index.html';
          const file = path.resolve(root, relative);
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { await fulfill(requestId, '', 'text/plain', 404); return; }
          let text = fs.readFileSync(file, 'utf8');
          if (relative === 'firebase-auth.js') text = text.replace(
            'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}});',
            'root.OphthalAuth = createController({config: typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {}, load:async()=>root.__analyticsTestSDK});');
          await fulfill(requestId, text, ({ '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' })[path.extname(file)] || 'text/html');
        } else {
          // Unrelated fonts/auth are independent of analytics; stub them, never send externally.
          await fulfill(requestId, '', url.pathname.endsWith('.js') || url.pathname.includes('/gsi/') ? 'application/javascript' : 'text/css');
        }
      })().catch(error => interceptionErrors.push(error.message));
    });
    await call('Page.enable'); await call('Runtime.enable');
    await call('Page.addScriptToEvaluateOnNewDocument', { source: sdkFixture });
    await call('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    const waitFor = async expression => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw Error('Timed out: ' + expression);
    };
    const click = async selector => {
      const point = await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw Error('Missing '+${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    };
    for (const width of [1280, 360]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      if (width === 360) await evaluate("localStorage.removeItem('ophthalconf_analytics_consent_v1'); localStorage.removeItem('ophthalconf_filter_state');");
      const before = requests.length;
      await call('Page.navigate', { url: 'https://medconf.jp/ophthalconf/?view=list&email=private@example.invalid#private-test-uid' });
      await waitFor("document.readyState==='complete' && typeof state==='object' && !!window.OphthalAnalytics && !document.getElementById('analytics-notice').hidden");
      assert.equal(requests.length, before, 'Analytics/Tag communication before consent = 0');
      assert.equal(await evaluate("document.getElementById('auth-user').textContent"), 'PrivateLoginName');
      assert.equal(await evaluate("typeof gtag"), 'undefined');
      const banner = await evaluate("(() => {const r=document.getElementById('analytics-notice').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,buttonHeight:document.getElementById('analytics-accept').getBoundingClientRect().height};})()");
      assert.ok(banner.left >= 0 && banner.right <= width && banner.top >= 0 && banner.bottom <= 900 && banner.buttonHeight >= 44);
      const bannerShot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(profile, 'consent-' + width + '.png'), Buffer.from(bannerShot.data, 'base64'));
      await click('#analytics-decline'); assert.equal(requests.length, before, 'Denial never loads tag');
      await evaluate("document.getElementById('analytics-settings').click();");
      await click('#analytics-accept');
      await waitFor("window.__gaMockReady && dataLayer.some(row=>row[0]==='event'&&row[1]==='page_view')");
      await evaluate("document.getElementById('analytics-accept').click();");
      await waitFor("performance.getEntriesByType('resource').some(r=>r.name.includes('/g/collect'))");
      const events = () => evaluate("Array.from(dataLayer,row=>Array.from(row)).filter(row=>row[0]==='event')");
      assert.equal((await events()).filter(row => row[1] === 'page_view').length, 1);
      assert.equal(requests.slice(before).filter(url => url.includes('googletagmanager')).length, 1);
      await evaluate(fs.readFileSync(path.join(root, 'analytics.js'), 'utf8'));
      await evaluate("document.getElementById('view-calendar').click();document.getElementById('view-calendar').click();document.getElementById('view-compact').click();document.getElementById('view-list').click();");
      assert.deepEqual((await events()).filter(row => row[1] === 'view_mode_change').map(row => row[2].view_mode), ['calendar', 'compact', 'list']);
      if (width === 360) await click('#mobile-filter-btn');
      else await evaluate("document.querySelector('#filter-year input').focus();");
      const filterCount = (await events()).filter(row => row[1] === 'filter_apply').length;
      await evaluate("document.querySelector('#filter-year input').click();");
      assert.equal((await events()).filter(row => row[1] === 'filter_open').length, 1);
      assert.equal((await events()).filter(row => row[1] === 'filter_apply').length, filterCount + 1);
      if (width === 360) { await click('#apply-mobile-filter'); assert.equal((await events()).filter(row => row[1] === 'filter_apply').length, filterCount + 2); }
      // Reset only test state, without fabricating analytics events, then use real card listeners.
      await evaluate("state.filters.year.clear();state.filters.specialty.clear();state.filters.eventType.clear();state.filters.format.clear();state.filters.region.clear();state.filters.company.clear();state.filters.abstractStatus.clear();state.filters.keyword='';state.filters.includeEndedConferences=true;getTodayString=()=> '2026-10-05';renderEvents();");
      const expected = {};
      for (const [selector, name] of [
        ['#event-list .btn-official', 'official_link_click'],
        ['#event-list [data-action="view-pdf"]', 'pdf_click'],
        ['#event-list [data-action="add-calendar"]', 'calendar_add_click'],
        ['#event-list [data-action="attend-choice"][data-choice="yes"]', 'attendance_status_change'],
        ['#event-list [data-action="record-history"][data-history-choice="attended"]', 'attendance_status_change']
      ]) {
        const previous = (await events()).filter(row => row[1] === name).length;
        await evaluate(`(() => { const target=document.querySelector(${JSON.stringify(selector)}); if(!target)throw Error('Missing action'); if(target.tagName==='A')target.addEventListener('click',event=>event.preventDefault(),{once:true});target.click(); })()`);
        assert.equal((await events()).filter(row => row[1] === name).length, previous + 1, 'One event per action: ' + selector);
        expected[name] = (expected[name] || 0) + 1;
        await evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close());");
      }
      const rows = await events();
      assert.equal(rows.filter(row => row[1] === 'filter_open').length, 1, 'Dialog focus restoration must not fabricate filter_open');
      assert.ok(!/private@example|PrivateLoginName|private-test-uid|OphthalConf-ID|conf-jp-|oph-00/.test(JSON.stringify(rows)), 'No private/app identifiers in payload');
      assert.ok(rows.every(row => row[2].page_location === 'https://medconf.jp/ophthalconf/' && row[2].page_referrer === ''));
      const shot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(profile, 'analytics-' + width + '.png'), Buffer.from(shot.data, 'base64'));
      await delay(300);
      const transports = requests.slice(before).filter(url => url.includes('google-analytics')).map(url => new URL(url).searchParams.get('en'));
      assert.equal(transports.length, rows.length, 'Mock collection requests match exactly one per emitted event');
      results.push({ width, beforeConsentRequests: 0, tagLoads: 1, pageViews: 1, events: rows.map(row => row[1]), expected, mockCollectionRequests: transports.length });
      await evaluate("document.getElementById('analytics-settings').click();document.getElementById('analytics-decline').click();");
      await waitFor("document.readyState==='complete' && window.OphthalAnalytics?.getConsent()==='denied'");
      assert.equal(await evaluate("!!document.getElementById('ophthalconf-gtag')"), false);
      assert.equal(requests.slice(before).filter(url => url.includes('googletagmanager')).length, 1, 'Withdrawal/reload sends no second tag request');
    }
    // Same assets at the root are deliberately unmeasured, even with a stored grant.
    await evaluate("localStorage.setItem('ophthalconf_analytics_consent_v1',JSON.stringify({version:1,choice:'granted',expiresAt:Date.now()+86400000}));");
    const beforeRoot = requests.length;
    await call('Page.navigate', { url: 'https://medconf.jp/' });
    await waitFor("document.readyState==='complete' && typeof state==='object' && !!window.OphthalAnalytics");
    assert.equal(requests.length, beforeRoot); assert.equal(await evaluate("document.getElementById('analytics-settings').hidden"), true);
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    assert.equal(interceptionErrors.length, 0, JSON.stringify(interceptionErrors));
    fs.writeFileSync(path.join(profile, 'results.json'), JSON.stringify({ results, exceptions, interceptionErrors,
      method: 'Production URL intercepted with local source; GA transport and Firebase mocked; no live analytics sent' }, null, 2));
    console.log('PASS: Edge desktop/mobile 1280/360; pre-consent GA/Tag=0; denial=0; tag=1; page_view=1; all custom actions deduplicated; PII absent; withdrawal; root unmeasured');
    console.log('Browser evidence: ' + profile);
    await call('Browser.close');
  } finally { if (socket) socket.close(); if (browser.exitCode === null) browser.kill(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
