const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadEvents}=require('../scripts/auto-updater/storage');
const {events}=loadEvents(path.resolve(__dirname,'..'));
assert.ok(!events.some(e=>e.id==='oph-002'||e.title.includes('緑内障薬物治療Update')||e.sponsor?.includes('眼科メディカルファーマ')));
assert.ok(!JSON.stringify(require('../companies').COMPANY_MASTER).includes('眼科メディカルファーマ'));
assert.equal(events.length,94);
for(const id of ['oph-005','oph-006','oph-007','oph-009'])assert.ok(events.some(e=>e.id===id),'unconfirmed events retained');
console.log('PASS: confirmed dummy removed, fictional organizer absent from public events/master, 94 events, uncertain events retained');
