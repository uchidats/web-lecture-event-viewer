# 全イベント公式整合性監査（2026-10-09）

対象は全94件（国内・海外学会85件と講演会・研究会・共催セミナー9件）。events.jsの変更、commit／pushは実施しない。監査は自動更新パイプラインと独立して実行した。

## 全体集計

| 分類 | 件数 |
| --- | ---: |
| verified | 0 |
| official-url-missing | 0 |
| metadata-mismatch | 22 |
| possible-wrong-edition | 12 |
| bot-protected-official-candidate | 2 |
| insufficient-evidence | 53 |
| not-found | 5 |

優先度：高14件、中19件、低61件。優先度は修正候補の影響度であり、低は正しさや安全性を保証する意味ではない。

verifiedはタイトル・回次・年・開始／終了日・開催地・会場・主催・テーマを照合できたものだけ。今回は未確認項目が残るためverified=0。全件が誤情報という意味ではない。締切・参加登録期間が取得できない場合も、その項目をunverifiedとして残す。URL欠落だけと確定できたものは0件で、別年度疑義のあるレコードへURLだけを付けない。

分類は排他的。開催年／回次の矛盾をpossible-wrong-editionとして最優先に分類し、確認できた他の差分はmetadata-mismatch、本文のBot保護は開催回候補URLがある場合だけbot-protectedにする。not-foundは今回公式開催情報を確認できない5件で、不存在の断定ではない。HTTP取得失敗だけをnot-foundとは扱わない。

## 高優先度（年・回次・日程・会場等）

