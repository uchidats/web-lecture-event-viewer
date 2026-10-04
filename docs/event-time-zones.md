# 海外イベントの日本時間表示

会場マスターの `timeZone` にIANA名を保存する（例: `America/Chicago`）。
`venueId` がないイベントでも、イベントの `timeZone` があれば利用する。
イベントの明示値を優先し、会場マスターをフォールバックとする。
都市名から実行時にタイムゾーンを推測する処理は設けない。

`getEventJapanTimes(event)` は `Intl.DateTimeFormat` / `formatToParts` で
その日付の現地時刻から実際の瞬間を求め、`Asia/Tokyo` で表示する。
固定UTCオフセットは保存も使用もしない。
API仕様: [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat)。

`date`〜`endDate` は現地開催日。既存の `time` は各日の共通時間帯として扱い、
全日を個別変換する。変換結果が全日同じなら「各日」とまとめ、異なる場合は
各現地開催日を添えて表示する。開始・終了も別々に変換するので、
DST切替をまたぐ時間帯にも対応する。終了時刻が開始より早ければ現地の翌日終了、
`24:00` は翌日0時として扱う。

「翌」「前日」等は各行の現地開催日を基準にした日本での日付差を表す。
日本開催（国名が日本または `Asia/Tokyo`）には併記しない。
タイムゾーンが不明・無効、時刻未設定、日付不正の場合は既存の表示を維持する。
DST切替時の存在しない時刻・二重に存在する時刻は瞬間を一意に確定できないため、
推測せず当該イベントを現地時間だけで表示する。

カードと詳細ダイアログの表示専用の変換であり、イベントの日時データ、
フィルター、Google Calendar / ICS の出力処理は変更しない。
