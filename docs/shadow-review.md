# シャドー判定（shadow review）

現行の自動更新・要確認判定とは独立に、新しい正規化・分類ルールを適用した場合の結果だけを記録する。
**本番動作には一切影響しない**（events.js、Firestoreのstatus、review状態、承認履歴、自動適用件数は変更しない）。

## 実行

```
node scripts/shadow-review/run.js [--today YYYY-MM-DD] [--no-write] [--legacy <file>] [--gemini <file>] [--out <path>]
```

入力（読み取りのみ）: `reports/auto-update-review.json`（要確認候補）、`reports/gemini-monitor/` の最新レポート（`--today` 以前で最新）、`events.js`（大会名・開催日の参照）。
出力: `reports/shadow-review/latest.json`（実行のたびに上書き）と、件数サマリーの標準出力。

## 保存場所と競合回避

GitHub Actionsが `git add` する対象は次のとおりで、`reports/shadow-review/` はどれにも含まれない。

- `gemini-monitor.yml`: `events.js`, `reports/gemini-monitor/`, `reports/gemini-monitor-state.json`, `reports/gemini-rollback-history.json`
- `update-conferences.yml`: `events.js`, `reports/auto-update-report.json`, `reports/auto-update-review.json`, `reports/auto-update-source-state.json`, `reports/auto-update-history.json`

そのため、ボットのcommitと衝突しない。ワークフローには組み込んでいない（手動実行）。コミットするかどうかは別途判断する。

## 分類

| 分類 | 意味 |
|---|---|
| `equivalent` | 実質同一で人間確認不要 |
| `low_risk_auto_candidate` | 将来自動確定できそうだが、シャドー期間中は適用しない |
| `source_problem` | 取得失敗・別回/別年ページ・探索未確定 |
| `human_review` | 人間判断を残す |

各候補に `eventId` / `eventName` / `field` / `current` / `detected` / `classification` / `ruleId` / `reason`（人間向け理由）を記録する。`sourceReason` は元の候補の理由コード。

## ルール（`scripts/shadow-review/classify.js`）

- equivalent: 空値同士、空白・全角半角・記号の差、日付表記の差（`2026/10/19` = `October 19, 2026`）、時刻の区切り（`T`/空白）、検出側の時刻省略、配列順・キー順、題名の括弧書き別名や英語併記の増減（回次は不変）、
  CET/CESTのみが異なる同日・同時刻の締切（「締切日として同値」。絶対時刻の同一性は主張しない）、前期間の終了日と次期間の開始日が同日の連続期間。
- low_risk_auto_candidate: 年だけ1年異なる参加登録締切（今日以降かつ開催日前に収まる候補が1つだけの場合）、未入力項目への信頼度95%以上の欠損補完（演題募集の開始・締切・状態・URL・タイムゾーン、参加登録期間）、公式で確認できる副題、同日への時刻追加。
- human_review（必ず残す）: 日付・締切日の実質変更、会場・都市・国の変更、情報量が減る会場名、URL・ドメイン変更、開催回・開催年の不一致、学会名の意味的変更、複数候補、正規化しても意味が一致しないもの。中止・延期は、現行の候補に現れた場合は既知ルールに該当せず `human_review` になる。
- source_problem: 取得失敗、本文未確認、Bot保護、別年ページ（公式の開催年・日付が現在と異なる）、探索上限、開催回・年を確認できない候補URL。

## 大量変更

`MAX_AUTO_APPLY_BATCH=5` の挙動は変更しない。シャドー判定は項目ごとに評価し、`[Mass Change Escalated]` で人間確認へ回された項目のうち
自動処理可能（equivalent + low_risk）だった件数と、本当に人間確認が必要だった件数を `summary.massChange` に別集計する。

## 重複

`summary.duplicates` に「同一イベント・同一項目・同一意味」の指摘の重複数を集計する。候補は削除しない。
