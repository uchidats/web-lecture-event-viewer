// Shared one-hop budget: up to two registration and two abstract pages, four total.
const {registrationLinks,followRegistrationPages}=require('./registration-followup');
const {text,blocks,dateRanges,normalizeDate}=require('./extract');
const {validRegistration}=require('./registration');
const MAX_IMPORTANT_PAGES=4;
function extractAbstractPage(document,event) {
  const title=text(document.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/\s/g,'');
  if(!event.title||!title.includes(event.title.replace(/\s/g,'')))return {issue:'abstract-conference-identity-unconfirmed'};
  const sections=blocks(document.html).filter(([label])=>/演題.*(?:募集|登録|受付)期間|抄録募集期間|(?:abstract.*(?:submission|period|deadline)|call for abstracts)/i.test(label));
  const ranges=[];
  for(const [,html] of sections) {
    const plain=text(html);
    if(/未定|TBD|TBA/i.test(plain)||[...plain.matchAll(/20\d{2}年\d{1,2}月\d{1,2}日/g)].some(m=>!normalizeDate(m[0])))return {issue:'abstract-period-invalid-or-unconfirmed'};
    for(const r of dateRanges(plain,Number(event.date?.slice(0,4)))) {
      if(!r.start||!r.end||(r.evidence.match(/20\d{2}年/g)||[]).length!==2)return {issue:'abstract-period-ambiguous'};
      ranges.push(r);
    }
  }
  const unique=[...new Map(ranges.map(r=>[r.start+'|'+r.end,r])).values()];
  if(unique.length!==1)return {issue:unique.length?'abstract-period-conflicting':'abstract-period-unconfirmed'};
  const r=unique[0],timeZone=event.abstractSubmission?.timeZone||event.timeZone||event.registration?.timeZone||(event.conferenceRegion!=='international'?'Asia/Tokyo':null);
  const value={startDate:r.start.replace(' ','T'),deadline:r.end.replace(' ','T'),url:document.url,timeZone};
  if(!timeZone||!validRegistration({type:'domestic',timeZone,periods:[{label:'abstract',start:value.startDate,deadline:value.deadline}]})||value.deadline.slice(0,10)>(event.endDate||event.date))return {issue:'abstract-period-invalid-order-or-zone'};
  return {value,evidence:r.evidence};
}
function abstractStatus(value,today=new Date().toISOString().slice(0,10)) {
  return value.deadline.slice(0,10)<today?'closed':value.startDate.slice(0,10)>today?'upcoming':'open';
}
async function followImportantPages({document,event,getPage,excludeUrls=[]}) {
  const cache=new Map();
  const cached=page=>{if(!cache.has(page.url))cache.set(page.url,getPage(page));return cache.get(page.url);};
  const registration=await followRegistrationPages({document,event,getPage:cached,excludeUrls});
  const pages=[...registration.pages],abstractIssues=[],values=[];
  const base=new URL(document.url),directory=new URL('.',base).pathname;
  for(const url of registrationLinks(document.html,document.url,'abstract').filter(url=>!excludeUrls.includes(url))) {
    try {
      const page=await cached({url,role:'abstract'}),final=new URL(page.url||url);
      if(final.origin!==base.origin||!final.pathname.startsWith(directory))throw Error('abstract-redirect-outside-event');
      const normalized={...page,url:final.href};if(!pages.some(p=>p.url===final.href))pages.push(normalized);
      const parsed=extractAbstractPage(normalized,event);
      if(parsed.issue)abstractIssues.push({url,reason:parsed.issue});else values.push(parsed);
    }catch(error){abstractIssues.push({url,reason:'abstract-fetch-failed',error:error.message});}
  }
  const unique=[...new Map(values.map(v=>[JSON.stringify({...v.value,url:null}),v])).values()];
  if(unique.length>1)abstractIssues.push({url:document.url,reason:'abstract-conflicting-pages'});
  return {pages,registration:registration.registration,registrationIssues:registration.issues,abstractIssues,
    abstractSubmission:unique.length===1&&!abstractIssues.length?unique[0]:null,issues:[...registration.issues,...abstractIssues]};
}
module.exports={MAX_IMPORTANT_PAGES,extractAbstractPage,abstractStatus,followImportantPages};
