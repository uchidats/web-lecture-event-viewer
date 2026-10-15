// Deadline evidence is distinct from acquisition/decoder health. No event-specific exceptions.
const {text,normalizeDate}=require('./extract');
const {normalizeConferenceTitle}=require('./titles');
const {validRegistration}=require('./registration');
const key=s=>normalizeConferenceTitle(String(s||'')).normalize('NFKC').toLowerCase().replace(/[\p{White_Space}\p{Punctuation}]/gu,'');
function plain(html){return text(html.replace(/<(\/?)(?:footer)\b/gi,'<$1div').replace(/<\/(?:title|td|th|dt)>/gi,'</p>'));}
function identity(document,event,top){
 const title=text(document.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const expected=key(event.title),actual=key(title);
 const edition=String(event.title||'').match(/第(\d+)回/),found=title.match(/第(\d+)回/);
 if(edition&&found&&edition[1]!==found[1])return false;
 const year=event.date?.slice(0,4),years=[...title.matchAll(/20\d{2}/g)].map(m=>m[0]);
 if(years.length&&!years.includes(year))return false;
 if(expected&&actual.includes(expected))return true;
 const core=key(String(event.title||'').replace(/\s*[（(][^）)]*[）)]/g,''));
 if(core&&actual.includes(core))return true;
 const official=event.eventOfficialUrl||event.officialUrl;
 try{if(new URL(document.url).origin!==new URL(official).origin)return false;}catch{return false;}
 const body=plain(document.html),topText=top?plain(top.html):'';
 if(core&&key(body).includes(core))return true;
 if(edition){const society=String(event.title).match(/日本[^\s（(・/]+?学会/)?.[0];return !!society&&key(body).includes(key(society))&&new RegExp('第\\s*'+edition[1]+'\\s*回').test(body)&&(!top||key(topText).includes(key(society)));}
 const acronym=String(event.title||'').match(/\(([A-Z]{2,})\s*20\d{2}\)/)?.[1]||String(event.title||'').match(/^[A-Za-z][A-Za-z\d]+/)?.[0];
 return !!acronym&&new RegExp(acronym,'i').test(title+' '+body)&&new RegExp(acronym+'\\s*'+year,'i').test(body+' '+topText);
}
function issueCategory(issue){
 const reason=issue.reason||issue.issue||'',detail=reason+' '+(issue.error||'');
 if(/fetch-failed|http-\d|bot-protected|fetch-error|timeout|ENOTFOUND|ECONN|untrusted|Missing cached/i.test(detail))return 'unavailable';
 if(/not-applicable/.test(reason))return 'not-applicable';
 if(/not-published/.test(reason))return 'unpublished';
 if(/no-recognized|link-not-found/.test(reason))return 'link-not-found';
 if(/conflict|identity|ambiguous-boundary|invalid-order|invalid-date|insufficient-replacement-evidence|unknown-timezone|^ambiguous$/.test(reason))return 'review';
 return 'extraction-failed';
}
function partitionIssues(issues){return {review:issues.filter(i=>issueCategory(i)==='review'),observations:issues.filter(i=>issueCategory(i)!=='review').map(i=>({...i,category:issueCategory(i)}))};}
const months='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
function dates(input,event){
 const clean=input.normalize('NFKC').replace(/(\d{4}年|\d{1,2}月)\s+/g,'$1').replace(/\([^)]*(?:extended from|original)[^)]*\)/gi,'');
 const pattern=/(\d{4})[-/](\d{1,2})[-/](\d{1,2})|(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日|\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*(\d{4})?\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/gi;
 const found=[...clean.matchAll(pattern)],explicit=found.map(m=>m[1]||m[4]||m[9]||m[12]).filter(Boolean);
 return found.map((m,index)=>{
  const month=+(m[2]||m[5]||(months.indexOf(String(m[8]||m[10]).slice(0,3).toLowerCase())+1)),day=+(m[3]||m[6]||m[7]||m[11]);
  let year=+(m[1]||m[4]||m[9]||m[12]||explicit[0]||event.date.slice(0,4));
  if(index===0&&!m[1]&&!m[4]&&!m[9]&&!m[12]&&found[1]&&(found[1][1]||found[1][4]||found[1][9]||found[1][12])){const nextMonth=+(found[1][2]||found[1][5]||(months.indexOf(String(found[1][8]||found[1][10]).slice(0,3).toLowerCase())+1));if(month>nextMonth)year--;}
  if(!explicit.length&&String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')>event.date.slice(5))year--;
  if(!m[1]&&!m[4]&&!m[9]&&!m[12]&&index&&month<+(found[index-1][2]||found[index-1][5]||0))year++;
  const after=clean.slice(m.index+m[0].length,found[index+1]?.index??m.index+m[0].length+55).replace(/^\s*\((?:[月火水木金土日]|Mon\w*|Tue\w*|Wed\w*|Thu\w*|Fri\w*|Sat\w*|Sun\w*)\)/i,'').replace(/^\s*\((?=\d{1,2}:)/,'');
  const before=clean.slice(Math.max(0,m.index-35),m.index);
  let clock=after.match(/^\s*[,、]?\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i)||after.match(/^\s*(\d{1,2})時(?:(\d{2})分)?/)||(after.match(/^\s*正午/)?['','12','00']:null);
  if(!clock&&/\d{1,2}:\d{2}\s*[AP]M\s*,?\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*)?$/i.test(before))clock=before.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const hour=clock?(clock[3]?(+clock[1]<1||+clock[1]>12?25:+clock[1]%12+(clock[3].toUpperCase()==='PM'?12:0)):+clock[1]):null;
  const value=normalizeDate(`${year}年${month}月${day}日${clock?' '+String(hour).padStart(2,'0')+':'+(clock[2]||'00'):''}`)?.replace(' ','T');
  return {value,index:m.index,end:m.index+m[0].length,explicitYear:!!(m[1]||m[4]||m[9]||m[12]),raw:m[0]};
 });
}
function zone(body,event){
 if(/(?:Singapore Time|GMT\s*\+\s*8|UTC\s*\+\s*8)/i.test(body))return 'Asia/Singapore';
 if(/Japan Standard Time|JST|UTC\s*\+\s*9/i.test(body))return 'Asia/Tokyo';
 if(/\bGMT\b(?!\s*\+)/.test(body))return 'Etc/UTC';
 if(/\bCEST\b/.test(body))return 'Etc/GMT-2';
 if(/\bCET\b/.test(body))return 'Etc/GMT-1';
 return event.abstractSubmission?.timeZone||event.registration?.timeZone||event.timeZone||(event.conferenceRegion!=='international'?'Asia/Tokyo':null);
}
function unpublished(body){return /(?:このページ|只今|現在)[\s\S]{0,25}準備中|準備中です|coming soon|to be announced/i.test(body);}
function extractAbstract(document,event,top){
 const body=plain(document.html);
 if(/一般口演[\s\S]{0,100}演題受付は行いません/.test(body))return {issue:'abstract-not-applicable'};
 if(!identity(document,event,top))return {issue:'abstract-conference-identity-unconfirmed'};
 const zoneEvidence=body.split('\n').filter(l=>/deadline|submission.*clos/i.test(l)&&/\bCE[S]?T\b/.test(l)).join('\n');
 if(/\bCEST\b/.test(zoneEvidence)&&/\bCET\b/.test(zoneEvidence))return {issue:'abstract-conflicting-timezones',evidence:zoneEvidence};
 if(unpublished(body)&&!/(?:演題.*期間|abstract.*deadline|deadline.*abstract)/i.test(body))return {issue:'abstract-not-published'};
 const lines=body.split('\n'),segments=[];
 for(let i=0;i<lines.length;i++){
  if(!/演題.*(?:募集|登録|受付)期間|抄録募集期間|abstract submission period|submission commencement|submission deadline|(?:abstract.*deadline|deadline.*abstract)|一般演題の募集期間/i.test(lines[i]))continue;
  if(/^※|保守|延長は|延長しました/.test(lines[i]))continue;
  if(/ePoster in PowerPoint|film submission|presenting author|presenter|registration|notification/i.test(lines[i]))continue;
  let chunk=lines.slice(i,i+5).join('\n');
  chunk=chunk.split(/指定演題/)[0];
  if(/未定|\bTBD\b|\bTBA\b/i.test(chunk))return {issue:'abstract-not-published'};
  // A heading followed by the general-abstract and invited-abstract rows.
  const values=dates(chunk,event);if(values.length)segments.push({chunk,values});
 }
 if(!segments.length)return {issue:unpublished(body)?'abstract-not-published':'abstract-extraction-failed'};
 const deadlines=[];let startDate;
 for(const {chunk,values} of segments){
  if(values.some(d=>!d.value))return {issue:'abstract-invalid-date'};
  if(values.length===1&&/[~〜～–—-]\s*\d{1,2}日/.test(chunk))return {issue:'abstract-extraction-failed'};
  const isRange=/[~〜～–—]|\s-\s/.test(chunk)&&values.length>=2;
  if(/commencement/i.test(chunk.split('\n')[0])){startDate=values[0].value;if(values[1])deadlines.push(values[1].value);}
  else if(isRange){startDate||=values[0].value;deadlines.push(values[1].value);}
  else if(/commencement/i.test(chunk.split('\n')[0])&&!/deadline/i.test(chunk))startDate=values[0].value;
  else deadlines.push(values[0].value);
 }
 const byDay=new Map();for(const d of deadlines){const old=byDay.get(d.slice(0,10));if(!old||d.length>old.length)byDay.set(d.slice(0,10),d);}
 if(byDay.size!==1)return {issue:'abstract-conflicting-deadlines'};
 if(/\bCEST\b/.test(body)&&/\bCET\b/.test(body))return {issue:'abstract-conflicting-timezones'};
 const deadline=[...byDay.values()][0],timeZone=zone(body,event);
 if(deadline.includes('T')&&!timeZone)return {issue:'abstract-unknown-timezone'};
 if(deadline.slice(0,10)>(event.endDate||event.date)||startDate&&startDate>deadline)return {issue:'abstract-invalid-order'};
 const value={...(startDate?{startDate}:{status:/submission.*(?:is open|open)|受付中|募集中/i.test(body)?'open':'unknown'}),deadline,url:document.url,...(timeZone?{timeZone}:{})};
 if(!validAbstract(value,event))return {issue:'abstract-invalid-date'};
 return {value,evidence:segments.map(s=>s.chunk).join('\n')};
}
const stage=/(事前早期登録|事前通常登録|早期参加登録|通常参加登録|事前参加登録|前期参加登録|後期参加登録|直前・当日参加登録|直前・当日登録|直前参加登録|直前登録|当日参加登録|当日登録|通常登録|早期登録|事前登録|追加登録|Early[ -]?Bird(?: Registration| Rate| fee)?|Advance(?: Registration| Rate| fee)?|Standard(?: Registration| Rate| fee)?|Regular(?: Registration| Rate| fee)?|Late(?: Registration| Rate| fee)?|On[ -]?site|[123](?:st|nd|rd)\s*Tier(?: Rate)?)/i;
function phaseCategory(label){
 if(/当日|直前|on[ -]?site/i.test(label))return {category:'onsite',advanceEligible:false};
 if(/早期|前期|early[ -]?bird|1st\s*tier/i.test(label))return {category:'early',advanceEligible:true};
 if(/事前|通常|regular|advance|2nd\s*tier/i.test(label))return {category:'regular',advanceEligible:true};
 if(/後期|standard|late|3rd\s*tier/i.test(label))return {category:'regular',advanceEligible:null};
 return {category:null,advanceEligible:null};
}
function extractRegistration(document,event,top){
 const body=plain(document.html);
 if(!identity(document,event,top))return {issue:'registration-conference-identity-unconfirmed'};
 if(unpublished(body)&&!dates(body,event).some(d=>d.value))return {issue:'registration-not-published'};
 const lines=body.split('\n'),periods=[];let unparsed=false;
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(stage);if(!match||match.index>8)continue;
  let chunk=lines[i].slice(match.index+match[0].length);
  for(let j=i+1;j<Math.min(lines.length,i+6);j++){
   const next=lines[j].match(stage);if(next&&next.index<=8)break;
   if(!dates(chunk,event).length&&!dates(lines[j],event).length&&!/^(?:on or before|until|from|by|onwards|\s*[:~])$/i.test(lines[j]))break;
   if(dates(chunk,event).length&&(dates(chunk,event).length>=2||/会期終了/.test(chunk)||!dates(lines[j],event).length))break;
   chunk+='\n'+lines[j];
  }
  const ds=dates(chunk,event);
  if(/未定|TBD|TBA/i.test(chunk)){unparsed=true;continue;}
  if(!ds.length)continue;
  if(ds.length===1&&/[~〜～–—-]\s*\d{1,2}日/.test(chunk)){unparsed=true;continue;}
  if(ds.some(d=>!d.value))return {issue:'registration-invalid-date'};
  const label=match[0],category=phaseCategory(label);
  let start,deadline;
  if(ds.length>=2){start=ds[0].value;deadline=ds[1].value;}
  else if(/onwards|from|以降|~\s*(?:$|会期終了)/i.test(chunk)&&!/before|until|まで/i.test(chunk)){start=ds[0].value;if(/会期終了/.test(chunk))deadline=event.endDate||event.date;}
  else deadline=ds[0].value;
  periods.push({label,...(start?{start}:{}),...(deadline?{deadline}:{}),...category,sourceUrl:document.url});
 }
 // Contradictory years are material, including official footers; cancelled dates are already removed.
 const keyed=new Map();for(const p of periods){const k=key(p.label.replace(/(?:Registration|Rate|fee)/gi,''));const old=keyed.get(k);if(old?.deadline&&p.deadline&&old.deadline.slice(0,10)!==p.deadline.slice(0,10))return {issue:'registration-conflicting-deadlines',evidence:JSON.stringify([old,p])};if(!old||Object.keys(p).length>Object.keys(old).length)keyed.set(k,p);}
 const unique=[...keyed.values()];
 if(document.verifiedImageText){
  const image=extractRegistration({...document,html:'<html><title>'+event.title+'</title><p>'+document.verifiedImageText.replace(/\n/g,'</p><p>')+'</p></html>',verifiedImageText:null},event,top);
  if(image.issue)return image;
 }
 if(!unique.length)return {issue:/<img[^>]+(?:Reg-fees|registration[^"']*\.(?:png|jpg))/i.test(document.html)?'registration-extraction-failed':unpublished(body)||!/\b(?:early|regular|late|advance|standard)\b|参加登録期間/i.test(body)?'registration-not-published':'registration-extraction-failed'};
 if(/\bONWARDS\b/.test(body)&&!unique.some(p=>p.start&&!p.deadline))return {issue:'registration-extraction-failed'};
 if(unparsed)return {issue:'registration-extraction-failed'};
 const timeZone=zone(body,event),value={version:2,type:event.conferenceRegion==='international'?'international':'domestic',...(timeZone?{timeZone}:{}),periods:unique};
 if(unique.some(p=>(p.start?.includes('T')||p.deadline?.includes('T'))&&!timeZone))return {issue:'registration-unknown-timezone'};
 if(!validRegistration(value))return {issue:'registration-invalid-order'};
 for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++)if(unique[i].deadline&&unique[j].start&&unique[i].deadline===unique[j].start&&!unique[i].deadline.includes('T'))return {issue:'registration-ambiguous-boundary',evidence:JSON.stringify([unique[i],unique[j]])};
 return {value,evidence:body};
}
function validAbstract(value,event){
 if(!value||!['open','closed','unknown','upcoming',undefined].includes(value.status))return false;
 if(value.deadline&&Number(value.deadline.slice(0,4))<Number(event.date.slice(0,4))-1)return false;
 if(!validRegistration({type:'domestic',...(value.timeZone?{timeZone:value.timeZone}:{}),periods:[{label:'abstract',start:value.startDate,deadline:value.deadline}]}))return false;
 try{const u=new URL(value.url||event.eventOfficialUrl||event.officialUrl);if(u.protocol!=='https:'||u.username||u.password)return false;}catch{return false;}
 return !value.deadline||value.deadline.slice(0,10)<=(event.endDate||event.date);
}
function preserveDatePrecision(before,after){return typeof before==='string'&&typeof after==='string'&&after.length===10&&before.slice(0,10)===after?before:after;}
function mergeRegistration(before,after){
 if(!before||!validRegistration(after))return {value:after};
 if(before.periods.some(p=>!after.periods.some(next=>key(next.label)===key(p.label))))return {issue:'registration-insufficient-replacement-evidence'};
 return {value:{...before,...after,periods:after.periods.map(p=>{const old=before.periods.find(o=>key(o.label)===key(p.label));if(!old)return p;const value={...old,...p};for(const k of ['start','deadline']){if(p[k])value[k]=preserveDatePrecision(old[k],p[k]);else if(old[k]!==undefined)value[k]=old[k];else delete value[k];}for(const k of ['category','advanceEligible'])if(p[k]==null&&old[k]!=null)value[k]=old[k];return value;})}};
}
module.exports={plain,identity,dates,zone,issueCategory,partitionIssues,extractAbstract,extractRegistration,phaseCategory,validAbstract,preserveDatePrecision,mergeRegistration};
