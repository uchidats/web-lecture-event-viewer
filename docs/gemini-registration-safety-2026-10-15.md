# 2026年10月15日 Gemini Monitor登録情報の安全性修正

対象実行：[38656877617](https://github.com/uchidats/web-lecture-event-viewer/actions/runs/38656877617)。実行開始は2026年10月15日08:54 JST、baselineは `a08c90a`。artifactのdaily reportとrollback snapshotを照合した。

- Event ID: `conf-jp-neuro-2026`
- タイトル: 第64回 日本神経眼科学会総会
- 公式情報源: https://n-practice.co.jp/64thJNOS/
- Gemini confidence: 0.98
- 適用前: `registration` なし。legacy `earlyBirdDeadline` は `締切済`
- 提案: `registration.deadline: null → 2026-11-27`
- 不正な適用後のregistration全体: `{ "deadline": "2026-11-27" }`

日付そのものは正しい形式だが、`registration.type` と必須の `registration.periods[]` がない。periodsが空になったのではなく、存在しない。phaseが存在しないためcategory・advanceEligible・start/deadline順序の問題ではない。legacy変換ではなく、汎用のドット区切りfield setterが中間オブジェクトを作ったことが原因。

同じ実行では演題締切 `2026-07-31` と別イベントの会場変更も適用候補だった。不正なregistrationが保存された後、safety checkでvalidatorが検出しcommitがスキップされた。現在の追跡データ94件に不正なregistrationはなく、構造化済み2件も有効。公開events.jsの修復は不要であり変更しない。

## 修正方針

`validRegistration()` は変更しない。提案の分類時と実適用時の両方で、適用後のregistration全体を検証する。単一の締切だけでは公式early/regular/onsiteの対応が分からないため、`registration.deadline` からphaseを推測生成しない。この変更だけをreviewへ送り、公式phaseを確認してから構造化登録する。

不正なfieldはdaily reportのreview候補に理由付きで記録し、同じイベントの他の安全なfieldや別イベントの更新を継続する。保存直前にはdataset全体も既存validatorで再検証する。拒否したfieldは適用件数・適用済み履歴に含めない。

実artifact由来の最小fixtureで、混在バッチの安全な2イベントの更新と登録fieldのreview送り、Monitor全体の隔離実行を回帰テストする。空periods・必須値欠落・不正日付・開始終了逆転・許可外category・非boolean・不正URL・既存structured registrationへのドットfield変更も検証する。
