# Firestore TokenStore

## 切替と保存構造

`TOKEN_STORE` 未指定はmemoryです。`TOKEN_STORE=memory`も同じです。`TOKEN_STORE=firestore`を明示した場合だけAdmin Firestore clientを取得します。誤った値や空文字は起動エラーで、Firestoreへ暗黙に切替しません。依存追加は不要です（既存firebase-adminを使用）。

共通の非同期インターフェース：saveRefreshToken(uid, token)、getRefreshToken(uid)、deleteRefreshToken(uid)、hasRefreshToken(uid)。以前の3メソッドのみのカスタムTokenStoreでもstatusは互換フォールバックで動作します。

デフォルトデータベースの `googleCalendarTokens/{Firebase uid}` に以下だけを保存します。

```text
refreshToken: string
createdAt: Firestore Timestamp
updatedAt: Firestore Timestamp
provider: "google"
```

transactionで初回createdAtを設定し、再保存時はcreatedAtを維持します。updatedAtにはサーバー時刻を使用します。access token、authorization code、client secret、Googleのレスポンス全体は保存しません。既存データを広げてコピーする処理もありません。

Admin初期化はfirebase.jsのgetAdminAppで共用します。Auth／Firestoreは同じ名前付きアプリ・project IDを使います。異なるproject IDでの再初期化を拒否します。ADCを使い、service account JSONをコードに置きません。FIRESTORE_EMULATOR_HOSTが設定されているとAdmin SDKが自動的にEmulatorへ接続します（http://を付けません）。

今回、実Firestoreへ接続・書き込みはしていません。検証にはモック／ローカルEmulatorのみを使ってください。

## ローカルEmulator

Firebase CLIと対応するJDKを別途用意します。リポジトリルートで：

```powershell
firebase emulators:start --only firestore --config backend/emulator/firebase.json --project demo-ophthalconf
```

別ターミナルで：

```powershell
cd backend
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085"
$env:FIREBASE_PROJECT_ID = "demo-ophthalconf"
npm run test:emulator
```

このテストは合成fixtureだけを保存し、後で削除します。ローカルhostとdemo-プロジェクト以外では実行を拒否し、実Firestoreへフォールバックしません。backendは8080、Firestore Emulatorは8085なので競合しません。Emulatorを再起動すると、import/exportを使わない限りデータは消えます。

