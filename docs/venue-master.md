# 共通会場マスター（初期実装）

`venues.js` を events.js / script.js より先に読み込む。診療科や開催年に依存しない
`venueMaster` を安定した英字の `venueId` で参照する。名称変更時もIDを維持する。
イベントのID、既存の `venue`、都市表記、参加状態、関連セミナーの親IDは変更しない。

## 参照と互換性

- `getEventVenue(event)` は既知のIDのマスターを返す。未指定・不明なIDは null。
- Google Mapsは既知のIDなら `googleMaps.searchQuery` を使用する。
- IDなし・不明なIDは従来の会場文字列と都市から検索する。
- 表示・カレンダーの場所は既存の `venue` を優先し、空ならマスターの名前を使う。
  部屋名、配信併記などを落とさないための仕様。
- 未定・オンライン会場のリンク抑止は従来どおり。
- 会場横の海外地域表示は `getEventVenueRegionLabel(event)` で国名にする。
  マスターの country を優先し、未指定・不明ID・空の country は cityCountry の
  `/` または `／` の後ろから取得する。シンガポール共和国は表示上シンガポール。
  未定・欧州など国が不明な場合は元の地域表示を維持する。
  日本開催の既存地域表示と、フィルター・集計用の地域や国際学会分類は変更しない。
- 複数会場のイベントは今回紐付けない。将来の複数会場参照は別途設計する。

## データ構造

| フィールド | 内容 |
| --- | --- |
| venueId / name | 安定ID / 会場名 |
| city / prefecture / country | 都市・自治体 / 都道府県 / 国 |
| timeZone | 任意。IANAタイムゾーン名（例: America/Chicago）。未確認なら省略 |
| googleMaps.searchQuery | Maps検索語（名称・所在地） |
| access.nearestStations | 最寄駅のアクセス経路配列 |
| access.shinkansenStations | 主要新幹線駅からの経路配列 |
| access.airports | 主要空港からの経路配列 |
| access.transportModes | 使用可能な交通手段の配列 |
| access.taxiEstimate | タクシー目安オブジェクト、未調査は null |
| access.morningCrowdingNotes | 朝の混雑注意の文字列配列 |
| accommodation.recommendedAreas | おすすめ宿泊エリア配列 |
| accommodation.hotels | ホテル配列 |

経路は `{ origin, steps: [{ mode, from, to, durationMinutes }],
durationMinutes: { min, max }, notes, sourceUrl, verifiedAt }` とする。
所要時間は出発地点から会場まで（乗換・徒歩を含む）の目安を分単位で保持する。
未確認の所要時間は null とし、0分と区別する。最寄駅の徒歩経路も同じ形式を使う。
交通手段は `walk / train / subway / bus / taxi` 等の文字列。

タクシー目安は `{ origin, fare: { min, max, currency }, durationMinutes,
notes, sourceUrl, verifiedAt }`。宿泊エリアは `{ name, reason, sourceUrl, verifiedAt }`。
ホテルは `{ hotelId, name, area, categories, officialUrl, sourceUrl, verifiedAt }`。
categories は `luxury / business / budget / walkable / airportAccess` の複数指定を可能にする。
診療科固有のおすすめは共通マスターに混在させない。

アクセス・おすすめ宿泊情報は初期状態では未調査の空配列 / null。
調査済みデータを追加する際は公式情報の sourceUrl と確認日（YYYY-MM-DD）を記録する。
空配列は「駅・ホテルが存在しない」という意味ではない。
今回、交通・ホテルの案内UIは追加しない。

## 試験導入

初期の国内6会場に加え、ニューオーリンズ・シンガポール・ウィーンの3会場を登録し、
既存の該当4イベントに venueId を追加した。海外の時刻併記は [event-time-zones.md](event-time-zones.md) を参照。
FujiRetina 2027の公式会場を確認し、虎ノ門ヒルズフォーラムを追加して同イベントに紐づけた。
訂正経緯と確認URLは [fujiretina-2027-venue-audit.md](fujiretina-2027-venue-audit.md) を参照。
既存イベント全件の一括置換・名称による自動紐付けは行わない。

検証: `node --check venues.js`、`node --check events.js`、`node --check script.js`、
`node scratch/test_venue_master.js`、既存の scratch/test_ended_conferences.js と
scratch/test_conference_history.js を実行する。

変更前との比較を行う場合は、変更前の script.js をUTF-8の一時ファイルに保存し、
`node scratch/test_venue_master.js <変更前script.jsのパス>` を実行する。
省略時は現行実装の互換性・構造・カレンダー出力を検証する。
