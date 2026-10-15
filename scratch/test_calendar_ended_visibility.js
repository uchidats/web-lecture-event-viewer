const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 getTodayString=()=> '2026-11-02';
 for(const key of FILTER_SET_KEYS)state.filters[key].clear();
 state.filters.includeEndedConferences=false;
 const ids=mode=>getFilteredEvents(false,mode).map(e=>e.id);
 for(const mode of ['list','compact']){
  assert.ok(!ids(mode).includes('oph-004'),'AAO ended hidden in '+mode);
  assert.ok(!ids(mode).includes('conf-jp-lowvision-2026'),'September ended hidden');
 }
 assert.ok(ids('calendar').includes('oph-004'),'AAO remains in October calendar');
 assert.ok(ids('calendar').includes('conf-jp-glaucoma-2026'),'October ended conference retained');
 assert.ok(!ids('calendar').includes('conf-jp-lowvision-2026'));
 for(const enabled of [false,true]){
  state.filters.includeEndedConferences=enabled;
  assert.ok(!ids('calendar').includes('conf-jp-lowvision-2026'),'Calendar cutoff independent of checkbox');
  for(const mode of ['list','compact'])assert.equal(ids(mode).includes('conf-jp-lowvision-2026'),enabled);
 }
 state.filters.includeEndedConferences=false;
 for(const isConference of [true,false]){
  assert.equal(shouldHideEndedEvent({isConference,date:'2026-09-30',endDate:'2026-10-02'},'2026-11-02','calendar'),true);
  assert.equal(shouldHideEndedEvent({isConference,date:'2026-10-01'},'2026-11-02','calendar'),false);
  assert.equal(shouldHideEndedEvent({isConference,date:'2026-09-30',endDate:'2026-11-02'},'2026-11-02','calendar'),false,'End date inclusive');
 }
 state.filters.specialty=new Set(['総合']);
 assert.ok(ids('calendar').includes('oph-004'));assert.ok(!ids('calendar').includes('conf-jp-glaucoma-2026'));
 state.filters.specialty.clear();state.hiddenConferences.add('oph-004');assert.ok(!ids('calendar').includes('oph-004'));
 state.hiddenConferences.clear();
 const parent=sampleEvents.find(e=>e.id==='oph-001');
 const child={...sampleEvents.find(e=>e.parentConferenceId===parent.id),date:parent.date,endDate:parent.endDate};
 state.events=[parent,child];state.attendingConferences.add(parent.id);
 assert.equal(ids('calendar').length,1);assert.equal(ids('compact').length,0);assert.equal(ids('list').length,0);
 const futureParent={...parent,date:'2099-10-01',endDate:'2099-10-02'};
 state.events=[futureParent,{...child,date:futureParent.date,endDate:futureParent.endDate}];
 for(const choice of ['registered','yes','no','none']) {
   state.attendingConferences.clear();state.hiddenConferences.clear();
   if(choice==='registered'||choice==='yes') state.attendingConferences.add(parent.id);
   if(choice==='no') state.hiddenConferences.add(parent.id);
   for(const mode of ['list','compact','calendar']) {
     assert.ok(!getFilteredEvents(false,mode).some(e=>e.parentConferenceId),'Related seminars stay hidden: '+choice+'/'+mode);
     assert.equal(getFilteredEvents(false,mode).some(e=>e.id===parent.id),choice!=='no');
   }
 }
 assert.equal(state.events.length,2,'Hidden seminar data is retained');
`,context);
console.log('PASS: per-mode ended visibility, October cutoff, AAO real data, checkbox, date boundaries, other filters and related seminars');
