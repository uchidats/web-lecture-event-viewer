# Google OAuth Client Secretの取得

## Provider切替

`SECRET_PROVIDER`未指定はenvです。ローカルでは従来どおりGOOGLE_OAUTH_CLIENT_SECRETを環境変数で設定します。envモードでSecret Manager clientを生成したり、APIへアクセスしたりしません。

```powershell
$env:SECRET_PROVIDER = "env"
$env:GOOGLE_OAUTH_CLIENT_SECRET = [System.Net.NetworkCredential]::new("", (Read-Host "Google Web OAuth Client Secret" -AsSecureString)).Password
```

本番では次を明示します。

```text
SECRET_PROVIDER=secret-manager
GOOGLE_OAUTH_CLIENT_SECRET_NAME=ophthalconf-google-oauth-client-secret
```

EnvironmentSecretProvider／GoogleSecretManagerProviderは共通の非同期getGoogleOAuthClientSecret()を持ちます。oauth-config.jsのloadOAuthConfigが公開OAuth設定を検証した後にProviderを呼び、取得値をOAuthへ渡します。通常リクエストからProviderを呼びません。startは非同期になり、秘密取得に成功するまでPORTで待ち受けません。

## Secret Manager設定

Secret名の既定値はophthalconf-google-oauth-client-secretです。短いSecret IDだけを指定し、projects/...形式は受け付けません。取得resourceは `projects/{project}/secrets/{name}/versions/latest` です。

projectはGOOGLE_OAUTH_SECRET_PROJECT_ID、FIREBASE_PROJECT_ID、GOOGLE_CLOUD_PROJECTの順で選びます。通常はFirebaseと同じophthalconfです。別プロジェクトのSecretを使う場合だけGOOGLE_OAUTH_SECRET_PROJECT_IDを追加してください。

@google-cloud/secret-manager SDKはADCで認証します。Cloud Run実行サービスアカウントを使用し、JSON鍵や明示credentialsを渡しません。Client IDは公開識別子なので引き続きGOOGLE_OAUTH_CLIENT_IDを使います。

起動時の取得Promiseと値をプロセスメモリ内でキャッシュします。同時取得でもAPI呼出は1回です。APIは10秒タイムアウトで、この取得レイヤーで自動再試行はしません。失敗もキャッシュして起動を拒否し、環境変数へのフォールバックはしません。取得後はSDK clientをcloseします。latestを更新しても既存プロセスの値は変わらないため、Secret更新後は新revision／再起動で反映します。OAuth処理中の旧secretの有効性も考慮してローテーションしてください。

## 本番起動ガード

NODE_ENV=productionまたはK_SERVICEがある場合、env Providerを拒否します。未指定もenvなので同様です。Cloud RunではSECRET_PROVIDER=secret-managerを必ず指定してください。

NODE_ENV=productionでは、OAuth設定の有無に関係なく起動冒頭でTOKEN_STORE=firestore、OAUTH_SESSION_STORE=firestore、SECRET_PROVIDER=secret-managerを必須検証します。不足・不正な場合はPORT待受やSecret取得より前に終了し、設定名と期待値だけを表示します。

secret-manager指定だけでGoogle OAuthを有効にすることはありません。Client ID／redirect URIが未設定ならOAuthは無効でSecret取得APIは呼びません。公開設定の一部だけ入力した場合は、Secret API呼出前に起動を拒否します。空／欠落payload、アクセス拒否、通信障害、SDK例外はoauth_secret_unavailableに置き換え、元の本文・causeを保持しません。起動ログも固定の一般メッセージだけで、secretやSDKエラー全文を出しません。

## 本番IAM（今回は設定しません）

Secret Manager APIを有効化し、対象Secretを作成してGoogle OAuth Web ClientのClient Secretだけを登録します。値はConsole等の安全な入力手段で登録し、リポジトリ内のファイルやコマンド履歴へ置きません。

実行アカウントには **対象Secret単位** でroles/secretmanager.secretAccessorを付与します。将来の設定例（未実行）：

```powershell
gcloud secrets add-iam-policy-binding ophthalconf-google-oauth-client-secret --project ophthalconf --member="serviceAccount:ophthalconf-backend@ophthalconf.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

Firestore用roles/datastore.userとは別権限です。プロジェクト全体へのSecret AccessorやEditor／Owner付与は不要です。Secret作成担当者の権限と実行アカウントの読取権限も分離します。

## Cloud Run用の公開環境変数

| 変数 | 本番設定 |
| --- | --- |
| NODE_ENV | production |
| SECRET_PROVIDER | secret-manager |
| GOOGLE_OAUTH_CLIENT_SECRET_NAME | ophthalconf-google-oauth-client-secret |
| GOOGLE_OAUTH_SECRET_PROJECT_ID | 任意。同一プロジェクトなら省略 |
| FIREBASE_PROJECT_ID | ophthalconf |
| GOOGLE_OAUTH_CLIENT_ID | Google Web OAuth Client ID |
| GOOGLE_OAUTH_REDIRECT_URI | https://BACKEND_HOST/api/google-calendar/callback |
| FRONTEND_URL | https://uchidats.github.io/web-lecture-event-viewer/ |
| TOKEN_STORE | firestore |
| OAUTH_SESSION_STORE | firestore |
| PORT | Cloud Runが設定 |

GOOGLE_OAUTH_CLIENT_SECRETを通常のCloud Run環境変数へ登録しません。GOOGLE_APPLICATION_CREDENTIALS、FIRESTORE_EMULATOR_HOST、FIREBASE_AUTH_EMULATOR_HOSTも本番には設定しません。実行サービスアカウントはCloud Runのサービス設定で指定します。

## テスト

backendでnpm testを実行します。新テストのcredential相当値は実行時に生成した合成値で、実Googleに送信しません。env／Secret Manager切替、API単発取得と並行cache、OAuth交換への値渡し、空payload・SDK障害の秘匿、秘密がログへ出ないこと、本番env拒否の実プロセス起動を確認します。Secret Manager SDKの通信はモックです。

実Secret登録、IAM変更、実Secret Manager読取、Cloud Runデプロイ、本番Firestore書込は今回行いません。KMSも未実装です。

## 本番前の残作業

Secret Manager API有効化・Secret登録・対象SecretへのIAM、実行アカウントADCでの読取試験、Cloud Run revisionでの起動・複数インスタンスOAuth検証、Secret更新／権限取消／通信障害の運用試験、既存のFirestore Rules／TTL・callback・秘密ログ保護を確認してください。秘密値を表示するCLIコマンドやNetworkデータの共有は不要です。

公式資料：[Secret versionアクセス](https://docs.cloud.google.com/secret-manager/docs/access-secret-version)、[Secret単位のIAM](https://docs.cloud.google.com/secret-manager/docs/access-control)。
