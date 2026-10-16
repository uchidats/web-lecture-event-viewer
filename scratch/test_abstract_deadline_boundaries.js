const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
if(!process.argv.includes('--child')) {
  for(const tz of ['UTC','Asia/Tokyo','America/Los_Angeles']) {
    const result=spawnSync(process.execPath,[__filename,'--child'],{env:{...process.env,TZ:tz},encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
  console.log('PASS: abstract deadlines independent of host TZ, exact times, date-only day end, DST, unified status/link/deadline');
} else {
  const context=vm.createContext({assert,console,URL,document:{getElementById:()=>null,addEventListener:()=>{}}});
  for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  vm.runInContext(`
    const event=(deadline,timeZone='Asia/Tokyo',status='open')=>({isConference:true,timeZone,abstractSubmission:{status,deadline,url:'https://example.com/abstract'}});
    const at=value=>new Date(value);
    for(const [zone,offset] of [['Asia/Tokyo','+09:00'],['America/Los_Angeles','-08:00']]) {
      const today=event('2026-11-05',zone);
      assert.ok(getAbstractSubmissionState(today,at('2026-11-05T23:59:59.999'+offset)).isOpen);
      assert.equal(getAbstractSubmissionState(today,at('2026-11-06T00:00:00'+offset)).status,'closed');
      const timed=event('2026-11-05 13:00',zone);
      assert.ok(getAbstractSubmissionState(timed,at('2026-11-05T12:59:59'+offset)).isOpen);
      assert.equal(getAbstractSubmissionState(timed,at('2026-11-05T13:00:01'+offset)).status,'closed');
      const closed=renderAbstractSubmissionHtml(timed,at('2026-11-05T13:00:01'+offset));
      assert.ok(closed.includes('終了'));assert.ok(!closed.includes('締切済'));assert.ok(!closed.includes('13:00'));assert.ok(closed.includes('abstract-link-closed'));assert.ok(closed.includes('<span>終了</span>'));
      assert.equal(getDaysUntilAbstractDeadline(event('2026-11-06',zone),at('2026-11-05T12:00:00'+offset)),1);
      assert.equal(getDaysUntilAbstractDeadline(event('2026-11-04',zone),at('2026-11-05T12:00:00'+offset)),-1);
      assert.ok(!matchesAbstractFilter(timed,'open',at('2026-11-05T13:00:01'+offset)));
    }
    const now=at('2026-10-14T12:00:00+09:00');
    for(const [date,days] of [['2026-11-05 13:00',22],['2026-11-13',30],['2026-11-14',31],['2026-10-14 13:00',0]]) {
      const html=renderAbstractSubmissionHtml(event(date),now);
      assert.equal((html.match(/<a /g)||[]).length,1);assert.ok(html.includes('受付中</span>'));assert.ok(!html.includes('↗'));assert.ok(html.includes(renderExternalLinkIconHtml()));assert.ok(!html.includes('演題登録'));assert.ok(!html.includes('注意・'));assert.ok(html.includes('abstract-submit-link'));
      assert.ok(!html.includes('日前'));assert.ok(!html.includes('本日締切'));assert.ok(html.includes(' 締切</span>'));
      assert.equal(html.includes('abstract-deadline urgent'),days<=30);
    }
    {const closedNoDate=renderAbstractSubmissionHtml(event(null,'Asia/Tokyo','closed'),now);assert.ok(closedNoDate.includes('<span>終了</span>'));assert.ok(closedNoDate.includes('abstract-link-closed'));assert.ok(!closedNoDate.includes('締切済'));}
    for(const sub of [undefined,{status:'unknown',deadline:null,url:null}]) {
      const source={isConference:true,abstractSubmission:sub,eventOfficialUrl:'https://official.example/congress',abstractDeadline:'未定'},saved=JSON.stringify(source);
      const html=renderAbstractSubmissionHtml(source,now);assert.ok(html.includes('<span>情報未確認</span>'));assert.ok(!html.includes('<span>公式</span>'));assert.ok(html.includes(source.eventOfficialUrl));assert.ok(html.includes(renderExternalLinkIconHtml()));assert.ok(!html.includes('演題募集情報未確認'));assert.equal(JSON.stringify(source),saved);
      const none=renderAbstractSubmissionHtml({...source,eventOfficialUrl:undefined},now);assert.equal(none,'<span class="abstract-unknown">情報未確認</span>');
    }
    const dedicated={isConference:true,eventOfficialUrl:'https://official.example/',abstractSubmission:{status:'unknown',url:'https://official.example/abstract?a=1&b=2'}};
    const dedicatedHtml=renderAbstractSubmissionHtml(dedicated,now);assert.ok(dedicatedHtml.includes('<span>情報未確認</span>'));assert.ok(!dedicatedHtml.includes('<span>詳細</span>'));assert.ok(!dedicatedHtml.includes('公式'));assert.ok(dedicatedHtml.includes('href="https://official.example/abstract?a=1&amp;b=2"'));assert.ok(!dedicatedHtml.includes('href="https://official.example/"'));assert.ok(dedicatedHtml.includes('target="_blank" rel="noopener noreferrer"'));
    assert.equal(renderAbstractSubmissionHtml({isConference:true,eventOfficialUrl:'javascript:alert(1)',abstractSubmission:{status:'unknown',url:'javascript:alert(2)'}},now),'<span class="abstract-unknown">情報未確認</span>');
    for(const legacy of ['受付終了','演題募集終了','締切済','2026年11月5日 13:00 受付終了','2026-11-05 13:00 演題募集終了']) {
      const source={isConference:true,abstractDeadline:legacy},snapshot=JSON.stringify(source),html=renderAbstractSubmissionHtml(source,now);
      assert.ok(html.includes('>終了<'));assert.ok(!html.includes('締切済'));assert.ok(!html.includes('13:00'));assert.ok(!html.includes('受付終了'));assert.ok(!html.includes('演題募集終了'));assert.ok(!html.includes('<a'));assert.equal(JSON.stringify(source),snapshot);
    }
    const fallback=event('2026-11-05');delete fallback.timeZone;fallback.registration={timeZone:'America/Los_Angeles'};
    assert.ok(getAbstractSubmissionState(fallback,at('2026-11-06T06:00:00Z')).isOpen);
    assert.equal(getAbstractSubmissionState(event('2026-11-05T13:00:00-08:00'),at('2026-11-05T21:00:01Z')).status,'closed');
    const dst=event('2026-11-01','America/Los_Angeles');
    assert.ok(getAbstractSubmissionState(dst,at('2026-11-02T07:59:59Z')).isOpen);
    assert.equal(getAbstractSubmissionState(dst,at('2026-11-02T08:00:00Z')).status,'closed');
  `,context);
}
