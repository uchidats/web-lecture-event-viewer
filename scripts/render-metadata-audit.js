const fs=require('node:fs'),path=require('node:path');
function renderAudit(root=path.resolve(__dirname,'..')){
  const report=JSON.parse(fs.readFileSync(path.join(root,'reports/event-metadata-audit-2026-10-09.json'),'utf8'));
  const labels={title:'タイトル',edition:'回次',year:'開催年',date:'開始日',endDate:'終了日',cityCountry:'開催地',venue:'会場',sponsor:'主催学会',subtitle:'テーマ',registration:'参加登録期間','abstractSubmission.deadline':'演題締切',eventOfficialUrl:'公式URL'};
  const fmt=v=>v==null?'未登録／未確認':(typeof v==='object'?JSON.stringify(v):String(v)).replaceAll('|','／').replaceAll('\n',' ');
  const diff=r=>r.differences.map(c=>`${labels[c.field]}：${fmt(c.current)} → ${fmt(c.official)}${c.result==='notation-difference'?'（表記差）':''}${c.confidence<0.95?'（抽出候補・要原文確認・反映対象外）':''}`).join('<br>')||'確定した差分なし（未確認項目を参照）';
  const sources=r=>[...new Set(r.comparisons.filter(c=>c.url).map(c=>c.url))].map((url,i)=>`[根拠${i+1}](${url})`).join(' ')||r.documents.map((d,i)=>`[参照${i+1}](${d.url})`).join(' ')||'公式情報未確認';
  const table=rows=>rows.length?'| ID | 現在のカード | 判定 | 確認した差分 | 根拠 |\n| --- | --- | --- | --- | --- |\n'+rows.map(r=>`| ${r.eventId} | ${fmt(r.title)} | ${r.category} | ${diff(r)} | ${sources(r)} |`).join('\n'):'該当なし。';
  const text=`# 全イベント公式整合性監査（2026-10-09）

対象は全${report.total}件（国内・海外学会85件と講演会・研究会・共催セミナー9件）。events.jsの変更、commit／pushは実施しない。監査は自動更新パイプラインと独立して実行した。

## 全体集計

| 分類 | 件数 |
| --- | ---: |
${Object.entries(report.summary).map(([k,v])=>`| ${k} | ${v} |`).join('\n')}

優先度：高${report.priorityCounts['高']}件、中${report.priorityCounts['中']}件、低${report.priorityCounts['低']}件。優先度は修正候補の影響度であり、低は正しさや安全性を保証する意味ではない。

verifiedはタイトル・回次・年・開始／終了日・開催地・会場・主催・テーマを照合できたものだけ。今回は未確認項目が残るためverified=0。全件が誤情報という意味ではない。締切・参加登録期間が取得できない場合も、その項目をunverifiedとして残す。URL欠落だけと確定できたものは0件で、別年度疑義のあるレコードへURLだけを付けない。

分類は排他的。開催年／回次の矛盾をpossible-wrong-editionとして最優先に分類し、確認できた他の差分はmetadata-mismatch、本文のBot保護は開催回候補URLがある場合だけbot-protectedにする。not-foundは今回公式開催情報を確認できない5件で、不存在の断定ではない。HTTP取得失敗だけをnot-foundとは扱わない。

## 高優先度（年・回次・日程・会場等）

${table(report.records.filter(r=>r.priority==='高'))}

第4回老視学会：タイトルの語順は表記差。開催年2027→2026、会期2027/1/16–17→2026/1/17–18、会場は御茶ノ水→品川、テーマは「老視矯正のサイエンスと臨床実践」→「アンメットニーズはここにある」。日程・会場は2027年第5回に近く、現カードが第4回と第5回のどちらを指すか人間が確認する必要がある。

第3回眼科AI学会は公式の過去回記録（2022年・京都）との照合。2027年の正しい開催回・日程を年次加算で推測したものではない。緑内障2027の単独会期4/23とWGC合同会期4/20–23は対象範囲の違いなので、即座に誤情報と断定しない。

## 中優先度（タイトル・テーマ・登録期間等）

${table(report.records.filter(r=>r.priority==='中'))}

現在値が空欄で公式期間を確認できたものは補完候補。期限が誤っていると断定するものではない。旧earlyBirdDeadlineの「締切済」は期間未登録とは分けてレビュー画面に表示する。表記差は差分として残すが誤情報と断定しない。

参加登録期間は延長前後・登録種別・関連企画が混在する可能性のある抽出候補で、信頼度0.8以下として反映対象から除外した。公式原表で再確認が必要。大学教室や開催事務局の記載も主催学会と同義ではないため、主催欄は未確認として扱った。

## URL欠落のみ

${table(report.records.filter(r=>r.category==='official-url-missing'))}

主要情報の未確認や他の差分があるURL欠落イベントは、この一覧に含めない。

## 取得不能・要人手確認

${table(report.records.filter(r=>['bot-protected-official-candidate','insufficient-evidence','not-found'].includes(r.category)))}

not-foundの5件はexample.comの仮URLのみで、名称の検索でも対応する公式開催情報を確認できなかった。検索結果から開催情報を確定したものではない。共催セミナー4件は親学会ページだけでは個別プログラムの一致を確認できないためinsufficient-evidence。将来回の未公開サイトや画像のみの記載は、PDF／公式プログラムを含めて人手確認が必要。

## 全94件と項目ごとの確認範囲

| ID | 判定 | 優先度 | 未確認項目 |
| --- | --- | --- | --- |
${report.records.map(r=>`| ${r.eventId} | ${r.category} | ${r.priority} | ${r.uncheckedFields.map(f=>labels[f]).join('、')||'なし'} |`).join('\n')}

各イベント12項目の現在値・公式値・差分・出典・confidence・HTTP取得記録は [監査JSON](../reports/event-metadata-audit-2026-10-09.json) に保存。公式ページ本文からの抽出と、metadata-audit-observations.jsに記録した2026-10-09の一次情報閲覧観察を併用。取得済み本文にある共通メニュー／過去写真／別年度リンクは当該開催回として採用しない。将来再監査するときは観察記録も再確認する。

## 管理レビューと人間承認

全94件をreports/auto-update-review.jsonにofficial-metadata-auditとして追加。過去の抽出途中の判定はsupersededで履歴を保持し、現行の監査は各イベント1項目。既存の自動更新レビューは残す。レビュー画面には現在値／公式値／差分／根拠URL／confidence／理由／未確認項目を表示し、スマホでは比較表を横スクロールできる。

差分のある項目はeventMetadataのまとめ承認。特に年・回次の疑義がある場合は対象開催回を先に選ぶ。低信頼のURL候補は変更セットに入れない。未確認だけの項目は「採用」を無効にする。自動承認候補のチェックボックスも監査項目には出さない。

人間が「採用」→「承認した監査修正を出力」後、管理者が明示的に以下を実行する。通常の自動更新・定期実行から呼ばない。

\`\`\`sh
node scripts/apply-reviewed-event-metadata.js --decisions <承認JSON>
node scripts/apply-reviewed-event-metadata.js --decisions <承認JSON> --apply
\`\`\`

未承認・署名不一致・監査後のデータ変更は拒否する。承認はブラウザ内の判断と管理者が扱うJSONであり、電子署名ではない。反映はバックアップ付きで、IDと利用者の参加履歴等の参照を維持する。日付変更時は表示用periodを同期し、物理会場変更時は旧venueId／timeZoneの紐づけを解除する。新しいタイムゾーンは推測せず、カレンダー登録の再確認が必要。

現在の移行テストには過去監査スナップショットとの一致を検証するものがある。将来、人間承認で実データを修正した後は、その承認記録に合わせて該当テストの期待値も確認する。今回はevents.jsを変更していない。

## 再実行・テスト

node scripts/audit-event-metadata.js：全件取得・監査・レビュー出力のみ。
node scripts/render-metadata-audit.js：監査JSONから本一覧を再生成。
node scratch/test_metadata_audit.js：第4回の7差分、表記差の区別、94件の網羅、登録ページの会場混入防止、未承認の反映拒否、承認後だけ隔離コピーを更新、ID維持を検証。
`;
  fs.writeFileSync(path.join(root,'docs/event-metadata-audit-2026-10-09.md'),text);
  return report.summary;
}
if(require.main===module)console.log(JSON.stringify(renderAudit(),null,2));
module.exports={renderAudit};
