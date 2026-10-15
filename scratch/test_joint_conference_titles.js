const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({assert,console,document:{getElementById:()=>null,addEventListener:()=>{}}});
for(const file of ['venues.js','companies.js','events.js','script.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
vm.runInContext(`
const original=JSON.stringify(sampleEvents);
const title='第83回 日本弱視斜視学会総会・第52回 日本小児眼科学会総会';
assert.equal(renderConferenceTitleHtml({isConference:true,title}),'第83回 日本弱視斜視学会総会・<br class="joint-conference-title-break">第52回 日本小児眼科学会総会');
for(const title of ['第1回 角膜・外眼部研究会','国内学会・第2回 研究会','第3回 学会（第2回 研究会）'])assert.equal(renderConferenceTitleHtml({isConference:true,title}),escapeHtml(title));
assert.equal(renderConferenceTitleHtml({isConference:false,title}),escapeHtml(title));
assert.equal((renderConferenceTitleHtml({isConference:true,title:'第１回 A・第２回 B・第３回 C'}).match(/<br/g)||[]).length,2);
assert.ok(renderConferenceTitleHtml({isConference:true,title:'第1回 <img>・第2回 B'}).includes('&lt;img&gt;'));
assert.equal(JSON.stringify(sampleEvents),original);
`,context);
console.log('PASS: joint-title ordinal separators only, punctuation retained, ordinary titles untouched, XSS escaping and unchanged data');
