# 共有OAuth session

## 切替

`OAUTH_SESSION_STORE`未指定はmemoryです。memoryでは従来どおり単一プロセスの検証用で、再起動するとsessionが消えます。

```powershell
$env:OAUTH_SESSION_STORE = "memory"
# または共有sessionとtoken保存の両方をFirestoreへ
$env:OAUTH_SESSION_STORE = "firestore"
$env:TOKEN_STORE = "firestore"
```

Firestore sessionにはFirestore TokenStoreを組み合わせます。開始をインスタンスA、callbackをインスタンスBで処理しても、同じFirebaseプロジェクト／データベース／OAuth Client設定なら動作します。sticky sessionやインスタンス内Mapの引継ぎは不要です。

Storeの基本APIは非同期save(stateId, sessionData)、consume(stateId, optionalBrowserNonce)、delete(stateId)です。共有競合を防ぐためrotate(uid)、runIfCurrent(uid, generation, work)、release(uid, generation)も用意しています。

## コレクション

`oauthSessions/{stateId}` に以下の明示的なフィールドだけを保存します。

| フィールド | 用途 |
| --- | --- |
| uid | Firebase検証済みユーザー |
| googleSubject | Firebase ID token内のGoogle provider ID |
| codeVerifier | PKCE verifier |
| browserDigest | 開始Cookie nonceのSHA-256（生nonceは保存しません） |
| generation | この接続開始のランダムな世代ID |
| createdAt / expiresAt | Firestore Timestamp |
| frontendUrl | 開始時に許可した戻りURL |
| clientId / redirectUri | インスタンス間のOAuth設定一致確認 |

refresh token、access token、Client Secret、authorization code、Google ID tokenはsession documentに保存しません。stateは256ビット乱数のopaque IDで、uid等を含みません。

`oauthConnectionGenerations/{uid}` はgeneration・updatedAtと、解除処理中のみleaseUntilを保存します。これはcallback後のtoken保存／解除の整合性のためで、秘密のtoken等は含みません。FirestoreTokenStoreのgoogleCalendarTokensコレクションとは分離しています。

## 期限とone-time use

sessionは10分で失効します。consume transactionはsessionを読み、expiresAt、現在世代、Cookie（存在する場合）を確認して同じtransactionで削除します。並行callbackは1件だけ取得可能で、2件目以降は拒否します。期限切れdocumentもその場で削除します。

将来、collection group `oauthSessions` の `expiresAt` にFirestore TTLを有効にできます。TTLは遅延削除なので、認証判定には使いません。アプリが独立して期限を検証します。今回、本番TTLポリシーは変更していません。

消費後のGoogle通信やtoken保存が失敗してもsessionは再利用しません。もう一度connectから開始してください。

## Cookieなしcallbackの本人確認

stateを持っているだけで、別アカウントのCalendarをFirebase uidに紐付けられる構成にはしません。

1. connectはFirebase ID token必須です。検証済み `firebase.identities['google.com']` をsessionへ保存します。Google provider IDのないユーザーは403です。
2. Calendarの2スコープに加えて **openid** を要求します。Google Auth PlatformのData Access／同意画面で追加を確認してください。email・profileスコープは追加しません。
3. token交換で返るGoogle ID tokenをgoogle-auth-libraryで署名・issuer・audience・期限検証し、subが開始ユーザーのGoogle provider IDと一致することを必須にします。ID tokenがない／不正／別Googleアカウントなら保存せず失敗します。
4. Cookieが届いた場合は従来のnonceも検証します。誤ったCookieは拒否します。Cookieがない場合でも上記の署名済みGoogle本人確認を省略しません。

サーバー方式ではFirebaseログインと同じGoogleアカウントで同意してください。既存ブラウザー直接型Google Calendarの処理は変更していません。Google本人確認追加後の実Googleフローは再確認が必要です。既存保存tokenの自動移行・削除は行いません。