| ID | 現在のカード | 判定 | 確認した差分 | 根拠 |
| --- | --- | --- | --- | --- |
| conf-jp-perimetry-2026 | 第38回 日本視野画像学会学術集会 | possible-wrong-edition | タイトル：第38回 日本視野画像学会学術集会 → 第15回日本視野画像学会学術集会<br>回次：[38] → [15]<br>会場：東京慈恵会医科大学 講堂 → 東京慈恵会医科大学 1号館 講堂<br>テーマ：視野検査と最先端画像診断のフロンティア → 「視覚のファントム -Phantoms in Vision-」<br>演題締切：未登録／未確認 → 2026-02-02<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","start":"2025-11-17","deadline":"2026-04-13"},{"label":"参加登録期間","start":"2026-04-14","deadline":"2026-05-17"}]}（抽出候補・要原文確認・反映対象外）<br>公式URL：未登録／未確認 → https://n-practice.co.jp/jips2026/（抽出候補・要原文確認・反映対象外） | [根拠1](https://n-practice.co.jp/jips2026/) [根拠2](https://n-practice.co.jp/jips2026/outline/index.html) [根拠3](https://n-practice.co.jp/jips2026/subject/index.html) [根拠4](https://n-practice.co.jp/jips2026/entry/index.html) |
| oph-010 | APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons) | metadata-mismatch | タイトル：APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons) → 38th APACRS – 55th RCOPT Joint Annual Meeting<br>回次：[] → [38,55]<br>開始日：2026-12-17 → 2026-06-04<br>終了日：2026-12-20 → 2026-06-06<br>開催地：シンガポール / シンガポール共和国 → Pattaya / Thailand<br>会場：Suntec Singapore Convention & Exhibition Centre → Pattaya Exhibition and Convention Hall (PEACH)<br>参加登録期間：未登録／未確認 → {"type":"international","periods":[{"label":"EARLY BIRD","deadline":"2026-03-29"},{"label":"EARLY BIRD","deadline":"2026-04-29"},{"label":"EARLY BIRD","deadline":"2026-04-30"},{"label":"late","start":"2026-04-29","deadline":"2026-04-29"},{"label":"Onsite","deadline":"2026-06-03"},{"label":"Onsite","deadline":"2026-06-06"},{"label":"Onsite","deadline":"2026-03-29"},{"label":"Early Bird","start":"2026-04-29","deadline":"2026-04-30"}]}（抽出候補・要原文確認・反映対象外）<br>公式URL：未登録／未確認 → https://apacrs2026.org/ | [根拠1](https://apacrs2026.org/) [根拠2](https://apacrs2026.org/registration/) |
| conf-jp-presbyopia-2027 | 第4回 日本老視学会学術総会 | possible-wrong-edition | タイトル：第4回 日本老視学会学術総会 → 日本老視学会 第4回学術総会（表記差）<br>開催年：2027 → 2026<br>開始日：2027-01-16 → 2026-01-17<br>終了日：2027-01-17 → 2026-01-18<br>会場：御茶ノ水ソラシティカンファレンスセンター → ​品川THE GRAND HALL<br>テーマ：老視矯正のサイエンスと臨床実践 → アンメットニーズはここにある<br>公式URL：未登録／未確認 → https://www.rousi.jp/jps4 | [根拠1](https://www.rousi.jp/jps4-summary) [根拠2](https://www.rousi.jp/jps4) |
| conf-jp-iscev-2027 | 第75回 日本臨床視覚電気生理学会 | possible-wrong-edition | タイトル：第75回 日本臨床視覚電気生理学会 → 第73回 日本臨床視覚電気生理学会<br>回次：[75] → [73]<br>公式URL：未登録／未確認 → https://www.congre.co.jp/73jscev/ | [根拠1](https://n-practice.co.jp/jscev/meeting/latest.html) [根拠2](https://www.congre.co.jp/73jscev/) |
| oph-014 | 第38回 日本緑内障学会 | metadata-mismatch | タイトル：第38回 日本緑内障学会 → 第38回日本緑内障学会（表記差）<br>開始日：2027-04-20 → 2027-04-23<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","start":"2026-10-06T12:00","deadline":"2027-03-15T12:00"},{"label":"参加登録期間","start":"2027-03-15T12:00","deadline":"2027-04-23"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://site2.convention.co.jp/jgs2027/) [根拠2](https://site2.convention.co.jp/jgs2027/info/) [根拠3](https://site2.convention.co.jp/jgs2027/resitration/) |
| conf-jp-perimetry-2027 | 第39回 日本視野画像学会学術集会 | possible-wrong-edition | タイトル：第39回 日本視野画像学会学術集会 → 第16回日本視野画像学会学術集会 - The 16th Annual Conference of the Japan Imaging and Perimetry Society<br>回次：[39] → [16]<br>テーマ：構造と機能の次世代イメージング解析 → Beyond Boundaries 伝統を礎に未来へ<br>公式URL：未登録／未確認 → https://www.ganki.jp/jips2027/ | [根拠1](https://www.ganki.jp/jips2027/) [根拠2](https://www.ganki.jp/jips2027/information.html) |
| conf-jp-myopia-2027 | 第8回 日本近視学会総会 | possible-wrong-edition | タイトル：第8回 日本近視学会総会 → 第9回日本近視学会総会 - The 9th Annual Meeting of Japan Myopia Society<br>回次：[8] → [9]<br>テーマ：近視パンデミックに対峙するエビデンスと実践 → Together for Lifelong Myopia Care<br>公式URL：未登録／未確認 → https://www.ganki.jp/myopia2027/ | [根拠1](https://www.ganki.jp/myopia2027/) [根拠2](https://www.ganki.jp/myopia2027/information.html) |
| conf-jp-oncology-2027 | 第14回 日本眼腫瘍学会 | possible-wrong-edition | タイトル：第14回 日本眼腫瘍学会 → 第44回日本眼腫瘍学会<br>回次：[14] → [44]<br>会場：富山国際会議場 → 富山国際会議場（富山市）（表記差） | [根拠1](https://www.jsoo.jp/society) |
| conf-jp-ai-2027 | 第3回 日本眼科AI学会総会 | possible-wrong-edition | タイトル：第3回 日本眼科AI学会総会 → 第3回日本眼科AI学会総会（表記差）<br>開催年：2027 → 2022<br>開始日：2027-11-26 → 2022-11-26<br>終了日：2027-11-26 → 2022-11-26<br>開催地：東京都 / 日本 → 京都 / 日本<br>会場：TKPガーデンシティ渋谷 → 京都ブライトンホテル | [根拠1](https://www.jsaio.jp/meeting/) |
| conf-jp-presbyopia-2028 | 第5回 日本老視学会学術総会 | possible-wrong-edition | タイトル：第5回 日本老視学会学術総会 → 日本老視学会 第5回学術総会（表記差）<br>開催年：2028 → 2027<br>開始日：2028-01-15 → 2027-01-16<br>終了日：2028-01-16 → 2027-01-17<br>開催地：京都市（京都府） / 日本 → 東京都 / 日本<br>会場：京都テルサ（京都府民総合交流プラザ） → 御茶ノ水ソラシティ カンファレンスセンター<br>テーマ：老視研究と最新治療テクノロジー → 老視克服への新たな冒険<br>公式URL：未登録／未確認 → https://www.rousi.jp/jps5 | [根拠1](https://www.rousi.jp/jps5-overview) [根拠2](https://www.rousi.jp/jps5) |
| conf-jp-iscev-2028 | 第76回 日本臨床視覚電気生理学会（韓日合同） | possible-wrong-edition | タイトル：第76回 日本臨床視覚電気生理学会（韓日合同） → 第74回 日本臨床視覚電気生理学会（韓日合同学会）<br>回次：[76] → [74]<br>会場：千里ライフサイエンスセンター → 千里ライフサイエンスセンター（大阪）（表記差） | [根拠1](https://n-practice.co.jp/jscev/meeting/latest.html) |
| conf-jp-perimetry-2028 | 第40回 日本視野画像学会学術集会 | possible-wrong-edition | タイトル：第40回 日本視野画像学会学術集会 → 第17回日本視野画像学会学術集会<br>回次：[40] → [17]<br>会場：東京慈恵会医科大学 → 東京慈恵会医科大学 講堂 | [根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) |
| conf-jp-myopia-2028 | 第9回 日本近視学会総会 | possible-wrong-edition | タイトル：第9回 日本近視学会総会 → 第10回日本近視学会総会<br>回次：[9] → [10]<br>会場：コングレコンベンションセンター（グランフロント大阪） → コングレコンベンションセンター（表記差） | [根拠1](https://www.ganki.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-inflammation-2028 | 第65回 日本眼感染症学会・第61回 日本眼炎症学会・第60回 日本眼科アレルギー学会・第47回 日本涙道・涙液学会総会 | possible-wrong-edition | タイトル：第65回 日本眼感染症学会・第61回 日本眼炎症学会・第60回 日本眼科アレルギー学会・第47回 日本涙道・涙液学会総会 → 第64回日本眼感染症学会・第61回日本眼炎症学会・第11回日本眼科アレルギー学会・第16回日本涙道・涙液学会総会<br>回次：[47,60,61,65] → [11,16,61,64] | [根拠1](https://www.ganki.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |

第4回老視学会：タイトルの語順は表記差。開催年2027→2026、会期2027/1/16–17→2026/1/17–18、会場は御茶ノ水→品川、テーマは「老視矯正のサイエンスと臨床実践」→「アンメットニーズはここにある」。日程・会場は2027年第5回に近く、現カードが第4回と第5回のどちらを指すか人間が確認する必要がある。

第3回眼科AI学会は公式の過去回記録（2022年・京都）との照合。2027年の正しい開催回・日程を年次加算で推測したものではない。緑内障2027の単独会期4/23とWGC合同会期4/20–23は対象範囲の違いなので、即座に誤情報と断定しない。

## 中優先度（タイトル・テーマ・登録期間等）

| ID | 現在のカード | 判定 | 確認した差分 | 根拠 |
| --- | --- | --- | --- | --- |
| conf-jp-eyelid-2026 | 第37回 日本眼瞼義眼床手術学会学術集会 | metadata-mismatch | タイトル：第37回 日本眼瞼義眼床手術学会学術集会 → 第37回日本眼瞼義眼床手術学会 | [根拠1](https://www.ggigan.com/) |
| oph-008 | 第13回 日本眼形成再建外科学会学術集会 (JSOPRS 2026) | metadata-mismatch | タイトル：第13回 日本眼形成再建外科学会学術集会 (JSOPRS 2026) → 第13回日本眼形成再建外科学会学術集会（表記差）<br>会場：高知県立県民文化ホール グリーンホール → 高知県民文化ホール(グリーンホールほか)（表記差）<br>テーマ：眼形成再建の技術革新とエビデンス → 「眼形成の未来」<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"事前参加登録","start":"2026-03-23T12:00","deadline":"2026-05-19"},{"label":"事前参加登録","start":"2026-05-20T12:00","deadline":"2026-06-20"},{"label":"事前参加登録","deadline":"2026-06-20"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://jsoprs2026.com/) [根拠2](https://jsoprs2026.com/overview.html) [根拠3](https://jsoprs2026.com/registration.html) |
| conf-jp-lowvision-2026 | 第27回 日本ロービジョン学会学術総会 | metadata-mismatch | タイトル：第27回 日本ロービジョン学会学術総会 → 第27回日本ロービジョン学会学術総会（表記差）<br>演題締切：未登録／未確認 → 2026-05-12<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"事前参加登録","start":"2026-03-17T12:00","deadline":"2026-07-31"},{"label":"参加登録期間","start":"2026-08-20T12:00","deadline":"2026-09-21"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://convention.jtbcom.co.jp/lowvision2026/) [根拠2](https://convention.jtbcom.co.jp/lowvision2026/summary/index.html) [根拠3](https://convention.jtbcom.co.jp/lowvision2026/abstract/index.html) [根拠4](https://convention.jtbcom.co.jp/lowvision2026/join/index.html) |
| conf-jp-glaucoma-2026 | 第37回 日本緑内障学会 | metadata-mismatch | タイトル：第37回 日本緑内障学会 → 第37回日本緑内障学会（表記差）<br>テーマ：緑内障診療の深耕と未来開拓 → テクノロジーとヒューマニティの融合による緑内障の克服<br>演題締切：未登録／未確認 → 2026-05-21 12:00<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","start":"2026-05-08T12:00","deadline":"2026-07-31"},{"label":"参加登録期間","start":"2026-08-07T12:00","deadline":"2026-11-16T16:00"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://www.congre.co.jp/jgs2026/) [根拠2](https://www.congre.co.jp/jgs2026/contents/outline.html) [根拠3](https://www.congre.co.jp/jgs2026/contents/cfa.html) [根拠4](https://www.congre.co.jp/jgs2026/contents/registration.html) |
| oph-001 | 第80回 日本臨床眼科学会 (臨眼 2026) | metadata-mismatch | タイトル：第80回 日本臨床眼科学会 (臨眼 2026) → 第80回日本臨床眼科学会（表記差）<br>テーマ：臨床眼科80年の軌跡と新次元への跳躍 → The long and winding road<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","deadline":"2026-10-01"},{"label":"事前参加登録","start":"2026-03-03","deadline":"2026-09-25"},{"label":"事前参加登録","deadline":"2026-11-01"},{"label":"当日登録","deadline":"2026-10-29"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://convention.jtbcom.co.jp/80ringan/index.html) [根拠2](https://convention.jtbcom.co.jp/80ringan/summary/index.html) [根拠3](https://convention.jtbcom.co.jp/80ringan/join/index.html) |
| conf-jp-pharmacology-2026 | 第46回 日本眼薬理学会 | metadata-mismatch | タイトル：第46回 日本眼薬理学会 → 第46回日本眼薬理学会(2026年11月7日(土)・8日(日) じゅうろくプラザ)<br>会場：じゅうろくプラザ（岐阜市文化産業交流センター） → じゅうろくプラザ(岐阜市文化産業交流センター)（表記差）<br>テーマ：眼科創薬の新展開とドラッグデリバリーシステム → 「多様な視点で拓く眼科創薬の未来」<br>演題締切：未登録／未確認 → 2026-07-26<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録受付期間","start":"2026-05-08","deadline":"2026-08-31"},{"label":"直前・当日登録","start":"2026-09-01","deadline":"2026-11-08"},{"label":"直前・当日登録","deadline":"2026-11-07"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://square.umin.ac.jp/jsop46/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://square.umin.ac.jp/jsop46/overview.html) [根拠4](https://square.umin.ac.jp/jsop46/abstracts.html) [根拠5](https://square.umin.ac.jp/jsop46/registration.html) |
| conf-jp-neuro-2026 | 第64回 日本神経眼科学会総会 | metadata-mismatch | タイトル：第64回 日本神経眼科学会総会 → 第64回日本神経眼科学会総会（表記差）<br>テーマ：視覚路・眼球運動障害の解剖と最先端臨床 → 多領域融合<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","deadline":"2026-11-27"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://n-practice.co.jp/64thJNOS/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://n-practice.co.jp/64thJNOS/outline/index.html) [根拠4](https://n-practice.co.jp/64thJNOS/entry/index.html) |
| conf-jp-jrvs-2026 | 第65回 日本網膜硝子体学会総会 | metadata-mismatch | タイトル：第65回 日本網膜硝子体学会総会 → 第65回日本網膜硝子体学会総会（表記差）<br>演題締切：未登録／未確認 → 2026-07-23 12:00<br>参加登録期間：{"type":"domestic","periods":[{"label":"事前参加登録","start":"2026-05-19T12:00","deadline":"2026-10-16"},{"label":"直前・当日登録","start":"2026-11-12T12:00","deadline":"2026-12-06"}]} → {"type":"domestic","periods":[{"label":"事前参加登録","start":"2026-05-19T12:00","deadline":"2026-10-16"},{"label":"直前・当日登録","start":"2026-11-12T12:00","deadline":"2026-12-06"},{"label":"直前・当日登録","start":"2026-10-21T12:00","deadline":"2026-10-27"},{"label":"事前参加登録","deadline":"2026-10-16"},{"label":"事前参加登録","deadline":"2026-05-19T12:00"},{"label":"直前・当日登録","deadline":"2026-12-07"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://convention.jtbcom.co.jp/65moumaku/index.html) [根拠2](https://convention.jtbcom.co.jp/65moumaku/summary/index.html) [根拠3](https://convention.jtbcom.co.jp/65moumaku/abstract/index.html) [根拠4](https://convention.jtbcom.co.jp/65moumaku/join/index.html) |
| conf-int-arc-2026 | Asia Retina Congress 2026 (ARC 2026) | metadata-mismatch | タイトル：Asia Retina Congress 2026 (ARC 2026) → The 6th Asia Retina Congress December 5(sat) 6(sun), 2026 Tokyo International Forum,Japan<br>回次：[] → [6] | [根拠1](https://convention.jtbcom.co.jp/arc2026/) |
| conf-jp-surgery-2027 | 第50回 日本眼科手術学会学術総会 | metadata-mismatch | テーマ：眼科手術の集大成と次世代への継承 → 原点回帰と未来への革新 | [根拠1](https://50.jsos.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-cornea-2027 | 角膜カンファランス2027 | metadata-mismatch | 演題締切：未登録／未確認 → 2026-11-04<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","start":"2026-12-01","deadline":"2027-01-14"},{"label":"参加登録期間","start":"2027-01-15","deadline":"2027-02-13"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://www.okinawa-congre.co.jp/cornea2027/) [根拠2](https://www.okinawa-congre.co.jp/cornea2027/outline/index.html) [根拠3](https://www.okinawa-congre.co.jp/cornea2027/cfa/index.html) [根拠4](https://www.okinawa-congre.co.jp/cornea2027/registration/index.html) |
| conf-jp-diabetic-2027 | 第33回 日本糖尿病眼学会総会 | metadata-mismatch | タイトル：第33回 日本糖尿病眼学会総会 → 第33回日本糖尿病眼学会総会（表記差）<br>演題締切：未登録／未確認 → 2026-11-11 12:00<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録受付期間","start":"2026-09-09T12:00","deadline":"2027-03-13"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://convention.jtbcom.co.jp/jsod33/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://convention.jtbcom.co.jp/jsod33/abstract/index.html) [根拠4](https://convention.jtbcom.co.jp/jsod33/join61/index.html) |
| conf-int-apao-2027 | APAO 2027 (42nd Asia-Pacific Academy of Ophthalmology Congress) | metadata-mismatch | タイトル：APAO 2027 (42nd Asia-Pacific Academy of Ophthalmology Congress) → APAO 2027 – The 42nd Asia-Pacific Academy of Ophthamology Congress（表記差）<br>参加登録期間：未登録／未確認 → {"type":"international","periods":[{"label":"Early Bird","deadline":"2026-02-12"},{"label":"on-site","deadline":"2026-11-30"},{"label":"on-site","deadline":"2026-12-01"},{"label":"on-site","deadline":"2027-02-15"},{"label":"on-site","deadline":"2027-02-16"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://2027.apaophth.org/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠3](https://2027.apaophth.org/registration/) |
| oph-011 | 第131回 日本眼科学会総会 | metadata-mismatch | タイトル：第131回 日本眼科学会総会 → 第131回日本眼科学会総会（表記差）<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"事前参加登録","start":"2026-10-01T12:00","deadline":"2027-02-12"},{"label":"事前参加登録","start":"2027-02-12","deadline":"2027-02-16T12:00"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://convention.jtbcom.co.jp/131jos/index.html) [根拠2](https://convention.jtbcom.co.jp/131jos/summary/index.html) [根拠3](https://convention.jtbcom.co.jp/131jos/join/index.html) |
| conf-int-wgc-2027 | World Glaucoma Congress 2027 (WGC 2027) | metadata-mismatch | タイトル：World Glaucoma Congress 2027 (WGC 2027) → 12th World Glaucoma Congress<br>回次：[] → [12] | [根拠1](https://worldglaucomacongress.org/) |
| conf-jp-jsoprs-2027 | 第14回 日本眼形成再建外科学会学術集会 (JSOPRS 2027) | metadata-mismatch | タイトル：第14回 日本眼形成再建外科学会学術集会 (JSOPRS 2027) → 第14回日本眼形成再建外科学会学術集会(2027年6月12日・13日/九州大学医学部 百年講堂)（表記差）<br>会場：九州大学医学部 百年講堂 → 九州大学医学部百年講堂（表記差）<br>演題締切：未登録／未確認 → 2027-02-19 | [根拠1](https://orbit-cs.net/jsoprs2027/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://orbit-cs.net/jsoprs2027/abstracts.html) |
| conf-jp-pediatric-2027 | 第83回 日本弱視斜視学会総会・第52回 日本小児眼科学会総会 | metadata-mismatch | タイトル：第83回 日本弱視斜視学会総会・第52回 日本小児眼科学会総会 → 第83回日本弱視斜視学会総会/第52回日本小児眼科学会総会（表記差）<br>テーマ：子どもの目の未来を守る：早期発見・最新治療・支援体制 → 灯をつなぐ<br>参加登録期間：未登録／未確認 → {"type":"domestic","periods":[{"label":"参加登録期間","start":"2026-07-27","deadline":"2027-01-04"},{"label":"参加登録期間","start":"2027-01-05","deadline":"2027-05-20"},{"label":"当日登録","start":"2027-05-21","deadline":"2027-06-19"}]}（抽出候補・要原文確認・反映対象外） | [根拠1](https://jasa-japo2027.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://jasa-japo2027.jp/gaiyo.html) [根拠4](https://jasa-japo2027.jp/sanka.html) |
| conf-jp-cl-2027 | 第69回 日本コンタクトレンズ学会総会 | metadata-mismatch | タイトル：第69回 日本コンタクトレンズ学会総会 → 第69回日本コンタクトレンズ学会総会（表記差）<br>会場：東京建物 ぴあ シアター＆カンファレンス → 東京建物 ぴあ シアター&カンファレンス（表記差）<br>テーマ：安心安全なコンタクトレンズ診療と新機能レンズの展望 → Progress and Harmony for Vision | [根拠1](https://www.congre.co.jp/jcls2027/) [根拠2](https://www.congre.co.jp/jcls2027/outline/index.html) |
| conf-jp-optics-2027 | 第63回 日本眼光学学会総会 | metadata-mismatch | タイトル：第63回 日本眼光学学会総会 → 第63回日本眼光学学会総会（表記差）<br>テーマ：光学と視覚科学の交差点 → Informed vision, bright future | [根拠1](https://www.jsoo-ws.com/63overview) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠3](https://www.jsoo-ws.com/63jsoo) |

現在値が空欄で公式期間を確認できたものは補完候補。期限が誤っていると断定するものではない。旧earlyBirdDeadlineの「締切済」は期間未登録とは分けてレビュー画面に表示する。表記差は差分として残すが誤情報と断定しない。

参加登録期間は延長前後・登録種別・関連企画が混在する可能性のある抽出候補で、信頼度0.8以下として反映対象から除外した。公式原表で再確認が必要。大学教室や開催事務局の記載も主催学会と同義ではないため、主催欄は未確認として扱った。

## URL欠落のみ

該当なし。

主要情報の未確認や他の差分があるURL欠落イベントは、この一覧に含めない。

## 取得不能・要人手確認

| ID | 現在のカード | 判定 | 確認した差分 | 根拠 |
| --- | --- | --- | --- | --- |
| conf-jp-surgery-2026 | 第49回 日本眼科手術学会学術総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.jsos.jp/jsos49) [参照2](https://jsos.jp/) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-cornea-2026 | 角膜カンファランス2026（第50回日本角膜学会総会／第42回日本角膜移植学会） | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.congre.co.jp/cornea2026/) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-jos-2026 | 第130回 日本眼科学会総会 | insufficient-evidence | タイトル：第130回 日本眼科学会総会 → 第130回日本眼科学会総会（表記差） | [根拠1](https://www.congre.co.jp/130jos/index.html) |
| oph-008-s1 | 【JSOPRS 2026】共催セミナー1：眼瞼痙攣に対するボツリヌス療法と手術療法のハイブリッド戦略 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://jsoprs2026.com/) |
| conf-int-euretina-2026 | EURETINA 2026 (26th EURETINA Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://euretina.org/vienna-2026/) [参照2](https://euretina.org/) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| oph-004 | AAO 2026 Annual Meeting (American Academy of Ophthalmology) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://aao.org/annual-meeting) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| oph-002 | 緑内障薬物治療Update 〜配合点眼薬とSLTのポジショニング〜 | not-found | 確定した差分なし（未確認項目を参照） | 公式情報未確認 |
| oph-003 | 第35回 日本小児眼科学会・日本弱視斜視学会 合同学会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.jasa-web.jp/event/programs) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| oph-001-s1 | 【臨眼2026】ランチョンセミナー12：難治性黄斑疾患に対する抗VEGF治療の新展開 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://convention.jtbcom.co.jp/80ringan/index.html) |
| oph-001-s2 | 【臨眼2026】モーニングセミナー3：緑内障手術ナビゲーション 〜低侵襲緑内障手術(MIGS)の極意〜 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://convention.jtbcom.co.jp/80ringan/index.html) |
| oph-001-s3 | 【臨眼2026】イブニングセミナー5：極小切開白内障手術と最新IOL固定手技 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://convention.jtbcom.co.jp/80ringan/index.html) |
| oph-005 | プレミアムIOL徹底攻略：老視矯正と乱視軸合わせの極意 | not-found | 確定した差分なし（未確認項目を参照） | 公式情報未確認 |
| oph-006 | 第37回 関西角膜・ドライアイ臨床研究会 | not-found | 確定した差分なし（未確認項目を参照） | 公式情報未確認 |
| oph-007 | 小児眼科スクリーニングと斜視弱視治療の実際 | not-found | 確定した差分なし（未確認項目を参照） | 公式情報未確認 |
| oph-009 | 神経眼科ケースカンファレンス：見落としてはならない視神経疾患 | not-found | 確定した差分なし（未確認項目を参照） | 公式情報未確認 |
| conf-int-fujiretina-2027 | FujiRetina 2027 | insufficient-evidence | タイトル：FujiRetina 2027 → FUJI RETINA DATE:March 26(Fri.) – 28(Sun.), 2027 VENUE:Toranomon Hills Forum, Tokyo, Japan（表記差） | [根拠1](https://convention.jtbcom.co.jp/fujiretina/index.html) |
| conf-int-ascrs-2027 | ASCRS 2027 Annual Meeting | bot-protected-official-candidate | 公式URL：未登録／未確認 → https://annualmeeting.ascrs.org/（抽出候補・要原文確認・反映対象外） | [根拠1](https://annualmeeting.ascrs.org/) |
| oph-012 | ARVO 2027 Annual Meeting | bot-protected-official-candidate | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.arvo.org/annual-meeting) |
| conf-jp-lowvision-2027 | 第28回 日本ロービジョン学会学術総会 | insufficient-evidence | タイトル：第28回 日本ロービジョン学会学術総会 → 第28回日本ロービジョン学会学術総会（表記差）<br>会場：大阪国際会議場（グランキューブ大阪） → 大阪国際会議場（表記差） | [根拠1](https://www.ganki.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-apacrs-2027 | APACRS 2027 Annual Meeting | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://apacrs2027.org/) [参照2](https://apacrs.org/) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-soe-2027 | SOE 2027 (European Society of Ophthalmology Congress) | insufficient-evidence | タイトル：SOE 2027 (European Society of Ophthalmology Congress) → SOE 2027 Congress（表記差） | [根拠1](https://soe2027.soevision.org/) |
| oph-013 | 第42回 JSCRS学術総会 (日本白内障屈折矯正手術学会) | insufficient-evidence | タイトル：第42回 JSCRS学術総会 (日本白内障屈折矯正手術学会) → 第42回JSCRS学術総会  未来編おステップ  見つめよう、その先の未来を。  会期：2027年6月25日（金）～27日（日）  会場：神戸国際会議場  会長：神谷　和孝（昭和医科大学）（表記差） | [根拠1](https://www.kwcs.jp/42jscrs/) |
| conf-int-iois-2027 | IOIS 2027 (International Ocular Inflammation Society Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.iois.info/page.php?edi_id=1697) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-inflammation-2027 | 第60回 日本眼炎症学会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-circulation-2027 | 第43回 日本眼循環学会 | insufficient-evidence | タイトル：第43回 日本眼循環学会 → 第43回日本眼循環学会（表記差） | [根拠1](https://convention.jtbcom.co.jp/43jsoc/) [根拠2](https://convention.jtbcom.co.jp/43jsoc/summary/index.html) |
| conf-jp-cataract-2027 | 第66回 日本白内障学会総会・第53回 水晶体研究会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-pharmacology-2027 | 第47回 日本眼薬理学会 | insufficient-evidence | 会場：ホテル プラム（横浜市） → ホテル プラム（表記差） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-euretina-2027 | EURETINA 2027 (27th EURETINA Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://euretina.org/copenhagen-27/) [参照2](https://euretina.org/) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-escrs-2027 | ESCRS 2027 (45th Congress of the ESCRS) | insufficient-evidence | タイトル：ESCRS 2027 (45th Congress of the ESCRS) → ESCRS - 45th Congress of the ESCRS（表記差） | [根拠1](https://www.escrs.org/escrs-annual-events/45th-congress-of-the-escrs) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-ringan-2027 | 第81回 日本臨床眼科学会 (臨眼 2027) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-aao-2027 | AAO 2027 Annual Meeting | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.aao.org/annual-meeting/past-and-future-meetings) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-neuro-2027 | 第65回 日本神経眼科学会総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-asnos-2027 | ASNOS 2027 (Asian Neuro-ophthalmology Society Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://asnos.org/future-meetings/) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-jrvs-2027 | 第66回 日本網膜硝子体学会総会 | insufficient-evidence | タイトル：第66回 日本網膜硝子体学会総会 → 第66回日本網膜硝子体学会総会（表記差）<br>会場：大阪国際会議場（グランキューブ大阪） → 大阪国際会議場（表記差） | [根拠1](https://www.jrvs.jp/meeting.html) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-surgery-2028 | 第51回 日本眼科手術学会学術総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-cornea-2028 | 角膜カンファランス2028 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://cornea.gr.jp/conference/future/) [参照2](https://cornea.gr.jp/conference/info/) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-eyelid-2028 | 第39回 日本眼瞼義眼床手術学会学術集会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.nichigan.or.jp/member/syukai/hyoji_other.html) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-diabetic-2028 | 第34回 日本糖尿病眼学会総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-ips-2028 | IPS 2028 (26th International Perimetric Society Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) [参照2](https://square.umin.ac.jp/jips/index.html) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-apao-2028 | APAO 2028 (43rd Asia-Pacific Academy of Ophthalmology Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-fujiretina-2028 | FujiRetina 2028 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.jrvs.jp/meeting.html) [参照2](https://www.jrvs.jp/fuji.html) [参照3](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-jos-2028 | 第132回 日本眼科学会総会 | insufficient-evidence | 会場：大阪府立国際会議場（グランキューブ大阪）、リーガロイヤルホテル大阪 → 大阪府立国際会議場、リーガロイヤルホテル大阪（表記差） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-ascrs-2028 | ASCRS 2028 Annual Meeting | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-arvo-2028 | ARVO 2028 Annual Meeting | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [参照2](https://www.arvo.org/annual-meeting/about/future-meetings) [参照3](https://www.arvo.org/) |
| conf-jp-lowvision-2028 | 第29回 日本ロービジョン学会学術総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-pediatric-2028 | 第84回 日本弱視斜視学会総会・第53回 日本小児眼科学会総会 | insufficient-evidence | 会場：朱鷺メッセ（新潟コンベンションセンター） → 朱鷺メッセ（表記差） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-jsoprs-2028 | 第15回 日本眼形成再建外科学会学術集会 (JSOPRS 2028) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-optics-2028 | 第64回 日本眼光学学会総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-jscrs-2028 | 第43回 JSCRS学術総会 (日本白内障屈折矯正手術学会) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.jscrs.org/index/page/id/28) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-cl-2028 | 第70回 日本コンタクトレンズ学会総会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-cataract-2028 | 第67回 日本白内障学会総会・第54回 水晶体研究会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-oncology-2028 | 第15回 日本眼腫瘍学会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-ringan-2028 | 第82回 日本臨床眼科学会 (臨眼 2028) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-escrs-2028 | ESCRS 2028 (46th Congress of the ESCRS) | insufficient-evidence | タイトル：ESCRS 2028 (46th Congress of the ESCRS) → ESCRS - 46th Congress of the ESCRS（表記差） | [根拠1](https://www.escrs.org/escrs-annual-events/46th-congress-of-the-escrs) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-aao-2028 | AAO 2028 Annual Meeting | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [参照1](https://www.aao.org/annual-meeting/past-and-future-meetings) [参照2](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-apvrs-2028 | APVRS 2028 (18th Asia-Pacific Vitreo-retina Society Congress) | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-woc-2028 | WOC 2028 (World Ophthalmology Congress) | insufficient-evidence | タイトル：WOC 2028 (World Ophthalmology Congress) → ICO WOC2028（表記差）<br>公式URL：未登録／未確認 → https://icoph.org/world-ophthalmology-congress/ | [根拠1](https://icoph.org/world-ophthalmology-congress/) |
| conf-jp-pharmacology-2028 | 第48回 日本眼薬理学会 | insufficient-evidence | 確定した差分なし（未確認項目を参照） | [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-neuro-2028 | 第66回 日本神経眼科学会総会 | insufficient-evidence | タイトル：第66回 日本神経眼科学会総会 → 第66回日本神経眼科学会総会（表記差） | [根拠1](https://www.ganki.jp/) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-jrvs-2028 | 第67回 日本網膜硝子体学会総会・第44回 日本眼循環学会 | insufficient-evidence | タイトル：第67回 日本網膜硝子体学会総会・第44回 日本眼循環学会 → 第67回日本網膜硝子体学会総会(合同開催:第44日本眼循環学会)（表記差） | [根拠1](https://www.jrvs.jp/meeting.html) [根拠2](https://www.nichigan.or.jp/member/syukai/hyoji.html) |

not-foundの5件はexample.comの仮URLのみで、名称の検索でも対応する公式開催情報を確認できなかった。検索結果から開催情報を確定したものではない。共催セミナー4件は親学会ページだけでは個別プログラムの一致を確認できないためinsufficient-evidence。将来回の未公開サイトや画像のみの記載は、PDF／公式プログラムを含めて人手確認が必要。

## 全94件と項目ごとの確認範囲

| ID | 判定 | 優先度 | 未確認項目 |
| --- | --- | --- | --- |
| conf-jp-surgery-2026 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-eyelid-2026 | metadata-mismatch | 中 | 開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-cornea-2026 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jos-2026 | insufficient-evidence | 低 | 開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-perimetry-2026 | possible-wrong-edition | 高 | 開催年、開始日、終了日、開催地、主催学会 |
| oph-008 | metadata-mismatch | 中 | 開催地、主催学会、演題締切 |
| oph-008-s1 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-lowvision-2026 | metadata-mismatch | 中 | 開催地、主催学会、テーマ |
| conf-int-euretina-2026 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-glaucoma-2026 | metadata-mismatch | 中 | 開催地、主催学会 |
| oph-004 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-002 | not-found | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-001 | metadata-mismatch | 中 | 開催地、主催学会、演題締切 |
| oph-003 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-001-s1 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-001-s2 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-001-s3 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-pharmacology-2026 | metadata-mismatch | 中 | 開催地、主催学会 |
| oph-005 | not-found | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-006 | not-found | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-007 | not-found | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-neuro-2026 | metadata-mismatch | 中 | 開催地、主催学会、演題締切 |
| conf-jp-jrvs-2026 | metadata-mismatch | 中 | 開催地、主催学会、テーマ |
| conf-int-arc-2026 | metadata-mismatch | 中 | 開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| oph-009 | not-found | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-010 | metadata-mismatch | 高 | 主催学会、テーマ、演題締切 |
| conf-jp-presbyopia-2027 | possible-wrong-edition | 高 | 開催地、主催学会、演題締切、参加登録期間 |
| conf-jp-surgery-2027 | metadata-mismatch | 中 | 開催地、演題締切、参加登録期間 |
| conf-jp-cornea-2027 | metadata-mismatch | 中 | 回次、開催地、主催学会、テーマ |
| conf-jp-eyelid-2027 | metadata-mismatch | 低 | タイトル、回次、開催年、開始日、終了日、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-diabetic-2027 | metadata-mismatch | 中 | 開催地、主催学会、テーマ |
| conf-jp-iscev-2027 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間 |
| conf-int-apao-2027 | metadata-mismatch | 中 | 開催地、会場、主催学会、テーマ、演題締切 |
| conf-int-fujiretina-2027 | insufficient-evidence | 低 | 回次、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-int-ascrs-2027 | bot-protected-official-candidate | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| oph-011 | metadata-mismatch | 中 | 開催地、主催学会、演題締切 |
| oph-014 | metadata-mismatch | 高 | 開催地、主催学会、テーマ、演題締切 |
| conf-int-wgc-2027 | metadata-mismatch | 中 | 開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| oph-012 | bot-protected-official-candidate | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-lowvision-2027 | insufficient-evidence | 低 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-apacrs-2027 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-perimetry-2027 | possible-wrong-edition | 高 | 開催地、演題締切、参加登録期間 |
| conf-jp-jsoprs-2027 | metadata-mismatch | 中 | 開催地、主催学会、テーマ、参加登録期間 |
| conf-jp-pediatric-2027 | metadata-mismatch | 中 | 開催地、主催学会、演題締切 |
| conf-int-soe-2027 | insufficient-evidence | 低 | 回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| oph-013 | insufficient-evidence | 低 | 開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-myopia-2027 | possible-wrong-edition | 高 | 開催地、主催学会、演題締切、参加登録期間 |
| conf-int-iois-2027 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-inflammation-2027 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-circulation-2027 | insufficient-evidence | 低 | 開催地、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-cl-2027 | metadata-mismatch | 中 | 開催地、主催学会、演題締切、参加登録期間 |
| conf-jp-optics-2027 | metadata-mismatch | 中 | 開催地、演題締切、参加登録期間 |
| conf-jp-cataract-2027 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-pharmacology-2027 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-euretina-2027 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-oncology-2027 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-escrs-2027 | insufficient-evidence | 低 | 開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-ringan-2027 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-aao-2027 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-neuro-2027 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-asnos-2027 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-ai-2027 | possible-wrong-edition | 高 | 主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jrvs-2027 | insufficient-evidence | 低 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-presbyopia-2028 | possible-wrong-edition | 高 | 主催学会、演題締切、参加登録期間 |
| conf-jp-surgery-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-cornea-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-eyelid-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-iscev-2028 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-diabetic-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-ips-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-perimetry-2028 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-apao-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-fujiretina-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jos-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-ascrs-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-arvo-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-myopia-2028 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-lowvision-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-pediatric-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jsoprs-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-optics-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jscrs-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-inflammation-2028 | possible-wrong-edition | 高 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-cl-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-cataract-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-oncology-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-ringan-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-escrs-2028 | insufficient-evidence | 低 | 開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-int-aao-2028 | insufficient-evidence | 低 | タイトル、回次、開催年、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-apvrs-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、会場、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-int-woc-2028 | insufficient-evidence | 低 | 回次、開始日、終了日、開催地、会場、主催学会、テーマ、演題締切、参加登録期間 |
| conf-jp-pharmacology-2028 | insufficient-evidence | 低 | タイトル、回次、開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-neuro-2028 | insufficient-evidence | 低 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |
| conf-jp-jrvs-2028 | insufficient-evidence | 低 | 開催地、主催学会、テーマ、演題締切、参加登録期間、公式URL |

各イベント12項目の現在値・公式値・差分・出典・confidence・HTTP取得記録は [監査JSON](../reports/event-metadata-audit-2026-10-09.json) に保存。公式ページ本文からの抽出と、metadata-audit-observations.jsに記録した2026-10-09の一次情報閲覧観察を併用。取得済み本文にある共通メニュー／過去写真／別年度リンクは当該開催回として採用しない。将来再監査するときは観察記録も再確認する。

## 管理レビューと人間承認

全94件をreports/auto-update-review.jsonにofficial-metadata-auditとして追加。過去の抽出途中の判定はsupersededで履歴を保持し、現行の監査は各イベント1項目。既存の自動更新レビューは残す。レビュー画面には現在値／公式値／差分／根拠URL／confidence／理由／未確認項目を表示し、スマホでは比較表を横スクロールできる。

差分のある項目はeventMetadataのまとめ承認。特に年・回次の疑義がある場合は対象開催回を先に選ぶ。低信頼のURL候補は変更セットに入れない。未確認だけの項目は「採用」を無効にする。自動承認候補のチェックボックスも監査項目には出さない。

人間が「採用」→「承認した監査修正を出力」後、管理者が明示的に以下を実行する。通常の自動更新・定期実行から呼ばない。

```sh
node scripts/apply-reviewed-event-metadata.js --decisions <承認JSON>
node scripts/apply-reviewed-event-metadata.js --decisions <承認JSON> --apply
```

未承認・署名不一致・監査後のデータ変更は拒否する。承認はブラウザ内の判断と管理者が扱うJSONであり、電子署名ではない。反映はバックアップ付きで、IDと利用者の参加履歴等の参照を維持する。日付変更時は表示用periodを同期し、物理会場変更時は旧venueId／timeZoneの紐づけを解除する。新しいタイムゾーンは推測せず、カレンダー登録の再確認が必要。

現在の移行テストには過去監査スナップショットとの一致を検証するものがある。将来、人間承認で実データを修正した後は、その承認記録に合わせて該当テストの期待値も確認する。今回はevents.jsを変更していない。

## 再実行・テスト

node scripts/audit-event-metadata.js：全件取得・監査・レビュー出力のみ。
node scripts/render-metadata-audit.js：監査JSONから本一覧を再生成。
node scratch/test_metadata_audit.js：第4回の7差分、表記差の区別、94件の網羅、登録ページの会場混入防止、未承認の反映拒否、承認後だけ隔離コピーを更新、ID維持を検証。
