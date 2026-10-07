# Conference Auto Updater v1

高信頼度の変更は機械的に反映でき、判断できない変更だけを `needs-review` として保存する更新基盤。毎回すべての差分を承認する運用は前提にしない。初期運用は **dry-run**。依存パッケージ不要、Node.js 24を使用する。

## 対象学会

`conference-sources.js` の5レコードだけを取得する。他の89イベントには触れず、ID、新規作成、削除、並び順を変更しない。

| 学会 | 既存ID | 公式取得元 |
| --- | --- | --- |
| 第131回日本眼科学会総会（2027） | `oph-011` | [開催概要](https://convention.jtbcom.co.jp/131jos/summary/index.html)・[演題募集](https://convention.jtbcom.co.jp/131jos/abstract/index.html) |
| 第80回日本臨床眼科学会（2026） | `oph-001` | [開催概要](https://convention.jtbcom.co.jp/80ringan/summary/index.html)・[演題募集](https://convention.jtbcom.co.jp/80ringan/abstract/index.html) |
| 第50回日本眼科手術学会学術総会（2027） | `conf-jp-surgery-2027` | [公式トップ](https://50.jsos.jp/)・[一般演題登録](https://50.jsos.jp/abstract) |
| 第37回日本緑内障学会（2026） | `conf-jp-glaucoma-2026` | [開催概要](https://www.congre.co.jp/jgs2026/contents/outline.html)・[一般演題募集](https://www.congre.co.jp/jgs2026/contents/cfa.html) |
| 第65回日本網膜硝子体学会総会（2026） | `conf-jp-jrvs-2026` | [開催概要](https://convention.jtbcom.co.jp/65moumaku/summary/index.html)・[演題募集](https://convention.jtbcom.co.jp/65moumaku/abstract/index.html) |

公式HTMLの開催概要・募集期間を取得できることを2026-10-04に確認した。学会団体トップページから毎年の開催回を推測せず、開催回ごとのURLに固定する。緑内障・網膜硝子体は現在データの団体ドメインと公式大会ドメインが異なるため、その `officialUrl` 変更は要確認となる。

## パイプライン

```text
source config → fetch → extract → normalize → validate → compare → apply
                                                     ├─ 高信頼度 → 自動反映候補
                                                     └─ 不確実   → needs-review
apply → バックアップ → 書き込み → 回帰テスト → 成功時に履歴保存
                                      └─ 失敗時に復元、commit禁止
```

- `fetch.js`: HTTPS・許可ホスト・最大3リダイレクト・15秒の取得タイムアウト・2MB上限。ホスト変更は追跡しない。HTML以外はv1では保留する。
- `extract.js`: 共通のラベル付きHTML（見出し、表、定義リスト）、開催回が一致したJSON-LD `Event` を抽出する。ページtitleで開催回と学会を照合し、フッターに学会名があるだけでは受け付けない。script/style/nav/footer/commentと削除線の過去締切を抽出対象から除外する。
- `policy.js`: フィールドごとの候補、confidence、既存値、矛盾を評価する。単一候補だけ採用し、日程・所在地・演題期間／状態は関連フィールドをまとめて保留できる。URLは独立評価。
- `storage.js`: JSON互換の `sampleEvents` 配列をJSONとして読む。データをコードとして実行しない。ID・件数・順序・親学会を検証する。
- `pipeline.js`: pilotのみの取得、上限判定、差分適用、バックアップ、回帰テスト、履歴保存を統括する。applyはmainのクリーンな作業ツリーと排他ロックが必要。

変更可能なフィールドは学会名、開始／終了日、会場、都市、国、公式URL、演題開始／締切／状態／URLのみ。都市／国は既存の `cityCountry` に反映する。会期変更時は `period`、演題締切変更時は `abstractDeadline` も同期する。`venueId`、地域フィルター、参加状態などは書き換えない。

都市・国は会場セクションの明示的なラベル、会場住所、JSON-LDから取得する。既存の会場マスターで完全一致する会場が1つだけある場合、その検証済み都市・国も利用できる。運営事務局の所在地を会場として採用しない。国コードは日本／米国／オーストリア／シンガポールなどの既存表記へ正規化する。

## Confidence と自動更新条件

### 会場の採用・上書きルール

会場は、公式開催概要の会場欄または開催回が一致するJSON-LD `Event.location.name` に
明記された値のみ候補にする。`sourceRole`、`venueEvidence`、原文 `evidence` を保存し、
policyで抽出方法と原文の会場名一致を検証する。都市名・他学会・AI・会場マスターから
会場名を推測しない。記載がない場合は既存値を保持する。

未設定／未定等は明示的な根拠があれば補完可能。確定済みの既存会場と異なる場合は、
都市情報があっても `existing-venue-change-needs-review` として自動上書きしない。
venueIdを持つ場合は会場マスターとの矛盾も保留する。適用処理でも根拠・URL・既存値を再検証する。
会場差分には `sourceUrl`（抽出元の公式URL）を必須とし、dry-runレポートと
適用履歴 `auto-update-history.json` に新旧値・根拠とともに保存する。
手動訂正も確認URL付きで記録する（例: `reports/venue-corrections.json`）。

| 根拠 | confidence上限 |
| --- | --- |
| 開催回が一致する公式JSON-LD | 0.99 |
| 明示的なラベル付き公式HTML | 0.98 |
| 公式演題募集ページURL | 0.98 |
| 明示された会場名 | 0.97 |
| 公式title、会場住所、検証済み会場地理 | 0.96 |
| 年の省略を設定年で補完、将来のPDF adapter | 0.80 |
| 周辺文脈、将来のAI推定 | 0.70 / 0.40 |

自動反映は **0.95以上**、既存値と異なる値、妥当性検証成功、対象学会の `autoUpdateEnabled: true` が条件。抽出方法が未登録の場合や、その方法の上限を超えるconfidenceは保留する。すでに同じ値のものは無変更とし、表記上の空白だけを変更しない。

演題状態は一意で高信頼度の開始日・締切日の組がある場合、Asia/Tokyoの当日と比較してupcoming/open/closedにする。締切当日はopen、翌日はclosed。公式ページに明示された受付終了も候補として使う。日時は保持するが日数判定は暦日単位。

## 要確認と停止

### 採用済み締切日の保持と再取得

`abstractSubmission.deadline` は採用済みの基準値であり、`status: closed` になっても保持する。同じ締切日時を翌日以降に取得した場合、正規化後の一致を変更なしとして扱い、単一候補ならレビューへ追加しない。
未入力から公式・高信頼度の締切を取得した場合は従来どおり自動更新候補にできる。既存の締切と異なる場合は小さな修正でも自動上書きしない。
後ろへ移った日付・既存時刻の延長は `deadline-extension-possible`（締切延長の可能性）、それ以外は `deadline-change-needs-review` とする。時刻消失・複数候補も引き続き要確認。
締切が要確認の間は関連する募集開始日・状態も保留し、採用前の新候補を使って募集状態を変更しない。適用処理にも既存締切の上書き拒否を置く。

初回の締切採用時は `originalDeadline` / `currentDeadline` / `extended` を追加する。`deadline` と `currentDeadline` は採用済み日時、`originalDeadline` は初回の基準日時、`extended` は採用された日時が初回より後ろへ移ったかを表す。
将来の管理者承認による延長反映でこの構造を利用できる。延長レビュー候補に付くこれらの情報は提案であり、保存済みイベントを変更しない。
既存データには一括移行を行わず、UIは従来の `deadline` だけでも動作する。

終了後の表示は `2026年5月21日 12:00 締切済`。承認済みの延長情報があれば `（延長）` を追加する。
日付と時刻の表示は `formatAbstractDeadline` に分離し、必要なら `showTime: false` で日付のみを表示できる。表示処理はデータを削除・変更しない。

以下は人が見る例外に保存する。

- 取得失敗、404、HTML以外、HTML不正、開催回を確認できないページ、会場／日程／演題期間が抽出できないページ
- 複数の開催日・募集区分・締切候補、明示年のない募集日、低confidence
- 学会名の実質変更、都市／国の矛盾、国内海外分類の矛盾
- 会場マスターと一致しない会場、変更後の所在地が確認できない会場
- 公式ドメイン変更、許可外ドメイン、同一主催ドメイン内で別開催回へのURL変更
- 開催日14日超の移動、演題日90日超の移動、締切時刻の消失
- 無効な日付、開始後に終了しない日程、31日超の会期、学会終了後の演題締切など

異常日付はバッチ全体を停止する。mass-changeはdistinct eventId数、変更元フィールド総数、イベントごとの変更数、リスク換算数を別々に評価する。既定の上限は5イベント、20フィールド、1イベント6フィールド、リスク換算10。いずれかを超えると全反映を停止し、部分反映はしない。派生表示フィールドは数えない。

policyの検証を通った公式・高信頼度の `null → 値` に限り、`abstractSubmission.startDate` / `deadline` / `status` / `url` の補完を0.25件としてリスク換算する。他の変更は1件。`unknown`からの状態変更や既存URLの変更も1件であり、開催日・開催地・タイトル・ドメイン変更の個別検証は維持する。レポートの `massChangeAssessment` に各件数と超過した上限を記録する。

全体停止時は適用候補を `autoChanges` から `blockedAutoChanges` へ移し、通常の `needsReview` や永続例外キューへ複製しない。過去のキューに保存済みの停止項目は履歴として残す。今回相当の固定HTML・baselineによるdry-runは5ソース、4イベント、11フィールド（null補完8件、通常リスク3件、換算5件）で停止せず、真の要確認9件、ブロック0件となる。

取得できなかった値で既存値を削除しない。ID変更・レコード削除・非pilot変更は禁止。JSON/JS構文不正、変更中のデータ、Git作業ツリーの変更も反映を拒否する。回帰テストが失敗すると、イベントと適用途中のメタデータ／履歴を元の状態へ戻す。

## 出力と履歴

- `reports/auto-update-report.json`: 今回の候補・採否・根拠・confidence・取得メタデータ・テスト結果・停止理由。dry-runでも出力する。
- `reports/auto-update-review.json`: 永続例外キュー。安定ID、eventId、field、旧値、候補値、URL、理由、confidence、firstSeen、lastSeen、occurrences、`status: needs-review` を持つ。次回取得できなくても削除しない。調査後は運用者がstatus／解決メモを編集でき、処理済みの記録も保存する。キューの値をそのまま自動採用する機能はない。
- `reports/auto-update-source-state.json`: apply時のsourceMetaを学会ID別に保存。officialUrl、lastChecked、lastChanged、confidence、fingerprint、extractionMethod、autoUpdateEnabled、ページ別fingerprint／取得結果。dry-run時の観測はreportに入れ、適用済み状態を変更しない。
- `reports/auto-update-history.json`: 実際に自動反映された各フィールドの旧値、新値、時刻、URL、confidence、抽出方法、根拠、fingerprintを追記する。dry-runの候補は更新履歴に混ぜない。
- `reports/auto-update-backups/<実行時刻>/`: 変更前events.jsと既存メタデータ／履歴／キュー。Git管理外。Actionsのartifactに保存する。

副次管理情報はブラウザに読み込ませず、既存サイトへ追加の依存を入れない。

## 実行方法とテスト

```sh
node scripts/update-conferences.js            # dry-runが既定
node scripts/update-conferences.js --dry-run  # events.jsを変更しない
node scripts/check-conference-regressions.js # 全既存回帰＋updater fixture
node scratch/test_auto_updater.js            # オフライン・再現可能
node scratch/test_auto_updater_integration.js # 隔離コピーで実反映＋全回帰ゲート
node scratch/test_auto_updater_live.js       # 実サイト10ページの取得・抽出のみ
node scripts/update-conferences.js --apply   # mainがクリーンな場合のみ、安全な差分を反映
```

applyコマンド自体はGit commit/pushを行わない。安全な適用後の自動commit/pushはActionsが担当する。手動apply後は同じ回帰テストを確認してGitへ保存できる。dry-runはreportsを書き出すため、手動apply前には必要なレポートをコミットするか作業ツリー外に保存する。

終了コード: 通常/dry-run/無変更/無効化は0、全体停止／復元は2、構文・設定・ロックなどの実行エラーは1。fixtureは取得済み公式HTMLに基づく。概要ページはHTMLスナップショット、演題ページはtitleと募集期間の元HTML断片を保持する。出典は `scratch/fixtures/auto-updater/manifest.json`。fixtureテストの適用／復元検証はOSの一時ディレクトリだけを変更する。

## GitHub Actions

`.github/workflows/update-conferences.yml` は毎日06:17 JSTと手動実行。mainだけが対象。最初に回帰テストを実行し、取得・判定後にも回帰テストを行う。Node.js 24を使い、依存インストール不要。

既定はdry-run。`CONFERENCE_AUTO_APPLY=true` というrepository variableを設定すると、上限内・日付正常・テスト成功の実行だけ、データと履歴／例外キューを自動commitしてmainへ通常pushする。毎回の承認は不要。pushが競合した場合はforce pushや自動マージをせず失敗させる。ブランチ保護がbotのpushを禁止する場合も失敗となる。

停止やdry-run時にはcommitしないが、reportsとバックアップをartifactに保存する（保持30日）。dry-runの例外はartifactに保存され、mainのキューへ自動追記されない。停止中の例外を長期保管する場合はartifactを保存する。applyが成功した実行のキュー／履歴はGit履歴にも残る。既存の公開方式の変更は行わず、main更新後の公開はリポジトリのホスティング設定に従う。`GITHUB_TOKEN`によるpushが別のpush-triggered workflowを起動しない制約があるため、別の公開workflowが必要な場合は同一jobに公開工程を接続する。

## 緊急停止と復元

1. Actionsのrepository variable `CONFERENCE_AUTO_UPDATE_DISABLED=true` で定期／手動jobを停止する。実行中の場合はそのrunをキャンセルする。
2. 本番反映だけを止めて観測を続けるには `CONFERENCE_AUTO_APPLY` をfalseに戻す。
3. ローカルは `AUTO_UPDATE_DISABLED=1`、全体設定は `conference-sources.js` の `enabled: false`、学会単位は `autoUpdateEnabled: false`。
4. 適用済みコミットは `git revert <自動更新コミット>` で復元できる。コミット前はbackupディレクトリのevents.jsを戻す。必要なら同じbackupのメタデータ／履歴も戻す。元々存在しなかった管理ファイルは削除対象になるので、historyとreportを見て作業する。
5. 強制終了でlockが残った場合はプロセスが終了済みであることを確認して `reports/auto-update.lock` を取り除く。ロックの自動強奪は行わない。

## 全科への展開

対象はregistryに安定ID・開催回・year・公式URL・許可ホスト・概要／演題ページを追加する。HTMLレイアウトが共通ならadapterコードを増やさない。JSON-LD、PDFなど追加の抽出器は `adapters` のインターフェース `{ candidates, issues, fingerprint }` を実装し、候補ごとにfield/value/confidence/method/url/evidenceを返す。methodのconfidence上限もpolicyへ登録する。

新規adapterはfixtureと安全判定テストを追加してからpilotを広げる。複数区分の募集期間に対して将来は「一般公募」などの抽出scopeをregistryへ追加する。PDFはv1では中confidence以下で要確認、AIの推定だけで自動更新しない。大量展開は診療科別のバッチ／シャードを設け、mass-changeの各上限を無条件に引き上げない。開催年が変わっても既存IDを書き換えず、別年度レコードの追加は別の検証済み投入工程とする。
