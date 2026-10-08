# OphthalConfのルート／サブパス先行検証

現在のルートを維持したまま、同じソースを `/ophthalconf/` でも配信するための実装。ルートをポータルにしたり、ルートから転送したりしない。

## 公開成果物

`node scripts/build-dual-site.js` はGit管理外の `_site/` を生成する。

```text
_site/
  CNAME                       medconf.jp
  index.html                  現在のOphthalConfと同一
  JS・CSS                     ソースと同一
  reports/                    管理レビュー等の公開JSON
  docs/                       既存の資料
  ophthalconf/
    index.html                ルートと同一
    JS・CSS                   ルートと同一
    reports/                  ルートと同一
    docs/                     ルートと同一
```

現在のHTMLと14個のJS/CSS、必要なレビューJSONを両方の階層に同じバイト列でコピーする。相対パスは変更しない。CNAMEは公開ルートに1個だけ置く。リポジトリ名、ルートのevents.js、自動更新のファイル参照、Firebase設定、Calendar Client ID、localStorageキーは変更しない。

backend、node_modules、.git、.github、テスト、更新バックアップ、認証情報を成果物へ含めない。公開ファイルは明示したリストとdocs内の資料だけ。生成処理は自分のマーカーがある `_site/` だけを再生成し、ソースを削除しない。

## ローカルで開く

```sh
node scripts/preview-dual-site.js
```

`http://localhost:8000/` と `http://localhost:8000/ophthalconf/` を同じブラウザで開く。プレビューサーバーは `/ophthalconf` を301で `/ophthalconf/` に統一し、queryを保持する。ルートは200のアプリで、転送しない。公開後もGitHub Pagesのディレクトリindexによる末尾スラッシュへの転送を確認する。

## 公開に使うworkflow

`.github/workflows/deploy-pages.yml` はmainのpush／手動実行／既存Conference Auto Updaterの成功後に、現在のmainから成果物を再生成してPagesへ配信する。自動更新がGITHUB_TOKENでpushしてもworkflow_runから生成できる。既存の更新workflowやデータ保存場所は変更しない。

今後公開するときは、GitHubのSettings → Pages → Build and deployment → Sourceを **GitHub Actions** に設定し、このworkflowの成果物を使う。Custom domainはmedconf.jpを維持する。現在の「Deploy from a branch」のままでは、Git管理外の `_site/` は公開されない。

今回はローカル実装のみで、Pages設定の変更・workflowの起動・commit・pushはしていない。本番の `/ophthalconf/` が公開済みであるとは扱わない。切替後も成果物のルートには同じOphthalConfが入るため、先行検証段階でルートの削除／転送は起きない。問題があればPagesの公開元を元のmainルートへ戻せる。

## サーバーOAuthの一時的な互換許可

`backend/lib/frontend-urls.js` の共通リストで以下を許可する。設定検証とOAuthセッション検証は同じリストを参照する。

- http://localhost:8000/
- https://uchidats.github.io/web-lecture-event-viewer/
- https://medconf.jp/
- https://medconf.jp/ophthalconf/

CORSは既存originを残して https://medconf.jp を追加。パス付きoriginは許可しない。callback URLとCookieのPathは `/api/google-calendar/callback` のまま。環境変数FRONTEND_URLの既定値・稼働サービスの設定は今回変更しない。新URLへの戻りを実運用で試す場合、バックエンドをこのコードで更新したうえでFRONTEND_URLを末尾スラッシュ付きの新URLへ設定する。

FirebaseのAuthorized domains、Google OAuthのJavaScript origin、クライアントIDやプロジェクト設定は現状維持。本番の認証動作は既存の外部設定に依存する。

## 検証結果と限界

- `node scratch/test_dual_site.js`：両階層のファイルがソースと同一、JS/CSS14件と管理レビューJSONが200、ルート非転送、末尾スラッシュ／query、ソース不変、配信対象外ファイルの除外。
- `node scratch/test_dual_site_browser.js`：実HTTP＋Edge、1280／390／320pxで両URLを表示。参加予定・非表示・履歴・フィルタ・カレンダー設定・レビュー履歴のlocalStorageを両方向で保持。Firebaseのログイン復元、Google Calendarの再接続とAPI呼出、管理レビューダイアログ、query／hash保持、横あふれなし。
- `npm test`（backend）：42件。旧URL・ルート・新URLの設定／セッション検証、成功／拒否時の戻り先、CORSの許可／拒否を含む。
- `node scripts/check-conference-regressions.js`：既存32項目を確認。

ブラウザテストはFirebase SDK／Google Calendar APIだけをテストサーバー上でモックに置き換える。公開用の成果物にはモックを含めない。実Googleアカウントでのログイン／予定操作、実際のmedconf.jp/ophthalconf/への公開後確認は未実施。

パス移動は同じoriginなので保存キーの移行は不要。Firebaseの保存済みログインは同じ設定で復元する。メモリだけに保持するCalendarアクセストークンはページ遷移で消え、従来どおり再接続が必要。
