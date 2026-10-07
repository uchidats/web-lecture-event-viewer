# 管理者向け更新レビュー（ローカル試作）

通常モードはFirebase Authenticationの現在ユーザーが `email === 'uchidats@gmail.com'` かつ `emailVerified === true` のときだけ有効。
ヘッダーの「更新確認 9件」からレビュー画面へ進む。未ログイン・別メール・未確認メールは入口もデータ取得も無効。
ログアウトやユーザー変更時には開いている画面と候補をクリアする。判断操作も現在の管理者状態を確認する。

ローカル検証で認証を省略する場合のみ、ローカルコピーの `review-config.js` を `developmentMode: true` に設定する。
リポジトリのルートで `python -m http.server 8000 --bind 127.0.0.1` を実行し、`http://127.0.0.1:8000/?adminReview=1` を開く。
既定はfalse。クエリだけではローカルでも管理者にならない。開発設定がtrueでもlocalhost / 127.0.0.1 / IPv6 loopback以外では無効。
本番ドメインでは確認済み管理者ログインが必須。開発設定を本番へ配信しない。

## 操作

各カードには学会名、変更項目、取得時の現在値、検出した候補値、根拠、信頼度、理由、情報源へのリンクを表示する。
「採用」「変更しない」「保留」はローカル判断だけを記録する。採用・変更しないを選んだ項目は未判断一覧から外れる。
「要確認すべて」「全候補・判断済み」で判断を変更できる。保留は未判断一覧に残る。
同じイベント・同じフィールドで異なる候補を同時に採用できない。候補値や安全な情報源URLがない取得エラーは採用できない。

fixtureは今回の `reports/auto-update-review.json` の固定コピー（20件）。真の要確認9件と旧仕様の `mass-change-limit` 11件を別表示にする。
元レポートやevents.jsは変更しない。最新artifactの自動取得・配信は実装していない。

## 保存と拡張

- `review-data.js`: `load()` を持つ読み取り専用provider。現在は固定JSONを取得する。将来artifact、認可済みbackend API、Firestoreのproviderへ差し替える。
- `review-model.js`: 正規化、リスク分類、管理者判定、判断履歴。`isAdminUser(user)` は確認済みの指定メールとUIDの存在を検証する。`createAccess` の `authorizeUser(user)` を将来の管理者判定に差し替えられる。Firebase Authの既存subscribeからemailVerifiedを含む現在ユーザーを渡す。本番UIDは固定しない。
- `review-ui.js` / `review.css`: 表示と単件操作。Firebaseの認証状態変化に応じて入口を更新し、権限がなくなれば画面を閉じる。

判断は `localStorage['ophthalconf.review-decisions.v1']` の `{version: 1, history: [...]}` に追記する。
各履歴はreviewId、decision、decidedAt、field、reason、riskLevel、eventId、reviewerId、候補のsignature、新旧値、automationCandidate、scopeを持つ。
同一判断の連打は履歴を増やさない。署名が変わった候補に以前の判断を引き継がず、履歴は削除しない。
ブラウザ・originごとに保存され、別ブラウザへ同期しない。保存不能・破損時はエラーを表示する。認証トークンは保存しない。

低リスクカードのチェックボックスは、次の判断とともに `automationCandidate` を保存する検討用の印。
実際の自動承認設定には接続しない。`statistics(item, reviewerId)` で同じfield・reason・riskLevelの採用回数、却下有無、直近判断を取得できる。
将来自動承認ルールを作る際はこの履歴を別途審査し、公式根拠・Updaterの個別安全検証を維持する。
一括承認は未実装。追加する場合は低リスクかつ採用可能な候補だけを対象とし、高リスクを含む一括承認を許可しない。

静的UIの入口制御はサーバーの認可を代替しない。`backend/lib/admin-access.js` に独立した認可ガードを用意している。
将来のレビュー読み取り・反映APIでは、処理の最初に以下を実行し、成功する前にデータを書き込まない。

```js
const { createVerifier } = require('./lib/firebase');
const { createRequireAdmin } = require('./lib/admin-access');
const requireAdmin = createRequireAdmin(createVerifier(process.env));
// HTTP handler内。例外時は401/403または検証障害として拒否し、更新処理へ進まない。
const { uid } = await requireAdmin(req.headers.authorization);
```

ガードはBearer Firebase ID tokenをAdmin SDKで検証した後、`isAdminClaims(claims)` で `email === 'uchidats@gmail.com'` と `email_verified === true` を確認する。
本文・クエリのemail/uidやフロントの判定結果を信用せず、開発モードの例外も持たない。既存Calendar APIの一般ユーザー認証は変更しない。
レビューの実反映APIはまだ作成していない。将来Firestore `admins/{uid}` へ移行する場合は、`createRequireAdmin` の第二引数を検証済みUIDに対する非同期ロール照会へ差し替える。
バックエンドの認可結果をフロントの `authorizeUser` に接続する際は、未確認・通信エラーを拒否扱いにする。

## リスク分類

高リスクを最優先する。開催開始・終了日、会場・都市・国、タイトル、公式URLのドメイン変更は高リスク（赤枠・ラベル）。
複数候補と関連項目の確認待ちは中リスク。公式URLの同一ドメイン内変更、既存日時・募集URLの上書き、根拠不足も中リスク。
演題募集4項目のnull補完と募集ステータス更新は、信頼度95%以上・HTTPS情報源・根拠があり、理由が未指定または過去のmass-change停止の場合のみ低リスク。
募集URLの追加には候補URL自体も有効なHTTPS URLであることを求める。ここでのUI分類はUpdaterのmass-changeリスク換算とは別用途。

## 検証

`node scratch/test_review.js`：fixture件数、リスク、管理者判定、判断保存・履歴・競合、URL、取得・保存エラー。

`node scratch/test_review_browser.js`：ローカルHTTP + headless Edge。PC/タブレット1280・768px、スマホ390・320pxの横溢れ・縦配置・操作サイズ、3択保存、再読み込み、停止候補、検討用チェック、HTML注入防止、高リスク表示、既存学会UI・Calendar入口。
ブラウザ実行パスは `CARD_TEST_BROWSER` で指定可能。テスト用Firebase SDKは無効化し、外部サービスへの実更新は行わない。
