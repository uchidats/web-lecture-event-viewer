# OphthalConf Cloud Run API skeleton

Node.js 24 / Firebase Admin SDK。通常UIは変更しません。TokenStoreとOAuth sessionのMemory／Firestore実装を用意しています。Secret取得は [SECRET-PROVIDERS.md](SECRET-PROVIDERS.md) のenv／Secret Manager Providerで切替可能です。Firestore本番書込、Secret Manager実接続、Calendar API操作、Cloud Runデプロイは行いません。OAuth検証は [OAUTH-LOCAL.md](OAUTH-LOCAL.md)、共有sessionは [OAUTH-SESSIONS.md](OAUTH-SESSIONS.md)、TokenStoreは [FIRESTORE-TOKEN-STORE.md](FIRESTORE-TOKEN-STORE.md) を参照してください。

## APIと認証

| API | 認証 | 成功レスポンス |
| --- | --- | --- |
| GET /health | 不要 | `{"ok":true}` |
| GET /api/me | Firebase ID token | `{"uid":"検証済みuid","authenticated":true}` |
| POST /api/google-calendar/connect | Firebase ID token | Google認可URL（開始ブラウザーにCookie設定） |
| GET /api/google-calendar/callback | one-time state＋署名済みGoogle本人確認（Cookieは追加検証） | フロントへ303リダイレクト |
| GET /api/google-calendar/status | Firebase ID token | `{"connected":true/false}` |
| POST /api/google-calendar/disconnect | Firebase ID token | 保存削除・可能ならGoogle revoke |

`Authorization: Bearer <Firebase ID token>` をFirebase Admin SDKの `verifyIdToken()` へ渡します。SDKが署名、期限、issuer、audience（Firebase project ID）、subjectを検証します。検証済みuidだけを返し、クエリーのuidなどは使用しません。CalendarのGoogle access tokenやGoogle ID tokenはFirebase ID tokenの代わりになりません。

ヘッダー欠落・形式不正・不正／期限切れtokenは401。検証サービスの障害は503で、検証失敗時にAPIを許可しません。初期段階では `checkRevoked` は有効にしていないため、Firebaseセッションの失効／ユーザー無効化の即時検出は行いません。ログアウト前に発行されたtokenは有効期限まで検証可能です。将来のトークン保存APIでは失効確認と必要なIAM権限を検討してください。

許可originは `https://uchidats.github.io` と `http://localhost:8000` の完全一致です。Authorizationヘッダーを許可するGET／POSTのOPTIONSプリフライトをエンドポイントごとに扱い、Cookieを使うconnectのためcredential付き通信を許可します。許可外originは403で、ワイルドカードは使用しません。Originなしのcurl等は利用できますが認証は省略できません。CORSはユーザー認証の代わりにはなりません。

## Google Cloud Consoleでの準備

1. Firebaseと同じGoogle Cloudプロジェクト `ophthalconf` を選択し、課金を有効にします。
2. Cloud Run Admin API、Cloud Build API、Artifact Registry APIを有効にします。既存Firebase AuthenticationのGoogleプロバイダー設定を維持します。FirestoreやGoogle Calendar APIの追加設定は今回不要です。
3. 実行用サービスアカウント `ophthalconf-backend` を作成します。JSON鍵を発行しません。今回は公開鍵によるID token検証のみで、Firestore・Secret Manager等のアクセスロールは不要です。EditorやFirebase Admin等の広いロールを付与しません。
4. デプロイ担当者にはCloud Run Source Developer、Service Usage Consumerと、実行用サービスアカウントへのService Account User権限が必要です。ソースビルド用アカウントにはCloud Run Builderが必要です。公開アクセスのIAM変更には追加のCloud Run管理権限が必要になる場合があります。組織の管理者に必要な範囲だけ付与してもらってください。
5. Cloud Runサービスをブラウザーから呼べる公開入口にします。Cloud Run IAM認証とFirebase認証は別であり、Firebase ID tokenはCloud Run IAMの呼び出し用tokenではありません。OPTIONSとhealthを通し、`/api/me` の認証はアプリで検証します。

## 将来の骨格デプロイ手順（今回は実行しません）

以下は以前のAPI骨格用手順です。本番起動にはSECRET_PROVIDER=secret-managerの指定が必要です。OAuth有効化には両Storeのfirestore指定、HTTPS、Emulator未使用も必要です。Secret登録／IAMと実アクセス試験、本番Firestore／Rules・TTL、複数インスタンス試験は別途行ってください。

Google Cloud CLIを導入し、プロジェクトルートで実行します。

```powershell
gcloud auth login
gcloud config set project ophthalconf
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud iam service-accounts create ophthalconf-backend --display-name="OphthalConf backend"
```

IAM準備後、backendだけをアップロードします。

