# 参加登録期間

学会の `registration` は `{ type: "domestic" | "international", periods: [{ label, start?, deadline? }] }`。
日付は `YYYY-MM-DD`、日時は `YYYY-MM-DDTHH:mm`。期間配列の順序をカード表示に使用し、label はそのまま表示する。
新構造がない場合は `earlyRegistrationDeadline`、次いで既存の `earlyBirdDeadline` を使用する。
国内のフォールバック名称は「事前参加登録」、海外は「Early bird」。未定などの旧文字列表記も保持する。

締切は締切日の翌日から「締切済」。開始前は「○年○月○日開始」。各段階を表示し、開始時刻はデータに保持する。
カードの状態判定は既存の `getTodayString()` と同じ暦日単位で行う。時刻付き締切は表示に時刻も残す。

自動更新は `registration` ロールの公式ページ、または開催概要の明示された登録期間から抽出する。
演題募集・ランチョン・協賛・展示の期間を参加登録として採用しない。海外の段階を対象にする情報源には `registrationType: "international"` を指定でき、パイプラインは学会の地域区分を渡す。
複数段階は1つの登録情報オブジェクトの `periods` に全件保持する。同じ段階の異なる日付や複数ページの不一致は `multiple-candidates` としてレビューする。
参加登録の追加・変更はすべて管理レビューに送る。既存締切より後の日付は `deadline-extension-possible`、前の日付は `deadline-change-needs-review`。
同じ登録情報の再検出は変更対象にしない。管理レビューの承認は既存仕様どおりローカル判断履歴の保存のみで、学会データへの自動反映は行わない。

第65回日本網膜硝子体学会総会は公式ページで2026年10月7日に確認した2期間を登録：
https://convention.jtbcom.co.jp/65moumaku/join/index.html

検証：`node scratch/test_registration.js`。自動更新の回帰チェックにも含める。
ブラウザーでのカード確認：`node scratch/test_registration_browser.js`（Edge/Chrome 必須）。
