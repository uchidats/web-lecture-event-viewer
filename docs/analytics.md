# OphthalConf GA4

測定IDは `G-JXE3ZH9PVS`。対象はHTTPSの `medconf.jp/ophthalconf/` と
`medconf.jp/ophthalconf/index.html` のみです。root側、localhost、file、別ホスト、
プレビューURLでは、保存済みの同意があっても解析タグを読み込みません。
dual-siteの両方へ同じローカルassetを配置し、実行時に対象URLを判定します。

## 同意

温泉スタンプラリーと同じBasic Consent Modeです。明示的な同意または有効な保存済み同意が
ある場合だけgtag.jsを追加します。同意前・拒否時には、Google Analytics／Google Tagへの
通信も、拒否状態のpingも送りません。既存のGoogle Fonts、Googleログイン、Calendarの
通信は別機能として維持します。

選択は専用localStorageキー `ophthalconf_analytics_consent_v1` に180日保存します。
期限切れ・壊れた値・保存エラーは自動許可しません。保存できない場合も、そのページで
明示した選択は有効です。フッターの「アクセス解析の設定」で変更できます。
取消は無効化フラグを立て、このstreamのpath配下の解析Cookieだけを削除して再読み込みし、
既に実行中のタグを解除します。他タブからの同意変更も反映します。ログイン・参加記録・
フィルター等の保存内容は削除しません。

## イベントと送信項目

| イベント | 独自属性 | 操作 |
| --- | --- | --- |
| page_view | なし | タグの読み込み成功後、1ページにつき1回 |
| view_mode_change | view_mode=list/calendar/compact | 表示切替。同じ選択への再クリックは対象外 |
| filter_open | なし | モバイルのフィルター展開／PCのフィルター操作開始 |
| filter_apply | なし | checkbox、適用・リセット・条件解除、確定した検索変更 |
| official_link_click | なし | 公式ページ・学会タイトル・履歴の公式リンク |
| pdf_click | なし | PDFプレビューまたはダウンロード操作 |
| calendar_add_click | なし | カードのカレンダー追加操作。完了や成功とは区別 |
| attendance_status_change | record_type=plan/history、status | 参加予定・参加実績の選択／解除 |

statusは `planned` / `not_planned` / `unselected` / `attended` / `not_attended` の固定値のみです。
氏名、メールアドレス、UID、Googleアカウント、トークン、検索語、リンク先URL、学会ID・
学会名・参加履歴一覧、個人の予定内容を送りません。任意属性は閉じたschemaで除外します。
全イベントのpage_locationは `https://medconf.jp/ophthalconf/`、page_titleは `OphthalConf`、
page_referrerは空に固定し、query・hash・流入元URLを含めません。

広告関連のconsentは常にdenied。Google Signalsと広告パーソナライズ信号も無効です。
GA4標準のCookie識別子、ブラウザー・端末情報などの処理は残ります。完全匿名とは案内しません。
ユーザー提供データやuser_idを設定するコードはありません。

singleton初期化と委譲listenerでカード再描画による重複を防ぎます。同意前の操作は保存・再送しません。
同意後、タグの読み込み中だけ最大50件の許可済みイベントを一時保持します。タグ失敗時は破棄し、
サイトの機能を妨げません。連続した別操作はそれぞれ1件として計測します。

## 公開前のGA4管理画面設定

このリポジトリからGA4管理画面を変更する権限はありません。Webデータstreamの
**拡張計測をOFF**にしてください。履歴変更のpage_view、サイト内検索、外部クリック、
フォーム、ファイルdownloadなどの自動計測を止め、queryやフォーム値の収集・重複を防ぎます。
`send_page_view:false`だけでは拡張計測を停止できません。

Google Signals・ユーザー提供データの収集も有効にしないでください。独自属性をGA4画面で
集計する場合は、`view_mode`、`record_type`、`status`をイベントscopeのカスタムディメンションに
登録します。GA4自身のsession_start・first_visit等は標準イベントです。

## 検証

- `node scratch/test_analytics.js`: 同意・対象URL・保存失敗・取消・属性制限・重複ガード。
- `node scratch/test_analytics_browser.js`: 実Edgeの1280px/360pxで操作・通信件数を確認。
  本番URLへのrequestをローカルsourceに差し替え、Google tag/collectと認証をmock化します。
  本番GA4データは送信しません。証跡は一時ディレクトリへ保存します。
- `node scratch/verify_gemini_notification_regressions.js`: 全回帰・Updater統合・dual-site・build。

公開後は実際のgtag.js／collect件数とGA4リアルタイム画面で受信を確認してください。
ローカルmock検証は、本番GA4での受信確認とは区別します。

参考: [Basic Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)、
[ページビューと拡張計測の重複防止](https://developers.google.com/analytics/devguides/collection/ga4/views)、
[Googleタグのprivacy設定](https://developers.google.com/tag-platform/security/guides/privacy)。
