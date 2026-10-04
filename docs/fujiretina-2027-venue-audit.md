# FujiRetina 2027 会場訂正と原因調査（2026-10-05）

会期は2027年3月26〜28日、会場は虎ノ門ヒルズフォーラム。
[大会公式トップ](https://convention.jtbcom.co.jp/fujiretina/)の2027年開催バナー、
[JRVSのFujiRetina案内](https://www.jrvs.jp/fuji.html)の第6回・2027年の行、
[日本眼科学会の国際学会予定表](https://www.nichigan.or.jp/member/syukai/hyoji_international.html)で確認した。
JRVSのページ先頭には2026年の案内もあるため、2027年の行を照合した。

## 履歴から確定できる経緯

- `0cb04f0`（2026-10-04 16:14 JST、データを2026〜2028年へ拡充）で
  `conf-int-fujiretina-2027` が初めて追加され、その時点の `venue` が東京国際フォーラムだった。
  `officialUrl` は空、`sourceUrl` は日本眼科学会の国際学会予定表。
- seed文書 `docs/conference/conference_seed_2026-10-04.txt` の2027年FujiRetina行は
  日程と `Tokyo, Japan` を記載するが、会場名を記載していない。
- `git blame` で会場行の起源も `0cb04f0` と確認できる。その後、会場文字列の変更はない。
- `02c3280` の会場マスター導入では国内6会場に各1イベントを紐づけたが、
  FujiRetina 2027には `venueId` を付与していない。
- `c38e0f7` の海外会場・時差対応でもFujiRetina 2027への `venueId` 付与はない。
  訂正直前も `venueId` は未設定だった。
- Auto Updaterの対象は別の5学会であり、FujiRetina 2027は対象外。
  Updaterや会場マスターが後から東京国際フォーラムを選択した事象ではない。

## 推定と限界

誤りは初回データ作成時の会場入力・検証に起因する。
同じ追加データにはARC／JRVSなど東京国際フォーラムで開催する別の学会もあり、
東京開催という情報からの推測補完、または別イベントからの取り違えが考えられる。
ただし、生成スクリプト・操作記録・当時取得した公式HTMLが履歴にないため、
どの入力判断でその値になったかは断定できない。
sourceUrlを持つことと、会場値がそのページに明記されたことを混同していた点が検証上の問題。

## 訂正と再発防止

イベントの `venue` を訂正し、検証済みの `toranomon-hills-forum` に紐づける。
名称・Maps検索語・日本タイムゾーンを会場マスターに登録する。
手動訂正の新旧値・venueId・確認URLは `reports/venue-corrections.json` に残す。

Updaterは、開催回が一致した公式開催概要の会場欄またはJSON-LD Event.location.nameの
明示値に限って採用する。根拠種別・原文・source URLを必須とし、会場名を原文と照合する。
会場名がない場合は埋めず、既存値を保持してレビュー対象とする。
確定済みの既存会場と異なる候補は自動上書きせず、人による訂正へ回す。
自動補完は未設定／未定等の値に限定し、sourceUrlを差分・適用履歴へ保存する。
都市、他学会、会場マスターの地域情報から会場名を推測しない。