```powershell
gcloud run deploy ophthalconf-backend --source ./backend --region asia-northeast1 --service-account ophthalconf-backend@ophthalconf.iam.gserviceaccount.com --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=ophthalconf,TOKEN_STORE=firestore,OAUTH_SESSION_STORE=firestore,SECRET_PROVIDER=secret-manager,GOOGLE_OAUTH_CLIENT_SECRET_NAME=ophthalconf-google-oauth-client-secret --allow-unauthenticated
```

既にアカウント／APIが用意されている場合、その作成手順は不要です。デプロイ時のIAM／組織ポリシーに応じて管理者の設定が必要です。Buildpacksがpackage.jsonとpackage-lock.jsonからビルドし、npm startで起動します。PORTはCloud Runから与えられ、0.0.0.0で待ち受けます。

Admin SDKは `applicationDefault()` を使用し、Cloud Runに割り当てた実行用サービスアカウントのADCを利用します。`FIREBASE_PROJECT_ID` は公開の識別子で、フロントのFirebaseプロジェクトと一致させてください。Cloud RunではGOOGLE_APPLICATION_CREDENTIALSを設定せず、service account JSONを置きません。署名検証用公開鍵の取得にGoogleへの外向き通信が必要です。

## Secrets

ローカルOAuth用client secretはenv Provider、本番はSecret Manager Providerで起動時に取得します。対象secret単位のSecret Accessorを付与する前提ですが、今回IAM実設定や実アクセスは行いません。client secretを通常のCloud Run環境変数に直書きしません。refresh tokenは既定でメモリ保存し、明示的な設定でFirestoreへ切替可能です。本番への書込は今回は行いません。

`.gitignore`と`.gcloudignore`は依存フォルダ、環境設定、既知の鍵ファイル名等を除外します。任意の名前の秘密ファイルを完全に判別するものではないため、秘密情報ファイルをリポジトリ内に置かないでください。リクエストのAuthorization、ID token、claimsやSDKエラー全文をログへ出力しません。

## ローカルテスト

Node.js 24を使用します。フロントは8000、バックエンドは8080です。

```powershell
cd backend
npm ci
npm test
gcloud auth application-default login
$env:FIREBASE_PROJECT_ID = "ophthalconf"
$env:PORT = "8080"
npm start
```

ADCはCLIのユーザープロファイルに保存され、Gitへ追加しません。`gcloud auth login` とADC設定は別です。Firebase Auth emulatorは未対応で、FIREBASE_AUTH_EMULATOR_HOSTが設定されている場合は起動を拒否します。

別ターミナルで：

```powershell
Invoke-RestMethod http://localhost:8080/health
curl.exe -i http://localhost:8080/api/me
curl.exe -i -H "Authorization: Bearer invalid-test-token" http://localhost:8080/api/me
curl.exe -i -X OPTIONS -H "Origin: http://localhost:8000" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Authorization" http://localhost:8080/api/me
curl.exe -i -H "Origin: https://example.org" http://localhost:8080/health
```

順に200、401、401、204、403を期待します。フロントを `http://localhost:8000/` で開いてFirebaseログインし、ブラウザーConsoleで：

```javascript
await OphthalAuth.testBackend("http://localhost:8080")
// { uid: Firebaseのuid, authenticated: true }
```

Cloud Runへデプロイ後は、引数を発行された `https://...run.app` のoriginに変更します。バックエンドURLはConsole呼び出し時に指定し、UIや設定ファイルにはまだ固定しません。ポート8000のフロントHTTPサーバーはリポジトリルートから起動してください。

疎通関数はログイン中のユーザーからID tokenを取得し、Authorizationにだけ設定してGETします。HTTPS（ローカルのみHTTP可）、15秒タイムアウト、リダイレクト拒否、レスポンスuidの一致確認を行います。返り値にはuidとauthenticatedだけを含めます。tokenをConsoleへ出力する必要はありません。

未ログインで関数を呼ぶとnot-signed-inで通信しません。401はbackend-http-401として報告します。CORS拒否・通信障害はfetchの例外になります。Firebaseのログイン状態やGoogle Calendar OAuth接続は変更しません。

プロジェクトルートからのフロント回帰テスト：

```powershell
node scratch/test_backend_client.js
node scratch/test_firebase_auth.js
node scratch/test_google_calendar.js
```

バックエンド自動テストはHTTP境界、OAuth交換、state／Cookie／PKCE、UID分離、保存・解除をモックで確認し、実Admin SDKによる不正JWT拒否も確認します。実Googleの同意・refresh token取得はOAUTH-LOCAL.mdの手順で確認してください。Cloud RunのADCは今回未検証です。

公式資料：[ID token検証](https://firebase.google.com/docs/auth/admin/verify-id-tokens)、[Admin SDKとADC](https://firebase.google.com/docs/admin/setup)、[Node.jsソースデプロイ](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)、[IAM](https://docs.cloud.google.com/run/docs/securing/managing-access)、[公開入口](https://docs.cloud.google.com/run/docs/authenticating/public)。
