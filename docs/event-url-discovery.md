# 空欄イベント公式URLの探索

2026年10月8日実装。高信頼5件を手動承認済みの変更として events.js に反映し、設定済み36件だけ学会カードのタイトルをリンク表示する。未設定49件は通常テキストのまま。旧officialUrl・societyUrlをタイトルに流用しない。

## 探索の流れ

`scripts/update-conferences.js` の通常dry-run／applyから実行する。既存5開催回の情報監視とは独立した `scripts/auto-updater/discovery.js` が、eventTypeが国内学会・海外学会、isConference=true、eventOfficialUrlが空欄のカードを抽出する。

1. 現カードの開催年・開催回・学会名を検索条件として組み立てる。日本語の第N回と英語のordinalを抽出する。番号のないAnnual Meeting／FujiRetinaは開催年を年次開催回として照合する。回数を推測して補完しない。
2. `conference-discovery-sources.js` の公式本体の集会一覧を優先し、必要に応じ運営事務局・日本眼科学会の一覧を取得する。公式トップから同ホストの学術集会案内へ進むこともできる。未登録カードはsocietyUrlを入口にする。入口がなければ未確認理由を記録する。
3. 一覧の該当行・リンク名称・年／回の記述から開催回ページの候補を抽出する。隣の行の別学会や同略称の別団体を候補にしない。前年URLの年を置換してURLを作ることはしない。
4. 許可したホストの候補ページを取得し、HTMLタイトル・見出し・会期・会期画像altから開催年・回・学会名を確認する。トップで開催年を読めない場合は同サイトの開催概要を補助取得する。ニュース日付・copyrightだけを開催年の証拠にしない。
5. 判定とHTTP取得記録をレポートに残し、候補を管理レビューへ送る。探索モジュールはautoChangesを返さず、applyモードでもURLを自動反映しない。

外部検索エンジンAPIは使用しない。`searchMethod: official-index-links` のとおり、記録した年・回・名称の条件で公式一覧のリンクを探索する。任意のWebサイト全体を検索する仕組みではない。入口の追加はこのレジストリで行う。

取得はイベントごとに一覧3ページ、候補／開催概要合計4ページまで。一覧ごとの候補リンクは6件まで。同じURLと許可ホスト集合の取得結果は実行内で共有する。ホスト制限、HTTPS、リダイレクト上限、タイムアウト、サイズ制限を維持し、新ドメインのリンクは自動的に信頼しない。新しい運営ドメインは根拠とともにレビューし、許可ホストを登録する。

## 管理レビューへの出方

| 結果 | 理由 | レビュー項目 |
| --- | --- | --- |
| 1件・年／回／名称一致 | discovery-single-high-confidence | field=eventOfficialUrl、旧値null、候補URL、confidence=0.98。高リスクの追加前確認 |
| 複数候補 | multiple-candidates | 候補ごとにURLと根拠を表示。field=nullでURLだけの採用を無効化 |
| 年度不一致 | event-url-year-mismatch | URLだけの採用を無効化しカード情報を確認 |
| 開催回不一致 | event-url-edition-mismatch | 同上 |
| 名称不一致 | discovery-name-mismatch | 同上 |
| 年／開催回の確証不足 | event-url-edition-unverified | URL候補を確認のみ可能 |
| 取得失敗 | discovery-fetch-failed | HTTP結果／エラーを確認。不存在とは断定しない |
| 探索の上限に到達 | discovery-search-limit | 未取得候補を残し、単一高信頼には昇格させない |
| 既知の監査保留20件 | discovery-card-integrity-needs-review | カードの年・開催回・日程等の確認を先行。URL候補値は出さない |
| 専用URLを発見できず | discovery-dedicated-url-not-found | 新しいURL候補をキューに追加しない。通常テキストのまま |
| 情報源未登録 | discovery-no-index-source | 未確認理由だけをレポートに記録 |

管理画面は候補URLを安全な外部リンクとして表示する。field=nullの項目は「採用」が無効で、変更しない／保留／情報源確認が可能。既存のレビュー判断はブラウザ内保存のままで、管理画面で採用を押してもevents.jsを変更しない。

監査20件の `integrityReview` は自動的に解除しない。カードの正式名称・開催回・開催年・日程を一次情報と照合して解決してから、そのメモを解除して探索を再開する。過去のレビュー項目は履歴として残し、解決理由を記録する。

## 再現ログ

`reports/auto-update-report.json` の `discovery.records` にeventId、expected、searchQueries、searchMethod、indexUrls、requests、candidates、reasonを保存する。requestsには取得URL・HTTPステータス（200、403、404、302等）・リダイレクト先・通信エラーを記録。HTTP応答がない通信失敗はstatus=nullで、404扱いしない。candidatesには根拠、照合結果、補助の開催概要URL、採用候補／保留理由を残す。高信頼の場合も「追加前レビュー」であり自動採用ではない。

既存5開催回のページ監視にも `requests` を追加した。管理レビュー候補は `reports/auto-update-review.json` に安定IDでマージし、同じ候補の再出現はoccurrencesを増やす。レポートは各実行のスナップショットで、定期実行では既存Actionsのartifactに保存される。HTTP fixtureテストは外部サイトの変化に依存せず、検索条件・取得結果・判定の再現性を検証する。

## テスト

`node scratch/test_event_url_discovery.js`：単一候補・複数・候補なし、年／回／名称不一致、annual／合同開催、画像会期／下層概要、隣接行の除外、403・通信失敗・リダイレクト、許可外ホスト、20件の整合性保留、レビュー重複、dry-run／applyでもURL未反映を検証。

`node scratch/test_event_urls.js`：5件の反映、36件のリンク、49件の空欄、タイトル以外の表示維持、従来URLの非フォールバック。新監査の54件はtitle・date・endDate・venueを変更していないことも検証する。

`node scripts/check-conference-regressions.js`：全30項目の構文／回帰テスト。`node scratch/test_auto_updater_integration.js`：隔離コピーの実更新と全回帰ゲート。`node scratch/test_registration_browser.js`：Edgeの6画面幅でタイトルリンク、5件のリンク先、未設定カードの通常テキスト、リンク安全属性・レイアウトを検証。

実サイトdry-runは実行時のレポートを参照。取得成功しなかったサイトや開催年を本文で確認できないサイトは候補採用を保留する。実ネットワークで新規高信頼候補が0件でも、fixtureで追加前レビューの動作を検証する。

## 今回変更したファイル

| 用途 | ファイル |
| --- | --- |
| 5件のURL反映 | events.js |
| 探索入口・統合設定 | conference-discovery-sources.js（新規）、conference-sources.js |
| 探索・取得・レビュー保存・実行 | scripts/auto-updater/discovery.js（新規）、fetch.js、pipeline.js、storage.js、scripts/update-conferences.js |
| 管理レビューの理由・候補URL表示 | review-model.js、review-ui.js |
| テスト | scratch/test_event_url_discovery.js（新規）、test_event_urls.js、test_auto_updater.js、test_auto_updater_integration.js、test_registration_browser.js |
| 説明 | docs/event-url-discovery.md（新規）、docs/event-official-urls.md、docs/auto-updater.md |
| 実サイトdry-runの出力 | reports/auto-update-report.json、reports/auto-update-review.json |

カード描画の条件は既存の `eventOfficialUrl` 判定を維持し、データ反映後の実カードで検証した。既存の他作業の差分は保持している。commit／pushは実施していない。
