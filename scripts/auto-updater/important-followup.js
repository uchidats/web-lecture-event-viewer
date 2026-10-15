// Shared one-hop budget: up to two registration and two abstract pages, four total.
const {registrationLinks,followRegistrationPages}=require('./registration-followup');
const MAX_IMPORTANT_PAGES=4;
function extractAbstractPage(document,event,top) { return require('./deadline-evidence').extractAbstract(document,event,top); }
function abstractStatus(value,today=new Date().toISOString().slice(0,10)) {
  return value.deadline.slice(0,10)<today?'closed':!value.startDate?value.status||'unknown':value.startDate.slice(0,10)>today?'upcoming':'open';
}
async function followImportantPages({document,event,getPage,getImagePage=require('./image-evidence').fetchVerifiedImagePage,excludeUrls=[]}) {
  const cache=new Map();
  const cached=page=>{if(!cache.has(page.url)){if(cache.size>=MAX_IMPORTANT_PAGES)throw Error('important-page-budget-exhausted');cache.set(page.url,page.role==='evidence-image'?getImagePage(page):getPage(page));}return cache.get(page.url);};
  const registration=await followRegistrationPages({document,event,getPage:cached,excludeUrls});
  const pages=[...registration.pages],abstractIssues=[],values=[];
  const base=new URL(document.url),directory=new URL('.',base).pathname;
  const links=registrationLinks(document.html,document.url,'abstract');
  if(!links.length)abstractIssues.push({url:document.url,reason:'abstract-link-not-found'});
  for(const url of links.filter(url=>!excludeUrls.includes(url))) {
    try {
      const page=await cached({url,role:'abstract'}),final=new URL(page.url||url);
      if(final.origin!==base.origin||!final.pathname.startsWith(directory))throw Error('abstract-redirect-outside-event');
      const normalized={...page,url:final.href};if(!pages.some(p=>p.url===final.href))pages.push(normalized);
      const parsed=extractAbstractPage(normalized,event,document);
      if(parsed.issue)abstractIssues.push({url,reason:parsed.issue,evidence:parsed.evidence});else values.push(parsed);
    }catch(error){abstractIssues.push({url,reason:'abstract-fetch-failed',error:error.message});}
  }
  const unique=[...new Map(values.map(v=>[JSON.stringify({...v.value,url:null}),v])).values()];
  if(unique.length>1)abstractIssues.push({url:document.url,reason:'abstract-conflicting-pages'});
  return {pages,registration:registration.registration,registrationIssues:registration.issues,abstractIssues,
    abstractSubmission:unique.length===1&&!abstractIssues.length?unique[0]:null,issues:[...registration.issues,...abstractIssues]};
}
module.exports={MAX_IMPORTANT_PAGES,extractAbstractPage,abstractStatus,followImportantPages};
