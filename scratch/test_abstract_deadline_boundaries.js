const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
if(!process.argv.includes('--child')) {
  for(const tz of ['UTC','Asia/Tokyo','America/Los_Angeles']) {
    const result=spawnSync(process.execPath,[__filename,'--child'],{env:{...process.env,TZ:tz},encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
  console.log('PASS: abstract deadlines independent of host TZ, exact times, date-only day end, DST, unified status/link/deadline');
} else {
  const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
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
      assert.ok(closed.includes('2026年11月5日 締切済'));assert.ok(!closed.includes('13:00'));assert.ok(!closed.includes('<a'));assert.ok(!closed.includes('abstract-status-tag'));
      assert.equal(getDaysUntilAbstractDeadline(event('2026-11-06',zone),at('2026-11-05T12:00:00'+offset)),1);
      assert.equal(getDaysUntilAbstractDeadline(event('2026-11-04',zone),at('2026-11-05T12:00:00'+offset)),-1);
      assert.ok(!matchesAbstractFilter(timed,'open',at('2026-11-05T13:00:01'+offset)));
    }
    const now=at('2026-10-14T12:00:00+09:00');
    for(const [date,days] of [['2026-11-05 13:00',22],['2026-11-13',30],['2026-11-14',31],['2026-10-14 13:00',0]]) {
      const html=renderAbstractSubmissionHtml(event(date),now);
      assert.equal((html.match(/<a /g)||[]).length,1);assert.ok(html.includes('演題募集中 ↗'));assert.ok(!html.includes('演題登録'));assert.ok(!html.includes('注意・'));assert.ok(!html.includes('abstract-submit-link'));
      assert.ok(html.includes(days===0?'本日締切：':days<=30?'締切'+days+'日前：':'締切：'));
      assert.equal(html.includes('abstract-deadline-prefix urgent'),days<=30);
    }
    assert.equal(renderAbstractSubmissionHtml(event(null,'Asia/Tokyo','closed'),now),'<span class="deadline-highlight closed">締切済</span>');
    for(const legacy of ['受付終了','演題募集終了','締切済','2026年11月5日 13:00 受付終了','2026-11-05 13:00 演題募集終了']) {
      const source={isConference:true,abstractDeadline:legacy},snapshot=JSON.stringify(source),html=renderAbstractSubmissionHtml(source,now);
      assert.ok(html.includes(legacy.includes('2026')?'2026年11月5日 締切済':'>締切済<'));assert.ok(!html.includes('13:00'));assert.ok(!html.includes('受付終了'));assert.ok(!html.includes('演題募集終了'));assert.ok(!html.includes('<a'));assert.equal(JSON.stringify(source),snapshot);
    }
    const fallback=event('2026-11-05');delete fallback.timeZone;fallback.registration={timeZone:'America/Los_Angeles'};
    assert.ok(getAbstractSubmissionState(fallback,at('2026-11-06T06:00:00Z')).isOpen);
    assert.equal(getAbstractSubmissionState(event('2026-11-05T13:00:00-08:00'),at('2026-11-05T21:00:01Z')).status,'closed');
    const dst=event('2026-11-01','America/Los_Angeles');
    assert.ok(getAbstractSubmissionState(dst,at('2026-11-02T07:59:59Z')).isOpen);
    assert.equal(getAbstractSubmissionState(dst,at('2026-11-02T08:00:00Z')).status,'closed');
  `,context);
}
