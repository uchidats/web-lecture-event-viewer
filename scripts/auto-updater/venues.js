// Deterministic venue extraction: explicit entries only; never split slashes or infer sites.
function validVenues(value) {
  return Array.isArray(value)&&value.length>0&&value.every(v=>v&&typeof v.name==='string'&&v.name.trim()&&typeof v.mapUrl==='string'&&
    URL.canParse(v.mapUrl)&&new URL(v.mapUrl).protocol==='https:'&&!new URL(v.mapUrl).username&&!new URL(v.mapUrl).password);
}
function venueKey(value) { return JSON.stringify((value||[]).map(v=>({name:v.name.normalize('NFKC').replace(/\s+/g,' ').trim(),mapUrl:v.mapUrl}))); }
function makeVenue(name,address='') {return {name:name.trim(),mapUrl:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([name.trim(),address.trim()].filter(Boolean).join(' '))};}
function extractVenueSection(html,toText) {
  const address=line=>/〒|\d{3}-\d{4}|^(?:東京都|北海道|京都府|大阪府|.{2,3}県).*(?:市|区)|^\d+\s+.*(?:Street|St\b|Road|Rd\b)/i.test(line);
  const facility=line=>/(?:会館|ホテル|フォーラム|タワー|会議場|センター|ホール|Convention Center|Hotel|Hall)(?:[（(].*[）)])?$/i.test(line);
  const lines=toText(html).split('\n').map(s=>s.trim()).filter(Boolean);
  const entries=[];
  for(const line of lines){
    if(address(line)){if(entries.length)entries.at(-1).address+=' '+line;continue;}
    if(/^https?:|^TEL|^FAX|アクセス|地図|Google.*Maps/i.test(line))continue;
    const names=line.includes('、')&&!/[（(].*、.*[）)]/.test(line)?line.split('、').map(s=>s.trim()):[line];
    for(const name of names)entries.push({name,address:''});
  }
  if(entries.length>1&&entries.every(e=>facility(e.name)||e.address.trim()))return {venues:entries.map(e=>makeVenue(e.name,e.address)),ambiguous:false};
  return {venues:null,ambiguous:entries.length>1 || entries.some(e=>/[／/]/.test(e.name.replace(/[（(].*?[）)]/g,'')))};
}
function venuesFromLocations(locations){
  if(!Array.isArray(locations)||locations.length<2||locations.some(v=>!v||typeof v.name!=='string'||!v.name.trim()||v['@type']&&v['@type']!=='Place'))return null;
  return locations.map(v=>makeVenue(v.name,typeof v.address==='string'?v.address:[v.address?.streetAddress,v.address?.addressLocality,v.address?.addressRegion,v.address?.addressCountry].filter(x=>typeof x==='string').join(' ')));
}
module.exports={validVenues,venueKey,makeVenue,extractVenueSection,venuesFromLocations};
