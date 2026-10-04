const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. events.js をロード
const eventsCode = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');
const fn = new Function(eventsCode + '\nreturn sampleEvents;');
const events = fn();

console.log(`Loaded ${events.length} events from events.js`);

// 2. isConferenceEnded 判定関数のテスト
function isConferenceEnded(event, todayStr) {
  if (!event.isConference) return false;
  const targetEnd = event.endDate || event.date;
  if (!targetEnd) return false;
  return targetEnd < todayStr;
}

const todayStr = '2026-10-04';

const endedConfs = events.filter(e => isConferenceEnded(e, todayStr));
console.log(`Ended conferences as of ${todayStr}: ${endedConfs.length}`);
endedConfs.forEach(e => {
  console.log(`  - [${e.id}] ${e.title} (endDate: ${e.endDate || e.date})`);
});

// 終了学会が7件であることを確認
if (endedConfs.length !== 7) {
  console.error(`FAIL: Expected 7 ended conferences, got ${endedConfs.length}`);
  process.exit(1);
}

// 本日終了の緑内障学会が終了扱いになっていないこと（未終了であること）の確認
const glaucoma2026 = events.find(e => e.id === 'conf-jp-glaucoma-2026');
if (!glaucoma2026) {
  console.error('FAIL: conf-jp-glaucoma-2026 not found');
  process.exit(1);
}
if (isConferenceEnded(glaucoma2026, todayStr)) {
  console.error('FAIL: conf-jp-glaucoma-2026 should NOT be ended today (ends 2026-10-04)');
  process.exit(1);
}
console.log('PASS: conf-jp-glaucoma-2026 is active on ending day (today)');

// 明日 (2026-10-05) になったら緑内障学会が終了扱いになることの確認
if (!isConferenceEnded(glaucoma2026, '2026-10-05')) {
  console.error('FAIL: conf-jp-glaucoma-2026 should be ended tomorrow (2026-10-05)');
  process.exit(1);
}
console.log('PASS: conf-jp-glaucoma-2026 is ended on 2026-10-05');

// 一般講演会 (isConference: false) は endDate が過去でも終了判定されないことの確認
const nonConfPast = {
  id: 'test-lecture-past',
  isConference: false,
  date: '2026-09-01',
  endDate: '2026-09-01'
};
if (isConferenceEnded(nonConfPast, todayStr)) {
  console.error('FAIL: Non-conference event should not be flagged as ended conference');
  process.exit(1);
}
console.log('PASS: Non-conference event is not flagged as ended conference');

// 3. フィルタリングロジックのシミュレーションテスト
function simulateFilter({ includeEndedConferences, attendingConferences = new Set(), hiddenConferences = new Set(), years = new Set() }) {
  return events.filter(event => {
    // 終了済み学会の除外
    if (!includeEndedConferences && event.isConference) {
      if (isConferenceEnded(event, todayStr)) {
        return false;
      }
    }

    // 非表示学会の除外
    if (event.isConference && hiddenConferences.has(event.id)) {
      return false;
    }

    // 関連セミナー
    if (event.parentConferenceId) {
      if (!attendingConferences.has(event.parentConferenceId)) {
        return false;
      }
      if (!includeEndedConferences) {
        const parentConf = events.find(e => e.id === event.parentConferenceId);
        if (parentConf && isConferenceEnded(parentConf, todayStr)) {
          return false;
        }
      }
    }

    // 年フィルター
    if (years.size > 0) {
      const eventYear = parseInt(event.date.substring(0, 4), 10);
      if (!years.has(eventYear)) {
        return false;
      }
    }

    return true;
  });
}

// デフォルト状態（includeEndedConferences: false）
const defaultResults = simulateFilter({ includeEndedConferences: false });
const conferencesInDefault = defaultResults.filter(e => e.isConference);
console.log(`Default filtered conferences count: ${conferencesInDefault.length} (total confs: ${events.filter(e => e.isConference).length})`);
if (conferencesInDefault.some(e => isConferenceEnded(e, todayStr))) {
  console.error('FAIL: Default results contain ended conferences');
  process.exit(1);
}
console.log('PASS: No ended conferences in default view');

// 「終了した学会も表示」ON状態（includeEndedConferences: true）
const includeEndedResults = simulateFilter({ includeEndedConferences: true });
const conferencesInEnded = includeEndedResults.filter(e => e.isConference);
console.log(`Include ended conferences count: ${conferencesInEnded.length}`);
if (conferencesInEnded.length !== events.filter(e => e.isConference).length) {
  console.error('FAIL: Include ended should show all conferences');
  process.exit(1);
}
console.log('PASS: All conferences shown when includeEndedConferences is true');

// 年フィルターとの併用テスト (2026年のみ)
const year2026EndedOn = simulateFilter({ includeEndedConferences: true, years: new Set([2026]) });
const year2026EndedOff = simulateFilter({ includeEndedConferences: false, years: new Set([2026]) });
console.log(`2026 with ended confs: ${year2026EndedOn.length}, without: ${year2026EndedOff.length} (diff: ${year2026EndedOn.length - year2026EndedOff.length})`);
if (year2026EndedOn.length - year2026EndedOff.length !== 7) {
  console.error(`FAIL: Difference should be 7 (all 7 ended conferences are in 2026), got ${year2026EndedOn.length - year2026EndedOff.length}`);
  process.exit(1);
}
console.log('PASS: Year filter + includeEndedConferences combination works correctly');

// HTML & CSS 検証
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

if (!html.includes('id="filter-include-ended"')) {
  console.error('FAIL: #filter-include-ended not found in index.html');
  process.exit(1);
}
console.log('PASS: #filter-include-ended exists in index.html');

if (!css.includes('.conf-ended-badge') || !css.includes('.card-conference-ended')) {
  console.error('FAIL: Ended styles not found in style.css');
  process.exit(1);
}
console.log('PASS: Ended styles exist in style.css');

console.log('\nALL TESTS PASSED SUCCESSFULLY!');
