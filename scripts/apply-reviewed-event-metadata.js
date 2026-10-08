// Human approval bridge only. This is never called by the automatic updater.
const fs=require('node:fs'),path=require('node:path');
const {loadEvents,readJson,writeJson,atomicWrite,validateEvents}=require('./auto-updater/storage');
const model=require('../review-model');
const ALLOWED=new Set(['title','date','endDate','venue','cityCountry','sponsor','subtitle','registration','abstractSubmission.deadline','eventOfficialUrl']);
const REGION_RULES=[[/北海道/,'北海道'],[/青森|岩手|宮城|秋田|山形|福島/,'東北'],[/東京|神奈川|千葉|埼玉|茨城|栃木|群馬/,'関東'],
  [/新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知/,'中部'],[/京都|大阪|兵庫|奈良|滋賀|和歌山/,'関西'],[/鳥取|島根|岡山|広島|山口/,'中国'],
  [/徳島|香川|愛媛|高知/,'四国'],[/福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄/,'九州・沖縄']];
function applyReviewedMetadata({root,approvals,apply=false}){
  if(approvals?.version!==1||approvals.kind!=='event-metadata-human-approvals'||!approvals.decisions?.length)throw Error('Explicit human approval export required');
  const data=loadEvents(root),queueFile=path.join(root,'reports/auto-update-review.json'),queue=readJson(queueFile,{version:1,items:[]});
  const items=model.normalize(queue),events=structuredClone(data.events),changes=[],seen=new Set();
  for(const approval of approvals.decisions){
    const item=items.find(i=>i.reviewId===approval.reviewId&&i.signature===approval.signature);
    if(!item?.actionable||item.field!=='eventMetadata'||!item.audit||approval.decision!=='approved'||!approval.reviewerId||
      !Number.isFinite(Date.parse(approval.decidedAt))||approval.eventId!==item.eventId||approval.field!==item.field||
      JSON.stringify(approval.value)!==JSON.stringify(item.value)||seen.has(item.eventId))throw Error('Missing, stale, mismatched or duplicate human approval');
    const event=events.find(e=>e.id===item.eventId);
    if(!event||JSON.stringify(event)!==JSON.stringify(item.reviewSnapshot))throw Error('Event changed since audit');
    const geographyChanged=Object.keys(item.value).some(field=>['venue','cityCountry'].includes(field)&&item.audit.comparisons.find(c=>c.field===field)?.result==='mismatch');
    for(const [field,value]of Object.entries(item.value)){
      if(!ALLOWED.has(field))throw Error('Protected field');
      const comparison=item.audit.comparisons.find(c=>c.field===field);
      if(!comparison||comparison.result==='unverified'||comparison.confidence<0.95||JSON.stringify(comparison.official)!==JSON.stringify(value))throw Error('Official evidence missing');
      if(field==='eventOfficialUrl'&&!model.safeUrl(value))throw Error('Invalid URL');
      if(field==='registration')event.registration=value;
      else{if(typeof value!=='string'||!value)throw Error('Invalid value');
        if(field==='abstractSubmission.deadline')event.abstractSubmission={...(event.abstractSubmission||{}),deadline:value};else event[field]=value;}
    }
    if(item.value.date||item.value.endDate){
      const format=d=>{const [y,m,day]=d.split('-');return `${y}年${Number(m)}月${Number(day)}日(${new Intl.DateTimeFormat('ja-JP',{weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date(d+'T00:00:00Z'))})`;};
      event.period=event.endDate&&event.endDate!==event.date?`${format(event.date)} 〜 ${format(event.endDate)}`:format(event.date);
    }
    // Avoid showing the old venue master or using its timezone after a physical venue change.
    // No new timezone is guessed from a city name; registration remains subject to verification.
    if(geographyChanged){delete event.venueId;delete event.timeZone;
      if(item.value.cityCountry){const [city,country]=event.cityCountry.split(/[/／]/).map(v=>v.trim());
        if(country&&!['日本','Japan','JP'].includes(country))event.region='海外';else{const region=REGION_RULES.find(([pattern])=>pattern.test(city));if(region)event.region=region[1];}}}
    const officialYear=item.audit.comparisons.find(c=>c.field==='year'&&c.result!=='unverified')?.official;
    if(typeof officialYear==='number'&&Number(event.date.slice(0,4))!==officialYear)throw Error('Year conflict unresolved; confirm the intended edition and dates');
    const officialEdition=item.audit.comparisons.find(c=>c.field==='edition'&&c.result==='mismatch')?.official;
    if(officialEdition){const updatedEdition=[...new Set([...event.title.matchAll(/第\s*(\d+)\s*(?:回|(?=日本))|(\d+)(?:st|nd|rd|th)\b/gi)].map(m=>Number(m[1]||m[2])))].sort((a,b)=>a-b);
      if(JSON.stringify(updatedEdition)!==JSON.stringify(officialEdition))throw Error('Edition conflict unresolved');}
    seen.add(event.id);changes.push({eventId:event.id,fields:Object.keys(item.value),reviewerId:approval.reviewerId});
  }
  validateEvents(events,data.events);
  for(const change of changes){const event=events.find(e=>e.id===change.eventId);
    if((Date.parse(event.endDate||event.date)-Date.parse(event.date))/86400000>31)throw Error('Conference date range needs review');}
  if(apply){
    if(fs.readFileSync(data.file,'utf8')!==data.original)throw Error('Dataset changed during approval apply');
    const backup=path.join(root,'reports/auto-update-backups','human-metadata-'+Date.now());fs.mkdirSync(backup,{recursive:true});
    fs.writeFileSync(path.join(backup,'events.js'),data.original);fs.writeFileSync(path.join(backup,'auto-update-review.json'),JSON.stringify(queue,null,2));
    try{atomicWrite(data.file,data.serialize(events));
      const updated=structuredClone(queue);for(const approval of approvals.decisions)Object.assign(updated.items.find(i=>i.id===approval.reviewId),{status:'human-applied',humanApproval:approval,appliedAt:new Date().toISOString()});
      writeJson(queueFile,updated);
    }catch(error){atomicWrite(data.file,data.original);writeJson(queueFile,queue);throw error;}
  }
  return{mode:apply?'apply':'dry-run',changes};
}
if(require.main===module){try{
  const args=process.argv.slice(2),i=args.indexOf('--decisions');
  if(i<0||!args[i+1]||args.some((a,n)=>n!==i+1&&!['--decisions','--apply'].includes(a)))throw Error('Use --decisions <approval.json> [--apply]; default dry-run');
  console.log(JSON.stringify(applyReviewedMetadata({root:path.resolve(__dirname,'..'),approvals:JSON.parse(fs.readFileSync(args[i+1],'utf8')),apply:args.includes('--apply')}),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={applyReviewedMetadata};
