# 公式参加登録ページの1階層取得

Gemini Monitorと旧Auto Updaterで共通の `registration-followup.js` を使用する。トップにある参加登録／事前参加登録／参加申込／Registration／Register／参加者の皆様へに一致するリンクのみ、最大2ページを追加取得する。子ページのリンクは辿らない。重複・アンカー・外部ドメイン・同一ホストの別大会ディレクトリは除外する。HTTP取得は既存のtimeout・サイズ・リダイレクト検証を利用する。

子ページのタイトルと現在の大会名・回次が一致し、期間の日付・カテゴリー・タイムゾーンが明確な場合だけ、公式ラベルとsourceUrlを保持した `registration.version=2 / periods[]` を生成する。早期はearly、事前参加登録・通常はregular、直前・当日はonsiteとし、onsiteはadvanceEligible=false。第1次／第2次など意味が不明な区分や、年の省略、不正日付、期間の一部不明、ページ間の矛盾、国際学会で不明なタイムゾーンはreviewへ回す。phaseを推測で生成しない。

Gemini側は従来の公式情報・同一大会・高confidence判定に加え、構造全体のvalidatorを適用する。単一registration_deadlineではphaseを生成しない。旧Auto Updaterは未知の登録情報の補完だけを安全な自動適用対象とし、既存構造・確定済みlegacy締切の変更は従来どおりreviewとする。保存直前にも検証し、旧フィールドを削除しない。

トップが未変更でも子ページは取得し、その内容（締切時刻を含む）をhashに含める。子ページだけの更新を見逃さない。

## 第33回 日本糖尿病眼学会総会

公式トップ: https://convention.jtbcom.co.jp/jsod33/

公式登録ページ: https://convention.jtbcom.co.jp/jsod33/join/index.html

2026年10月15日の確認内容（fixtureに保存）:

- 事前参加登録: 2026年9月9日正午〜2027年2月2日。regular / advanceEligible=true
- 直前・当日参加登録: 2027年2月23日正午〜2027年3月13日。onsite / advanceEligible=false
- timeZone: Asia/Tokyo。終了時刻は記載がないため補わず、日付のみは現地当日終了まで有効

通常カードは既存の共通ヘルパーにより「事前参加登録：2月2日 締切」を表示し、並び替えも同じ締切を使う。直前・当日登録の3月13日を事前登録締切には使わない。
