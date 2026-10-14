const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
assert.equal(getEventTypeDisplayLabel('国内学会'),'国内');
assert.equal(getEventTypeDisplayLabel('海外学会'),'国際');
assert.equal(getEventTypeDisplayLabel('国際学会'),'国際');
assert.equal(getEventTypeDisplayLabel('講演会・勉強会'),'講演会・勉強会');
const original=JSON.stringify(sampleEvents);
for(const event of sampleEvents.filter(e=>e.isConference)) {
  const label=event.conferenceRegion==='international'?'国際':'国内';
  const html=createEventCardHtml(event);
  assert.ok(html.includes('<span class="conf-category-badge region">'+label+'</span>'),event.title);
  assert.ok(!html.includes('conf-category-badge region">国内学会'));
  assert.ok(!html.includes('conf-category-badge region">国際学会'));
}
assert.equal(JSON.stringify(sampleEvents),original);
const container={innerHTML:''};
document.getElementById=id=>id==='filter-eventType'?container:{innerHTML:'',querySelectorAll:()=>[]};
state.events=sampleEvents;renderFilterOptions();
for(const [value,label] of [['国内学会','国内'],['海外学会','国際']]) {
  const start=container.innerHTML.indexOf('value="'+value+'"');
  assert.ok(start>=0,'internal filter value retained');
  const chip=container.innerHTML.slice(start,container.innerHTML.indexOf('</label>',start));
  assert.ok(chip.includes(label));assert.ok(chip.includes('('+sampleEvents.filter(e=>e.eventType===value).length+')'));
}
elements.activeFilterChips={innerHTML:'',querySelectorAll:()=>[]};
state.filters.eventType=new Set(['国内学会','海外学会']);renderActiveFilterChips();
assert.ok(elements.activeFilterChips.innerHTML.includes('<strong>国内</strong>'));
assert.ok(elements.activeFilterChips.innerHTML.includes('<strong>国際</strong>'));
assert.ok(state.filters.eventType.has('国内学会'));assert.ok(state.filters.eventType.has('海外学会'));
`,context);
console.log('PASS: concise domestic/international labels, all conference cards, unchanged data and non-conference labels');
