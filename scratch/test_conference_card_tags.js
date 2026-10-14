const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
const original=JSON.stringify(sampleEvents);
for(const event of sampleEvents) {
  const html=createEventCardHtml(event);
  assert.equal(html.includes('card-tags-list'),!event.isConference,event.title);
  const detail=createEventCardHtml(event,{showConferenceTags:true});
  for(const tag of event.tags)assert.ok(detail.includes('#'+escapeHtml(tag)));
}
assert.equal(JSON.stringify(sampleEvents),original);
const event={...sampleEvents.find(e=>e.isConference),date:'2040-01-01',endDate:'2040-01-02',tags:['unique-retained-search-tag']};
state.events=[event];state.filters.keyword='unique-retained-search-tag';
assert.ok(getFilteredEvents().some(e=>e.id===event.id),'hidden tags remain searchable');
`,context);
console.log('PASS: conference list tags hidden, detail/seminar tags retained, unchanged data and searchable tags');
