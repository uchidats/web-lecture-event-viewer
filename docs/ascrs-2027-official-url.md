# ASCRS 2027 大会公式URLの手動確認（2026-10-13）

ユーザーによる明示的な公式URL確認・登録指示を受け、eventOfficialUrlと旧officialUrlを https://annualmeeting.ascrs.org/ に設定した。旧学会本体URL https://ascrs.org/ はsocietyUrlに保持する。

大会トップは取得時HTTP403となったため、本文を確認できたとは扱っていない。

- [ASCRS公式演題募集ページ](https://ascrs.confex.com/ascrs/27am/cfp.cgi)：2027 ASCRS ASOA Annual Meeting、April 2–5, 2027、San Diego, CAと大会サイトへのリンクを確認。検索索引の公式ページ内容と、既存の公式リンク確認記録も照合した。
- [会場運営者の大会掲載](https://www.visitsandiego.com/calendar/2209273-ascrs-2027-annual-meeting)：2027-04-02～04-05、San Diego Convention Centerを確認。

会期、会場、開催都市、タイトルは既存値と一致するため維持。登録・演題期限など今回の対象外の未確認項目は補完していない。

カードタイトル・カレンダー詳細・簡易表示詳細はeventOfficialUrlを使用する。Gemini監視もeventOfficialUrlを最優先するため、監視対象は大会URLへ切り替わる。HTTP403は取得失敗として扱い、推測や学会本体URLへの自動差し戻しはしない。
