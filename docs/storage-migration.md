# OphthalConf の保存キー移行

起動時、通常の保存データ読み込みより前に `migrateLegacyStorage()` を実行する。新しい正規キーは次の4つ。

- `ophthalconf_attending_conferences`: 参加予定
- `ophthalconf_hidden_conferences`: 非表示学会
- `ophthalconf_conference_attendance_history`: 参加履歴（roles、notesなども保持）
- `ophthalconf_calendar_settings`: カレンダー設定

旧キーに値があり、新キーが存在しないか空文字の場合だけ、保存文字列をそのままコピーする。新キーの `[]` や `{}` は有効な保存値として扱い、旧データで上書きしない。旧キーは削除・変更せず、以後の読み書きは新キーのみを使用する。

コピー完了後に `<新キー>_legacy_migrated=1` を保存する。すでに新キーに値がある場合も完了扱いにするため、後からデータをクリアしても旧データが復活しない。キーごとに処理するため、部分的な失敗は他の移行を妨げず、コピーに失敗したキーは次回起動時に再試行する。保存領域が利用できない場合は既存の読み書き処理と同様に警告を記録し、起動を継続する。

移行は同じサイトオリジン内で行う。ブランド変更と同時にドメインを変更する場合、別オリジンのlocalStorageは参照できないので、別途エクスポート／インポートが必要。

```sh
node scratch/test_brand_storage.js
node scripts/check-conference-regressions.js
```

テストは4キーの移行、旧キーの維持、新キー優先、繰り返し実行、クリア後の再移行防止、空文字／空配列、コピー失敗時の再試行、保存領域が利用できない場合を検証する。
