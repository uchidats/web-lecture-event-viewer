const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {validateEvents}=require('../scripts/auto-updater/storage');
const context=vm.createContext({assert,console,URL,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
 const event=sampleEvents.find(e=>e.id==='oph-001'),snapshot=JSON.stringify(event);
 assert.equal(event.venue,'国立京都国際会館、ザ・プリンス 京都宝ヶ池');
 assert.deepEqual(event.venues.map(v=>v.name),['国立京都国際会館','ザ・プリンス 京都宝ヶ池']);
 const html=renderVenueHtml(event);assert.equal((html.match(/class="venue-map-link"/g)||[]).length,2);
 for(const venue of event.venues){assert.ok(html.includes(escapeHtml(venue.mapUrl)));const query=new URL(venue.mapUrl).searchParams.get('query');assert.ok(query.includes(venue.name));}
 assert.notEqual(event.venues[0].mapUrl,event.venues[1].mapUrl);
 assert.equal(getEventVenueName({...event,venue:'旧情報'}),'国立京都国際会館、ザ・プリンス 京都宝ヶ池','Structured names win');
 assert.ok(!renderVenueHtml({...event,venue:'旧情報'}).includes('旧情報'));
 assert.equal((renderVenueHtml({...event,venues:undefined}).match(/class="venue-map-link"/g)||[]).length,1,'Legacy fallback retained');
 assert.ok(!renderVenueHtml({...event,venues:[{name:'東京国際フォーラム'}]}).includes('multiple-venues'));
 assert.ok(renderVenueHtml({...event,venues:[{name:'会場',mapUrl:'https://maps.google.com/?q=Kyoto'}]}).includes('href="https://maps.google.com/?q=Kyoto"'));
 const unsafe=renderVenueHtml({...event,venues:[{name:'<script>悪意</script>',mapUrl:'javascript:alert(1)'}]});
 assert.ok(!unsafe.includes('href="javascript:'));assert.ok(unsafe.includes('&lt;script&gt;'));
 assert.equal(JSON.stringify(event),snapshot,'No display-time data mutation');
 for(const [id,names] of [
  ['conf-jp-ringan-2027',['東京国際フォーラム','JPタワー']],
  ['conf-jp-jos-2028',['大阪府立国際会議場（グランキューブ大阪）','リーガロイヤルホテル大阪']],
  ['oph-011',['グランドメルキュール札幌大通公園','札幌プリンスホテル国際館パミール','札幌市教育文化会館']]
 ]){
  const target=sampleEvents.find(e=>e.id===id),html=renderVenueHtml(target);
  assert.deepEqual(target.venues.map(v=>v.name),names);assert.equal(target.venue,names.join('、'),'Legacy venue preserved');
  assert.equal((html.match(/class="venue-map-link"/g)||[]).length,names.length);
  assert.equal(new Set(target.venues.map(v=>v.mapUrl)).size,names.length);
  for(const venue of target.venues){assert.ok(new URL(venue.mapUrl).searchParams.get('query').includes(venue.name));assert.ok(html.includes(escapeHtml(venue.mapUrl)));}
 }
`,context);
for(const venues of [[],[null],[{name:''}],[{name:'会場',mapUrl:'javascript:alert(1)'}]])assert.throws(()=>validateEvents([{id:'invalid',venues}]),/Invalid venues/);
console.log('PASS: official Ringan venues, independent Maps links, structured priority, single legacy fallback, escaping and validation');
