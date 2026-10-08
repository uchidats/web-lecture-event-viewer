// One-time, explicitly requested correction. Not part of the automatic updater.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadEvents,validateEvents}=require('../scripts/auto-updater/storage');
const root=path.resolve(__dirname,'..'),data=loadEvents(root);
const audit=require('../reports/event-metadata-audit-2026-10-09.json');
const high=audit.records.filter(r=>r.priority==='高');assert.equal(high.length,14);
const patches={
 'conf-jp-perimetry-2026':{title:'第15回日本視野画像学会学術集会',venue:'東京慈恵会医科大学 1号館 講堂',subtitle:'視覚のファントム -Phantoms in Vision-',eventOfficialUrl:'https://n-practice.co.jp/jips2026/'},
 'oph-010':{title:'38th APACRS – 55th RCOPT Joint Annual Meeting',date:'2026-06-04',endDate:'2026-06-06',cityCountry:'Pattaya / Thailand',venue:'Pattaya Exhibition and Convention Hall (PEACH)',eventOfficialUrl:'https://apacrs2026.org/',time:'全日程',subtitle:'未確認',officialUrl:'',pdfUrl:'',abstractDeadline:'未確認',earlyBirdDeadline:'未確認',abstractSubmission:{status:'unknown',startDate:null,deadline:null,url:null}},
 'conf-jp-presbyopia-2027':{title:'日本老視学会 第4回学術総会',date:'2026-01-17',endDate:'2026-01-18',venue:'品川THE GRAND HALL',subtitle:'アンメットニーズはここにある',eventOfficialUrl:'https://www.rousi.jp/jps4'},
 'conf-jp-iscev-2027':{title:'第73回 日本臨床視覚電気生理学会',eventOfficialUrl:'https://www.congre.co.jp/73jscev/'},
 'oph-014':{date:'2027-04-23',endDate:'2027-04-23'},
 'conf-jp-perimetry-2027':{title:'第16回日本視野画像学会学術集会',subtitle:'Beyond Boundaries 伝統を礎に未来へ',eventOfficialUrl:'https://www.ganki.jp/jips2027/'},
 'conf-jp-myopia-2027':{title:'第9回 日本近視学会総会',subtitle:'Together for Lifelong Myopia Care',eventOfficialUrl:'https://www.ganki.jp/myopia2027/'},
 'conf-jp-oncology-2027':{title:'第44回日本眼腫瘍学会',eventOfficialUrl:'https://www.ganki.jp/jsoo2027/'},
 'conf-jp-presbyopia-2028':{title:'日本老視学会 第5回学術総会',date:'2027-01-16',endDate:'2027-01-17',cityCountry:'東京都 / 日本',region:'関東',venue:'御茶ノ水ソラシティ カンファレンスセンター',subtitle:'老視克服への新たな冒険',eventOfficialUrl:'https://www.rousi.jp/jps5'},
 'conf-jp-iscev-2028':{title:'第74回 日本臨床視覚電気生理学会（韓日合同学会）'},
 'conf-jp-perimetry-2028':{title:'第17回日本視野画像学会学術集会',venue:'東京慈恵会医科大学 講堂'},
 'conf-jp-myopia-2028':{title:'第10回日本近視学会総会'},
 'conf-jp-inflammation-2028':{title:'第64回日本眼感染症学会・第61回日本眼炎症学会・第11回日本眼科アレルギー学会・第16回日本涙道・涙液学会総会'}
};
const extraSources={
 'conf-jp-perimetry-2026':['https://n-practice.co.jp/jips2026/outline/index.html'],
 'oph-010':['https://apacrs2026.org/'],
 'oph-014':['https://site2.convention.co.jp/jgs2027/info/'],
 'conf-jp-oncology-2027':['https://www.ganki.jp/jsoo2027/information.html','https://www.jsoo.jp/society'],
 'conf-jp-myopia-2028':['https://www.nichigan.or.jp/member/syukai/hyoji.html'],
 'conf-jp-inflammation-2028':['https://www.nichigan.or.jp/member/syukai/hyoji.html']
};
function period(e){const fmt=d=>{const[y,m,day]=d.split('-');return `${y}年${+m}月${+day}日(${new Intl.DateTimeFormat('ja-JP',{weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date(d+'T00:00:00Z'))})`;};return e.endDate!==e.date?`${fmt(e.date)} 〜 ${fmt(e.endDate)}`:fmt(e.date);}
const results=[];
for(const r of high){
 const e=data.events.find(e=>e.id===r.eventId);assert.deepEqual(e,r.currentSnapshot,'Run only against the unchanged audited dataset');
 if(!patches[e.id]){results.push({eventId:e.id,title:e.title,status:'held',reason:'2027年の公式開催情報を確認できない。2022年の過去回へ置き換えず、未確認として非表示にする案を提示。現段階では保存ID・表示ロジックを変更しない。',sources:['https://www.jsaio.jp/meeting/'],changes:[]});continue;}
 const before=structuredClone(e);Object.assign(e,patches[e.id]);
 if(before.date!==e.date||before.endDate!==e.endDate)e.period=period(e);
 if(before.venue!==e.venue && e.id==='oph-010'){delete e.venueId;delete e.timeZone;}
 const fields=[...new Set([...Object.keys(before),...Object.keys(e)])];
 const changes=fields.filter(f=>JSON.stringify(before[f])!==JSON.stringify(e[f])).map(field=>({field,before:before[field]??null,after:e[field]??null}));
 results.push({eventId:e.id,title:e.title,status:'corrected',sources:[...new Set([...(extraSources[e.id]||[]),...r.comparisons.filter(c=>c.url&&c.field!=='registration').map(c=>c.url)])],changes});
}
for(const r of audit.records.filter(r=>r.priority!=='高'))assert.deepEqual(data.events.find(e=>e.id===r.eventId),r.currentSnapshot);
validateEvents(data.events);fs.writeFileSync(data.file,data.serialize(data.events));
fs.writeFileSync(path.join(root,'reports/event-metadata-high-priority-fixes-2026-10-09.json'),JSON.stringify({basis:'event-metadata-audit-2026-10-09.json',corrected:13,held:1,results},null,2)+'\n');
const fmt=v=>JSON.stringify(v).replaceAll('|','／');
const doc=['# 高優先度14件の修正結果','', '監査当時のJSON／Markdownは履歴として維持。13件修正、眼科AI2027の1件保留。対象外80件は完全一致。ID・順序・総数94件を維持。自動更新・管理レビュー・保存キー・認証・Calendar・dual-path公開処理は変更なし。','',
 '未確認テーマを新しく推定しない。APACRSは公式会期より後の演題締切・登録締切、Singapore仮URL／PDF、根拠のない時刻・テーマを未確認／空欄へ戻した。旧Singapore会場マスターも解除し、会場表示とCalendarの場所が旧会場に戻らないようにした。登録期間の新規補完はなし。','',
 '眼科AI2027：第3回は公式記録では2022年。2027年の開催案内がないため、2022年へ変更することも第8回と推測することもしない。未確認として公開一覧から一時除外する案を推奨するが、今回は表示ロジックや保存IDを変えず保留した。','',
 '緑内障2027：独立した国内学会カードは4/23のみ。WGCの4/20–23カードは対象外のため維持。','',
 '専用URL未確認の2028年JSCEV・JIPS・近視・合同学会には、学会一覧URLをeventOfficialUrlとして登録しない。',''];
for(const r of results){doc.push(`## ${r.eventId} — ${r.title}`,'',r.status==='held'?r.reason:'| 項目 | 修正前 | 修正後 |\n| --- | --- | --- |\n'+r.changes.map(c=>`| ${c.field} | ${fmt(c.before)} | ${fmt(c.after)} |`).join('\n'),'',r.sources.map((u,i)=>`[根拠${i+1}](${u})`).join(' '),'');}
fs.writeFileSync(path.join(root,'docs/event-metadata-high-priority-fixes-2026-10-09.md'),doc.join('\n'));
console.log('PASS: corrected 13 high-priority records; held AI; 80 other records unchanged; 94 IDs and ordering retained');
