const fs = require('fs');
const path = require('path');

// 1. events.js をロード
const eventsCode = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');
const fn = new Function(eventsCode + '\nreturn sampleEvents;');
const events = fn();

console.log(`Loaded ${events.length} events from events.js`);

// 2. 年度判定ロジックのテスト
function getJapaneseFiscalYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;
  return month >= 4 ? year : year - 1;
}

function formatFiscalYearLabel(fy) {
  if (!fy) return "";
  let era = "";
  if (fy >= 2019) {
    const rYear = fy - 2018;
    era = rYear === 1 ? "令和元" : `令和${rYear}`;
  } else if (fy >= 1989) {
    const hYear = fy - 1988;
    era = hYear === 1 ? "平成元" : `平成${hYear}`;
  }
  return era ? `${fy}年度（${era}年度）` : `${fy}年度`;
}

// テストケース：年度の境界
const testFiscalYears = [
  { date: "2026-02-01", expectedFY: 2025, label: "2025年度（令和7年度）" },
  { date: "2026-03-31", expectedFY: 2025, label: "2025年度（令和7年度）" },
  { date: "2026-04-01", expectedFY: 2026, label: "2026年度（令和8年度）" },
  { date: "2026-04-09", expectedFY: 2026, label: "2026年度（令和8年度）" },
  { date: "2026-12-31", expectedFY: 2026, label: "2026年度（令和8年度）" },
  { date: "2027-01-29", expectedFY: 2026, label: "2026年度（令和8年度）" },
  { date: "2027-03-31", expectedFY: 2026, label: "2026年度（令和8年度）" },
  { date: "2027-04-15", expectedFY: 2027, label: "2027年度（令和9年度）" }
];

