const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  let developmentMode = false;
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    try {
      let data = fs.readFileSync(file);
      if (file.endsWith('index.html')) data = Buffer.from(data.toString().replace(/<link[^>]*https:[^>]*>/g, '').replace(/<script[^>]*https:[^>]*><\/script>/g, ''));
      if (file.endsWith('firebase-config.js')) data = Buffer.from('const FIREBASE_CONFIG = {};');
      if (file.endsWith('review-config.js')) data = Buffer.from(`globalThis.OphthalReviewConfig = Object.freeze({developmentMode:${developmentMode},reviewDataUrl:'scratch/fixtures/review/auto-update-review.json'});`);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ophthal-review-browser-'));
  const browser = spawn(process.env.CARD_TEST_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100);
    assert.ok(fs.existsSync(portFile), 'Browser failed to start');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    let seq = 0; const pending = new Map();
    socket.addEventListener('message', event => {
      const result = JSON.parse(event.data), task = pending.get(result.id);
      if (!task) return; pending.delete(result.id); clearTimeout(task.timer);
      if (result.error) task.reject(new Error(JSON.stringify(result.error))); else task.resolve(result.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq, timer = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 15000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    async function navigate(url, ready) {
      await call('Page.navigate', { url });
      for (let i = 0; i < 100; i++) { if (await evaluate(ready)) return; await delay(100); }
      throw new Error('Page not ready');
    }
    await navigate(origin, '!!window.OphthalReviewModel');
    assert.equal(await evaluate('document.getElementById("review-entry").hidden'), true);
    assert.equal(await evaluate('document.querySelectorAll(".event-card").length > 0'), true);
    await navigate(origin + '/?adminReview=1', '!!window.OphthalReviewModel');
    assert.equal(await evaluate('document.getElementById("review-entry").hidden'), true, 'query alone must not grant access');
    await evaluate('window.OphthalAuth={subscribe(fn){window.adminObserver=fn;fn({user:null});}};');
    await evaluate(fs.readFileSync(path.join(root, 'review-ui.js'), 'utf8'));
    for (const width of [1280, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      for (const user of [null, {uid:'other',email:'other@gmail.com',emailVerified:true}, {uid:'admin',email:'uchidats@gmail.com',emailVerified:false}]) {
        await evaluate(`adminObserver({user:${JSON.stringify(user)}}); document.getElementById('review-entry').click();`);
        assert.equal(await evaluate('document.getElementById("review-entry").hidden'), true);
        assert.equal(await evaluate('document.getElementById("review-dialog").open'), false);
      }
      await evaluate(`adminObserver({user:{uid:'admin',email:'uchidats@gmail.com',emailVerified:true}});`);
      for (let i = 0; i < 50; i++) { if (await evaluate('document.getElementById("review-entry").textContent === "更新確認 9件"')) break; await delay(100); }
      assert.equal(await evaluate('document.getElementById("review-entry").hidden'), false);
      await evaluate('document.getElementById("review-entry").click()');
      assert.equal(await evaluate('document.getElementById("review-dialog").open'), true);
      assert.equal(await evaluate('document.querySelectorAll(".review-card").length'), 9);
      await evaluate(`document.querySelector('[data-review-index="0"] [data-decision="deferred"]').click()`);
      assert.equal(await evaluate('JSON.parse(localStorage.getItem(OphthalReviewModel.storageKey)).history.at(-1).reviewerId'), 'admin');
      await evaluate('adminObserver({user:null})');
      assert.equal(await evaluate('document.getElementById("review-dialog").open'), false);
      assert.equal(await evaluate('document.querySelectorAll(".review-card").length'), 0);
    }
    developmentMode = true;
    await navigate(origin + '/?adminReview=1', 'document.getElementById("review-entry")?.textContent === "更新確認 9件"');
    await evaluate('document.getElementById("review-entry").click()');
    assert.equal(await evaluate('document.querySelectorAll(".review-card").length'), 9);
    for (const width of [1280, 768, 390, 320]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'page overflow ' + width);
      assert.equal(await evaluate('document.getElementById("review-dialog").scrollWidth <= document.getElementById("review-dialog").clientWidth'), true, 'dialog overflow ' + width);
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".review-values")).gridTemplateColumns.split(" ").length'), width <= 600 ? 1 : 2);
      assert.equal(await evaluate('[...document.querySelectorAll(".review-actions button")].every(b=>b.getBoundingClientRect().height>=44)'), true);
    }
    for (const decision of ['approved', 'rejected', 'deferred']) {
      await evaluate(`document.querySelector('[data-review-index="0"] [data-decision="${decision}"]').click()`);
      assert.equal(await evaluate('JSON.parse(localStorage.getItem(OphthalReviewModel.storageKey)).history.at(-1).decision'), decision);
      if (decision !== 'deferred') await evaluate('document.getElementById("review-filter").value="review"; document.getElementById("review-filter").dispatchEvent(new Event("change"))');
    }
    await navigate(origin + '/?adminReview=1', 'document.getElementById("review-entry")?.textContent === "更新確認 9件"');
    await evaluate('document.getElementById("review-entry").click()');
    assert.equal(await evaluate('document.querySelector(".review-decision").textContent.includes("保留中")'), true);
    await evaluate('document.getElementById("review-filter").value="blocked"; document.getElementById("review-filter").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll(".review-card").length'), 11);
    await evaluate('document.querySelector(".review-automation input").checked=true; document.querySelector(".risk-low [data-decision=approved]").click()');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem(OphthalReviewModel.storageKey)).history.at(-1).automationCandidate'), true);
    // Feed hostile content via the provider boundary: it must be text and never execute.
    await evaluate(`window.fetch = async () => ({ok:true,json:async()=>({version:1,items:[{id:'hostile',eventId:'oph-011',field:'title',oldValue:'old',value:'<img src=x onerror="window.injected=1">',evidence:'<script>window.injected=1</script>',confidence:.98,reason:'conference-name-change',url:'javascript:alert(1)'}]})}); document.getElementById('review-reload').click();`);
    for (let i = 0; i < 30; i++) { if (await evaluate('document.getElementById("review-summary").textContent.includes("要確認 1件")')) break; await delay(100); }
    await evaluate('document.getElementById("review-filter").value="all"; document.getElementById("review-filter").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll(".review-card.risk-high").length'), 1);
    assert.equal(await evaluate('document.querySelectorAll(".review-card img, .review-card script, .review-card a").length'), 0);
    assert.equal(await evaluate('!!window.injected'), false);
    assert.equal(await evaluate('document.querySelector("[data-decision=approved]").disabled'), true);
    assert.equal(await evaluate('document.querySelector(".review-automation")'), null);
    // Bot candidate details and human approval export must not mutate the card data.
    await evaluate(`window.fetch = async () => ({ok:true,json:async()=>({version:1,items:[{id:'bot-ascrs',eventId:'conf-int-ascrs-2027',field:'eventOfficialUrl',oldValue:null,value:'https://annualmeeting.ascrs.org/',candidateUrl:'https://annualmeeting.ascrs.org/',url:'https://ascrs.confex.com/ascrs/27am/cfp.cgi',reason:'bot-protected-official-candidate',confidence:.9,evidence:'ASCRS 2027 San Diego',checks:{officialSocietyDomain:true,yearMatches:true,nameMatches:true,editionMatches:true,cityMatches:true,city:'San Diego'},fetchFailure:{httpStatus:403,botProtected:true,error:'bot-protected'},officialEvidence:[{url:'https://ascrs.confex.com/ascrs/27am/cfp.cgi',evidence:'2027 ASCRS ASOA Annual Meeting, San Diego'}]}]})}); document.getElementById('review-reload').click();`);
    for (let i = 0; i < 30; i++) { if (await evaluate('!!document.querySelector(".review-card a[href=\\"https://annualmeeting.ascrs.org/\\"]")')) break; await delay(100); }
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("Bot保護を検出")'));
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("開催地：一致")'));
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("HTTP 403")'));
    assert.equal(await evaluate('!!sampleEvents.find(e=>e.id==="conf-int-ascrs-2027").eventOfficialUrl'), false);
    await evaluate('document.querySelector("[data-decision=approved]").click()');
    assert.equal(await evaluate('!!sampleEvents.find(e=>e.id==="conf-int-ascrs-2027").eventOfficialUrl'), false);
    assert.ok(await evaluate('!!document.getElementById("review-export-urls")'));
    const metadataAudit=require('../reports/event-metadata-audit-2026-10-09.json').records.find(r=>r.eventId==='conf-jp-presbyopia-2027');
    const metadataValue=Object.fromEntries(metadataAudit.differences.filter(c=>!['year','edition'].includes(c.field)&&c.confidence>=.95).map(c=>[c.field,c.official]));
    const metadataItem={id:'metadata-case',eventId:metadataAudit.eventId,field:'eventMetadata',value:metadataValue,oldValue:metadataAudit.currentSnapshot,
      audit:metadataAudit,reviewSnapshot:metadataAudit.currentSnapshot,requiresHumanApproval:true,priority:'高',confidence:.97,
      reason:'metadata-audit-possible-wrong-edition',url:'https://www.rousi.jp/jps4'};
    await evaluate(`window.fetch=async()=>({ok:true,json:async()=>({version:1,items:[${JSON.stringify(metadataItem)}]})});document.getElementById('review-reload').click();`);
    for(let i=0;i<30&&!await evaluate('!!document.querySelector(".audit-table")');i++)await delay(100);
    assert.equal(await evaluate('document.querySelectorAll(".audit-table tbody tr").length'),12);
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("2026/01/17")'));
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("アンメットニーズはここにある")'));
    assert.ok(await evaluate('document.getElementById("review-list").textContent.includes("表記差")'));
    assert.equal(await evaluate('!!document.querySelector(".review-automation")'),false);
    for(const width of [1280,390,320]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      assert.ok(await evaluate('document.getElementById("review-dialog").scrollWidth<=document.getElementById("review-dialog").clientWidth'));
    }
    await evaluate('document.querySelector("[data-decision=approved]").click()');
    assert.equal(await evaluate('sampleEvents.find(e=>e.id==="conf-jp-presbyopia-2027").date'),'2026-01-17');
    assert.ok(await evaluate('!!document.getElementById("review-export-metadata")'));
    await evaluate('document.getElementById("review-close").click(); document.getElementById("calendar-settings-btn").click()');
    assert.equal(await evaluate('document.getElementById("calendar-settings-modal").open'), true);
    assert.equal(await evaluate('OphthalAuth.snapshot().phase'), 'unconfigured');
    console.log('PASS: PC/mobile 1280/768/390/320px; verified email admin only, wrong/unverified/logged-out denial, logout closes dialog, query denied without development mode; decisions/reload, blocked separation, checkbox, XSS, high risk, Calendar and event UI');
    await call('Browser.close');
  } finally { socket?.close(); if (browser.exitCode === null) browser.kill(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