実Firebaseログイン・既存OAuthと組み合わせる場合、上記demoプロジェクトでは本番Firebase ID tokenのaudienceが一致しません。Emulatorを `--project ophthalconf` で起動し、バックエンドを次の設定にします。**FIRESTORE_EMULATOR_HOSTを必ず維持し、実Firestoreには接続しません。**

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085"
$env:FIREBASE_PROJECT_ID = "ophthalconf"
$env:TOKEN_STORE = "firestore"
$env:PORT = "8080"
# GOOGLE_OAUTH_* と FRONTEND_URL は OAUTH-LOCAL.md の手順で設定
npm start
```

OAuth成功後にstatus=trueを確認し、**Firestore Emulatorを動かしたまま**backendだけを停止・再起動します。同じFirebaseユーザーのstatus=trueが維持されることを確認してください。`OAUTH_SESSION_STORE=firestore`も指定すると、OAuth途中のsessionも再起動を越えて保持できます。既定のmemory sessionでは途中の再起動後にOAuthをやり直します。

メモリへ戻す場合：

```powershell
$env:TOKEN_STORE = "memory"
```

MemoryTokenStoreのデータをFirestoreへ自動移行する処理はありません。切替後は一度再連携してください。

## クライアントアクセスとRules

フロントにFirestore SDKやtoken読取APIを追加していません。statusはconnectedの真偽値のみです。FirestoreTokenStoreはバックエンドAdmin SDKだけで使用します。

本番Rulesへ統合する場合の案：

```text
match /googleCalendarTokens/{uid} {
  allow read, write: if false;
}
```

Firebase Admin SDKはSecurity Rulesをバイパスし、IAMで制御されます。Rulesの明示denyは、別の広いmatchでのallowに優先しません。`/{document=**}`などで認証済みユーザーを一括許可しているルールがあれば、token collectionを許可対象から除外する必要があります。本番へRulesをデプロイする前に全ルールを確認し、クライアントSDKで認証あり／なしのread/write拒否をテストしてください。

このリポジトリでは従来本番Rulesを管理していませんでした。追加のemulator/firestore.rulesはEmulator専用で全クライアントアクセスを拒否します。本番Rulesはまだ変更・デプロイしていません。

## 将来の本番IAM

Cloud Run実行サービスアカウントへFirestoreデータ読取／書込用の `roles/datastore.user` を付与する構成が基本です。可能ならデータベース単位のIAM条件や、必要なtransaction／document読取・書込・削除だけのカスタムロールで範囲を狭めます。標準roleはcollection単位のアクセス隔離を保証しません。Editor／Owner／Firebase Adminをこの用途で付与する必要はありません。

Firestore Native modeデータベースの作成・リージョン・課金、Firestore APIの有効化、実行アカウントのADC、Rulesを本番化前に設定します。今回IAM変更も実Firestore作成も行っていません。Secret Managerのsecretアクセス権限と将来KMSの権限は別途必要ですが、今回は接続しません。

## 解除とエラー

disconnectは接続世代を更新し、保存tokenを読み、Google revokeを試み、その後finallyで保存を削除します。共有session使用時は世代確認と削除を同じtransactionにし、revoke中の共有leaseも使います。revoke失敗でも削除し、削除成功時はconnected=false、revoked=falseを返します。保存済みtokenがない場合も削除は冪等です。

Firestoreの読取失敗でも削除を試みます。Firestore削除自体が失敗した場合は500を返し、解除成功とは表示しません。接続状態を消せたと偽らず、ストレージ復旧後に再度解除してください。statusの読取失敗も500で、falseと誤表示しません。

SDK／codecのエラーを `token_store_unavailable` に置き換え、元のエラー本文・cause・tokenをログやAPIへ流しません。status／disconnectのAPIエラーは既存の一般エラーだけです。callback保存失敗はcalendar_oauth=failedとなります。

## 暗号化の拡張点

FirestoreTokenStoreへ `codec: { encode(token, uid), decode(value, uid) }` を注入できます。両方非同期で、保存文字列と読取値を変換します。既定は平文（今回許可されたサーバー専用保存）です。KMS等を使う場合は暗号文・バージョン情報を文字列としてエンコードし、decodeで復号する実装へ差し替えます。hasRefreshTokenは存在だけを確認し、復号しません。KMSは未実装です。

## テストとCloud Runへの残作業

`npm test`はFirestoreをモックし、save/get/has/delete、createdAt維持、新Storeによる再読取、codec、保存失敗時の秘密の非露出、APIのboolean-only、revoke失敗でも解除、Auth／Firestore初期化共用を確認します。実Emulatorは別の `npm run test:emulator` で任意に検証します。

共有state／接続世代、Cookie欠落時のGoogle本人確認を追加しました。[OAUTH-SESSIONS.md](OAUTH-SESSIONS.md) を参照してください。Secret Manager Providerも実装済みで、[SECRET-PROVIDERS.md](SECRET-PROVIDERS.md) に設定をまとめています。本番では両Storeをfirestoreにし、Secret登録・IAM・Rules・TTL、callback URI、秘密ログ保護、実サービスの接続／複数インスタンス検証を整えます。Google Calendar APIのバックエンド読取・追加はまだありません。

Emulatorのdebugログやexportにtokenが含まれる可能性があります。実tokenを使う場合は、ログ・export保存先をフロントHTTPサーバーの配信範囲外にしてください。秘密ファイルはGit除外だけでなくHTTP配信も防ぐ必要があります。.env、credentials、secrets、鍵、.firebase、emulator-data等はGit／Cloudデプロイ対象から除外しています。

公式資料：[Emulator接続](https://firebase.google.com/docs/emulator-suite/connect_firestore)、[RulesとAdminの違い](https://firebase.google.com/docs/firestore/security/test-rules-emulator)、[Firestore IAM](https://docs.cloud.google.com/firestore/docs/security/iam)。
