const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const {events}=loadEvents(path.resolve(__dirname,'..'));
assert.ok(!events.some(e=>['oph-002','oph-005','oph-006','oph-007','oph-009'].includes(e.id)||e.title.includes('緑内障薬物治療Update')||e.sponsor?.includes('眼科メディカルファーマ')));
assert.ok(!JSON.stringify(require('../companies').COMPANY_MASTER).includes('眼科メディカルファーマ'));
assert.ok(!events.some(e=>e.sponsor?.includes('中部屈折矯正白内障手術懇話会')||e.tags?.includes('カレンダー登録済')));
assert.ok(!JSON.stringify(require('../companies').COMPANY_MASTER).includes('中部屈折矯正白内障手術懇話会'));
for(const sponsor of ['近畿角膜疾患研究グループ','日本弱視斜視臨床懇話会','首都圏神経眼科研究会']) {
  assert.ok(!events.some(e=>e.sponsor?.includes(sponsor)));
  assert.ok(!JSON.stringify(require('../companies').COMPANY_MASTER).includes(sponsor));
}
assert.equal(events.length,90);
assert.ok(!events.some(e=>/example\.(com|org|net)|(?:^|[-_])(demo|sample|test|dummy)(?:$|[-_])/i.test(e.id+' '+(e.officialUrl||''))));
console.log('PASS: confirmed dummy removed, fictional organizer absent from public events/master, 90 events, uncertain events retained');
