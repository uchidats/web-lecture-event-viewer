const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
const now=new Date('2026-10-14T12:00:00+09:00');
for(const [deadline,expected,closed] of [['2026-11-05 12:00','11月5日 12:00 締切',false],['2026-11-05','11月5日 締切',false],['2026-10-13 12:00','10月13日 締切済',true],['2027-01-08','1月8日 締切',false]]) {
  const event={isConference:true,date:'2027-02-01',timeZone:'Asia/Tokyo',registration:{periods:[{label:'事前参加登録',category:'regular',deadline}]},abstractSubmission:{status:'open',deadline}};
  const saved=JSON.stringify(event);
  for(const [kind,html] of [['registration',renderRegistrationHtml(event,now)],['abstract',renderAbstractSubmissionHtml(event,now)]]) {
    assert.ok(html.includes(expected),html);assert.ok(!html.includes('年'));if(closed)assert.ok(!html.includes('12:00'));
  }
  assert.equal(JSON.stringify(event),saved);
}
const cross={date:'2027-02-01',registration:{periods:[{label:'事前参加登録',category:'regular',start:'2026-12-01',deadline:'2027-01-08'}]}};
const html=renderRegistrationHtml(cross,now);assert.ok(html.includes('2026年12月1日'));assert.ok(html.includes('2027年1月8日'));
assert.equal(formatCardDeadline('2026-11-05',{date:'2028-02-01'}),'2026年11月5日');
assert.equal(formatLegacyCardDeadline('2026年11月5日 12:00 締切',{date:'2026-12-01'}),'11月5日 12:00 締切');
assert.equal(formatLegacyCardDeadline('締切済 2026年11月5日 12:00',{date:'2026-12-01'},{showTime:false}),'締切済 11月5日');
`,context);
console.log('PASS: shared short deadline dates/times, expired date only, next-year deadline, ambiguous year exceptions, legacy and unchanged data');
