# Firebase Googleログイン

## Firebase Console

1. OphthalConf用Firebaseプロジェクトを作成または選択し、プロジェクト設定でWebアプリを登録します。PC・スマホとも同じプロジェクトの設定を使います。
2. Authentication → Sign-in methodでGoogleを有効にし、プロジェクトの公開名とサポート用メールを設定します。独自のメール／パスワード認証は不要です。
3. Authentication → Settings → Authorized domainsに `uchidats.github.io` と `localhost` を追加します。別ドメインで公開する場合はそのホスト名も登録します（URLのパスやポートは含めません）。2025年4月28日以降作成のプロジェクトではlocalhostが初期登録されません。
4. プロジェクト設定 → マイアプリ → WebアプリのFirebase SDK設定から、下記の値をコピーします。Firebase Hostingの導入は不要です。

## firebase-config.js

| キー | 入力する値 |
| --- | --- |
| apiKey | Webアプリ設定のapiKey |
| authDomain | Webアプリ設定のauthDomain（通常 `プロジェクトID.firebaseapp.com`） |
| projectId | FirebaseプロジェクトID |
| appId | Firebase WebアプリID（OAuth Client IDとは別） |

Authenticationにはこの4項目を使います。storageBucket、messagingSenderId、measurementIdは今回不要です。Web configは公開設定です。秘密鍵、service account JSON、client secretは入力しません。

未入力では「Googleログインは準備中です。」と表示され、ログインボタンは無効です。既存のイベント一覧とCalendar連携は利用できます。SDKは設定済みの場合だけ公式CDNからApp/Authを読み込みます（12.19.0に固定）。

## 認証設計

`OphthalAuth.getUid()` はFirebase認証で確認したuid、未ログインではnullを返します。`snapshot()`と`subscribe(callback)`で状態を参照・監視できます。初期化中はphaseがloadingなので、復元完了前のnullを未ログイン確定と扱わないでください。

同じFirebaseプロジェクト・Googleアカウントなら、別端末でも同じuidになります。各端末の初回ログインは必要です。ユーザー設定・学会履歴は従来どおりブラウザー保存で、端末間同期はまだありません。

Firebase SDKのbrowserLocalPersistenceとonAuthStateChangedを使用します。同じブラウザー・同じoriginでリロード後やブラウザー再起動後も復元します。プライベートモード、ストレージ削除、ブラウザーの制限、認証失効の場合は再ログインが必要になることがあります。SDK自身がFirebaseセッションをブラウザーに保存します。アプリ側でトークンをコピーして保存する処理はありません。

PC・スマホとも、クリック直後にsignInWithPopupを呼びます。ポップアップがブロックされた場合は許可して再試行してください。GitHub Pagesでの第三者ストレージ制限に配慮し、redirect方式への自動切替は行いません。

FirebaseログインとGoogle Calendar OAuthは独立しています。FirebaseログインはCalendar接続を開始せず、Calendar権限も要求しません。ログアウトしてもCalendar接続は維持されます。共用端末ではCalendar側も「解除」してください。両方で異なるGoogleアカウントを選ぶことも可能です。

将来のバックエンド用に `OphthalAuth.getIdToken()` を用意しています。今回は送信・保存しません。将来Cloud Runで使う際はFirebase ID tokenをサーバーで検証し、検証済みuidを利用してください（フロントから渡されたuidだけを信用しません）。Firestore、Cloud Run、Google Calendar refresh token保存は今回未実装です。

## ローカル検証

1. Firebase Consoleを設定し、firebase-config.jsの4項目を入力します。
2. リポジトリで `python -m http.server 8000` を実行し、`http://localhost:8000/` を開きます。file://では認証しません。
3. 未ログイン時の「Googleでログイン」を確認し、押してGoogleアカウントを選択します。表示名（未設定ならメール）とログアウトボタンを確認します。Consoleで `OphthalAuth.getUid()` を確認します。トークンは表示・共有しないでください。
4. ページをリロードし、同じuidとログイン表示が復元されることを確認します。ブラウザー再起動と同じoriginの別タブでも確認します。
5. ログアウト後に `getUid()` がnullになり、リロードしてもログアウト状態であることを確認します。
6. 1280、1024、980、480、360、320px幅で、未ログイン・長い表示名／メール・ログアウト状態のヘッダーに横はみ出しがないことを確認します。実スマホでもGoogleのポップアップログインを確認します。
7. スマホとPCで同じ公開URL・Firebaseプロジェクトに同じGoogleアカウントでログインし、uidが一致することを確認します。
8. Firebaseのログイン・ログアウト前後に、Calendar OAuth接続、空き／一部重複／重複、直接登録→GET再確認→確認リンク、ICSで登録済みにならないこと、フィルターと学会表示を確認します。Calendar接続はリロード後に再接続が必要な既存仕様です。

自動テスト（実Googleアカウントを使わない）：

```text
node scratch/test_firebase_auth.js
node scratch/test_firebase_auth_browser.js
node scratch/test_google_calendar.js
node scratch/test_calendar_conflict_times.js
node scripts/check-conference-regressions.js
```

モックテストは実Firebaseの同意画面・サーバー側uid・実ブラウザーでの永続化保証を検証しません。これらは設定入力後に上記手動手順で確認します。

公式資料：[Googleログイン](https://firebase.google.com/docs/auth/web/google-signin)、[状態の永続化](https://firebase.google.com/docs/auth/web/auth-state-persistence)、[localhost設定](https://firebase.google.com/docs/auth/faq-and-troubleshooting)、[CDN SDK](https://firebase.google.com/docs/web/alt-setup)、[redirect制約](https://firebase.google.com/docs/auth/web/redirect-best-practices)。
