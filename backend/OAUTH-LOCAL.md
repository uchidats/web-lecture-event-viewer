# Google CalendarサーバーOAuth（ローカル限定）

## 今回の範囲

Firebase ID tokenで本人を確認してOAuthを開始し、GoogleのWeb Server flowでcodeをrefresh tokenに交換します。既存ブラウザー直接型 `GoogleCalendar` は変更しません。サーバー方式は接続状態の比較だけが可能で、Calendar予定読取／追加はまだ行いません。

refresh tokenは既定ではMemoryTokenStoreでFirebase uidに紐づけ、プロセス再起動で消えます。`TOKEN_STORE=firestore`で永続保存、`OAUTH_SESSION_STORE=firestore`で共有sessionへ切替できます。詳細は [FIRESTORE-TOKEN-STORE.md](FIRESTORE-TOKEN-STORE.md) と [OAUTH-SESSIONS.md](OAUTH-SESSIONS.md) を参照してください。本番設定とバックエンドのCalendar操作はまだ別段階です。

## Google Cloud Console

1. プロジェクト `ophthalconf` のGoogle Auth Platformで、公開名・サポートメール等を確認します。外部向け／Testingの場合は、実際に検証するGoogleアカウントをテストユーザーに登録します。
2. Data Accessで以下のCalendarスコープと、本人確認用openidを設定します。
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
   - `openid`（Firebaseログインと同じGoogleアカウントであることを署名済みID tokenで確認）
3. Clientsで専用の「ウェブアプリケーション」OAuth Clientを作成します。Firebaseログイン用・既存ブラウザーCalendar用クライアントとは分けることを推奨します。同じOAuth clientを共有すると、revokeが既存方式のGoogle grantにも影響する可能性があります。
4. **Authorized redirect URIs** に完全一致で追加します。
   ```text
   http://localhost:8080/api/google-calendar/callback
   ```
   フロントの `http://localhost:8000/` はcallbackではありません。Web Server flowではbackendのredirect URIが必要で、JS originの追加だけでは代わりになりません。
5. Client IDとClient Secretをローカル環境変数へ設定します。secret JSONはリポジトリ内へダウンロードしません。既存のFirebase Authorized domains設定も維持します。

将来は `https://<backend-host>/api/google-calendar/callback` を登録し、同じ値をバックエンド設定に使います。今回はCloud Runへデプロイせず、本番callbackも登録必須ではありません。

## 環境変数

| 名前 | ローカル値／用途 |
| --- | --- |
| FIREBASE_PROJECT_ID | `ophthalconf`（フロントと一致） |
| PORT | `8080` |
| GOOGLE_OAUTH_CLIENT_ID | 専用Web OAuth Client ID |
| GOOGLE_OAUTH_CLIENT_SECRET | 専用Client Secret。バックエンドのみ |
| GOOGLE_OAUTH_REDIRECT_URI | `http://localhost:8080/api/google-calendar/callback` |
| FRONTEND_URL | `http://localhost:8000/`（既定値） |
| SECRET_PROVIDER | `env`（既定値）。本番はsecret-manager |

将来のFRONTEND_URLは `https://uchidats.github.io/web-lecture-event-viewer/` に切替可能です。任意の戻りURLは認めず、この2種類だけを許可します。OAuth設定を全て省略した場合、health・me・statusは動作し、connect／callbackは503を返します。OAuth設定の一部だけ入力した場合は起動時にエラーになります。

## 起動

Node.js 24で、別ターミナルからbackendを起動します。環境変数はこのターミナルのプロセス内だけに設定し、secretをコマンド履歴へ書かないよう対話入力します。

```powershell
cd backend
npm ci
gcloud auth application-default login
$env:FIREBASE_PROJECT_ID = "ophthalconf"
$env:PORT = "8080"
$env:GOOGLE_OAUTH_CLIENT_ID = Read-Host "Google Web OAuth Client ID"
$env:GOOGLE_OAUTH_CLIENT_SECRET = [System.Net.NetworkCredential]::new("", (Read-Host "Google Web OAuth Client Secret" -AsSecureString)).Password
$env:GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:8080/api/google-calendar/callback"
$env:FRONTEND_URL = "http://localhost:8000/"
npm start
```

別ターミナルのプロジェクトルートで `python -m http.server 8000` を実行します。既に動作中なら再起動は不要です。localhostと127.0.0.1を混在させず、フロント・backend・登録callbackすべてlocalhostを使ってください。

環境変数を表示するコマンドやHTTPヘッダーの共有は避けてください。検証後にbackendを停止するとメモリ保存は消えます。必要なら同じターミナルで `Remove-Item Env:GOOGLE_OAUTH_CLIENT_SECRET` でsecret変数を消してください。

## 実Googleでの確認

`http://localhost:8000/` でFirebase Googleログインします。Consoleで、token本体を表示せず以下を実行します。

```javascript
await OphthalAuth.testBackend("http://localhost:8080")
await OphthalAuth.getCalendarConnectionStatus()
// 初回は { connected: false }

window.location.assign((await OphthalAuth.connectServerCalendar()).authorizationUrl)
```

Googleの同意画面でFirebaseログインと同じGoogleアカウントを選択し、Calendar読取・イベント追加を許可します。callbackはstateを一度消費し、PKCE付きでtoken交換してGoogle ID tokenの本人一致を確認します。Cookieが届いた場合は追加検証します。`http://localhost:8000/?calendar_oauth=connected` へ戻ったら、Firebaseログイン状態の復元を待って：

