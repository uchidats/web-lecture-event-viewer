# 高優先度14件の修正結果

監査当時のJSON／Markdownは履歴として維持。13件修正、眼科AI2027の1件保留。対象外80件は完全一致。ID・順序・総数94件を維持。自動更新・管理レビュー・保存キー・認証・Calendar・dual-path公開処理は変更なし。

未確認テーマを新しく推定しない。APACRSは公式会期より後の演題締切・登録締切、Singapore仮URL／PDF、根拠のない時刻・テーマを未確認／空欄へ戻した。旧Singapore会場マスターも解除し、会場表示とCalendarの場所が旧会場に戻らないようにした。登録期間の新規補完はなし。

眼科AI2027：第3回は公式記録では2022年。2027年の開催案内がないため、2022年へ変更することも第8回と推測することもしない。未確認として公開一覧から一時除外する案を推奨するが、今回は表示ロジックや保存IDを変えず保留した。

緑内障2027：独立した国内学会カードは4/23のみ。WGCの4/20–23カードは対象外のため維持。

専用URL未確認の2028年JSCEV・JIPS・近視・合同学会には、学会一覧URLをeventOfficialUrlとして登録しない。

今回確認しなかったテーマ・参加登録・演題締切は、正しいと判定したものではない。監査時点のレビューと根拠は履歴として維持しており、修正済みデータに対する再監査は今回実行しない。保存ID中の旧年は参加予定・履歴の継続のため変更せず、年フィルタ・カード表示にはdateの修正年を用いる。

## テスト結果

- events.js構文チェック：成功。
- 既存回帰チェック32項目：全成功。公式会期修正により終了済み学会9件、専用URL44件、会場マスター紐付け10件となる期待値を更新。
- 対象範囲テスト：13件のみ修正、保留AIを含む81件が監査時点と完全一致。94件のID・順序を保持。
- 監査・人間承認テスト：成功。修正前の老視データを独立した履歴fixtureとして維持。
- Edge：1280／390／320px × ルート／ophthalconfの6条件で、13カードのタイトル・会期・会場・タイトルリンクを確認。カードの横はみ出しなし。
- dual-pathの資産一致、レビューJSON、保存状態継続：成功。認証・Google APIはブラウザ試験内のモックで検証し、実サービス設定は変更していない。
- commit／push／公開環境への反映：未実施。

## conf-jp-perimetry-2026 — 第15回日本視野画像学会学術集会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第38回 日本視野画像学会学術集会" | "第15回日本視野画像学会学術集会" |
| subtitle | "視野検査と最先端画像診断のフロンティア" | "視覚のファントム -Phantoms in Vision-" |
| venue | "東京慈恵会医科大学 講堂" | "東京慈恵会医科大学 1号館 講堂" |
| eventOfficialUrl | null | "https://n-practice.co.jp/jips2026/" |

[根拠1](https://n-practice.co.jp/jips2026/outline/index.html) [根拠2](https://n-practice.co.jp/jips2026/) [根拠3](https://n-practice.co.jp/jips2026/subject/index.html)

## oph-010 — 38th APACRS – 55th RCOPT Joint Annual Meeting

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons)" | "38th APACRS – 55th RCOPT Joint Annual Meeting" |
| subtitle | "Precision and Artistry in Anterior Segment Surgery" | "未確認" |
| date | "2026-12-17" | "2026-06-04" |
| endDate | "2026-12-20" | "2026-06-06" |
| time | "08:30 - 18:00 (現地時間)" | "全日程" |
| venue | "Suntec Singapore Convention & Exhibition Centre" | "Pattaya Exhibition and Convention Hall (PEACH)" |
| venueId | "suntec-singapore" | null |
| abstractSubmission | {"status":"closed","startDate":"2026-06-01","deadline":"2026-08-10 23:59","url":"https://example.com/apacrs2026/abstracts"} | {"status":"unknown","startDate":null,"deadline":null,"url":null} |
| officialUrl | "https://example.com/apacrs2026-singapore" | "" |
| pdfUrl | "apacrs2026_singapore.pdf" | "" |
| period | "2026年12月17日(木) 〜 12月20日(日)" | "2026年6月4日(木) 〜 2026年6月6日(土)" |
| cityCountry | "シンガポール / シンガポール共和国" | "Pattaya / Thailand" |
| abstractDeadline | "2026年8月10日(月) 締切済" | "未確認" |
| earlyBirdDeadline | "2026年10月31日(土) まで受付中" | "未確認" |
| eventOfficialUrl | null | "https://apacrs2026.org/" |