CookieはHttpOnly・SameSite=Lax・callbackパス限定、HTTPSではSecureです。GitHub Pages→Cloud Runで開始Cookieが第三者Cookie制約により保存されなくても、callbackは共有state＋Google本人確認で処理できます。Cookieを省略するだけのセキュリティ緩和は行いません。

## 接続／解除の競合

開始ごとにFirestoreで新しいgenerationを発行します。callback消費時にも確認し、token保存時にはgenerationの読取とtoken書込を同じFirestore transactionにします。別インスタンスの新しいconnect／disconnectに追い越されたcallbackは保存できません。

disconnectも世代を更新して古いcallbackを無効化します。Google revoke中は60秒の共有leaseを置き、新しいconnect／disconnectを409で拒否します。解除後にleaseを解放し、プロセスが途中停止した場合は最大60秒で再試行可能になります。保存削除も世代検証と同じtransactionで行い、新しい接続を古い解除が消すことを防ぎます。

Googleへの通信は15秒でタイムアウトします。外部Google revokeとFirestoreは一つの分散transactionにはできません。provider側の遅延・障害やプロセス停止後の再試行は本番検証が必要です。Firestore失敗時は成功を返さず、秘密値を含まない一般エラーで失敗します。

## Emulatorテスト

リポジトリルートで：

```powershell
firebase emulators:start --only firestore --config backend/emulator/firebase.json --project demo-ophthalconf
```

別ターミナルで：

```powershell
cd backend
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085"
$env:FIREBASE_PROJECT_ID = "demo-ophthalconf"
npm run test:sessions:emulator
npm run test:emulator
npm test
```

sessionテストはsave/delete、8件の同時consumeのone-time use、期限切れ、replay、Store／サービス再生成後のCookieなしcallback、token永続保存を実Emulatorで確認します。Google通信・Google本人確認は合成fixtureのモックです。テスト後は自分が作成したdocumentだけを削除します。localhostとdemo-プロジェクト以外ではテスト実行を拒否します。

今回、実Googleの追加openidフローやCloud Run上の処理はまだ検証していません。ローカル実Google検証はOAUTH-LOCAL.mdに従い、同じFirebase Googleアカウントを選択してください。

## IAM・Rules・秘密情報

oauthSessions、oauthConnectionGenerations、googleCalendarTokensはAdmin SDK専用です。クライアントSDKのread/writeを全て禁止します。AdminはRulesをバイパスするため、IAMも設定します。広い別matchのallowがあれば明示denyだけでは防げない点にも注意してください。

Firestore実行用アカウントにはdocumentとtransaction操作の権限が必要です。既存のroles/datastore.userまたは必要な操作に絞ったロールを検討してください。sessionにPKCE verifierを保存するため、token collectionと同様にアクセスを制限します。

アプリはstate、PKCE verifier、authorization code、ID token、Client Secret、refresh tokenをログやエラーへ出しません。callbackのレスポンスはno-store/no-referrerです。ただしCloud Run／プロキシのアクセスログにはcallback queryが入り得るため、本番で記録・マスキング方針を設定してください。Emulator debugログ・exportもGitやフロントHTTP配信範囲へ置かないでください。既に存在するrootのfirestore-debug.logは削除せず、Git除外を追加しました。

## 本番へ残る作業

共有session／世代の実装ができたため、両Storeがfirestore・HTTPS・Emulator未使用の設定なら本番用構成チェックを通ります。今回はデプロイや本番Firestore書込は行いません。

Secret Manager Providerは実装済みです。[SECRET-PROVIDERS.md](SECRET-PROVIDERS.md) を参照してください。残る作業はSecret登録・対象SecretへのIAMと実アクセス、Provider改修後のCloud Run／複数インスタンスOAuth試験、Rules・TTL・callback設定、外部revokeの障害／lease回復試験、秘密ログ保護です。KMS・Calendar APIのバックエンド読取／追加は別段階です。

公式資料：[Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)、[TTL](https://docs.cloud.google.com/firestore/native/docs/ttl)、[Google ID token検証](https://developers.google.com/identity/sign-in/web/backend-auth)。
