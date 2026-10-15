# 参加登録・演題募集の重要ページ取得

Gemini Monitorと旧Auto Updaterは `important-followup.js` を共用する。公式トップから同一origin・同一大会ディレクトリ内のリンクを1階層だけ辿る。

- 参加登録: 最大2ページ。既存の `registration.version=2 / periods[]`、公式ラベル、category、advanceEligible、sourceUrlを維持する。
- 演題募集: 最大2ページ。演題募集／抄録募集／演題登録／Abstract(s)／Call for Abstractsのリンクを対象とする。
- 合計: 最大4ページ追加。URLの重複はfetchを共用する。子ページから別リンクへは進まない。外部ドメインと別大会パスは除外し、リダイレクト・timeout・応答サイズの制限は既存fetcherを使う。

演題は子ページのtitleで同じ大会名・回次を確認し、ラベル付き募集期間から明示された開始日・締切日時を抽出する。公式に正午とあれば12:00を保存し、指定のない終了時刻は補わない。既存abstractSubmissionのstartDate、deadline、url、timeZoneとstatusを利用し、独立したデータ構造は追加しない。

期間の一部が不明、年の省略、日付不正、開始終了の逆転、複数の矛盾した期間、異なる大会、タイムゾーン不明はreviewへ回す。Geminiの単一締切提案で、その曖昧さを上書きしない。演題側の失敗で安全な参加登録補完を止めず、逆も同様とする。未確認を表すnullのreview候補は、保存済み演題情報を消す命令として適用しない。

子ページの本文・日時をhashに含めるため、トップページが未変更でも演題締切だけの変更を検知できる。従来のGemini公式ソース・同一大会・confidence判定、Auto Updaterの既存締切変更review、rollbackと保存前検証を維持する。

## 第33回 日本糖尿病眼学会総会

2026年10月15日に公式トップから両ページへのリンクと内容を確認した。

- 参加登録: https://convention.jtbcom.co.jp/jsod33/join/index.html
- 演題募集: https://convention.jtbcom.co.jp/jsod33/abstract/index.html
- 募集開始: 2026年9月9日
- 締切: 2026年11月11日 正午（Asia/Tokyo）
- 通常カード: 事前参加登録「2月2日 締切」、演題募集「受付中」「11月11日 12:00 締切」。専用リンク先は公式演題ページ。

今回はこの1件の未確認情報だけを補完し、他イベントへの一括移行は行わない。
