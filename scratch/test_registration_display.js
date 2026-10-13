const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 const now=new Date('2026-12-17T12:00:00+09:00');
 for(const type of ['domestic','international'])for(const label of ['事前登録','事前参加登録','Early bird','Regular']) {
  for(const [deadline,days] of [['2027-01-17',31],['2027-01-16',30],['2027-01-08',22],['2026-12-17',0],['2026-12-16T13:00',-1]]) {
   const event={registration:{type,timeZone:'Asia/Tokyo',periods:[{label,category:'early',advanceEligible:true,deadline}]}},saved=JSON.stringify(event);
   const html=renderRegistrationHtml(event,now);
   assert.ok(html.includes('事前参加登録：</span>'));assert.ok(!html.includes('Early bird'));assert.ok(!html.includes('Regular'));
   assert.equal(html.includes('registration-deadline-prefix'),days>=0&&days<=30);
   assert.ok(html.includes(days===0?'本日締切：':days>0&&days<=30?'締切'+days+'日前：':days<0?'2026年12月16日 締切済':'2027年1月17日まで'));
   if(days<0)assert.ok(!html.includes('13:00'));
   assert.equal(JSON.stringify(event),saved);
  }
  assert.ok(renderRegistrationHtml({registration:{type,periods:[]}},now).includes('事前参加登録：</span><span class="conf-val registration-deadline">未定'));
 }
 const abroad={registration:{type:'international',timeZone:'America/Los_Angeles',periods:[{label:'Early bird',category:'early',advanceEligible:true,deadline:'2026-12-17'}]}};
 assert.ok(renderRegistrationHtml(abroad,new Date('2026-12-18T07:59:59Z')).includes('本日締切：'));
 assert.ok(renderRegistrationHtml(abroad,new Date('2026-12-18T08:00:00Z')).includes('締切済'));
 for(const time of ['2026-12-17T12:59:59+09:00','2026-12-17T13:00:01+09:00']) {
  const html=renderRegistrationHtml({registration:{periods:[{label:'事前登録',deadline:'2026-12-17 13:00'}]}},new Date(time));
  assert.equal(html.includes('本日締切：'),time.includes('12:59'));assert.equal(html.includes('締切済'),time.includes('13:00:01'));
 }
`,context);
console.log('PASS: unified domestic/international registration labels, 31/30/22/0-day deadlines, date-only and timed expiry, timezone boundaries, unchanged phases');
