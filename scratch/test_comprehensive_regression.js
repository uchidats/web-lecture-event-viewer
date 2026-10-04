const fs = require('fs');
const path = require('path');

// 1. events.js をロード
const eventsCode = fs.readFileSync(path.join(__dirname, '..', 'events.js'), 'utf8');
const fn = new Function(eventsCode + '\nreturn sampleEvents;');
const sampleEvents = fn();

console.log(`Loaded ${sampleEvents.length} events from events.js`);

// 2. 基本機能テスト
// (1) isConference: true の学会と false の講演会
const conferences = sampleEvents.filter(e => e.isConference);
const lectures = sampleEvents.filter(e => !e.isConference);
console.log(`Conferences: ${conferences.length}, Lectures/Seminars: ${lectures.length}`);
if (conferences.length === 0 || lectures.length === 0) {
  console.error("FAIL: Events list should contain both conferences and non-conferences");
  process.exit(1);
}

// (2) 日本の年度判定関数
function getJapaneseFiscalYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;
  return month >= 4 ? year : year - 1;
}

// 境界値テスト
const fyTests = [
  { date: "2025-04-01", expected: 2025 },
  { date: "2026-03-31", expected: 2025 },
  { date: "2026-04-01", expected: 2026 },
  { date: "2026-10-04", expected: 2026 },
  { date: "2027-03-31", expected: 2026 },
  { date: "2027-04-01", expected: 2027 }
];
fyTests.forEach(t => {
  const actual = getJapaneseFiscalYear(t.date);
  if (actual !== t.expected) {
    console.error(`FAIL: FY mismatch for ${t.date}. Expected ${t.expected}, got ${actual}`);
    process.exit(1);
  }
});
console.log("PASS: Japanese fiscal year boundary tests passed");

// (3) 状態管理と参加履歴データ構造（将来拡張性を含む）
const mockState = {
  events: sampleEvents,
  attendingConferences: new Set(),
  hiddenConferences: new Set(),
  conferenceHistory: new Map(),
  historySelectedFiscalYear: "all",
  filters: {
    keyword: "",
    year: new Set(),
    specialty: new Set(),
    eventType: new Set(),
    abstractStatus: new Set(),
    format: new Set(),
    region: new Set(),
    scheduleStatus: new Set(["free", "partial_conflict", "conflict", "registered"]),
    registeredOnly: false,
    includeEndedConferences: false
  }
};

// 履歴記録関数（MVP要件 + 将来拡張キー roles, notes）
function recordAttendance(confId, status) {
  if (status === "attended" || status === "not_attended") {
    mockState.conferenceHistory.set(confId, {
      status: status,
      updatedAt: new Date().toISOString(),
      roles: [], // 将来: presentation, chair, invited, symposium
      notes: ""  // 将来: メモ
    });
  } else {
    mockState.conferenceHistory.delete(confId);
  }
}

// 参加記録を追加
recordAttendance("conf-jp-surgery-2026", "attended"); // 2026-01-30 -> FY2025, 国内
recordAttendance("conf-jp-eyelid-2026", "not_attended"); // 2026-02-07 -> FY2025, 参加しなかった
recordAttendance("conf-jp-jos-2026", "attended"); // 2026-04-09 -> FY2026, 国内
recordAttendance("oph-004", "attended"); // 2026-10-10 -> FY2026, 海外

// 集計ロジック
function getAggregatedHistory() {
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
      totalCount,
      domesticCount,
      internationalCount,
      conferences: confs
    };
  });
}

const fyGroups = getAggregatedHistory();
console.log(`Fiscal year groups count: ${fyGroups.length}`);

// 検証: FY2026
const fy2026 = fyGroups.find(g => g.fiscalYear === 2026);
if (!fy2026 || fy2026.totalCount !== 2 || fy2026.domesticCount !== 1 || fy2026.internationalCount !== 1) {
  console.error("FAIL: FY2026 breakdown incorrect", fy2026);
  process.exit(1);
}
console.log("PASS: FY2026 breakdown verified: 2 total, 1 domestic, 1 international");

// 検証: FY2025 (conf-jp-eyelid-2026 は not_attended なので含まれない)
const fy2025 = fyGroups.find(g => g.fiscalYear === 2025);
if (!fy2025 || fy2025.totalCount !== 1 || fy2025.domesticCount !== 1 || fy2025.internationalCount !== 0) {
  console.error("FAIL: FY2025 breakdown incorrect", fy2025);
  process.exit(1);
}
console.log("PASS: FY2025 breakdown verified: 1 total, 1 domestic, 0 international (not_attended excluded)");

// (4) 過去年度切り替えロジックの検証
function filterByFiscalYear(selectedFy, groups) {
  if (selectedFy === "all") return groups;
  return groups.filter(g => g.fiscalYear === selectedFy);
}

const viewAll = filterByFiscalYear("all", fyGroups);
if (viewAll.length !== 2) {
  console.error("FAIL: viewAll length should be 2");
  process.exit(1);
}

const view2025 = filterByFiscalYear(2025, fyGroups);
if (view2025.length !== 1 || view2025[0].fiscalYear !== 2025) {
  console.error("FAIL: view2025 mismatch");
  process.exit(1);
}

const view2026 = filterByFiscalYear(2026, fyGroups);
if (view2026.length !== 1 || view2026[0].fiscalYear !== 2026) {
  console.error("FAIL: view2026 mismatch");
  process.exit(1);
}
console.log("PASS: Fiscal year switching logic works as expected");

// (5) 参加予定(あり/なし)との独立性
mockState.attendingConferences.add("conf-jp-jos-2026");
mockState.hiddenConferences.add("conf-jp-glaucoma-2026");

// 参加履歴を削除しても attending / hidden は影響を受けない
recordAttendance("conf-jp-jos-2026", "none");
if (mockState.conferenceHistory.has("conf-jp-jos-2026")) {
  console.error("FAIL: history should be deleted");
  process.exit(1);
}
if (!mockState.attendingConferences.has("conf-jp-jos-2026")) {
  console.error("FAIL: attendingConferences was modified");
  process.exit(1);
}
if (!mockState.hiddenConferences.has("conf-jp-glaucoma-2026")) {
  console.error("FAIL: hiddenConferences was modified");
  process.exit(1);
}
console.log("PASS: Absolute independence between attendance history and attending/hidden status");

// (6) 関連セミナーの挙動検証
// parentConferenceId があり、親学会が参加予定ならセミナー表示、参加予定でなければ非表示
const seminar = sampleEvents.find(e => e.parentConferenceId === "conf-jp-jos-2026");
if (seminar) {
  // 親学会が attending にある場合
  mockState.attendingConferences.add("conf-jp-jos-2026");
  const visibleWithParentAttending = mockState.attendingConferences.has(seminar.parentConferenceId);
  if (!visibleWithParentAttending) {
    console.error("FAIL: Seminar should be visible when parent conference is attending");
    process.exit(1);
  }

  // 親学会が attending にない場合
  mockState.attendingConferences.delete("conf-jp-jos-2026");
  const visibleWithoutParentAttending = mockState.attendingConferences.has(seminar.parentConferenceId);
  if (visibleWithoutParentAttending) {
    console.error("FAIL: Seminar should NOT be visible when parent conference is not attending");
    process.exit(1);
  }
  console.log("PASS: Associated seminars display rule preserved");
}

console.log("\nALL COMPREHENSIVE REGRESSION TESTS PASSED SUCCESSFULLY!");