```javascript
await OphthalAuth.getCalendarConnectionStatus()
// { connected: true }
```

初回の接続前false→callback後trueなら、refresh tokenが取得され、そのFirebase uidのメモリ保存に成功したことを確認できます。APIはrefresh tokenやaccess tokenを返しません。既に保存済みの再接続でGoogleがrefresh tokenを返さなかった場合は、既存の保存値を維持します。新規取得を確認する場合はbackend再起動後のfalseから検証してください。

別ブラウザーで同じフロント・同じFirebaseアカウントにログインし、同じbackendへstatusを問い合わせるとtrueになります。別uidはfalseになります。スマホのlocalhostはスマホ自身を指すため、PCのlocalhostバックエンドへは接続できません。スマホからの共有HTTPSバックエンド検証は次段階です。

解除の確認：

```javascript
await OphthalAuth.disconnectServerCalendar()
// { connected: false, revoked: true } または revoke失敗時は revoked: false
await OphthalAuth.getCalendarConnectionStatus()
// { connected: false }
```

Google側revokeを先に試み、その後保存を削除します。Google通信が失敗してもfinallyで保存を削除します。Firestore削除自体に失敗した場合は解除成功とは返さず、復旧後の再試行が必要です。revoked:falseの場合はGoogleアカウント側のアプリ接続管理から手動で解除できます。Firebaseのログアウトとは別処理で、FirebaseログアウトだけではサーバーCalendar連携を解除しません。

## stateと保存の設計

- stateは暗号学的乱数による不透明セッションIDで、uidを含みません。Memory／Firestore sessionが検証済みuid・PKCE verifierに対応します。
- 10分で失効し、一度消費したstateは再利用できません。期限切れ、重複state、古い世代、届いたCookieの不一致は拒否します。Cookie欠落時もGoogle ID tokenの署名と本人一致を必須にします。
- connect時にHttpOnly・SameSite=Lax・callbackパス限定Cookieを設定します。HTTPS設定ではSecureも付与します。connectのfetchだけcredentials:includeを使用し、CORSは指定originだけを許可します。
- callbackはFirebase tokenをURLに付ける必要がありません。検証済みstateのサーバー情報でuidを決めます。PKCE S256で盗まれたcodeだけの交換を防ぎます。
- 接続世代を共有し、Firestoreでは世代確認とtoken保存／削除を同じtransactionにします。Google revoke中は共有leaseで新規開始を一時的に拒否します。
- 2スコープの同意をtoken交換レスポンスで確認します。初回にrefresh tokenがない、scopeが不足する、交換に失敗する場合は保存せず `calendar_oauth=failed` へ戻します。同意取消は `calendar_oauth=denied`。不正stateは400です。既存の保存値は交換失敗時に維持します。
- statusのtrueは保存値の存在を意味し、Google側で失効していないことまでは検証しません。access tokenは保存せず、codeもstate消費後に保持しません。

TokenStoreの4メソッドは維持し、共有session用に世代を検証する保存／削除メソッドを追加しています。本番用構成にはTokenStoreとsessionの両方のfirestore指定、HTTPS、Emulator未使用が必要です。今回デプロイは行いません。

GitHub Pages→Cloud Runは別siteなので開始Cookieが保存されない場合があります。共有sessionと署名済みGoogle本人確認によりCookie欠落にも対応しています。実ブラウザー／Cloud Run環境での確認は本番化前に必要です。

## 秘密情報

実secretファイルは作成していません。refresh tokenはメモリのみで、保存ファイルはありません。`.env`、`.env.*`、`credentials/`、`secrets/`、`*service-account*.json`、`*service_account*.json`、`*credentials*.json`、`client_secret*.json`、`*.pem`、`*.key` 等はbackendの.gitignoreと.gcloudignoreで除外しています。

**フロント用HTTPサーバーはリポジトリルート配下を配信するため、Git除外だけではHTTPから秘密ファイルを守れません。リポジトリ配下に.envや秘密JSONを置かず、今回の手順どおりプロセス環境変数を使用してください。**

アプリはcode、token、Client Secret、state付きcallback URLをログ出力しません。callbackのCache-Controlはno-store、Referrer-Policyはno-referrerです。将来Cloud Run／プロキシを使う場合は、アクセスログのcallbackクエリーにもcodeが入るため、記録・マスキング方針を確認してください。ブラウザーNetwork情報も秘密を含むので共有しないでください。

本番client secret用Secret Manager Providerを追加しました。[SECRET-PROVIDERS.md](SECRET-PROVIDERS.md) を参照してください。今回は実接続しません。通常のCloud Run環境変数へsecretを直書きする手順はありません。

Google Auth Platformの外部Testing状態では、Calendarスコープを持つrefresh tokenは通常7日で期限切れになります。再同意が必要になる場合があります。これは本番の永続連携の保証ではありません。

## 自動検証

```powershell
cd backend
npm test
cd ..
node scratch/test_backend_client.js
node scratch/test_firebase_auth.js
node scratch/test_google_calendar.js
node scratch/test_calendar_conflict_times.js
node scripts/check-conference-regressions.js
```

OAuthテストのcode・token・secretは明示的なfixture値で、実Google情報を使いません。実Googleの同意画面・実refresh token取得は上記手動手順で確認してください。

公式資料：[Google Web Server flow・offline・revoke・Testingの制限](https://developers.google.com/identity/protocols/oauth2/web-server)。
