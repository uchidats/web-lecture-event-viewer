# Google Calendar 第1段階

## 設定

1. Google Cloud Consoleでプロジェクトを作成または選択し、Google Calendar APIを有効にします。
2. Google Auth Platformのブランディング、対象（Audience）、データアクセスを設定します。外部ユーザー向けでテスト中の場合、利用するGoogleアカウントをテストユーザーへ追加してください。
3. OAuthクライアントを「ウェブ アプリケーション」として作成します。「承認済みのJavaScript生成元」に `https://uchidats.github.io` を追加します。リポジトリのパスや末尾の `/` は含めません。
4. ローカル検証には `http://localhost` と `http://localhost:8000` も追加します。`file://` は実認証には使用しません。GISのポップアップ型トークンモデルを使用するため、アプリ側のリダイレクトURIやClient Secretは不要です。
5. データアクセスには次のスコープを設定します。
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
6. `google-calendar-config.js` の `clientId: "YOUR_GOOGLE_CLIENT_ID"` を、発行された `....apps.googleusercontent.com` に置き換えます。設定箇所はここだけです。`calendarId` は第1段階では `primary` のままにします。

Client IDは公開識別子です。Client Secret、秘密鍵、アクセストークン、`.env` は追加しないでください。一般公開時はGoogleが求める同意画面の情報・スコープ審査をConsoleの案内に従って完了してください。

公式資料： [GISトークンモデル](https://developers.google.com/identity/oauth2/web/guides/use-token-model)、[JavaScript生成元の設定](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)、[予定取得](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)、[予定登録](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)。

## 動作と制限

- Googleのプライマリカレンダーを参照・登録します。共有カレンダーなど他のカレンダーの横断検索は今回の対象外です。
- トークンと取得予定はメモリのみです。タイトル・予定内容・トークンをlocalStorage、サーバー、GitHubに保存しません。従来の利用先設定はlocalStorageに残します。
- リロード・認証期限切れ後は「Google Calendarに接続」から再接続します。「解除」はメモリを破棄し、Googleアカウント側の同意を取り消しません。
- 取得は開催期間を含む四半期ごとにまとめ、ページングに対応します。同じ期間はセッション中のキャッシュを再利用します。外部で変更した予定は設定モーダルの「予定を再取得」で更新できます。
- 重複時間を合算し、イベント時間の80%以上が予定で埋まる場合を「重複」、それ未満を「一部重複」とします。重なる予定同士の時間は二重計上しません。透明な予定・本人が辞退した予定は除外します。
- 複数日学会は開始日から終了日までの期間で判定し、予定表示は最大3件です。表示時刻は日本時間です。
- 国内はAsia/Tokyo、海外はイベントまたは会場の明示されたIANAタイムゾーンを利用します。不明・不正な時刻やDSTの曖昧な時刻は推測せず、要確認と表示します。会期のみのイベントは終日扱いです。
- 登録済み判定は `extendedProperties.private.ophthalconfEventId`（または説明欄の `OphthalConf-ID:`）と開始・終了日時を照合します。以前ICSで追加した予定にはこのIDがなく、実データの登録済み判定には含まれません。
- 接続済みGoogleへの直接登録だけが実登録を確認します。ICSのダウンロード後に実際のインポートが完了したかは確認できません。Google未接続時はICSへフォールバックします。ICS生成内容、iCloudのダミーデータ構造は維持しています。

## 自動テスト

リポジトリのルートで実行します。

```text
node --check google-calendar-config.js
node --check google-calendar.js
node --check script.js
node scratch/test_google_calendar.js
node scripts/check-conference-regressions.js
node scratch/test_google_calendar_browser.js
node scratch/test_mobile_cards.js
```

ブラウザテストにはWindowsのEdgeが必要です。別の実行ファイルは `CARD_TEST_BROWSER` 環境変数で指定できます。Google用テストはモック認証・APIで行い、実際のGoogleアカウントの予定を取得・変更しません。

## 実接続の手動確認

1. Client IDを設定し、`python -m http.server 8000` 等で静的配信します。`http://localhost:8000` を開きます。公開サイトでも同じコードを使用できますが、今回の変更は未pushです。
2. 設定モーダルでGoogleを選択・保存し、接続ボタンからテストアカウントで認証します。接続済み表示と、取得中から空き状況への更新を確認します。
3. 例として10/15 19:00–20:00のイベントに対し、Googleに18:30–19:30の予定を作り、「予定を再取得」で一部重複、予定名・時間を確認します。19:00–20:00の予定や終日予定でも確認します。
4. 複数日学会の会期に4件以上作り、要約・最大3件・「ほかN件」を確認します。フィルター変更後にも結果が維持されることを確認します。
5. 既定の追加先をGoogleにしてイベントを追加します。Google側で日時・会場・公式URL・OphthalConf-ID、サイト側で登録済み表示を確認します。同じイベントを再度追加して重複登録されないことを確認します。
6. 「毎回選択する」でGoogle / ICS / キャンセルを確認します。未接続でGoogleを既定にした場合もICSがダウンロードされることを確認します。
7. Googleのみ・iCloudのみ・両方・未連携を切り替え、設定保存、既存フィルター、関連セミナー、Google Mapsを確認します。iCloudの予定はサンプルのままです。
8. 接続解除、リロード、通信失敗で空きありと誤表示しないこと、一覧は利用できることを確認します。スマートフォンでも設定・追加選択・カードに横スクロールがないことを確認します。

実際のOAuth同意・Google API呼び出しは、ユーザーのClient ID設定後にこの手順で確認してください。
