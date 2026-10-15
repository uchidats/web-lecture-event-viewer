// One-hop official registration discovery, shared by both updater paths.
const {text,blocks,registrationPeriods,normalizeDate,dateRanges}=require('./extract');
const {validRegistration,registrationKey}=require('./registration');
const MAX_REGISTRATION_PAGES=2;
function registrationLinks(html,baseUrl,role='registration') {
  const base=new URL(baseUrl),directory=new URL('.',base).pathname;
  const links=[];
  const clean=html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  for(const m of clean.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label=text(m[2].replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi,'$1')).replace(/\s|NEW|更新|[!！]/gi,'');
    const matches=role==='abstract'?/^(?:演題募集|抄録募集|演題登録|Abstracts?|CallforAbstracts)$/i:/^(?:参加登録|事前参加登録|参加申込|参加者の皆様へ|Registration|Register)$/i;
    if(!matches.test(label))continue;
    try {
      const url=new URL(m[1].replace(/&amp;/g,'&'),base);url.hash='';
      if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||!url.pathname.startsWith(directory)||url.href===base.href)continue;
      if(!links.includes(url.href))links.push(url.href);
    }catch{/* Invalid links are never fetched. */}
  }
  return links.slice(0,MAX_REGISTRATION_PAGES);
}
function phaseCategory(label) {
  if(/当日|直前|on[ -]?site/i.test(label))return {category:'onsite',advanceEligible:false};
  if(/早期|early\s*bird/i.test(label))return {category:'early',advanceEligible:true};
  if(/事前参加|通常|regular/i.test(label))return {category:'regular',advanceEligible:true};
  return {category:null,advanceEligible:null};
}
function extractRegistrationPage(document,event) {
  const title=text(document.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s/g,'');
  const expected=String(event.title||'').replace(/\s/g,'');
  if(!expected||!title.includes(expected))return {issue:'registration-conference-identity-unconfirmed'};
  const type=event.conferenceRegion==='international'?'international':'domestic';
  const result=registrationPeriods(blocks(document.html),{id:event.id,name:event.title,year:Number(event.date?.slice(0,4)),registrationType:type});
  if(!result.value.periods.length)return {issue:'registration-periods-unconfirmed'};
  const plain=text(document.html);
  const declared=[...plain.matchAll(/(事前早期登録|事前通常登録|早期参加登録|通常参加登録|事前参加登録|直前・当日参加登録|直前・当日登録|直前参加登録|直前登録|当日参加登録|当日登録|通常登録|早期登録|Early\s*bird|Regular|Late|On[ -]?site)\s*[:：]?\s*(?=20\d{2}|未定)/gi)].map(m=>m[1].toLowerCase());
  if(declared.some(label=>!result.value.periods.some(p=>p.label.toLowerCase()===label))||
      /第[一二三123１２３]+次(?:参加)?登録/.test(plain)||
      [...plain.matchAll(/20\d{2}年\d{1,2}月\d{1,2}日/g)].some(m=>!normalizeDate(m[0])))
    return {issue:'registration-periods-incomplete-or-invalid'};
  const timeZone=event.registration?.timeZone||event.timeZone||(type==='domestic'?'Asia/Tokyo':null);
  const periods=result.value.periods.map(p=>({...p,...phaseCategory(p.label),sourceUrl:document.url}));
  const explicitRanges=dateRanges(plain,Number(event.date?.slice(0,4))).filter(r=>(r.evidence.match(/20\d{2}年/g)||[]).length===2);
  const value={version:2,type,timeZone,periods};
  // No inherited years, unknown stages, partial ranges or inferred international time zones in automatic updates.
  if(!timeZone||periods.some(p=>!p.start||!p.deadline||p.category===null||
      type==='domestic'&&!explicitRanges.some(r=>r.start?.replace(' ','T')===p.start&&r.end?.replace(' ','T')===p.deadline))||
      new Set(periods.map(p=>p.label.toLowerCase())).size!==periods.length||
      (result.evidence.match(/\b20\d{2}(?:年|[-/]|\b)/g)||[]).length<periods.length*2||!validRegistration(value))
    return {issue:'registration-periods-ambiguous',proposed:value};
  return {value,evidence:result.evidence};
}
async function followRegistrationPages({document,event,getPage,excludeUrls=[]}) {
  const pages=[],issues=[],values=[];
  const base=new URL(document.url),directory=new URL('.',base).pathname;
  for(const url of registrationLinks(document.html,document.url).filter(url=>!excludeUrls.includes(url))) {
    try {
      const page=await getPage({url,role:'registration'});
      const final=new URL(page.url||url);
      if(final.origin!==base.origin||!final.pathname.startsWith(directory))throw Error('registration-redirect-outside-event');
      pages.push({...page,url:final.href});
      const parsed=extractRegistrationPage({...page,url:final.href},event);
      if(parsed.issue)issues.push({url,reason:parsed.issue,proposed:parsed.proposed||null});
      else values.push({...parsed,url:final.href});
    }catch(error){issues.push({url,reason:'registration-fetch-failed',error:error.message});}
  }
  const unique=[...new Map(values.map(v=>[registrationKey({...v.value,periods:v.value.periods.map(p=>({...p,sourceUrl:null}))}),v])).values()];
  if(unique.length>1)issues.push({url:document.url,reason:'registration-conflicting-pages'});
  return {pages,issues,registration:unique.length===1&&!issues.length?unique[0]:null};
}
module.exports={MAX_REGISTRATION_PAGES,registrationLinks,phaseCategory,extractRegistrationPage,followRegistrationPages};
