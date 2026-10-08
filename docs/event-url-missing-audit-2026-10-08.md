# eventOfficialUrl空欄の学会カード全件監査（2026-10-08）

対象は現在の events.js の eventType が国内学会・海外学会で eventOfficialUrl が空欄の全54件（国内40・海外14）。掲載済み31件は対象外。過去の学会も対象から除外していない。データ・取得コード・表示コード・管理レビューキューの修正、commit、pushは実施していない。本書と監査JSONのみ追加した。

| 結果 | 件数 |
| --- | ---: |
| 単一の高信頼URLを持つ追加候補 | 5 |
| 年・開催回・名称の矛盾、またはURLを確定できないレビュー対象 | 20 |
| 対象開催回の専用URL未確認 | 29 |
| 合計 | 54 |

「専用URL未確認」は未公開・不存在を意味しない。公式一覧・開催回サイト・運営事務局と検索索引を調査しても、今回の確認範囲で採用条件の確証を得られなかったという意味。取得失敗を404や不存在とみなしていない。URL候補が複数の場合やカードと年・開催回が異なる場合は採用候補へ昇格させていない。

## 追加候補5件

| ID | カード | eventOfficialUrl候補 | 確認根拠 |
| --- | --- | --- | --- |
| conf-jp-diabetic-2027 | 第33回 日本糖尿病眼学会総会（2027） | [開催回公式ページ](https://convention.jtbcom.co.jp/jsod33/) | 第33回、2027年3月12–13日、ホテル金沢を開催概要で照合。単一の開催回サイト。 |
| oph-014 | 第38回 日本緑内障学会（2027） | [開催回公式ページ](https://site2.convention.co.jp/jgs2027/) | 学会本体が指定URLへ明示リンク。第38回・2027年・日本緑内障学会・国立京都国際会館を確認。URLは高信頼。単独会期4月23日とWGC合同4月20–23日の区別は別途日程レビュー。 |
| conf-jp-circulation-2027 | 第43回 日本眼循環学会（2027） | [開催回公式ページ](https://convention.jtbcom.co.jp/43jsoc/) | 第43回、2027年7月17–18日、赤坂インターシティコンファレンスを本体案内と開催回サイトで照合。 |
| conf-int-escrs-2027 | ESCRS 2027 (45th Congress of the ESCRS)（2027） | [開催回公式ページ](https://www.escrs.org/escrs-annual-events/45th-congress-of-the-escrs) | 学会本体の第45回専用開催案内。2027年と第45回が一致。一覧で10月15–19日・Madridを照合。専用外部Congressサイトがなくても、この開催回公式ページは条件を満たす。 |
| conf-int-escrs-2028 | ESCRS 2028 (46th Congress of the ESCRS)（2028） | [開催回公式ページ](https://www.escrs.org/escrs-annual-events/46th-congress-of-the-escrs) | 学会本体の第46回専用開催案内。2028年・第46回が一致。公式一覧で10月6–10日を確認。開催回別の公式案内として条件を満たす。 |

- 糖尿病眼学会：[学会本体の総会案内](https://www.jsod.jp/member/)／[開催概要](https://convention.jtbcom.co.jp/jsod33/summary/index.html)。
- 緑内障学会：[学会本体の学術集会案内](https://www.ryokunaisho.jp/expert/meeting/index.php)／[開催概要](https://site2.convention.co.jp/jgs2027/info/)。
- 眼循環学会：[学会本体の学会案内](https://www.ganjunkan.org/info/)／[開催回トップ](https://convention.jtbcom.co.jp/43jsoc/)。
- ESCRS：[公式Meetings and Events一覧](https://www.escrs.org/meetings-and-events)から第45回2027年、第46回2028年を照合。学会本体のトップではなく、当該年・回だけの開催案内なので今回の条件を満たす。これは前回の「外部専用Congressサイト未確認」という保留基準を、今回の明示条件に合わせて見直したもの。

ここでの「単一」は今回の探索で競合する別イベントサイトを確認していないという意味。同じサイト内のトップ・開催概要・ご挨拶・言語版は根拠ページであり、別々の競合イベント候補として数えない。全5件とも自動反映はしない。

## 第38回日本緑内障学会が前回31件から外れた直接原因

前回は31件だけを監査したわけではない。[前回JSON](../reports/event-url-audit-2026-10-07.json)は全85件を記録し、31件を追加可能とした。その後、31件だけが events.js の eventOfficialUrl に登録され、54件が空欄に残った。

該当IDは **oph-014**。conf-jp-glaucoma-2027 というIDではない。前回記録にも **https://site2.convention.co.jp/jgs2027/** は candidate.url として既に入っていた。したがって「検索で拾われなかった」は正確ではなく、**発見済みURLが検証保留になり、追加候補への昇格・データへの反映がされなかった**。

前回の当該レコード：

| 項目 | 値 |
| --- | --- |
| currentKind | missing（旧officialUrl未登録の分類） |
| candidate.url | https://site2.convention.co.jp/jgs2027/ |
| candidate.verification | unverified |
| candidate.checks.eventPage | true |
| candidate.checks.yearMatches | true |
| candidate.checks.notSocietyTop | true |
| candidate.checks.editionMatches | null |
| proposedEventOfficialUrl | null |

前回の注記は「第38回2027年の公式企業ページは確認したがホーム取得は失敗。ホームと会期（国内学会単体／WGC合同）の扱いを再確認する。」。この editionMatches=null と verification=unverified のため31件に入らなかった。候補発見と「旧URL空欄」という分類は両立しており、currentKind=missing だけを見ると候補発見済みであることを見落とす。

今回は本体の学術集会案内が指定URLへ「第38回 日本緑内障学会」と明示リンクしていること、開催回の開催概要が第38回・2027年・日本緑内障学会・国立京都国際会館を示すことを確認。最初の直接openは取得エラーだったが、本体の明示リンクを経由した再取得は成功した。取得失敗だけを根拠に公式性を保留し続ける必要はない。

**URL判定と会期判定を混ぜたことも保留を長引かせた。** 学会本体と会長挨拶の合同会期は4月20–23日、開催回の開催概要は国内学会単独4月23日。URLの年・回・名称はどちらも一致している。カードの日程を単独会期とするか合同会期とするかは、URL採用とは独立した日程レビューにするべき。今回は日付を変えていない。

タイトルにリンクが付かなかった直接原因は [script.js](../script.js) のカード描画（2225行）で event.isConference && event.eventOfficialUrl を条件にしていること。空欄のときにリンクを付けない挙動は現仕様どおりであり、表示側の故障ではない。

## 未設定イベント全体の取得漏れ原因

### 検索・収集範囲

[conference-sources.js](../conference-sources.js) の sources は5件のみ。131jos 2027、80ringan 2026、眼科手術2027、緑内障2026、網膜硝子体2026で、oph-014 は未登録。[pipeline.js](../scripts/auto-updater/pipeline.js) は config.sources と source.pages を順に取得するだけで、全学会の空欄URLを検索したり、本体の学術集会一覧を巡回して別年のリンクを発見したりする処理はない。空欄54件すべてが、この5件の監視対象から外れている。

緑内障2026は congre.co.jp、2027は site2.convention.co.jp で運営ドメインも変わる。前年パスの年だけ差し替える方式では発見できない。本体一覧を入口にする必要がある。許可ホストに新サイトを加えるには公式性の確認を行うべきで、既存ホストの制限を外すことでは解決しない。

前回JSONには具体的な検索クエリ、検索結果全件、取得時のHTTPログがない。したがって「検索を旧officialUrlの有無で打ち切った」「検索エンジンが返さなかった」「通信失敗はサーバー側の障害だった」等は断定できない。確実に言えるのは、候補発見済み・取得失敗・開催回照合未完了という記録と、空欄レコードの多数で根拠URL／候補が未記入だったこと。

今回の検索クエリと各件の参照URLは新JSONに記録した。正式名＋年・回だけで一致しない場合は本体一覧の開催年・会場・会長等へ戻り、カードの回数が誤っている可能性を調べた。同略称の別学会（ASCRS、IPS、AAO等）や前年サイトを除外した。

### 判定条件

現在の自動更新コードには、次の取りこぼし要因がある。ただし oph-014 は監視対象外なので、これらによって実際に拒否されたという実行記録はない。今後の監視拡張時に影響する条件である。

- [extract.js](../scripts/auto-updater/extract.js) は source.identity の全トークンがHTML titleに存在することを必須にしている。本文や学会本体の明示リンクで照合できても、タイトルが英語・略称・別順序なら保留となる。
- 年の確証 eventYears は高信頼の開始日候補からだけ作る。会期が画像中心、ラベルが抽出規則外、年はタイトルにのみ明示、日付は別の下層ページにある場合、URLやタイトルの年が一致していても eventYears=[] で保留となる。
- [event-urls.js](../scripts/auto-updater/event-urls.js) は年／開催回不一致や年を検証できないものを保留する。誤採用防止として維持すべきだが、候補発見の入口や複数一次ページの根拠統合が別途必要。
- [policy.js](../scripts/auto-updater/policy.js) は確認済みURLでも追加・変更を event-url-change-needs-review に送る。自動更新を実行しても空欄が自動で埋まる仕様ではない。今回も候補提示まで。
- 前回ESCRS 2027／2028は年・回・公式性が確認済みでも「外部専用Congressサイトが未確認」のため保留。今回の条件は当該年・回の公式ページを認めるため、本体内の開催回別案内を追加候補とした。

### データ構造・監査状態

- URL用途を officialUrl／societyUrl／eventOfficialUrl に分けた設計自体は適切。旧URLをタイトルへ流用しないため、前回に承認した31件以外は空欄になる。
- 前回JSONは発見済み candidate と反映可能 proposedEventOfficialUrl を分けているが、missing は旧URLの分類なので「未探索」「候補発見済み」「取得失敗」「回数矛盾」を一覧の分類だけで区別できない。
- 未確認URLとカードの年・回数が間違っているレコードが混在している。回数を条件から外して自動採用すると、誤ったカード名に正しい別回URLを付けてしまう。
- 視野画像はカード38/39/40回に対し公式15/16/17回、臨床視覚電気生理は75/76回に対し公式73/74回、老視は年と回数のずれ、眼科AIは2027年第3回という矛盾。回数は title 内の文字列であり、イベントの正式な回数と検証状態を独立して保持していない。元の[seed資料](conference/conference_seed_2026-10-04.txt)はこれらを回数なしの名称で記載している。回数の付与・補完過程が原因である可能性はあるが、その過程の履歴がないため誰がどの規則で付けたかは断定できない。
- [test_event_urls.js](../scratch/test_event_urls.js) は31件と前回JSONの候補・保留状態への一致を検証する固定テスト。既知31件の移行を検証する役割で、空欄に新しい公式ページが存在するかを発見・検証するテストではない。

## 改修する場合の方向（今回は未実装）

1. 空欄全件を対象にする発見処理と、既に登録した開催回ページの監視処理を分ける。本体の一覧から開催年・回・正式名称・運営ページへの明示リンクを集める。
2. 取得状態と公式性、開催回一致、カード情報の矛盾を独立して記録する。トップ取得失敗でも本体リンク＋開催概要等で照合できればURLは高信頼候補にする。
3. 1件・高信頼候補、複数候補、年不一致、回数不一致、名称矛盾、専用URL未確認を区別する。取得失敗には再確認入口と理由を残す。
4. URL採用のレビューと、日付・会場・タイトルの修正レビューを分ける。候補が1件でも今回のデータ変更は行わない。
5. 公式本体内の開催回別ページも認める。別年に切り替わる共通Annual Meetingページは年度の継続検証が必要。

## 全54件の監査結果

JSONは [event-url-missing-audit-2026-10-08.json](../reports/event-url-missing-audit-2026-10-08.json)。candidateUrls は保留URLを含むため採用リストとして使わない。追加候補は proposedEventOfficialUrl が設定された5件だけ。

| ID | 年 | カード正式名称（現データ） | 判定 | 候補URL／保留URL | 結果と根拠 |
| --- | ---: | --- | --- | --- | --- |
| conf-jp-perimetry-2026 | 2026 | 第38回 日本視野画像学会学術集会 | レビュー | [候補1](https://n-practice.co.jp/jips2026/) | 公式は2026年第15回。カードの第38回と不一致。開催年・会場は対応するが、名称レビューが先。 [根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) [根拠2](https://n-practice.co.jp/jips2026/) |
| oph-003 | 2026 | 第35回 日本小児眼科学会・日本弱視斜視学会 合同学会 | レビュー | 未確認 | 2026年は第82回弱視斜視（6月5–6日）と第51回小児眼科の別開催という前回記録。今回も第35回合同・10月30日に対応する公式ページを確認できない。レコード自体をレビュー。 [根拠1](https://www.jasa-web.jp/event/programs) |
| oph-010 | 2026 | APACRS 2026 (Asia-Pacific Association of Cataract & Refractive Surgeons) | レビュー | [候補1](https://apacrs2026.org/) | 公式は2026年6月4–6日、Pattaya、第38回。カードの12月17日・Singaporeと不一致。公式URLは存在するがURL単独の追加を保留。 [根拠1](https://www.apacrs.org/) [根拠2](https://apacrs2026.org/) |
| conf-jp-presbyopia-2027 | 2027 | 第4回 日本老視学会学術総会 | レビュー | [候補1](https://www.rousi.jp/jps4)・[候補2](https://www.rousi.jp/jps5) | 第4回は2026年。カード日程・会場に対応する2027年は第5回（jps5）。開催回修正前は保留。 [根拠1](https://www.rousi.jp/) [根拠2](https://www.rousi.jp/jps4) [根拠3](https://www.rousi.jp/jps5) |
| conf-jp-eyelid-2027 | 2027 | 第38回 日本眼瞼義眼床手術学会学術集会 | 専用URL未確認 | 未確認 | 対象開催回の専用ページ未確認。医学書院の第38回案内は2月20日・京都府立医科大学附属図書館で、カードの2月13日とは相違（補助根拠）。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_other.html) |
| conf-jp-diabetic-2027 | 2027 | 第33回 日本糖尿病眼学会総会 | 追加候補 | [候補1](https://convention.jtbcom.co.jp/jsod33/) | 第33回、2027年3月12–13日、ホテル金沢を開催概要で照合。単一の開催回サイト。 [根拠1](https://www.jsod.jp/member/) [根拠2](https://convention.jtbcom.co.jp/jsod33/summary/index.html) [根拠3](https://convention.jtbcom.co.jp/jsod33/) |
| conf-jp-iscev-2027 | 2027 | 第75回 日本臨床視覚電気生理学会 | レビュー | [候補1](https://www.congre.co.jp/73jscev/) | 公式は2027年第73回。カードの第75回と不一致。学会本体が73jscevへ明示リンク。 [根拠1](https://n-practice.co.jp/jscev/meeting/latest.html) [根拠2](https://www.congre.co.jp/73jscev/) |
| conf-int-ascrs-2027 | 2027 | ASCRS 2027 Annual Meeting | レビュー | [候補1](https://annualmeeting.ascrs.org/)・[候補2](https://ascrs.confex.com/ascrs/27am/cfp.cgi) | Annual Meetingホームは403で年度を検証できない。2027年演題登録ページは確認できるが、イベントホームと用途が異なるため保留。同略称の大腸肛門外科学会を除外。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠2](https://annualmeeting.ascrs.org/) [根拠3](https://ascrs.confex.com/ascrs/27am/cfp.cgi) |
| oph-014 | 2027 | 第38回 日本緑内障学会 | 追加候補 | [候補1](https://site2.convention.co.jp/jgs2027/) | 学会本体が指定URLへ明示リンク。第38回・2027年・日本緑内障学会・国立京都国際会館を確認。URLは高信頼。単独会期4月23日とWGC合同4月20–23日の区別は別途日程レビュー。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.ryokunaisho.jp/expert/meeting/index.php) [根拠3](https://site2.convention.co.jp/jgs2027/info/) [根拠4](https://site2.convention.co.jp/jgs2027/greeting/) [根拠5](https://site2.convention.co.jp/jgs2027/) |
| conf-jp-lowvision-2027 | 2027 | 第28回 日本ロービジョン学会学術総会 | 専用URL未確認 | 未確認 | 運営事務局一覧に第28回・2027年5月22–23日・大阪国際会議場。対象回の専用URLは未確認。 [根拠1](https://www.ganki.jp/) |
| conf-jp-perimetry-2027 | 2027 | 第39回 日本視野画像学会学術集会 | レビュー | [候補1](https://www.ganki.jp/jips2027/) | 公式は2027年第16回。カードの第39回と不一致。jips2027は対象年・会場に対応するが開催回修正前は保留。 [根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) [根拠2](https://www.ganki.jp/jips2027/) |
| conf-jp-myopia-2027 | 2027 | 第8回 日本近視学会総会 | レビュー | [候補1](https://www.ganki.jp/myopia2027/)・[候補2](https://myopia2026.umin.ne.jp/) | 公式の2027年は第9回。カードの第8回は2026年の開催回。myopia2027は開催回修正前は保留。 [根拠1](https://www.ganki.jp/) [根拠2](https://www.myopiasociety.jp/member/meeting/) [根拠3](https://www.ganki.jp/myopia2027/) [根拠4](https://myopia2026.umin.ne.jp/) |
| conf-jp-circulation-2027 | 2027 | 第43回 日本眼循環学会 | 追加候補 | [候補1](https://convention.jtbcom.co.jp/43jsoc/) | 第43回、2027年7月17–18日、赤坂インターシティコンファレンスを本体案内と開催回サイトで照合。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.ganjunkan.org/info/) [根拠3](https://convention.jtbcom.co.jp/43jsoc/) |
| conf-jp-cataract-2027 | 2027 | 第66回 日本白内障学会総会・第53回 水晶体研究会 | 専用URL未確認 | 未確認 | 本体の年次総会案内に第66回・第53回・2027年9月4–5日・北里大学白金キャンパス。対象回専用URL未確認。 [根拠1](https://www.jscr.net/member/index.html) |
| conf-jp-pharmacology-2027 | 2027 | 第47回 日本眼薬理学会 | 専用URL未確認 | 未確認 | 対象回専用URL未確認。日本臨床薬理学会など別学会の第47回を除外。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-jp-oncology-2027 | 2027 | 第14回 日本眼腫瘍学会 | レビュー | 未確認 | 公式の2027年は第44回、富山国際会議場。カードの第14回と不一致。公式一覧内の2026年第43回と混同しない。 [根拠1](https://www.jsoo.jp/society) |
| conf-int-escrs-2027 | 2027 | ESCRS 2027 (45th Congress of the ESCRS) | 追加候補 | [候補1](https://www.escrs.org/escrs-annual-events/45th-congress-of-the-escrs) | 学会本体の第45回専用開催案内。2027年と第45回が一致。一覧で10月15–19日・Madridを照合。専用外部Congressサイトがなくても、この開催回公式ページは条件を満たす。 [根拠1](https://www.escrs.org/meetings-and-events) [根拠2](https://www.escrs.org/escrs-annual-events/45th-congress-of-the-escrs) |
| conf-jp-ringan-2027 | 2027 | 第81回 日本臨床眼科学会 (臨眼 2027) | 専用URL未確認 | 未確認 | 学会本体総会案内と名称・年検索で対象回専用URL未確認。80ringanは2026年なので流用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/sokai.html) |
| conf-int-aao-2027 | 2027 | AAO 2027 Annual Meeting | 専用URL未確認 | 未確認 | Annual Meeting共通ページを2027年へ流用しない。対象年の専用URL未確認。学会の複数年一覧は補助根拠のみ。 [根拠1](https://www.aao.org/annual-meeting/past-and-future-meetings) |
| conf-jp-neuro-2027 | 2027 | 第65回 日本神経眼科学会総会 | 専用URL未確認 | 未確認 | 対象回専用URL未確認。日本眼科学会の予定表に開催情報があるが、日本神経学会・日本神経科学学会など別学会を除外。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) |
| conf-int-asnos-2027 | 2027 | ASNOS 2027 (Asian Neuro-ophthalmology Society Congress) | 専用URL未確認 | 未確認 | 本体Future Meetingsは2027 ASNOS, Japanの一覧。対象開催回専用URL未確認。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-jp-ai-2027 | 2027 | 第3回 日本眼科AI学会総会 | レビュー | 未確認 | 第3回は2022年、2026年は第7回。カードの2027年第3回とは整合しない。現在の総会ページは2026年を案内するため採用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.jsaio.jp/meeting/) |
| conf-jp-jrvs-2027 | 2027 | 第66回 日本網膜硝子体学会総会 | 専用URL未確認 | 未確認 | 本体は2027年第66回を案内。対象回専用URL未確認。65moumakuは前年なので流用しない。 [根拠1](https://www.jrvs.jp/meeting.html) |
| conf-jp-presbyopia-2028 | 2028 | 第5回 日本老視学会学術総会 | レビュー | [候補1](https://www.rousi.jp/jps5) | 第5回公式開催概要は2027年1月16–17日、御茶ノ水。カードの2028年・京都と不一致。jps5を付けない。 [根拠1](https://www.rousi.jp/) [根拠2](https://www.rousi.jp/jps5-overview) [根拠3](https://www.rousi.jp/jps5) |
| conf-jp-surgery-2028 | 2028 | 第51回 日本眼科手術学会学術総会 | 専用URL未確認 | 未確認 | 本体学術総会案内は第50回2027年。第51回2028年の専用URL未確認。 [根拠1](https://www.jsos.jp/annual-meetings) |
| conf-jp-cornea-2028 | 2028 | 角膜カンファランス2028 | 専用URL未確認 | 未確認 | 本体今後の学会に2028年・第52回角膜／第44回移植・米子を確認。開催回サイト一覧は2027年までで対象回専用URL未確認。 [根拠1](https://cornea.gr.jp/conference/future/) |
| conf-jp-eyelid-2028 | 2028 | 第39回 日本眼瞼義眼床手術学会学術集会 | 専用URL未確認 | 未確認 | 対象回専用URL未確認。年度更新型ggigan.comの第37回2026年を流用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_other.html) |
| conf-jp-iscev-2028 | 2028 | 第76回 日本臨床視覚電気生理学会（韓日合同） | レビュー | 未確認 | 本体は2028年第74回（韓日合同）。カードの第76回と不一致。対象回専用URL未確認。 [根拠1](https://n-practice.co.jp/jscev/meeting/latest.html) |
| conf-jp-diabetic-2028 | 2028 | 第34回 日本糖尿病眼学会総会 | 専用URL未確認 | 未確認 | 本体の会員向け総会案内に第34回・2028年3月3–4日・札幌。対象回専用URL未確認。 [根拠1](https://www.jsod.jp/member/) |
| conf-int-ips-2028 | 2028 | IPS 2028 (26th International Perimetric Society Congress) | レビュー | 未確認 | 国内学会本体バナーにIPS2028第27回の表記。カードの26thと不一致。IPS本体のMeetingsは過去回中心で対象回専用URL未確認。Planetarium Society等の同略称別団体を除外。 [根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) [根拠2](https://square.umin.ac.jp/jips/index.html) [根拠3](https://www.perimetry.org/meetings/) |
| conf-jp-perimetry-2028 | 2028 | 第40回 日本視野画像学会学術集会 | レビュー | 未確認 | 本体は2028年第17回。カードの第40回と不一致。専用URL未確認。 [根拠1](https://square.umin.ac.jp/jips/meeting-seminar/meeting.html) |
| conf-int-apao-2028 | 2028 | APAO 2028 (43rd Asia-Pacific Academy of Ophthalmology Congress) | レビュー | [候補1](https://2028.apaophth.org/) | 年度サブドメインにAPAO2028・第43回の名称があるが初期投稿Hello worldのみ。開催情報が未整備で保留。取得502を不存在とは扱わない。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠2](https://2028.apaophth.org/) |
| conf-int-fujiretina-2028 | 2028 | FujiRetina 2028 | 専用URL未確認 | 未確認 | 本体は2028年第7回予定。共通イベントサイトは現在2027年なので流用しない。会場も本体は虎ノ門ヒルズでカードと相違。 [根拠1](https://www.jrvs.jp/meeting.html) [根拠2](https://www.jrvs.jp/fuji.html) [根拠3](https://convention.jtbcom.co.jp/fujiretina/) |
| conf-jp-jos-2028 | 2028 | 第132回 日本眼科学会総会 | 専用URL未確認 | 未確認 | 本体総会案内は第131回2027年。対象回専用URL未確認。131josを流用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/sokai.html) |
| conf-int-ascrs-2028 | 2028 | ASCRS 2028 Annual Meeting | 専用URL未確認 | 未確認 | 対象年専用URL未確認。Annual Meeting共通ページは取得403。同略称の大腸肛門外科学会の2028年ページを除外。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) |
| conf-int-arvo-2028 | 2028 | ARVO 2028 Annual Meeting | 専用URL未確認 | 未確認 | 本体Future Meetingsで2028年4月30日–5月4日Torontoを確認。Annual Meetingホームは2027年。対象回専用URL未確認。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠2](https://www.arvo.org/annual-meeting/about/future-meetings) [根拠3](https://www.arvo.org/annual-meeting) |
| conf-jp-myopia-2028 | 2028 | 第9回 日本近視学会総会 | レビュー | 未確認 | 運営一覧の2028年は第10回。カードの第9回と不一致。対象回専用URL未確認。 [根拠1](https://www.ganki.jp/) |
| conf-jp-lowvision-2028 | 2028 | 第29回 日本ロービジョン学会学術総会 | 専用URL未確認 | 未確認 | 本体・運営一覧・名称と年検索で対象回専用URL未確認。2026年lowvision2026を流用しない。 [根拠1](https://www.jslrr.org/) |
| conf-jp-pediatric-2028 | 2028 | 第84回 日本弱視斜視学会総会・第53回 日本小児眼科学会総会 | 専用URL未確認 | 未確認 | 本体総会案内・名称と年検索で対象回専用URL未確認。2027年合同サイトを流用しない。 [根拠1](https://www.jasa-web.jp/event/programs) |
| conf-jp-jsoprs-2028 | 2028 | 第15回 日本眼形成再建外科学会学術集会 (JSOPRS 2028) | 専用URL未確認 | 未確認 | 本体開催予定・履歴は第14回2027年まで。第15回2028年専用URL未確認。学会トップは採用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji.html) [根拠2](https://www.jsoprs.jp/学術集会開催履歴) |
| conf-jp-optics-2028 | 2028 | 第64回 日本眼光学学会総会 | 専用URL未確認 | 未確認 | 本体総会案内は第63回2027年。第64回2028年専用URL未確認。 [根拠1](https://www.jsoo-ws.com/events) |
| conf-jp-jscrs-2028 | 2028 | 第43回 JSCRS学術総会 (日本白内障屈折矯正手術学会) | 専用URL未確認 | 未確認 | 本体が第43回2028年を案内し、サイトは準備が出来次第公開と明記。第42回URLを流用しない。 [根拠1](https://www.jscrs.org/index/page/id/28) |
| conf-jp-inflammation-2028 | 2028 | 第65回 日本眼感染症学会・第61回 日本眼炎症学会・第60回 日本眼科アレルギー学会・第47回 日本涙道・涙液学会総会 | レビュー | 未確認 | 運営一覧の2028年は第61回眼炎症・第11回アレルギー・第16回涙道。カードのアレルギー第60回・涙道第47回と不一致。専用URL未確認。 [根拠1](https://www.ganki.jp/) |
| conf-jp-cl-2028 | 2028 | 第70回 日本コンタクトレンズ学会総会 | 専用URL未確認 | 未確認 | 本体の最新案内は第69回2027年。第70回2028年専用URL未確認。 [根拠1](https://www.clgakkai.jp/) |
| conf-jp-cataract-2028 | 2028 | 第67回 日本白内障学会総会・第54回 水晶体研究会 | 専用URL未確認 | 未確認 | 本体は第67回2028年、開催日未定と案内。対象回専用URL未確認。カードの9月2日は再確認が必要。 [根拠1](https://www.jscr.net/member/index.html) |
| conf-jp-oncology-2028 | 2028 | 第15回 日本眼腫瘍学会 | レビュー | 未確認 | カードの第15回は公式の2027年第44回という開催回系列と整合しない。2028年の正しい回数は年次加算だけで確定しない。対象回専用URL未確認。 [根拠1](https://www.jsoo.jp/society) |
| conf-jp-ringan-2028 | 2028 | 第82回 日本臨床眼科学会 (臨眼 2028) | 専用URL未確認 | 未確認 | 本体総会案内・名称と年検索で対象回専用URL未確認。2026年80ringanを流用しない。 [根拠1](https://www.nichigan.or.jp/member/syukai/sokai.html) |
| conf-int-escrs-2028 | 2028 | ESCRS 2028 (46th Congress of the ESCRS) | 追加候補 | [候補1](https://www.escrs.org/escrs-annual-events/46th-congress-of-the-escrs) | 学会本体の第46回専用開催案内。2028年・第46回が一致。公式一覧で10月6–10日を確認。開催回別の公式案内として条件を満たす。 [根拠1](https://www.escrs.org/meetings-and-events) [根拠2](https://www.escrs.org/escrs-annual-events/46th-congress-of-the-escrs) |
| conf-int-aao-2028 | 2028 | AAO 2028 Annual Meeting | 専用URL未確認 | 未確認 | 対象年専用URL未確認。Annual Meeting共通ページ／複数年一覧を2028年専用ページとは扱わない。 [根拠1](https://www.aao.org/annual-meeting/past-and-future-meetings) |
| conf-int-apvrs-2028 | 2028 | APVRS 2028 (18th Asia-Pacific Vitreo-retina Society Congress) | レビュー | 未確認 | 本体Congressesの2028年は第21回、11月16–19日Bangkok。カードの第18回と不一致。対象回専用URL未確認。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠2](https://apvrs.org/congresses/) |
| conf-int-woc-2028 | 2028 | WOC 2028 (World Ophthalmology Congress) | レビュー | [候補1](https://icoph.org/world-ophthalmology-congress/) | ICOのCongress総合案内にはWOC2028の見出しがあるが複数年向けのページで、対象回専用URLを確定できない。同名に近い非ICO会議サイトを除外。 [根拠1](https://www.nichigan.or.jp/member/syukai/hyoji_international.html) [根拠2](https://icoph.org/world-ophthalmology-congress/) |
| conf-jp-pharmacology-2028 | 2028 | 第48回 日本眼薬理学会 | 専用URL未確認 | 未確認 | 運営事務局一覧に第48回・2028年11月18–19日・神戸。対象回専用URL未確認。 [根拠1](https://www.ganki.jp/) |
| conf-jp-neuro-2028 | 2028 | 第66回 日本神経眼科学会総会 | 専用URL未確認 | 未確認 | 運営事務局一覧に第66回・2028年11月24–25日。対象回専用URL未確認。日本神経学会など別学会を除外。 [根拠1](https://www.ganki.jp/) |
| conf-jp-jrvs-2028 | 2028 | 第67回 日本網膜硝子体学会総会・第44回 日本眼循環学会 | 専用URL未確認 | 未確認 | 本体に第67回網膜硝子体／第44回眼循環の2028年合同開催を確認。対象回専用URL未確認。 [根拠1](https://www.jrvs.jp/meeting.html) |

## 確認範囲と限界

全54件を現データから抽出し、54件それぞれの名称・開催年検索を実施し、公式一覧や開催回サイトと前回記録を照合した。すべての未確認サイトの未公開・不存在を証明した監査ではない。会場等の情報があることと開催回サイトの公開は同義ではない。

医学書院・JOIA等のカレンダーは補助として利用し、学会本体・運営事務局の一次情報を優先した。ganki.jp、ASCRSホーム、AAO一覧、APAO2028にはタイムアウト・403・502等の取得制限があり、取得できた一次情報の検索索引も利用した。そのため未確認のものは空欄を維持する。カードの日付・会場の相違は見つかった範囲で記録したが、本件はそれら全項目の再監査・修正ではない。

