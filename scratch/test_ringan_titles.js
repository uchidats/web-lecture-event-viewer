const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {normalizeConferenceTitle:normalize}=require('../scripts/auto-updater/titles');
const {extractOfficialHtml}=require('../scripts/auto-updater/extract');
const {setField,assess}=require('../scripts/auto-updater/policy');
const {classifyDecision}=require('../scripts/gemini-monitor/classifier');
const {applyFieldChangesToEvent}=require('../scripts/gemini-monitor/applier');
const {extractFacts}=require('../scripts/audit-event-metadata');
for(const [edition,year] of [[80,2026],[81,2027],[82,2028],[83,2029],[100,2046]]) {
  for(const suffix of [` (臨眼 ${year})`,`（臨眼${year}）`])assert.equal(normalize(`第${edition}回 日本臨床眼科学会${suffix}`),`第${edition}回 日本臨床眼科学会`);
}
for(const suffix of ['（臨眼 2027）','(臨眼2027)',' （ 臨眼 2027 ）','( 臨眼　2027 )']) {
  const title='第81回 日本臨床眼科学会'+suffix,expected='第81回 日本臨床眼科学会';
  assert.equal(normalize(title),expected);assert.equal(normalize(normalize(title)),expected);
  const event={id:'ringan',title:expected,date:'2027-10-28',isConference:true};
  const source={id:event.id,name:expected,year:2027,identity:['第81回','日本臨床眼科学会'],officialUrl:'https://official.example/',allowedHosts:['official.example']};
  const html=`<html><title>${title}</title><h1>${title}</h1></html>`;
  assert.equal(extractOfficialHtml({html,url:source.officialUrl,role:'overview'},source).candidates.find(c=>c.field==='title').value,expected);
  assert.equal(extractFacts(html,event,source.officialUrl).facts.title.value,expected);
  assert.ok(!classifyDecision(event,{official_title:title}).fieldChanges.some(c=>c.field==='title'));
  const updated={...event};setField(updated,'title',title);assert.equal(updated.title,expected);
  applyFieldChangesToEvent(updated,[{field:'title',after:title}]);assert.equal(updated.title,expected);
  assert.ok(!assess(event,source,[{field:'title',value:title,method:'official-title',confidence:.96,url:source.officialUrl}],[],require('../conference-sources').defaults,{today:'2026-10-14'}).review.some(c=>c.field==='title'));
}
assert.equal(normalize('第８２回日本臨床眼科学会（臨眼２０２８）'),'第82回 日本臨床眼科学会');
for(const title of ['他学会（臨眼 2027）','第81回 日本臨床眼科学会（記念大会）','第81回 日本臨床眼科学会（臨眼 27）','【臨眼2026】ランチョンセミナー','AAO 2026 (American Academy of Ophthalmology)'])assert.equal(normalize(title),title);
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js','calendar-view.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 const targets=sampleEvents.filter(e=>/^第(80|81|82)回 日本臨床眼科学会$/.test(e.title));assert.equal(targets.length,3);
 assert.ok(!sampleEvents.some(e=>e.title.includes('日本臨床眼科学会')&&/[（(]臨眼\\s*\\d{4}[）)]/.test(e.title)));
 for(const event of targets){const html=createEventCardHtml(event);assert.ok(html.includes(event.title));assert.ok(!html.includes('(臨眼 '));if(event.eventOfficialUrl)assert.ok(html.includes(event.eventOfficialUrl.replace(/&/g,'&amp;')));}
 for(const key of FILTER_SET_KEYS)state.filters[key].clear();state.filters.includeEndedConferences=true;state.filters.keyword='日本臨床眼科学会';state.sortBy='title-asc';
 for(const mode of ['list','calendar','compact'])assert.deepEqual(getFilteredEvents(false,mode).map(e=>e.title),targets.map(e=>e.title).sort((a,b)=>a.localeCompare(b,'ja')));
`,context);
console.log('PASS: Ringan abbreviation normalization, extractor/audit/update guards, unchanged other titles, all-mode keyword search and title sort');
