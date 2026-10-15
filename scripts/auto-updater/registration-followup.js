// One-hop official registration discovery, shared by both updater paths.
const {text}=require('./extract');
const {registrationKey}=require('./registration');
const MAX_REGISTRATION_PAGES=2;
function registrationLinks(html,baseUrl,role='registration') {
  const base=new URL(baseUrl),directory=new URL('.',base).pathname;
  const links=[];
  const clean=html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  for(const m of clean.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label=text(m[2].replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi,'$1')).replace(/\s|NEW|更新|[!！]/gi,'');
    const matches=role==='abstract'?/^(?:(?:一般)?(?:演題募集|抄録募集|演題登録)(?:について)?|Abstracts?(?:Submissions?)?|CallforAbstracts|Submission|[A-Za-z]+(?:20\d{2})?AbstractSubmission)$/i:/^(?:参加登録|事前参加登録|参加申込|参加者の皆様へ|Registration|Register)$/i;
    const branded=role==='abstract'&&label.match(/^([A-Za-z]+)(?:20\d{2})?AbstractSubmission$/i);
    if(!matches.test(label.replace(/^[A-Za-z]+(?:20\d{2})?(?=AbstractSubmission)/i,''))&&!branded)continue;
    if(branded&&!base.hostname.toLowerCase().includes(branded[1].toLowerCase()))continue;
    try {
      const url=new URL(m[1].replace(/&amp;/g,'&'),base);url.hash='';
      if(url.protocol!=='https:'||url.origin!==base.origin||url.username||url.password||!url.pathname.startsWith(directory)||url.href===base.href)continue;
      if(!links.includes(url.href))links.push(url.href);
    }catch{/* Invalid links are never fetched. */}
  }
  return links.slice(0,MAX_REGISTRATION_PAGES);
}
function phaseCategory(label) { return require('./deadline-evidence').phaseCategory(label); }
function extractRegistrationPage(document,event,top) { return require('./deadline-evidence').extractRegistration(document,event,top); }
async function followRegistrationPages({document,event,getPage,excludeUrls=[]}) {
  const pages=[],issues=[],values=[];
  const base=new URL(document.url),directory=new URL('.',base).pathname;
  const links=registrationLinks(document.html,document.url);
  if(!links.length)issues.push({url:document.url,reason:'registration-link-not-found'});
  for(const url of links.filter(url=>!excludeUrls.includes(url))) {
    try {
      const page=await getPage({url,role:'registration'});
      const final=new URL(page.url||url);
      if(final.origin!==base.origin||!final.pathname.startsWith(directory))throw Error('registration-redirect-outside-event');
      for(const image of require('./image-evidence').linkedImages({...page,url:final.href})){
        try{const asset=await getPage({url:image.url,role:'evidence-image'});pages.push(asset);page.verifiedImageText=asset.verifiedImageText;}
        catch(error){issues.push({url:image.url,reason:'image-extraction-unavailable',error:error.message});}
      }
      pages.push({...page,url:final.href});
      const parsed=extractRegistrationPage({...page,url:final.href},event,document);
      if(parsed.issue)issues.push({url,reason:parsed.issue,evidence:parsed.evidence,proposed:parsed.proposed||null});
      else values.push({...parsed,url:final.href});
    }catch(error){issues.push({url,reason:'registration-fetch-failed',error:error.message});}
  }
  const unique=[...new Map(values.map(v=>[registrationKey({...v.value,periods:v.value.periods.map(p=>({...p,sourceUrl:null}))}),v])).values()];
  if(unique.length>1)issues.push({url:document.url,reason:'registration-conflicting-pages'});
  return {pages,issues,registration:unique.length===1&&!issues.length?unique[0]:null};
}
module.exports={MAX_REGISTRATION_PAGES,registrationLinks,phaseCategory,extractRegistrationPage,followRegistrationPages};
