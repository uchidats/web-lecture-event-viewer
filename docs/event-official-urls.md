# 開催回公式URLと学会本体URL

学会データのURL用途を分離する。

- `eventOfficialUrl`: 開催年・開催回と公式性を確認したイベントページ。カードタイトルはこの項目のみ使用する。
- `societyUrl`: 学会本体のサイト。タイトルのフォールバックには使用しない。
- `officialUrl`: 既存の申込ボタン、履歴内リンク、カレンダー説明等の互換用項目。今回の移行では全件維持する。

2026年10月7日の監査で確認した31件に `eventOfficialUrl` を追加し、確認できた13件に `societyUrl` を追加した。
31件のうち11件は旧 `officialUrl` が空欄。ユーザーの追加指示により、この11件にも確認済みイベントURLを追加した。
監査で旧URLが空欄だった52件のうち、残る41件は空欄を維持。全体で54件はイベントURLを採用せず、タイトルは通常テキスト。
AAO 2027/2028、APVRS 2028、APACRS 2026およびその他の保留レコードには新URLを追加していない。
根拠と候補は `reports/event-url-audit-2026-10-07.json`、一覧は `docs/event-url-audit-2026-10-07.md` を参照。

## 自動更新

2026年10月8日の追加指示により、高信頼5件（第33回糖尿病眼、第38回緑内障、第43回眼循環、ESCRS第45回2027年・第46回2028年）を反映。イベント公式URLは計36件、未設定は49件となった。残る20件のレビュー対象はURLを追加せず、カードの開催回・年・日程の確認を優先する。詳しくは `docs/event-url-discovery.md` を参照。

情報源レジストリも `eventOfficialUrl` / `societyUrl` を区別する。旧形式の情報源設定にある `officialUrl` はイベント情報源の互換用として読めるが、学会データやカードタイトルのフォールバックには使わない。
`allowedHosts` はイベントの取得・候補用。`allowedSocietyHosts` は学会本体用。リダイレクトで許可ホストを増やさない。

イベントURL候補には、ページタイトルの開催回一致、会期または構造化Event開始日の開催年、タイトル中の開催年を付ける。
候補URLのホスト・パスに明示された年度も照合する。著作権年やフッター内の別イベントの年度から開催年を推測しない。
日付の確認ができないページは自動確定しない。
公式HTMLのcanonical／og:url、構造化EventのURLも個別候補として保持し、登録済みURLと異なる場合は自動で置き換えない。
取得対象は既存レジストリの5学会を維持している。残りの学会を監視対象へ追加するには、年度別の情報源と許可ホストを登録する。

次は管理レビュー対象となる。

- `event-url-year-mismatch`: 会期・タイトル・URLの開催年が既存開催年と不一致。
- `event-url-edition-mismatch`: ページタイトルの開催回が情報源の開催回と不一致。
- `event-url-is-society-homepage`: イベント候補が学会本体トップ。
- `event-url-edition-unverified`: 開催年・開催回の確認ができない。
- `multiple-candidates`: 正規化しても異なる複数のイベントURL。
- `event-url-change-needs-review`: イベントURLの追加・変更。同一ホスト内の変更も対象。
- `society-url-change-needs-review`: 学会本体URLの追加・変更。

旧 `officialUrl` の変更もレビューに送り、既存操作への自動反映を防ぐ。
年度更新型URLは同じURLでもページが別年度に切り替わった場合にレビュー対象となる。
管理画面にはイベントURLと学会本体URLを別の変更項目として表示し、判断履歴の保存方式は維持する。

検証：`node scratch/test_event_urls.js`。ブラウザー検証は `node scratch/test_registration_browser.js` にタイトルURL・保留・安全属性の確認を含める。