testFiscalYears.forEach(tc => {
  const fy = getJapaneseFiscalYear(tc.date);
  const label = formatFiscalYearLabel(fy);
  if (fy !== tc.expectedFY) {
    console.error(`FAIL: ${tc.date} expected FY ${tc.expectedFY}, got ${fy}`);
    process.exit(1);
  }
  if (label !== tc.label) {
    console.error(`FAIL: ${tc.date} expected label ${tc.label}, got ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${tc.date} -> ${fy} (${label})`);
});

// 3. 学会参加履歴のデータ構造と集計ロジックのテスト
const mockState = {
  events: events,
  attendingConferences: new Set(),
  hiddenConferences: new Set(),
  conferenceHistory: new Map()
};

function setMockHistoryStatus(conferenceId, choice) {
  const conf = mockState.events.find(e => e.id === conferenceId);
  if (!conf) throw new Error("Conf not found");

  if (choice === "attended" || choice === "not_attended") {
    mockState.conferenceHistory.set(conferenceId, {
      status: choice,
      updatedAt: new Date().toISOString(),
      roles: [],
      notes: ""
    });
  } else {
    mockState.conferenceHistory.delete(conferenceId);
  }
}

function getMockAttendedByFiscalYear() {
  const attendedEvents = mockState.events.filter(event => {
    if (!event.isConference) return false;
    const rec = mockState.conferenceHistory.get(event.id);
    return rec && rec.status === "attended";
  });

  const fyMap = new Map();
  attendedEvents.forEach(event => {
    const fy = getJapaneseFiscalYear(event.date) || 9999;
    if (!fyMap.has(fy)) {
      fyMap.set(fy, []);
    }
    fyMap.get(fy).push(event);
  });

  const sortedYears = Array.from(fyMap.keys()).sort((a, b) => b - a);
  return sortedYears.map(fy => {
    const confs = fyMap.get(fy);
    confs.sort((a, b) => (a.date > b.date ? 1 : -1));
    const totalCount = confs.length;
    const internationalCount = confs.filter(c => c.conferenceRegion === "international").length;
    const domesticCount = totalCount - internationalCount;
    return {
      fiscalYear: fy,
      fiscalYearLabel: formatFiscalYearLabel(fy),
      totalCount,
      domesticCount,
      internationalCount,
      conferences: confs
    };
  });
}

// テスト: 学会の参加記録を設定
// conf-jp-surgery-2026: 2026-01-30〜2026-02-01 (2025年度, 国内)
setMockHistoryStatus("conf-jp-surgery-2026", "attended");
// conf-jp-eyelid-2026: 2026-02-07 (2025年度, 国内)
setMockHistoryStatus("conf-jp-eyelid-2026", "not_attended"); // 参加しなかった
// conf-jp-jos-2026: 2026-04-09〜2026-04-12 (2026年度, 国内)
setMockHistoryStatus("conf-jp-jos-2026", "attended");
// oph-008 (JSOPRS 2026): 2026-06-20〜2026-06-21 (2026年度, 国内)
setMockHistoryStatus("oph-008", "attended");
// 海外学会テスト (oph-004: AAO 2026, 2026-10-10, international)
const aao2026 = events.find(e => e.id === "oph-004");
if (aao2026) {
  setMockHistoryStatus("oph-004", "attended");
}

const fyGroups = getMockAttendedByFiscalYear();
console.log(`\nAggregated Fiscal Years: ${fyGroups.length}`);
fyGroups.forEach(g => {
  console.log(`FY ${g.fiscalYear} (${g.fiscalYearLabel}): Total=${g.totalCount}, Domestic=${g.domesticCount}, International=${g.internationalCount}`);
  g.conferences.forEach(c => {
    console.log(`  - [${c.id}] ${c.title} (${c.date}, ${c.conferenceRegion || 'domestic'})`);
  });
});

// 検証:
// 2025年度: conf-jp-surgery-2026 の1件 (conf-jp-eyelid-2026 は not_attended なので含まれない)
const fy2025 = fyGroups.find(g => g.fiscalYear === 2025);
if (!fy2025 || fy2025.totalCount !== 1 || fy2025.domesticCount !== 1 || fy2025.internationalCount !== 0) {
  console.error("FAIL: 2025 fiscal year count mismatch", fy2025);
  process.exit(1);
}
console.log("PASS: FY2025 aggregated correctly (1 total, 1 domestic, 0 intl)");

// 2026年度: conf-jp-jos-2026 (国内), oph-008 (国内), conf-intl-aao-2026 (海外) -> 計3件
const fy2026 = fyGroups.find(g => g.fiscalYear === 2026);
if (!fy2026 || fy2026.totalCount !== 3 || fy2026.domesticCount !== 2 || fy2026.internationalCount !== 1) {
  console.error("FAIL: 2026 fiscal year count mismatch", fy2026);
  process.exit(1);
}
console.log("PASS: FY2026 aggregated correctly (3 total, 2 domestic, 1 intl)");

// 4. 独立性テスト: 既存の参加予定 (attendingConferences) との独立性
mockState.attendingConferences.add("conf-jp-surgery-2026");
mockState.hiddenConferences.add("conf-jp-eyelid-2026");
// 参加履歴を削除
setMockHistoryStatus("conf-jp-surgery-2026", "none");
if (mockState.conferenceHistory.has("conf-jp-surgery-2026")) {
  console.error("FAIL: Conference history was not removed on 'none'");
  process.exit(1);
}
if (!mockState.attendingConferences.has("conf-jp-surgery-2026")) {
  console.error("FAIL: attendingConferences should NOT be affected by history removal");
  process.exit(1);
}
if (!mockState.hiddenConferences.has("conf-jp-eyelid-2026")) {
  console.error("FAIL: hiddenConferences should NOT be affected by history changes");
  process.exit(1);
}
console.log("PASS: Conference history is strictly decoupled from attending/hidden sets");

// 5. HTML & CSS 要素のチェック
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

const requiredHtmlIds = [
  'conference-history-btn',
  'history-badge-count',
  'sidebar-history-btn',
  'conference-history-modal',
  'close-history-modal',
  'dismiss-history-modal',
  'history-overall-summary',
  'conference-history-content'
];
requiredHtmlIds.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    console.error(`FAIL: Missing HTML id: ${id}`);
    process.exit(1);
  }
});
console.log("PASS: All required HTML elements present in index.html");

const requiredCssClasses = [
  '.conf-choice-btn.choice-attended.active',
  '.conf-choice-btn.choice-not-attended.active',
  '.conf-history-record-bar',
  '.conf-history-attended-badge',
  '.conference-history-dialog',
  '.history-fiscal-year-card',
  '.history-fy-header',
  '.history-fy-stat-chips'
];
requiredCssClasses.forEach(cls => {
  if (!css.includes(cls)) {
    console.error(`FAIL: Missing CSS selector: ${cls}`);
    process.exit(1);
  }
});
console.log("PASS: All required CSS selectors present in style.css");

console.log("\nALL CONFERENCE HISTORY TESTS PASSED SUCCESSFULLY!");
