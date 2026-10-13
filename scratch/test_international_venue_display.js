const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,URL,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 const ascrs=sampleEvents.find(e=>e.id==='conf-int-ascrs-2027'),snapshot=JSON.stringify(ascrs);
 assert.equal(formatVenueDisplayName(ascrs,ascrs.venue),'San Diego Convention Center');
 const html=renderVenueHtml(ascrs);assert.ok(html.includes('>San Diego Convention Center</a>'));
 const query=new URL(html.match(/href="([^"]+)"/)[1]).searchParams.get('query');
 assert.ok(query.includes('San Diego Convention Center, San Diego, CA'));assert.ok(query.includes('サンディエゴ'));
 const card=createEventCardHtml(ascrs);assert.ok(card.includes('[米国]'));assert.ok(card.includes(ascrs.cityCountry));
 for(const [name,expected] of [
  ['San Diego Convention Center, San Diego, CA','San Diego Convention Center'],
  ['Boston Convention Center, Boston, MA','Boston Convention Center'],
  ['Convention Center, San Diego, CA','Convention Center, San Diego'],
  ['Convention Center, New York, NY','Convention Center, New York'],
  ['San Diego Convention Center','San Diego Convention Center']
 ])assert.equal(formatVenueDisplayName(ascrs,name),expected);
 const domestic={region:'関東',cityCountry:'東京都 / 日本'};
 assert.equal(formatVenueDisplayName(domestic,'東京国際フォーラム, 東京, CA'),'東京国際フォーラム, 東京, CA');
 assert.equal(formatVenueDisplayName({...domestic,conferenceRegion:'international'},'東京国際フォーラム, 東京'),'東京国際フォーラム, 東京');
 assert.equal(formatVenueDisplayName({region:'海外',cityCountry:'トロント / カナダ'},'Convention Centre, Toronto, ON'),'Convention Centre, Toronto, ON');
 const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(ascrs.venue+' 米国');
 const multiple=renderVenueHtml({...ascrs,venues:[{name:ascrs.venue,mapUrl:url},{name:'Hall, San Diego, CA',mapUrl:url}]});
 assert.ok(multiple.includes('>San Diego Convention Center</a>'));assert.ok(multiple.includes('>Hall, San Diego</a>'));assert.ok(multiple.includes(escapeHtml(url)));
 assert.equal(JSON.stringify(ascrs),snapshot,'Display does not mutate source data');
`,context);
console.log('PASS: ASCRS simplified venue, US state suffixes, nonduplicated city retained, domestic/non-US preservation, full map query and immutable data');