[根拠1](https://apacrs2026.org/)

## conf-jp-presbyopia-2027 — 日本老視学会 第4回学術総会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第4回 日本老視学会学術総会" | "日本老視学会 第4回学術総会" |
| subtitle | "老視矯正のサイエンスと臨床実践" | "アンメットニーズはここにある" |
| date | "2027-01-16" | "2026-01-17" |
| endDate | "2027-01-17" | "2026-01-18" |
| venue | "御茶ノ水ソラシティカンファレンスセンター" | "品川THE GRAND HALL" |
| period | "2027年1月16日(土) 〜 1月17日(日)" | "2026年1月17日(土) 〜 2026年1月18日(日)" |
| eventOfficialUrl | null | "https://www.rousi.jp/jps4" |

[根拠1](https://www.rousi.jp/jps4-summary) [根拠2](https://www.rousi.jp/jps4)

## conf-jp-iscev-2027 — 第73回 日本臨床視覚電気生理学会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第75回 日本臨床視覚電気生理学会" | "第73回 日本臨床視覚電気生理学会" |
| eventOfficialUrl | null | "https://www.congre.co.jp/73jscev/" |

[根拠1](https://n-practice.co.jp/jscev/meeting/latest.html) [根拠2](https://www.congre.co.jp/73jscev/)

## oph-014 — 第38回 日本緑内障学会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| date | "2027-04-20" | "2027-04-23" |
| period | "2027年4月20日(火) 〜 4月23日(金)" | "2027年4月23日(金)" |

[根拠1](https://site2.convention.co.jp/jgs2027/info/) [根拠2](https://site2.convention.co.jp/jgs2027/)

## conf-jp-perimetry-2027 — 第16回日本視野画像学会学術集会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第39回 日本視野画像学会学術集会" | "第16回日本視野画像学会学術集会" |
| subtitle | "構造と機能の次世代イメージング解析" | "Beyond Boundaries 伝統を礎に未来へ" |
| eventOfficialUrl | null | "https://www.ganki.jp/jips2027/" |

[根拠1](https://www.ganki.jp/jips2027/) [根拠2](https://www.ganki.jp/jips2027/information.html)

## conf-jp-myopia-2027 — 第9回 日本近視学会総会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第8回 日本近視学会総会" | "第9回 日本近視学会総会" |
| subtitle | "近視パンデミックに対峙するエビデンスと実践" | "Together for Lifelong Myopia Care" |
| eventOfficialUrl | null | "https://www.ganki.jp/myopia2027/" |

[根拠1](https://www.ganki.jp/myopia2027/) [根拠2](https://www.ganki.jp/myopia2027/information.html)

## conf-jp-oncology-2027 — 第44回日本眼腫瘍学会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第14回 日本眼腫瘍学会" | "第44回日本眼腫瘍学会" |
| eventOfficialUrl | null | "https://www.ganki.jp/jsoo2027/" |

[根拠1](https://www.ganki.jp/jsoo2027/information.html) [根拠2](https://www.jsoo.jp/society)

## conf-jp-ai-2027 — 第3回 日本眼科AI学会総会

2027年の公式開催情報を確認できない。2022年の過去回へ置き換えず、未確認として非表示にする案を提示。現段階では保存ID・表示ロジックを変更しない。

[根拠1](https://www.jsaio.jp/meeting/)

## conf-jp-presbyopia-2028 — 日本老視学会 第5回学術総会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第5回 日本老視学会学術総会" | "日本老視学会 第5回学術総会" |
| subtitle | "老視研究と最新治療テクノロジー" | "老視克服への新たな冒険" |
| date | "2028-01-15" | "2027-01-16" |
| endDate | "2028-01-16" | "2027-01-17" |
| region | "関西" | "関東" |
| venue | "京都テルサ（京都府民総合交流プラザ）" | "御茶ノ水ソラシティ カンファレンスセンター" |
| period | "2028年1月15日(土) 〜 1月16日(日)" | "2027年1月16日(土) 〜 2027年1月17日(日)" |
| cityCountry | "京都市（京都府） / 日本" | "東京都 / 日本" |
| eventOfficialUrl | null | "https://www.rousi.jp/jps5" |

[根拠1](https://www.rousi.jp/jps5-overview) [根拠2](https://www.rousi.jp/jps5)

## conf-jp-iscev-2028 — 第74回 日本臨床視覚電気生理学会（韓日合同学会）

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第76回 日本臨床視覚電気生理学会（韓日合同）" | "第74回 日本臨床視覚電気生理学会（韓日合同学会）" |

[根拠1](https://n-practice.co.jp/jscev/meeting/latest.html)

## conf-jp-perimetry-2028 — 第17回日本視野画像学会学術集会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第40回 日本視野画像学会学術集会" | "第17回日本視野画像学会学術集会" |
| venue | "東京慈恵会医科大学" | "東京慈恵会医科大学 講堂" |

[根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html)

## conf-jp-myopia-2028 — 第10回日本近視学会総会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第9回 日本近視学会総会" | "第10回日本近視学会総会" |

[根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.ganki.jp/)

## conf-jp-inflammation-2028 — 第64回日本眼感染症学会・第61回日本眼炎症学会・第11回日本眼科アレルギー学会・第16回日本涙道・涙液学会総会

| 項目 | 修正前 | 修正後 |
| --- | --- | --- |
| title | "第65回 日本眼感染症学会・第61回 日本眼炎症学会・第60回 日本眼科アレルギー学会・第47回 日本涙道・涙液学会総会" | "第64回日本眼感染症学会・第61回日本眼炎症学会・第11回日本眼科アレルギー学会・第16回日本涙道・涙液学会総会" |

[根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.ganki.jp/)
