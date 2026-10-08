// Structured observations from opened first-party pages, 2026-10-09.
// Used only by the read-only audit, never by the automatic updater.
module.exports = [
  { eventId:'conf-jp-surgery-2027', url:'https://50.jsos.jp/', checkedOn:'2026-10-09',
    facts:{title:'第50回 日本眼科手術学会学術総会',edition:[50],year:2027,date:'2027-01-29',endDate:'2027-01-31',venue:'東京国際フォーラム',subtitle:'原点回帰と未来への革新'},
    evidence:'公式トップのメイン表示：第50回、2027年1月29～31日、東京国際フォーラム、テーマ「原点回帰と未来への革新」。' },
  { eventId:'conf-jp-optics-2027', url:'https://www.jsoo-ws.com/63overview', checkedOn:'2026-10-09',
    facts:{title:'第63回日本眼光学学会総会',edition:[63],year:2027,date:'2027-08-28',endDate:'2027-08-29',venue:'御茶ノ水ソラシティカンファレンスセンター',subtitle:'Informed vision, bright future'},
    evidence:'公式開催概要：第63回、2027年8月28～29日、御茶ノ水ソラシティ、テーマ「Informed vision, bright future」。' },
  { eventId:'conf-jp-presbyopia-2028', url:'https://www.rousi.jp/jps5-overview', checkedOn:'2026-10-09',
    facts:{title:'日本老視学会 第5回学術総会',edition:[5],year:2027,date:'2027-01-16',endDate:'2027-01-17',cityCountry:'東京都 / 日本',venue:'御茶ノ水ソラシティ カンファレンスセンター',subtitle:'老視克服への新たな冒険'},
    evidence:'開催概要：第5回、2027年1月16日・17日、御茶ノ水ソラシティ、テーマ「老視克服への新たな冒険」。' },
  { eventId:'conf-jp-iscev-2027', url:'https://n-practice.co.jp/jscev/meeting/latest.html', checkedOn:'2026-10-09',
    facts:{title:'第73回 日本臨床視覚電気生理学会',edition:[73],year:2027,date:'2027-03-12',endDate:'2027-03-13',venue:'リンクステーションホール青森'},
    evidence:'今後開催の学術集会：2027年第73回、3月12～13日、リンクステーションホール青森。' },
  { eventId:'conf-jp-iscev-2028', url:'https://n-practice.co.jp/jscev/meeting/latest.html', checkedOn:'2026-10-09',
    facts:{title:'第74回 日本臨床視覚電気生理学会（韓日合同学会）',edition:[74],year:2028,date:'2028-02-18',endDate:'2028-02-19',venue:'千里ライフサイエンスセンター（大阪）'},
    evidence:'今後開催の学術集会：2028年第74回（韓日合同）、2月18～19日、千里ライフサイエンスセンター。' },
  { eventId:'conf-jp-perimetry-2028', url:'https://square.umin.ac.jp/jips/meeting-seminar/meeting.html', checkedOn:'2026-10-09',
    facts:{title:'第17回日本視野画像学会学術集会',edition:[17],year:2028,date:'2028-03-11',endDate:'2028-03-12',venue:'東京慈恵会医科大学 講堂'},
    evidence:'次回以降の学術集会：2028年第17回、3月11～12日、東京慈恵会医科大学講堂。' },
  { eventId:'conf-jp-oncology-2027', url:'https://www.jsoo.jp/society', checkedOn:'2026-10-09',
    facts:{title:'第44回日本眼腫瘍学会',edition:[44],year:2027,date:'2027-09-18',endDate:'2027-09-19',venue:'富山国際会議場（富山市）'},
    evidence:'学会開催予定：2027年第44回、9月18～19日、富山国際会議場。' },
  { eventId:'conf-jp-ai-2027', url:'https://www.jsaio.jp/meeting/', checkedOn:'2026-10-09',
    facts:{title:'第3回日本眼科AI学会総会',edition:[3],year:2022,date:'2022-11-26',endDate:'2022-11-26',cityCountry:'京都 / 日本',venue:'京都ブライトンホテル'},
    evidence:'公式の過去総会一覧：第3回は2022年11月26日、京都、京都ブライトンホテル。2027年の開催回を確定したものではなく、現カードが指す開催回の選択が必要。' },
  { eventId:'conf-int-soe-2027', url:'https://soe2027.soevision.org/', checkedOn:'2026-10-09',
    facts:{title:'SOE 2027 Congress',year:2027,date:'2027-06-18',endDate:'2027-06-20',venue:'Megaron Athens International Conference Centre'},
    evidence:'ページ冒頭と会長挨拶：2027年6月18～20日、Athens。Location：Megaron Athens International Conference Centre。末尾のSOE2025／2023の写真紹介は当該回の開催年ではない。' },
  { eventId:'oph-010', url:'https://apacrs2026.org/', checkedOn:'2026-10-09',
    facts:{title:'38th APACRS – 55th RCOPT Joint Annual Meeting',edition:[38,55],year:2026,date:'2026-06-04',endDate:'2026-06-06',cityCountry:'Pattaya / Thailand',venue:'Pattaya Exhibition and Convention Hall (PEACH)'},
    evidence:'公式Welcome MessageとCONFERENCE VENUE：第38回APACRS・第55回RCOPT合同、2026年6月4～6日、Pattaya、PEACH。' }
];
module.exports.searchChecks = {
  'oph-002':{checkedOn:'2026-10-09',query:'"緑内障薬物治療Update" "2026"',outcome:'no-official-event-found'},
  'oph-005':{checkedOn:'2026-10-09',query:'"プレミアムIOL徹底攻略" "2026"',outcome:'no-official-event-found'},
  'oph-006':{checkedOn:'2026-10-09',query:'"第37回" "関西角膜" "2026"',outcome:'no-official-event-found'},
  'oph-007':{checkedOn:'2026-10-09',query:'"小児眼科スクリーニングと斜視弱視治療の実際"',outcome:'no-official-event-found'},
  'oph-009':{checkedOn:'2026-10-09',query:'"神経眼科ケースカンファレンス" "見落としてはならない"',outcome:'no-official-event-found'}
};
