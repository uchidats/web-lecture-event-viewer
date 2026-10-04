/**
 * OphthalConf - 眼科専用 講演会・学会検索アプリ
 * 即時絞り込み・カレンダー重複表示・ICS連携・学会詳細メタ情報
 */

// アプリケーションの状態管理
let state = {
  events: [...sampleEvents], // sampleEvents from events.js
  filters: {
    keyword: "",
    year: new Set(), // 開催年 (動的抽出)
    specialty: new Set(),
    eventType: new Set(),
    abstractStatus: new Set(), // 演題募集状況 (学会)
    format: new Set(),
    region: new Set(),
    company: new Set(),
    scheduleStatus: new Set(["free", "partial_conflict", "conflict", "registered"]), // 全ステータスを初期表示
    registeredOnly: false,
    includeEndedConferences: false // 終了した学会も表示 (デフォルトOFF)
  },
  sortBy: "date-asc",
  // カレンダー連携設定 (localStorage永続化)
  calendarSettings: {
    calendarProvider: "both", // "google", "icloud", "both", "none"
    defaultCalendar: "ask"    // "google", "icloud", "ask"
  },
  // 参加予定の学会IDセット (localStorage永続化: 「あり」)
  attendingConferences: new Set(),
  // 非表示にした学会IDセット (localStorage永続化: 「なし」)
  hiddenConferences: new Set(),
  // 学会参加履歴 (localStorage永続化: key: eventId, value: { status, updatedAt, roles, notes })
  conferenceHistory: new Map(),
  // マイ学会履歴モーダルの表示選択年度 ("all" または 年度数値)
  historySelectedFiscalYear: "all"
};

// DOM要素の参照キャッシュ
const elements = {
  eventList: document.getElementById("event-list"),
  eventCount: document.getElementById("event-count"),
  emptyState: document.getElementById("empty-state"),
  activeFilterChips: document.getElementById("active-filter-chips"),
  keywordSearch: document.getElementById("keyword-search"),
  clearSearchBtn: document.getElementById("clear-search-btn"),
  resetFilterBtn: document.getElementById("reset-filter-btn"),
  emptyResetBtn: document.getElementById("empty-reset-btn"),
  sortSelect: document.getElementById("sort-select"),
  toggleRegisteredFilter: document.getElementById("toggle-registered-filter"),
  registeredBadgeCount: document.getElementById("registered-badge-count"),
  registeredOnlyBadge: document.getElementById("registered-only-badge"),
  clearRegisteredFilter: document.getElementById("clear-registered-filter"),
  filterIncludeEnded: document.getElementById("filter-include-ended"),
  // モバイル関連
  mobileFilterBtn: document.getElementById("mobile-filter-btn"),
  closeMobileFilter: document.getElementById("close-mobile-filter"),
  applyMobileFilter: document.getElementById("apply-mobile-filter"),
  filterSidebar: document.getElementById("filter-sidebar"),
  filterBackdrop: document.getElementById("filter-backdrop"),
  mobileResultCount: document.getElementById("mobile-result-count"),
  // カレンダー連携設定関連
  calendarSettingsBtn: document.getElementById("calendar-settings-btn"),
  calendarSettingsIndicator: document.getElementById("calendar-settings-indicator"),
  calendarSettingsModal: document.getElementById("calendar-settings-modal"),
  closeCalSettingsModal: document.getElementById("close-cal-settings-modal"),
  dismissCalSettingsModal: document.getElementById("dismiss-cal-settings-modal"),
  saveCalSettingsBtn: document.getElementById("save-cal-settings"),
  calendarSettingsForm: document.getElementById("calendar-settings-form"),
  // 非表示学会管理モーダル
  hiddenModal: document.getElementById("hidden-conferences-modal"),
  openHiddenModalBtn: document.getElementById("open-hidden-modal-btn"),
  closeHiddenModalBtn: document.getElementById("close-hidden-modal"),
  dismissHiddenModalBtn: document.getElementById("dismiss-hidden-modal"),
  hiddenConferencesList: document.getElementById("hidden-conferences-list"),
  hiddenConferencesCountBadge: document.getElementById("hidden-conferences-count-badge"),
  unhideAllBtn: document.getElementById("unhide-all-conferences-btn"),
  // マイ学会履歴モーダル関連
  conferenceHistoryBtn: document.getElementById("conference-history-btn"),
  historyBadgeCount: document.getElementById("history-badge-count"),
  sidebarHistoryBtn: document.getElementById("sidebar-history-btn"),
  conferenceHistoryModal: document.getElementById("conference-history-modal"),
  closeHistoryModalBtn: document.getElementById("close-history-modal"),
  dismissHistoryModalBtn: document.getElementById("dismiss-history-modal"),
  historyOverallSummary: document.getElementById("history-overall-summary"),
  historyFyTabs: document.getElementById("history-fy-tabs"),
  conferenceHistoryContent: document.getElementById("conference-history-content"),
  // ダイアログ & トースト
  pdfModal: document.getElementById("pdf-modal"),
  closePdfModal: document.getElementById("close-pdf-modal"),
  dismissPdfModal: document.getElementById("dismiss-pdf-modal"),
  pdfModalTitle: document.getElementById("pdf-modal-title"),
  pdfModalBody: document.getElementById("pdf-modal-body"),
  downloadMockPdf: document.getElementById("download-mock-pdf"),
  toast: document.getElementById("toast-notification")
};

// 選択肢定義（眼科領域仕様）
const FILTER_OPTIONS = {
  specialty: [
    "網膜・硝子体",
    "緑内障",
    "白内障",
    "角膜・外眼部",
    "小児・斜視弱視",
    "神経眼科",
    "眼形成",
    "一般眼科",
    "その他"
  ],
  eventType: [
    "講演会・勉強会",
    "国内学会",
    "海外学会",
    "地方会・研究会"
  ],
  format: [
    "Web",
    "現地",
    "ハイブリッド"
  ],
  region: [
    "全国Web",
    "北海道",
    "東北",
    "関東",
    "中部",
    "関西",
    "中国",
    "四国",
    "九州・沖縄",
    "海外"
  ]
};

// 曜日表記ヘルパー
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * 初期化処理
 */
function initApp() {
  migrateLegacyStorage();
  loadCalendarSettings();
  loadAttendingConferences();
  loadHiddenConferences();
  loadConferenceHistory();
  renderFilterOptions();
  updateRegisteredBadge();
  updateHiddenConferencesBadge();
  updateHistoryBadgeCount();
  setupEventListeners();
  renderEvents();
}

/** 旧保存キーから移行する。正規キーの既存値と旧データは変更しない。 */
function migrateLegacyStorage() {
  const legacyPrefix = "ophthahub_"; // 旧バージョンとのデータ互換のためにのみ保持。
  for (const key of [ATTENDING_CONFERENCES_KEY, HIDDEN_CONFERENCES_KEY, CONFERENCE_HISTORY_KEY, CALENDAR_SETTINGS_KEY]) {
    try {
      const marker = `${key}_legacy_migrated`;
      if (localStorage.getItem(marker) === "1") continue;
      const current = localStorage.getItem(key);
      if (current !== null && current !== "") {
        // すでに正規キーを使っている場合も、後から旧データを復活させない。
        localStorage.setItem(marker, "1");
        continue;
      }
      const legacy = localStorage.getItem(key.replace(/^ophthalconf_/, legacyPrefix));
      if (legacy === null || legacy === "") continue;
      localStorage.setItem(key, legacy);
      // コピー完了後にだけ記録し、途中失敗時は次の起動で再試行できる。
      localStorage.setItem(marker, "1");
    } catch (error) {
      console.warn("Failed to migrate legacy storage:", error);
    }
  }
}

/**
 * 学会参加予定 / 非表示の永続化管理 (localStorage)
 */
const ATTENDING_CONFERENCES_KEY = "ophthalconf_attending_conferences";
const HIDDEN_CONFERENCES_KEY = "ophthalconf_hidden_conferences";

function loadAttendingConferences() {
  try {
    const saved = localStorage.getItem(ATTENDING_CONFERENCES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        state.attendingConferences = new Set(parsed);
      }
    }
  } catch (e) {
    console.warn("Failed to load attending conferences from localStorage:", e);
  }
}

function saveAttendingConferences() {
  try {
    localStorage.setItem(ATTENDING_CONFERENCES_KEY, JSON.stringify(Array.from(state.attendingConferences)));
  } catch (e) {
    console.warn("Failed to save attending conferences to localStorage:", e);
  }
}

function loadHiddenConferences() {
  try {
    const saved = localStorage.getItem(HIDDEN_CONFERENCES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        state.hiddenConferences = new Set(parsed);
      }
    }
  } catch (e) {
    console.warn("Failed to load hidden conferences from localStorage:", e);
  }
}

function saveHiddenConferences() {
  try {
    localStorage.setItem(HIDDEN_CONFERENCES_KEY, JSON.stringify(Array.from(state.hiddenConferences)));
  } catch (e) {
    console.warn("Failed to save hidden conferences to localStorage:", e);
  }
}

function updateHiddenConferencesBadge() {
  if (!elements.hiddenConferencesCountBadge) return;
  const count = state.hiddenConferences.size;
  if (count > 0) {
    elements.hiddenConferencesCountBadge.textContent = `${count}件`;
    elements.hiddenConferencesCountBadge.style.display = "inline-flex";
  } else {
    elements.hiddenConferencesCountBadge.style.display = "none";
  }
}

/**
 * 学会の参加ステータスを変更（あり・なし・未選択）
 * @param {string} conferenceId
 * @param {"yes"|"no"|"none"} choice - "yes": 参加あり, "no": 参加なし(非表示), "none": 未選択
 */
function setConferenceAttendance(conferenceId, choice) {
  const conf = state.events.find(e => e.id === conferenceId);
  const confTitle = conf ? conf.title : "学会";

  if (choice === "yes") {
    // あり: 参加予定ON、非表示OFF
    state.attendingConferences.add(conferenceId);
    state.hiddenConferences.delete(conferenceId);
    saveAttendingConferences();
    saveHiddenConferences();
    updateHiddenConferencesBadge();
    renderEvents();
    showToast(`✓ 「${confTitle}」を参加予定に設定しました（関連セミナーを表示中）`);
  } else if (choice === "no") {
    // なし: 非表示ON、参加予定OFF
    state.attendingConferences.delete(conferenceId);
    state.hiddenConferences.add(conferenceId);
    saveAttendingConferences();
    saveHiddenConferences();
    updateHiddenConferencesBadge();
    renderEvents();
    // カードが消えた際、Undo可能なトーストを表示
    showToast(`「${confTitle}」を非表示にしました`, {
      label: "元に戻す",
      onClick: () => {
        unhideConference(conferenceId);
      }
    });
  } else {
    // 未選択に戻す
    state.attendingConferences.delete(conferenceId);
    state.hiddenConferences.delete(conferenceId);
    saveAttendingConferences();
    saveHiddenConferences();
    updateHiddenConferencesBadge();
    renderEvents();
    showToast(`「${confTitle}」の選択を解除しました`);
  }
}

/**
 * 非表示にした学会を復活させる
 * @param {string} conferenceId
 */
function unhideConference(conferenceId) {
  if (!state.hiddenConferences.has(conferenceId)) return;
  state.hiddenConferences.delete(conferenceId);
  saveHiddenConferences();
  updateHiddenConferencesBadge();
  renderEvents();
  renderHiddenConferencesModal();

  const conf = state.events.find(e => e.id === conferenceId);
  const confTitle = conf ? conf.title : "学会";
  showToast(`「${confTitle}」を一覧に再表示しました`);
}

/**
 * 非表示にした学会をすべて復活
 */
function unhideAllConferences() {
  if (state.hiddenConferences.size === 0) return;
  const count = state.hiddenConferences.size;
  state.hiddenConferences.clear();
  saveHiddenConferences();
  updateHiddenConferencesBadge();
  renderEvents();
  renderHiddenConferencesModal();
  showToast(`${count}件の学会を一覧に再表示しました`);
}

/**
 * 非表示学会管理モーダルのリスト描画
 */
function renderHiddenConferencesModal() {
  if (!elements.hiddenConferencesList) return;

  const hiddenEvents = state.events.filter(e => e.isConference && state.hiddenConferences.has(e.id));

  if (hiddenEvents.length === 0) {
    elements.hiddenConferencesList.innerHTML = `
      <div class="hidden-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #94a3b8; margin: 0 auto 8px; display: block;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p style="text-align: center; color: #64748b; font-size: 0.9rem;">現在、非表示に設定された学会はありません。</p>
      </div>
    `;
    if (elements.unhideAllBtn) elements.unhideAllBtn.style.display = "none";
    return;
  }

  if (elements.unhideAllBtn) elements.unhideAllBtn.style.display = "inline-flex";

  elements.hiddenConferencesList.innerHTML = hiddenEvents.map(e => `
    <div class="hidden-conference-item-card">
      <div class="hidden-item-info">
        <h4 class="hidden-item-title">${escapeHtml(e.title)}</h4>
        <div class="hidden-item-meta">
          <span>📅 ${escapeHtml(e.period || e.date)}</span>
          <span>📍 ${escapeHtml(e.cityCountry || e.venue || e.region)}</span>
        </div>
      </div>
      <button type="button" class="btn btn-sm btn-outline btn-restore-conf" data-conference-id="${escapeHtml(e.id)}" title="一覧に再表示">
        再表示
      </button>
    </div>
  `).join("");
}

/**
 * ==========================================================================
 * 学会参加履歴の永続化管理 & 年度別集計 (マイ学会履歴)
 * ==========================================================================
 */
const CONFERENCE_HISTORY_KEY = "ophthalconf_conference_attendance_history";

/**
 * localStorageから学会参加履歴をロード
 * データ構造: { [conferenceId]: { status: "attended"|"not_attended", updatedAt: string, roles: [], notes: "" } }
 */
function loadConferenceHistory() {
  try {
    const saved = localStorage.getItem(CONFERENCE_HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        state.conferenceHistory = new Map(Object.entries(parsed));
      }
    }
  } catch (e) {
    console.warn("Failed to load conference history from localStorage:", e);
  }
}

/**
 * 学会参加履歴をlocalStorageに保存
 */
function saveConferenceHistory() {
  try {
    const obj = Object.fromEntries(state.conferenceHistory);
    localStorage.setItem(CONFERENCE_HISTORY_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn("Failed to save conference history to localStorage:", e);
  }
}

/**
 * ヘッダーの「マイ学会履歴」バッジ件数を更新
 */
function updateHistoryBadgeCount() {
  if (!elements.historyBadgeCount) return;
  let count = 0;
  for (const [, record] of state.conferenceHistory) {
    if (record && record.status === "attended") {
      count++;
    }
  }
  if (count > 0) {
    elements.historyBadgeCount.textContent = `${count}`;
    elements.historyBadgeCount.style.display = "inline-flex";
  } else {
    elements.historyBadgeCount.style.display = "none";
  }
}

/**
 * 学会参加実績（参加した／参加しなかった／未選択）を記録
 * @param {string} conferenceId
 * @param {"attended"|"not_attended"|"none"} choice
 */
function setConferenceHistoryStatus(conferenceId, choice) {
  const conf = state.events.find(e => e.id === conferenceId);
  const confTitle = conf ? conf.title : "学会";
  const existing = state.conferenceHistory.get(conferenceId) || {};

  if (choice === "attended") {
    state.conferenceHistory.set(conferenceId, {
      status: "attended",
      updatedAt: new Date().toISOString(),
      roles: existing.roles || [],
      notes: existing.notes || ""
    });
    saveConferenceHistory();
    updateHistoryBadgeCount();
    renderEvents();
    renderConferenceHistoryModal();
    showToast(`✓ 「${confTitle}」をマイ学会履歴に記録しました`);
  } else if (choice === "not_attended") {
    state.conferenceHistory.set(conferenceId, {
      status: "not_attended",
      updatedAt: new Date().toISOString(),
      roles: existing.roles || [],
      notes: existing.notes || ""
    });
    saveConferenceHistory();
    updateHistoryBadgeCount();
    renderEvents();
    renderConferenceHistoryModal();
    showToast(`「${confTitle}」を「参加しなかった」として記録しました`);
  } else {
    state.conferenceHistory.delete(conferenceId);
    saveConferenceHistory();
    updateHistoryBadgeCount();
    renderEvents();
    renderConferenceHistoryModal();
    showToast(`「${confTitle}」の参加記録を解除しました`);
  }
}

/**
 * 日付文字列 (YYYY-MM-DD) から日本の年度を取得 (4月1日〜翌年3月31日基準)
 * @param {string} dateStr
 * @returns {number|null} 年度 (例: 2026)
 */
function getJapaneseFiscalYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length < 2) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;
  return month >= 4 ? year : year - 1;
}

/**
 * 西暦年度を和暦併記ラベルに変換 (例: "2026年度（令和8年度）")
 * @param {number} fy
 * @returns {string}
 */
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

/**
 * 参加した学会を日本の年度ごとに集計
 * @returns {Array<{ fiscalYear: number, fiscalYearLabel: string, totalCount: number, domesticCount: number, internationalCount: number, conferences: Array<Object> }>}
 */
function getAttendedConferencesByFiscalYear() {
  const attendedEvents = state.events.filter(event => {
    if (!event.isConference) return false;
    const rec = state.conferenceHistory.get(event.id);
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

/**
 * マイ学会参加履歴モーダルの内容を描画
 */
function renderConferenceHistoryModal() {
  if (!elements.conferenceHistoryContent || !elements.historyOverallSummary) return;

  const fyGroups = getAttendedConferencesByFiscalYear();

  // 累計集計
  let grandTotal = 0;
  let grandDomestic = 0;
  let grandInternational = 0;
  fyGroups.forEach(g => {
    grandTotal += g.totalCount;
    grandDomestic += g.domesticCount;
    grandInternational += g.internationalCount;
  });

  if (grandTotal === 0) {
    elements.historyOverallSummary.innerHTML = "";
    elements.historyOverallSummary.style.display = "none";
    if (elements.historyFyTabs) {
      elements.historyFyTabs.innerHTML = "";
      elements.historyFyTabs.style.display = "none";
    }
    elements.conferenceHistoryContent.innerHTML = `
      <div class="history-empty-state">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #94a3b8; margin: 0 auto 12px; display: block;">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="13" x2="13" y2="13"></line>
        </svg>
        <p class="history-empty-title">まだ参加履歴の記録がありません</p>
        <p class="history-empty-desc">
          会期が終了した学会カードに表示される「参加しましたか？」で「参加した」を選択すると、日本の年度別（4月〜翌3月）に自動集計・記録されます。
        </p>
        <button type="button" id="history-view-ended-btn" class="btn btn-primary btn-sm" style="margin-top: 14px;">
          終了した学会を表示して記録する
        </button>
      </div>
    `;
    const viewEndedBtn = document.getElementById("history-view-ended-btn");
    if (viewEndedBtn) {
      viewEndedBtn.addEventListener("click", () => {
        closeConferenceHistoryModal();
        state.filters.includeEndedConferences = true;
        if (elements.filterIncludeEnded) {
          elements.filterIncludeEnded.checked = true;
        }
        renderEvents();
        showToast("終了した学会を一覧に表示しました");
      });
    }
    return;
  }

  // 累計サマリー表示
  elements.historyOverallSummary.style.display = "block";
  elements.historyOverallSummary.innerHTML = `
    <div class="history-summary-box">
      <div class="history-summary-stat">
        <span class="summary-stat-label">参加学会数（累計）</span>
        <span class="summary-stat-value">${grandTotal} <small>学会</small></span>
      </div>
      <div class="history-summary-divider"></div>
      <div class="history-summary-stat">
        <span class="summary-stat-label">国内学会</span>
        <span class="summary-stat-value">${grandDomestic} <small>学会</small></span>
      </div>
      <div class="history-summary-divider"></div>
      <div class="history-summary-stat">
        <span class="summary-stat-label">海外学会</span>
        <span class="summary-stat-value">${grandInternational} <small>学会</small></span>
      </div>
    </div>
  `;

  // 選択中の年度が有効か確認（削除された年度等の場合は "all" に戻す）
  const validFiscalYears = new Set(fyGroups.map(g => g.fiscalYear));
  if (state.historySelectedFiscalYear !== "all" && !validFiscalYears.has(state.historySelectedFiscalYear)) {
    state.historySelectedFiscalYear = "all";
  }

  // 年度切り替えタブの描画（過去年度も切り替えて確認可能）
  if (elements.historyFyTabs) {
    elements.historyFyTabs.style.display = "flex";
    elements.historyFyTabs.innerHTML = `
      <button type="button" 
        class="history-fy-tab-btn ${state.historySelectedFiscalYear === 'all' ? 'active' : ''}" 
        data-fy="all" 
        aria-pressed="${state.historySelectedFiscalYear === 'all' ? 'true' : 'false'}">
        <span>すべての年度</span>
        <span class="tab-count-badge">${grandTotal}</span>
      </button>
      ${fyGroups.map(g => `
        <button type="button" 
          class="history-fy-tab-btn ${state.historySelectedFiscalYear === g.fiscalYear ? 'active' : ''}" 
          data-fy="${g.fiscalYear}" 
          aria-pressed="${state.historySelectedFiscalYear === g.fiscalYear ? 'true' : 'false'}">
          <span>${g.fiscalYear}年度</span>
          <span class="tab-count-badge">${g.totalCount}</span>
        </button>
      `).join("")}
    `;

    // タブクリックイベントの設定
    const tabButtons = elements.historyFyTabs.querySelectorAll(".history-fy-tab-btn");
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const fyAttr = btn.getAttribute("data-fy");
        state.historySelectedFiscalYear = fyAttr === "all" ? "all" : parseInt(fyAttr, 10);
        renderConferenceHistoryModal();
      });
    });
  }

  // 表示対象の年度グループを抽出（全年度または特定年度）
  const displayedGroups = state.historySelectedFiscalYear === "all"
    ? fyGroups
    : fyGroups.filter(g => g.fiscalYear === state.historySelectedFiscalYear);

  // 年度別カード描画
  elements.conferenceHistoryContent.innerHTML = displayedGroups.map(group => `
    <div class="history-fiscal-year-card">
      <div class="history-fy-header">
        <div class="history-fy-title-group">
          <h4 class="history-fy-title">${escapeHtml(group.fiscalYearLabel)}</h4>
        </div>
        <div class="history-fy-stat-chips">
          <span class="history-stat-chip total">参加計 <strong>${group.totalCount}</strong>学会</span>
          <span class="history-stat-chip domestic">国内 <strong>${group.domesticCount}</strong></span>
          <span class="history-stat-chip international">海外 <strong>${group.internationalCount}</strong></span>
        </div>
      </div>

      <div class="history-conf-list">
        ${group.conferences.map(conf => `
          <div class="history-conf-item">
            <div class="history-conf-info">
              <div class="history-conf-badges">
                <span class="conf-category-badge region ${conf.conferenceRegion === 'international' ? 'international' : 'domestic'}">
                  ${conf.conferenceRegion === 'international' ? '海外学会' : '国内学会'}
                </span>
                ${conf.conferenceCategory ? `<span class="conf-category-badge category">${escapeHtml(conf.conferenceCategory)}</span>` : ''}
              </div>
              <h5 class="history-conf-title">
                ${conf.officialUrl ? `<a href="${escapeHtml(conf.officialUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(conf.title)} ↗</a>` : escapeHtml(conf.title)}
              </h5>
              <div class="history-conf-meta">
                <span>📅 ${escapeHtml(conf.period || conf.date)}</span>
                <span>📍 ${escapeHtml(conf.cityCountry || conf.venue || '')}</span>
              </div>
            </div>
            <div class="history-conf-actions">
              <button type="button" class="btn btn-sm btn-outline btn-cancel-attended" data-action="cancel-attended" data-conference-id="${escapeHtml(conf.id)}" title="参加記録を解除">
                取消
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function openConferenceHistoryModal() {
  if (!elements.conferenceHistoryModal) return;
  renderConferenceHistoryModal();
  if (typeof elements.conferenceHistoryModal.showModal === "function") {
    elements.conferenceHistoryModal.showModal();
  } else {
    elements.conferenceHistoryModal.setAttribute("open", "");
  }
}

function closeConferenceHistoryModal() {
  if (!elements.conferenceHistoryModal) return;
  if (typeof elements.conferenceHistoryModal.close === "function") {
    elements.conferenceHistoryModal.close();
  } else {
    elements.conferenceHistoryModal.removeAttribute("open");
  }
}

/**
 * localStorageからカレンダー連携設定をロード
 */
const CALENDAR_SETTINGS_KEY = "ophthalconf_calendar_settings";

function loadCalendarSettings() {
  try {
    const saved = localStorage.getItem(CALENDAR_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // 新旧フォーマット両対応
      const provider = parsed.calendarProvider || parsed.connectedCalendar;
      const destination = parsed.defaultCalendar || parsed.defaultDestination;

      if (provider) state.calendarSettings.calendarProvider = provider;
      if (destination) state.calendarSettings.defaultCalendar = destination;
    }
  } catch (e) {
    console.warn("Failed to load calendar settings from localStorage:", e);
  }
  // 不整合があれば補正
  sanitizeCalendarSettings();
  updateSettingsIndicator();
}

/**
 * 選択状態の整合性チェック・補正
 * - none: 既定の追加先は選択不可
 * - google: defaultは google または ask
 * - icloud: defaultは icloud または ask
 */
function sanitizeCalendarSettings() {
  const p = state.calendarSettings.calendarProvider;
  const d = state.calendarSettings.defaultCalendar;

  if (p === "google" && d === "icloud") {
    state.calendarSettings.defaultCalendar = "google";
  } else if (p === "icloud" && d === "google") {
    state.calendarSettings.defaultCalendar = "icloud";
  }
}

/**
 * ヘッダーの設定ボタン横のインジケーター表示を更新
 * 例：
 * - Google連携
 * - iCloud連携
 * - Google + iCloud
 * - 未連携
 */
function updateSettingsIndicator() {
  if (!elements.calendarSettingsIndicator) return;

  const labels = {
    google: "Google連携",
    icloud: "iCloud連携",
    both: "Google + iCloud",
    none: "未連携"
  };

  const current = state.calendarSettings.calendarProvider || "both";
  elements.calendarSettingsIndicator.textContent = labels[current] || "Google + iCloud";

  if (current === "none") {
    elements.calendarSettingsIndicator.style.background = "#fee2e2";
    elements.calendarSettingsIndicator.style.color = "#b91c1c";
  } else if (current === "both") {
    elements.calendarSettingsIndicator.style.background = "#ede9fe";
    elements.calendarSettingsIndicator.style.color = "#7c3aed";
  } else if (current === "google") {
    elements.calendarSettingsIndicator.style.background = "#e0f2fe";
    elements.calendarSettingsIndicator.style.color = "#0369a1";
  } else {
    elements.calendarSettingsIndicator.style.background = "#f1f5f9";
    elements.calendarSettingsIndicator.style.color = "#334155";
  }
}

/**
 * モーダル内の「既定の追加先」選択肢の有効/無効・グレーアウト状態を更新
 */
function updateDestinationOptionsInteractivity(provider) {
  const form = elements.calendarSettingsForm;
  if (!form) return;

  const sectionDest = document.getElementById("section-default-destination");
  const cardDestGoogle = document.getElementById("card-dest-google");
  const cardDestIcloud = document.getElementById("card-dest-icloud");
  const cardDestAsk = document.getElementById("card-dest-ask");

  const inputGoogle = cardDestGoogle ? cardDestGoogle.querySelector('input[type="radio"]') : null;
  const inputIcloud = cardDestIcloud ? cardDestIcloud.querySelector('input[type="radio"]') : null;
  const inputAsk = cardDestAsk ? cardDestAsk.querySelector('input[type="radio"]') : null;

  if (provider === "none") {
    // 連携しない場合: 既定の追加先をすべて無効化・グレーアウト
    if (sectionDest) sectionDest.classList.add("disabled");

    [cardDestGoogle, cardDestIcloud, cardDestAsk].forEach(card => card && card.classList.add("disabled"));
    [inputGoogle, inputIcloud, inputAsk].forEach(input => {
      if (input) {
        input.disabled = true;
        input.checked = false;
      }
    });
  } else {
    if (sectionDest) sectionDest.classList.remove("disabled");

    if (provider === "google") {
      // Google Calendarのみ: iCloudを選択不可
      if (cardDestGoogle) cardDestGoogle.classList.remove("disabled");
      if (inputGoogle) inputGoogle.disabled = false;

      if (cardDestIcloud) cardDestIcloud.classList.add("disabled");
      if (inputIcloud) {
        inputIcloud.disabled = true;
        if (inputIcloud.checked) {
          if (inputGoogle) inputGoogle.checked = true;
        }
      }

      if (cardDestAsk) cardDestAsk.classList.remove("disabled");
      if (inputAsk) inputAsk.disabled = false;

      // 何も選択されていなければGoogleを選択
      if (!inputGoogle?.checked && !inputAsk?.checked) {
        if (inputGoogle) inputGoogle.checked = true;
      }
    } else if (provider === "icloud") {
      // iCloudのみ: Googleを選択不可
      if (cardDestIcloud) cardDestIcloud.classList.remove("disabled");
      if (inputIcloud) inputIcloud.disabled = false;

      if (cardDestGoogle) cardDestGoogle.classList.add("disabled");
      if (inputGoogle) {
        inputGoogle.disabled = true;
        if (inputGoogle.checked) {
          if (inputIcloud) inputIcloud.checked = true;
        }
      }

      if (cardDestAsk) cardDestAsk.classList.remove("disabled");
      if (inputAsk) inputAsk.disabled = false;

      // 何も選択されていなければiCloudを選択
      if (!inputIcloud?.checked && !inputAsk?.checked) {
        if (inputIcloud) inputIcloud.checked = true;
      }
    } else if (provider === "both") {
      // 両方: Google / iCloud / 毎回選択する すべて選択可能
      [cardDestGoogle, cardDestIcloud, cardDestAsk].forEach(card => card && card.classList.remove("disabled"));
      [inputGoogle, inputIcloud, inputAsk].forEach(input => input && (input.disabled = false));

      if (!inputGoogle?.checked && !inputIcloud?.checked && !inputAsk?.checked) {
        if (inputAsk) inputAsk.checked = true;
      }
    }
  }
}

/**
 * カレンダー連携設定モーダルを開く
 */
function openCalendarSettingsModal() {
  const form = elements.calendarSettingsForm;
  if (!form) return;

  const currentProvider = state.calendarSettings.calendarProvider || "both";
  const currentDest = state.calendarSettings.defaultCalendar || "ask";

  // プロバイダーラジオ反映
  const provRadio = form.querySelector(`input[name="calendarProvider"][value="${currentProvider}"]`);
  if (provRadio) provRadio.checked = true;

  // 追加先ラジオ反映
  const destRadio = form.querySelector(`input[name="defaultCalendar"][value="${currentDest}"]`);
  if (destRadio) destRadio.checked = true;

  // 選択肢の無効・有効化状態を更新
  updateDestinationOptionsInteractivity(currentProvider);

  elements.calendarSettingsModal.showModal();
}

/**
 * カレンダー連携設定を保存
 */
function saveCalendarSettings() {
  const form = elements.calendarSettingsForm;
  if (!form) return;

  const selectedProv = form.querySelector('input[name="calendarProvider"]:checked');
  const selectedDest = form.querySelector('input[name="defaultCalendar"]:checked');

  const provider = selectedProv ? selectedProv.value : "both";
  let defaultCal = "ask";

  if (provider === "none") {
    defaultCal = "ask"; // 連携しない場合はaskを規定値とする
  } else if (selectedDest && !selectedDest.disabled) {
    defaultCal = selectedDest.value;
  } else {
    // 選択肢がdisabledだった場合のフォールバック
    if (provider === "google") defaultCal = "google";
    else if (provider === "icloud") defaultCal = "icloud";
    else defaultCal = "ask";
  }

  state.calendarSettings.calendarProvider = provider;
  state.calendarSettings.defaultCalendar = defaultCal;

  try {
    localStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify({
      calendarProvider: state.calendarSettings.calendarProvider,
      defaultCalendar: state.calendarSettings.defaultCalendar
    }));
  } catch (e) {
    console.warn("Failed to save calendar settings to localStorage:", e);
  }

  updateSettingsIndicator();
  elements.calendarSettingsModal.close();

  const providerLabels = {
    google: "Google Calendar",
    icloud: "Apple / iCloud Calendar",
    both: "Google + iCloud の両方",
    none: "連携しない"
  };
  showToast(`⚙️ カレンダー設定を保存しました (${providerLabels[provider]})`);

  // カレンダー設定変更に伴い、カードの空き状況表示や重複判定を再描画
  renderEvents();
}

/**
 * eventsデータから開催年（西暦4桁）を一意・昇順で抽出
 */
function getAvailableEventYears() {
  const yearsSet = new Set();
  state.events.forEach(event => {
    if (event.date) {
      const y = event.date.substring(0, 4);
      if (/^\d{4}$/.test(y)) {
        yearsSet.add(y);
      }
    }
  });
  return Array.from(yearsSet).sort();
}

/**
 * 演題締切日までの残り日数を算出
 * @param {Object} event
 * @param {Date} [baseDate]
 * @returns {number|null} 残り日数 (負なら締切超過)
 */
function getDaysUntilAbstractDeadline(event, baseDate = new Date()) {
  if (!event.isConference || !event.abstractSubmission?.deadline) return null;
  const deadline = parseAbstractDate(event.abstractSubmission.deadline);
  const today = parseAbstractDate(typeof baseDate === "string" ? baseDate :
    `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(baseDate.getDate()).padStart(2, "0")}`);
  return deadline && today ? (deadline.timestamp - today.timestamp) / 86400000 : null;
}

// 日時付きの既存データも、締切日の暦日として比較する。
function parseAbstractDate(value) {
  const match = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, timestamp };
}

function getAbstractSubmissionState(event, baseDate = getTodayString()) {
  const sub = event.isConference ? event.abstractSubmission : null;
  const days = getDaysUntilAbstractDeadline(event, baseDate);
  const status = sub?.status === "open" && days !== null && days < 0 ? "closed" : sub?.status || "unknown";
  const urgency = status !== "open" || days === null || days > 30 ? "normal" :
    days === 0 ? "today" : days <= 7 ? "urgent" : "soon";
  return { status, days, urgency, isOpen: status === "open" };
}

function matchesAbstractFilter(event, condition, baseDate = getTodayString()) {
  const info = getAbstractSubmissionState(event, baseDate);
  if (!info.isOpen) return false;
  if (condition === "open") return true;
  const limit = condition === "deadline_30d" ? 30 : condition === "deadline_7d" ? 7 : null;
  return limit !== null && info.days !== null && info.days >= 0 && info.days <= limit;
}

function renderAbstractSubmissionHtml(event, baseDate = getTodayString()) {
  const sub = event.abstractSubmission;
  if (!sub) return `<span class="deadline-highlight">${escapeHtml(event.abstractDeadline || "要確認")}</span>`;
  const info = getAbstractSubmissionState(event, baseDate);
  const labels = { open: "演題募集中", upcoming: "演題募集予定", closed: "演題募集終了" };
  const date = parseAbstractDate(sub.deadline);
  const today = parseAbstractDate(baseDate);
  const deadlineLabel = date ? `${date.year !== today?.year ? date.year + "/" : ""}${date.month}/${date.day}` : sub.deadline;
  const parts = [];
  if (labels[info.status]) parts.push(`<span class="abstract-status-tag ${info.status}">${labels[info.status]}</span>`);
  if (deadlineLabel) parts.push(`<span class="deadline-highlight">演題締切 ${escapeHtml(deadlineLabel)}</span>`);
  if (info.isOpen && info.days !== null) {
    const text = info.days === 0 ? "本日締切" : `${info.urgency === "urgent" ? "締切間近・" : info.urgency === "soon" ? "注意・" : ""}締切まで${info.days}日`;
    parts.push(`<span class="abstract-status-tag ${info.urgency}">${text}</span>`);
  }
  if (info.status === "upcoming" && sub.startDate) parts.push(`<span class="abstract-start-date">募集開始予定 ${escapeHtml(sub.startDate)}</span>`);
  if (sub.url) parts.push(`<a href="${escapeHtml(sub.url)}" target="_blank" rel="noopener noreferrer" class="abstract-submit-link">${info.isOpen ? "演題登録" : "演題募集詳細"} ↗</a>`);
  return parts.join(" ") || '<span class="abstract-unknown">演題募集情報未確認</span>';
}

/**
 * 今日の日付文字列 (YYYY-MM-DD) を取得
 * @returns {string}
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 学会が会期終了済みであるかを判定 (endDate < 今日)
 * 会期中、および終了日当日は false (未終了) を返す
 * @param {Object} event
 * @param {string} [todayStr]
 * @returns {boolean}
 */
function isConferenceEnded(event, todayStr = getTodayString()) {
  if (!event.isConference) return false;
  const targetEnd = event.endDate || event.date;
  if (!targetEnd) return false;
  return targetEnd < todayStr;
}

/**
 * フィルター項目のチェックボックス（チップUI）を動的生成
 */
function renderFilterOptions() {
  const companyContainer = document.getElementById("filter-company");
  const companyOptions = getCoSponsorCompanyOptions(state.events);
  companyContainer.innerHTML = companyOptions.length ? companyOptions.map(company => `
    <label class="chip-label">
      <input type="checkbox" name="company" value="${escapeHtml(company.id)}">
      <span class="chip-btn">${escapeHtml(company.shortName)} <span class="chip-count">(${company.count})</span></span>
    </label>
  `).join("") : '<span class="company-filter-empty">共催情報のある製薬会社はありません</span>';
  // 1. 開催年フィルター（eventsデータから動的抽出・昇順生成）
  const yearContainer = document.getElementById("filter-year");
  if (yearContainer) {
    const availableYears = getAvailableEventYears();
    yearContainer.innerHTML = availableYears.map(year => {
      const count = state.events.filter(e => e.date && e.date.startsWith(year)).length;
      const isChecked = state.filters.year.has(year);
      return `
        <label class="chip-label">
          <input type="checkbox" name="year" value="${escapeHtml(year)}" ${isChecked ? "checked" : ""}>
          <span class="chip-btn">
            ${escapeHtml(year)}年
            <span class="chip-count">(${count})</span>
          </span>
        </label>
      `;
    }).join("");
  }

  // 2. 演題募集フィルター（学会特有：募集中、30日以内、7日以内）
  const abstractContainer = document.getElementById("filter-abstractStatus");
  if (abstractContainer) {
    const today = getTodayString();
    const openCount = state.events.filter(e => matchesAbstractFilter(e, "open", today)).length;
    const d30Count = state.events.filter(e => matchesAbstractFilter(e, "deadline_30d", today)).length;
    const d7Count = state.events.filter(e => matchesAbstractFilter(e, "deadline_7d", today)).length;

    const abstractOptions = [
      { value: "open", label: "🟢 演題募集中", count: openCount },
      { value: "deadline_30d", label: "⏱️ 締切30日以内", count: d30Count },
      { value: "deadline_7d", label: "🔥 締切7日以内", count: d7Count }
    ];

    abstractContainer.innerHTML = abstractOptions.map(opt => {
      const isChecked = state.filters.abstractStatus.has(opt.value);
      return `
        <label class="chip-label">
          <input type="checkbox" name="abstractStatus" value="${opt.value}" ${isChecked ? "checked" : ""}>
          <span class="chip-btn">
            ${escapeHtml(opt.label)}
            <span class="chip-count">(${opt.count})</span>
          </span>
        </label>
      `;
    }).join("");
  }

  // 3. 専門領域・イベント種別・開催形式・地域フィルター
  Object.keys(FILTER_OPTIONS).forEach(key => {
    const container = document.getElementById(`filter-${key}`);
    if (!container) return;

    const items = FILTER_OPTIONS[key];
    container.innerHTML = items.map(val => {
      // 該当カテゴリに属するイベント件数を計算
      const count = state.events.filter(e => e[key] === val).length;
      return `
        <label class="chip-label">
          <input type="checkbox" name="${key}" value="${val}">
          <span class="chip-btn">
            ${escapeHtml(val)}
            <span class="chip-count">(${count})</span>
          </span>
        </label>
      `;
    }).join("");
  });
}

/**
 * イベントリスナーのセットアップ
 */
function setupEventListeners() {
  // キーワード検索（リアルタイム）
  elements.keywordSearch.addEventListener("input", (e) => {
    state.filters.keyword = e.target.value.trim().toLowerCase();
    elements.clearSearchBtn.style.display = state.filters.keyword ? "block" : "none";
    renderEvents();
  });

  elements.clearSearchBtn.addEventListener("click", () => {
    elements.keywordSearch.value = "";
    state.filters.keyword = "";
    elements.clearSearchBtn.style.display = "none";
    renderEvents();
  });

  // チップ・チェックボックスの変更監視 (イベント委譲)
  document.getElementById("filter-sidebar").addEventListener("change", (e) => {
    if (e.target.type === "checkbox") {
      const groupName = e.target.name;
      const value = e.target.value;

      if (state.filters[groupName]) {
        if (e.target.checked) {
          state.filters[groupName].add(value);
        } else {
          state.filters[groupName].delete(value);
        }
        renderEvents();
      }
    }
  });

  document.querySelector(".group-select-domestic").addEventListener("click", () => {
    const checkboxes = document.querySelectorAll('#filter-region input[type="checkbox"]');
    state.filters.region.clear();
    checkboxes.forEach(cb => {
      cb.checked = cb.value !== "海外";
      if (cb.checked) state.filters.region.add(cb.value);
    });
    document.querySelector('.group-select-all[data-target="region"]').textContent = "全選択";
    renderEvents();
  });

  // 「全選択 / 全解除」トグル
  document.querySelectorAll(".group-select-all").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetGroup = btn.getAttribute("data-target");
      const container = document.getElementById(`filter-${targetGroup}`);
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);

      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        if (!allChecked) {
          state.filters[targetGroup].add(cb.value);
        } else {
          state.filters[targetGroup].delete(cb.value);
        }
      });
      btn.textContent = allChecked ? "全選択" : "解除";
      renderEvents();
    });
  });

  // フィルター全リセット
  const handleResetFilters = () => {
    state.filters.keyword = "";
    elements.keywordSearch.value = "";
    elements.clearSearchBtn.style.display = "none";

    ["year", "specialty", "eventType", "abstractStatus", "format", "region", "company"].forEach(key => {
      state.filters[key].clear();
    });

    // スケジュール状況は全選択に戻す
    state.filters.scheduleStatus = new Set(["free", "partial_conflict", "conflict", "registered"]);
    state.filters.registeredOnly = false;
    state.filters.includeEndedConferences = false;
    if (elements.filterIncludeEnded) {
      elements.filterIncludeEnded.checked = false;
    }
    elements.toggleRegisteredFilter.classList.remove("active");
    elements.registeredOnlyBadge.style.display = "none";

    syncCheckboxesWithState();
    renderEvents();
    showToast("すべてのフィルター条件をリセットしました");
  };

  elements.resetFilterBtn.addEventListener("click", handleResetFilters);
  elements.emptyResetBtn.addEventListener("click", handleResetFilters);

  // ソート順変更
  elements.sortSelect.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderEvents();
  });

  // 終了学会表示トグル
  if (elements.filterIncludeEnded) {
    elements.filterIncludeEnded.addEventListener("change", (e) => {
      state.filters.includeEndedConferences = e.target.checked;
      renderEvents();
    });
  }

  // カレンダー登録済みのみトグル
  elements.toggleRegisteredFilter.addEventListener("click", () => {
    state.filters.registeredOnly = !state.filters.registeredOnly;
    elements.toggleRegisteredFilter.classList.toggle("active", state.filters.registeredOnly);
    elements.registeredOnlyBadge.style.display = state.filters.registeredOnly ? "inline-flex" : "none";
    renderEvents();
  });

  elements.clearRegisteredFilter.addEventListener("click", () => {
    state.filters.registeredOnly = false;
    elements.toggleRegisteredFilter.classList.remove("active");
    elements.registeredOnlyBadge.style.display = "none";
    renderEvents();
  });

  // モバイルメニュー開閉
  const toggleSidebar = (open) => {
    elements.filterSidebar.classList.toggle("open", open);
    elements.filterBackdrop.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  };

  elements.mobileFilterBtn.addEventListener("click", () => toggleSidebar(true));
  elements.closeMobileFilter.addEventListener("click", () => toggleSidebar(false));
  elements.filterBackdrop.addEventListener("click", () => toggleSidebar(false));
  elements.applyMobileFilter.addEventListener("click", () => toggleSidebar(false));

  // モーダルダイアログ (案内PDF)
  elements.closePdfModal.addEventListener("click", () => elements.pdfModal.close());
  elements.dismissPdfModal.addEventListener("click", () => elements.pdfModal.close());
  elements.downloadMockPdf.addEventListener("click", () => {
    showToast("📄 案内状PDFのダウンロードを開始しました");
    elements.pdfModal.close();
  });

  // モーダルダイアログ (カレンダー連携設定)
  if (elements.calendarSettingsBtn) {
    elements.calendarSettingsBtn.addEventListener("click", openCalendarSettingsModal);
  }
  if (elements.closeCalSettingsModal) {
    elements.closeCalSettingsModal.addEventListener("click", () => elements.calendarSettingsModal.close());
  }
  if (elements.dismissCalSettingsModal) {
    elements.dismissCalSettingsModal.addEventListener("click", () => elements.calendarSettingsModal.close());
  }
  if (elements.saveCalSettingsBtn) {
    elements.saveCalSettingsBtn.addEventListener("click", saveCalendarSettings);
  }

  // 利用するカレンダー変更時のリアルタイム連動（グレーアウト・選択肢無効化）
  if (elements.calendarSettingsForm) {
    elements.calendarSettingsForm.addEventListener("change", (e) => {
      if (e.target.name === "calendarProvider") {
        updateDestinationOptionsInteractivity(e.target.value);
      }
    });
  }

  // モーダルダイアログ (非表示にした学会の管理)
  if (elements.openHiddenModalBtn) {
    elements.openHiddenModalBtn.addEventListener("click", () => {
      renderHiddenConferencesModal();
      if (elements.hiddenModal) elements.hiddenModal.showModal();
    });
  }
  if (elements.closeHiddenModalBtn) {
    elements.closeHiddenModalBtn.addEventListener("click", () => elements.hiddenModal.close());
  }
  if (elements.dismissHiddenModalBtn) {
    elements.dismissHiddenModalBtn.addEventListener("click", () => elements.hiddenModal.close());
  }
  if (elements.unhideAllBtn) {
    elements.unhideAllBtn.addEventListener("click", () => {
      unhideAllConferences();
    });
  }
  if (elements.hiddenConferencesList) {
    elements.hiddenConferencesList.addEventListener("click", (e) => {
      const restoreBtn = e.target.closest(".btn-restore-conf");
      if (restoreBtn) {
        const confId = restoreBtn.getAttribute("data-conference-id");
        if (confId) unhideConference(confId);
      }
    });
  }

  // モーダルダイアログ (マイ学会履歴)
  if (elements.conferenceHistoryBtn) {
    elements.conferenceHistoryBtn.addEventListener("click", openConferenceHistoryModal);
  }
  if (elements.sidebarHistoryBtn) {
    elements.sidebarHistoryBtn.addEventListener("click", openConferenceHistoryModal);
  }
  if (elements.closeHistoryModalBtn) {
    elements.closeHistoryModalBtn.addEventListener("click", closeConferenceHistoryModal);
  }
  if (elements.dismissHistoryModalBtn) {
    elements.dismissHistoryModalBtn.addEventListener("click", closeConferenceHistoryModal);
  }
  if (elements.conferenceHistoryContent) {
    elements.conferenceHistoryContent.addEventListener("click", (e) => {
      const cancelBtn = e.target.closest('[data-action="cancel-attended"]');
      if (cancelBtn) {
        const confId = cancelBtn.getAttribute("data-conference-id");
        if (confId) {
          setConferenceHistoryStatus(confId, "none");
        }
      }
    });
  }
}

/**
 * チェックボックスのUIを現在のStateと一致させる
 */
function syncCheckboxesWithState() {
  const sidebar = document.getElementById("filter-sidebar");
  sidebar.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const group = cb.name;
    if (state.filters[group]) {
      cb.checked = state.filters[group].has(cb.value);
    }
  });

  document.querySelectorAll(".group-select-all").forEach(btn => {
    btn.textContent = "全選択";
  });
}

/**
 * ユーザーのカレンダー設定 (state.calendarSettings.calendarProvider) に基づいて
 * 各イベントの実効予定ステータスと重複リストを動的に算出
 * 
 * 戻り値:
 *  - statusKey: "free" | "partial_conflict" | "conflict" | "registered" | "unlinked"
 *  - badgeText: "🟢 空きあり" | "🟡 一部重複" | "🔴 重複" | "✓ カレンダー登録済み" | "未連携"
 *  - badgeClass: "free" | "partial_conflict" | "conflict" | "registered" | "unlinked"
 *  - isRegistered: boolean
 *  - conflicts: Array<{ providerLabel: "Google" | "iCloud", start: string, end: string, title: string }>
 */
function computeEffectiveScheduleStatus(event) {
  // カレンダー登録済みフラグ判定
  const isAdded = !!(event.calendarStatus?.isAdded || event.scheduleStatus === "registered");
  if (isAdded) {
    return {
      statusKey: "registered",
      badgeText: "✓ カレンダー登録済み",
      badgeClass: "registered",
      isRegistered: true,
      conflicts: []
    };
  }

  const provider = state.calendarSettings.calendarProvider || "both";

  // 1. 連携しない場合
  if (provider === "none") {
    return {
      statusKey: "unlinked",
      badgeText: "未連携",
      badgeClass: "unlinked",
      isRegistered: false,
      conflicts: []
    };
  }

  const gStatus = event.calendarStatus?.google?.status || "free";
  const gConflicts = event.calendarStatus?.google?.conflicts || [];

  const iStatus = event.calendarStatus?.icloud?.status || "free";
  const iConflicts = event.calendarStatus?.icloud?.conflicts || [];

  let effectiveStatus = "free";
  const combinedConflicts = [];

  if (provider === "google") {
    effectiveStatus = gStatus;
    gConflicts.forEach(c => combinedConflicts.push({ providerLabel: "Google", ...c }));
  } else if (provider === "icloud") {
    effectiveStatus = iStatus;
    iConflicts.forEach(c => combinedConflicts.push({ providerLabel: "iCloud", ...c }));
  } else {
    // "both" (Google + iCloud の両方)
    // どちらかbusy → busy(重複)
    // どちらかpartial → partial(一部重複)
    // 両方free → free(空きあり)
    if (gStatus === "busy" || iStatus === "busy") {
      effectiveStatus = "busy";
    } else if (gStatus === "partial" || iStatus === "partial") {
      effectiveStatus = "partial";
    } else {
      effectiveStatus = "free";
    }

    gConflicts.forEach(c => combinedConflicts.push({ providerLabel: "Google", ...c }));
    iConflicts.forEach(c => combinedConflicts.push({ providerLabel: "iCloud", ...c }));
  }

  if (effectiveStatus === "busy") {
    return {
      statusKey: "conflict",
      badgeText: "🔴 重複",
      badgeClass: "conflict",
      isRegistered: false,
      conflicts: combinedConflicts
    };
  } else if (effectiveStatus === "partial") {
    return {
      statusKey: "partial_conflict",
      badgeText: "🟡 一部重複",
      badgeClass: "partial_conflict",
      isRegistered: false,
      conflicts: combinedConflicts
    };
  } else {
    return {
      statusKey: "free",
      badgeText: "🟢 空きあり",
      badgeClass: "free",
      isRegistered: false,
      conflicts: []
    };
  }
}

/**
 * フィルタリング & ソートの計算
 */
function getFilteredEvents() {
  const todayStr = getTodayString();
  return state.events.filter(event => {
    // 終了済み学会の表示制御 (isConference: true のみ対象)
    // 「終了した学会も表示」がOFFの場合、会期終了済み(endDate < 今日)の学会を除外
    if (!state.filters.includeEndedConferences && event.isConference) {
      if (isConferenceEnded(event, todayStr)) {
        return false;
      }
    }

    // 非表示にした学会の除外（「参加予定：なし」）
    if (event.isConference && state.hiddenConferences.has(event.id)) {
      return false;
    }

    // 学会関連セミナー（ランチョン・モーニング・共催等）の表示制御:
    // parentConferenceId が設定されている場合、対応する学会が「参加予定」でなければ一覧から除外
    if (event.parentConferenceId) {
      if (!state.attendingConferences.has(event.parentConferenceId)) {
        return false;
      }
      // 親学会が終了して非表示になっている場合は関連セミナーも非表示
      if (!state.filters.includeEndedConferences) {
        const parentConf = state.events.find(e => e.id === event.parentConferenceId);
        if (parentConf && isConferenceEnded(parentConf, todayStr)) {
          return false;
        }
      }
    }

    const effective = computeEffectiveScheduleStatus(event);

    // 登録済み限定フィルター
    if (state.filters.registeredOnly && !effective.isRegistered) {
      return false;
    }

    // 開催年フィルター (複数年選択時はOR、未選択時は全年表示)
    if (state.filters.year.size > 0) {
      const eventYear = event.date ? event.date.substring(0, 4) : "";
      if (!state.filters.year.has(eventYear)) {
        return false;
      }
    }

    // キーワード検索（タイトル、サブタイトル、診療科、主催、単位、重複タイトル、タグなど）
    if (state.filters.keyword) {
      const q = state.filters.keyword;
      const conflictText = effective.conflicts.map(c => `${c.providerLabel} ${c.title}`).join(" ");
      const combined = `${event.title} ${event.subtitle} ${event.specialty} ${event.sponsor} ${event.credits} ${event.region} ${event.tags.join(" ")} ${conflictText}`.toLowerCase();
      if (!combined.includes(q)) return false;
    }

    // 専門領域
    if (state.filters.specialty.size > 0 && !state.filters.specialty.has(event.specialty)) {
      return false;
    }

    // イベント種別
    if (state.filters.eventType.size > 0 && !state.filters.eventType.has(event.eventType)) {
      return false;
    }

    // 演題募集フィルター (学会対象: 複数選択時はOR、未選択時は全件)
    if (state.filters.abstractStatus.size > 0) {
      if (![...state.filters.abstractStatus].some(condition => matchesAbstractFilter(event, condition, todayStr))) return false;
    }

    // 開催形式
    if (state.filters.format.size > 0 && !state.filters.format.has(event.format)) {
      return false;
    }

    // 地域
    if (state.filters.region.size > 0 && !state.filters.region.has(event.region)) {
      return false;
    }

    if (!matchesCoSponsorCompanies(event, state.filters.company, state.events)) {
      return false;
    }

    // 予定空き状況（未連携の場合は除外しない）
    if (effective.statusKey !== "unlinked") {
      if (state.filters.scheduleStatus.size > 0 && !state.filters.scheduleStatus.has(effective.statusKey)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (state.sortBy === "date-asc") {
      return new Date(a.date) - new Date(b.date);
    } else if (state.sortBy === "abstract-deadline-asc") {
      const deadlineA = parseAbstractDate(a.abstractSubmission?.deadline)?.timestamp ?? Infinity;
      const deadlineB = parseAbstractDate(b.abstractSubmission?.deadline)?.timestamp ?? Infinity;
      if (deadlineA !== deadlineB) return deadlineA - deadlineB;
      return new Date(a.date) - new Date(b.date);
    } else if (state.sortBy === "title-asc") {
      return a.title.localeCompare(b.title, "ja");
    }
    return 0;
  });
}

/**
 * イベントカード一覧のレンダリング
 */
function renderEvents() {
  const filtered = getFilteredEvents();

  // 件数表示
  elements.eventCount.textContent = filtered.length;
  elements.mobileResultCount.textContent = filtered.length;

  // アクティブ条件タグ
  renderActiveFilterChips();

  if (filtered.length === 0) {
    elements.eventList.innerHTML = "";
    elements.emptyState.style.display = "flex";
    return;
  }

  elements.emptyState.style.display = "none";
  elements.eventList.innerHTML = filtered.map(event => createEventCardHtml(event)).join("");

  // カード内アクションボタンのリスナー紐付け
  attachCardActionListeners();
}

/**
 * 適用中フィルタータグの描画
 */
function renderActiveFilterChips() {
  const chips = [];
  state.filters.company.forEach(id => {
    const company = COMPANY_MASTER.find(company => company.id === id);
    chips.push({ group: "company", label: `共催: ${company?.shortName || id}`, value: id });
  });

  if (state.filters.keyword) {
    chips.push({ group: "keyword", label: `検索: "${state.filters.keyword}"`, value: "" });
  }

  // 開催年
  if (state.filters.year.size > 0) {
    state.filters.year.forEach(yr => {
      chips.push({ group: "year", label: `年: ${yr}年`, value: yr });
    });
  }

  // 演題募集状況 (学会)
  if (state.filters.abstractStatus.size > 0) {
    const abstractLabels = {
      open: "🟢 演題募集中",
      deadline_30d: "⏱️ 締切30日以内",
      deadline_7d: "🔥 締切7日以内"
    };
    state.filters.abstractStatus.forEach(val => {
      chips.push({ group: "abstractStatus", label: abstractLabels[val] || val, value: val });
    });
  }

  ["specialty", "eventType", "format", "region"].forEach(group => {
    state.filters[group].forEach(val => {
      chips.push({ group, label: val, value: val });
    });
  });

  // スケジュール状況が一部のみ絞り込まれている場合
  const statusLabels = {
    free: "🟢 空きあり",
    partial_conflict: "🟡 一部重複",
    conflict: "🔴 重複",
    registered: "✓ 登録済み"
  };
  if (state.filters.scheduleStatus.size > 0 && state.filters.scheduleStatus.size < 4) {
    state.filters.scheduleStatus.forEach(val => {
      chips.push({ group: "scheduleStatus", label: statusLabels[val], value: val });
    });
  }

  // 終了した学会も表示
  if (state.filters.includeEndedConferences) {
    chips.push({ group: "includeEndedConferences", label: "終了した学会も表示", value: "true" });
  }

  if (chips.length === 0) {
    elements.activeFilterChips.innerHTML = "";
    return;
  }

  elements.activeFilterChips.innerHTML = chips.map(chip => `
    <span class="active-filter-badge">
      <strong>${escapeHtml(chip.label)}</strong>
      <button class="badge-remove" data-group="${chip.group}" data-value="${escapeHtml(chip.value)}" aria-label="解除">&times;</button>
    </span>
  `).join("");

  elements.activeFilterChips.querySelectorAll(".badge-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const grp = btn.getAttribute("data-group");
      const val = btn.getAttribute("data-value");

      if (grp === "keyword") {
        state.filters.keyword = "";
        elements.keywordSearch.value = "";
        elements.clearSearchBtn.style.display = "none";
      } else if (grp === "includeEndedConferences") {
        state.filters.includeEndedConferences = false;
        if (elements.filterIncludeEnded) elements.filterIncludeEnded.checked = false;
      } else if (state.filters[grp]) {
        state.filters[grp].delete(val);
        const cb = document.querySelector(`input[name="${grp}"][value="${val}"]`);
        if (cb) cb.checked = false;
      }
      renderEvents();
    });
  });
}

/**
 * イベントの日付バッジ情報（単日または複数日の会期表示）を生成
 */
function formatEventDateBadge(event) {
  const startDate = new Date(event.date);
  const startM = startDate.getMonth() + 1;
  const startD = startDate.getDate();
  const startW = WEEKDAYS[startDate.getDay()];

  // 終了日が未指定、または開始日と同じ（単日イベント）
  if (!event.endDate || event.endDate === event.date) {
    return {
      dateText: `${startM}/${startD}`,
      weekdayText: `(${startW})`
    };
  }

  // 複数日イベント（学会など）
  const endDate = new Date(event.endDate);
  const endM = endDate.getMonth() + 1;
  const endD = endDate.getDate();
  const endW = WEEKDAYS[endDate.getDay()];

  let dateText = "";
  if (startM === endM) {
    // 同一月内の会期: 例 "10/22–25"
    dateText = `${startM}/${startD}–${endD}`;
  } else {
    // 月をまたぐ会期: 例 "10/30–11/2"
    dateText = `${startM}/${startD}–${endM}/${endD}`;
  }

  // 曜日表示: 開始日と終了日の両方を表示 (例: "(木)–(日)")
  const weekdayText = `(${startW})–(${endW})`;

  return {
    dateText,
    weekdayText
  };
}

/**
 * 実在会場であるかを判定（「未定」「オンライン」等の非実在会場を除外）
 * @param {string} venue 
 * @returns {boolean}
 */
function isPhysicalVenue(venue) {
  if (!venue || typeof venue !== "string") return false;
  const v = venue.trim();
  if (!v || v === "未定" || v.includes("未定")) return false;
  if (
    v.startsWith("Web会議システム") ||
    v.startsWith("Zoom") ||
    v === "オンライン" ||
    v === "Web" ||
    v === "オンライン開催" ||
    v.includes("要確認")
  ) {
    return false;
  }
  return true;
}

/**
 * 会場名をGoogle Maps検索用ハイパーリンクとしてレンダリング
 * @param {Object} event 
 * @returns {string} HTML string
 */
function renderVenueHtml(event) {
  const masterVenue = getEventVenue(event);
  const venue = getEventVenueName(event);
  if (!isPhysicalVenue(venue)) {
    return escapeHtml(venue || "");
  }

  // 検索語の組み立て: 会場名 + 開催都市
  // 配信併記（例: " / Web同時配信", " / オンライン中継"）を検索語から除去して精度を向上
  const cleanVenue = venue.replace(/\s*\/\s*(?:Web|オンライン|ライブ).*$/, "").trim();

  let city = "";
  if (event.cityCountry && typeof event.cityCountry === "string" && !event.cityCountry.includes("未定")) {
    city = event.cityCountry.split("/")[0].trim();
  }

  let searchQuery = cleanVenue;
  // 会場名に都市名がまだ含まれていなければ都市名を付与（例: "高知県立県民文化ホール グリーンホール 高知市（高知県）"）
  if (city) {
    const rawCityName = city.replace(/（.*）/, "").trim();
    if (!cleanVenue.includes(rawCityName)) {
      searchQuery = `${cleanVenue} ${city}`;
    }
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(masterVenue?.googleMaps.searchQuery || searchQuery)}`;

  return `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="venue-map-link" title="Googleマップで場所を表示">${escapeHtml(venue)}</a>`;
}

/**
 * 1件の眼科イベントカードHTML生成
 */
function renderEventTimeHtml(event) {
  const rows = getEventJapanTimes(event);
  if (!rows.length) return escapeHtml(event.time || "");
  const localTime = event.time.replace(/\s*[（(]現地時間[）)]\s*$/, "") + "（現地時間）";
  const sameEveryDay = rows.every(row => row.text === rows[0].text);
  const japanTimes = sameEveryDay ? `<span class="japan-time">${rows.length > 1 ? "各日 " : ""}${escapeHtml(rows[0].text)}</span>` :
    rows.map(row => `<span class="japan-time">${escapeHtml(row.date)}：${escapeHtml(row.text)}</span>`).join("");
  return `<span class="event-time-zones"><span class="local-time">${escapeHtml(localTime)}</span>${japanTimes}</span>`;
}

function createEventCardHtml(event) {
  const dateBadgeInfo = formatEventDateBadge(event);
  const effective = computeEffectiveScheduleStatus(event);

  // 形式スタイル
  const formatMap = {
    "Web": "web",
    "現地": "onsite",
    "ハイブリッド": "hybrid"
  };
  const formatClass = formatMap[event.format] || "";

  // 重複情報の表示HTML（未連携・空きあり・登録済みの場合は表示しない）
  let conflictAlertHtml = "";
  if (effective.conflicts.length > 0) {
    const isFullConflict = effective.statusKey === "conflict";
    const alertBoxClass = isFullConflict ? "full" : "partial";
    const alertTitle = isFullConflict ? "予定と重複しています:" : "予定と一部重複しています:";

    const conflictLinesHtml = effective.conflicts.map(c => `
      <div class="conflict-item-line">
        <span class="conflict-provider-tag ${c.providerLabel === 'Google' ? 'google' : 'icloud'}">${escapeHtml(c.providerLabel)}</span>
        <span>${escapeHtml(c.start)}–${escapeHtml(c.end)} <strong>${escapeHtml(c.title)}</strong></span>
      </div>
    `).join("");

    conflictAlertHtml = `
      <div class="conflict-alert-box ${alertBoxClass}">
        <svg class="conflict-alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isFullConflict ? `
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          ` : `
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          `}
        </svg>
        <div class="conflict-alert-content">
          <span class="conflict-alert-title">${alertTitle}</span>
          ${conflictLinesHtml}
        </div>
      </div>
    `;
  }

  // 学会参加予定ステータス（あり・なし・未選択）
  const isConferenceAttending = event.isConference && state.attendingConferences.has(event.id);
  const isConferenceHidden = event.isConference && state.hiddenConferences.has(event.id);
  const isConferenceEndedEvent = event.isConference && isConferenceEnded(event);

  // 学会参加履歴ステータス（参加した・参加しなかった・未選択）
  const historyRecord = event.isConference ? state.conferenceHistory.get(event.id) : null;
  const historyStatus = historyRecord ? historyRecord.status : "none";
  const isAttended = historyStatus === "attended";
  const isNotAttended = historyStatus === "not_attended";

  // 学会（国内学会・海外学会）特有の表示ブロック
  let conferenceBlockHtml = "";
  if (event.isConference) {
    conferenceBlockHtml = `
      <div class="conference-special-box">
        ${isConferenceEndedEvent ? `
        <!-- 会期終了後: 参加実績記録（参加した／参加しなかった 排他2択）バー -->
        <div class="conf-attendance-bar conf-history-record-bar ${isAttended ? 'history-attended' : ''}">
          <div class="conf-attendance-label-wrap">
            <span class="conf-attendance-main-text">参加しましたか？</span>
            <span class="conf-attendance-hint">（マイ学会履歴に記録）</span>
          </div>

          <div class="conf-choice-group" role="group" aria-label="学会参加実績の選択">
            <button type="button" 
              class="conf-choice-btn choice-attended ${isAttended ? 'active' : ''}" 
              data-action="record-history" 
              data-history-choice="attended" 
              data-conference-id="${escapeHtml(event.id)}" 
              aria-pressed="${isAttended ? 'true' : 'false'}"
              title="${isAttended ? '参加記録を解除' : '参加した（マイ学会履歴に記録）'}">
              <span class="choice-dot"></span>
              <span class="choice-text">参加した</span>
            </button>

            <button type="button" 
              class="conf-choice-btn choice-not-attended ${isNotAttended ? 'active' : ''}" 
              data-action="record-history" 
              data-history-choice="not_attended" 
              data-conference-id="${escapeHtml(event.id)}" 
              aria-pressed="${isNotAttended ? 'true' : 'false'}"
              title="${isNotAttended ? '記録を解除' : '参加しなかった'}">
              <span class="choice-dot"></span>
              <span class="choice-text">参加しなかった</span>
            </button>
          </div>

          ${isAttended ? '<span class="conf-attended-active-tag">✓ 参加履歴に記録済み</span>' : ''}
        </div>
        ` : `
        <!-- 会期終了前: 参加予定（あり・なし 排他2択）切り替えバー -->
        <div class="conf-attendance-bar conf-planned-attendance-bar ${isConferenceAttending ? 'attending' : ''}">
          <div class="conf-choice-group conf-planned-choice-group" role="group" aria-label="参加予定の選択">
            <span class="conf-attendance-main-text">参加予定：</span>
            <button type="button" 
              class="conf-choice-btn choice-yes ${isConferenceAttending ? 'active' : ''}" 
              data-action="attend-choice" 
              data-choice="yes" 
              data-conference-id="${escapeHtml(event.id)}" 
              aria-pressed="${isConferenceAttending ? 'true' : 'false'}"
              title="${isConferenceAttending ? '参加予定を解除' : '参加予定にする（関連セミナーを表示）'}">
              <span class="choice-dot"></span>
              <span class="choice-text">あり（関連セミナー表示）</span>
            </button>

            <button type="button" 
              class="conf-choice-btn choice-no ${isConferenceHidden ? 'active' : ''}" 
              data-action="attend-choice" 
              data-choice="no" 
              data-conference-id="${escapeHtml(event.id)}" 
              aria-pressed="${isConferenceHidden ? 'true' : 'false'}"
              title="参加しない（一覧から非表示にする）">
              <span class="choice-dot"></span>
              <span class="choice-text">なし（非表示）</span>
            </button>
          </div>

        </div>
        `}

        <div class="conf-item conf-item-full">
          <span class="conf-label">会期:</span>
          <span class="conf-val">${escapeHtml(event.period || event.date)}</span>
        </div>
        <div class="conf-item conf-item-full">
          <span class="conf-label">開催都市・国:</span>
          <span class="conf-val">${escapeHtml(event.cityCountry || event.venue)}</span>
        </div>
        ${event.conferenceCategory || event.conferenceRegion ? `
        <div class="conf-item conf-item-full">
          <span class="conf-label">学会分類:</span>
          <span class="conf-val conf-classification-val">
            <span class="conf-category-badge region">${event.conferenceRegion === 'international' ? '海外学会' : '国内学会'}</span>
            ${event.conferenceCategory ? `<span class="conf-category-badge category">${escapeHtml(event.conferenceCategory)}</span>` : ''}
          </span>
        </div>
        ` : ''}
        <div class="conf-deadlines-row">
          <div class="conf-item">
            <span class="conf-label">演題募集:</span>
            <span class="conf-val conf-abstract-deadline-val">
              ${renderAbstractSubmissionHtml(event)}
            </span>
          </div>
          <div class="conf-item">
            <span class="conf-label">早期登録締切:</span>
            <span class="conf-val deadline-highlight">${escapeHtml(event.earlyBirdDeadline || "要確認")}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 学会関連セミナー（ランチョン・モーニング等）特有の親学会バッジ
  let parentConferenceBadgeHtml = "";
  if (event.parentConferenceId) {
    const parentConf = state.events.find(e => e.id === event.parentConferenceId);
    const parentTitle = parentConf ? parentConf.title : "親学会";
    parentConferenceBadgeHtml = `
      <div class="parent-conference-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span>${escapeHtml(parentTitle)} 関連セミナー</span>
      </div>
    `;
  }

  return `
    <article class="event-card ${effective.isRegistered ? 'status-registered-card' : ''} ${isConferenceAttending ? 'card-attending-conference' : ''} ${event.parentConferenceId ? 'card-seminar-related' : ''} ${isConferenceEndedEvent ? 'card-conference-ended' : ''} ${isAttended ? 'card-history-attended' : ''}" data-id="${event.id}">
      <!-- 上段: 日程・地域・ステータスバッジ -->
      <div class="card-top-row">
        <div class="date-time-block">
          <div class="date-badge">
            <span class="month-day">${escapeHtml(dateBadgeInfo.dateText)}</span>
            <span class="day-week">${escapeHtml(dateBadgeInfo.weekdayText)}</span>
          </div>
          <div class="time-and-region">
            <div class="time-text">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${renderEventTimeHtml(event)}
            </div>
            <div class="location-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>[${escapeHtml(getEventVenueRegionLabel(event))}] ${renderVenueHtml(event)}</span>
            </div>
          </div>
        </div>

        <div class="badges-group">
          <!-- 終了学会バッジ -->
          ${isConferenceEndedEvent ? '<span class="conf-ended-badge">終了</span>' : ''}
          <!-- 学会参加実績バッジ (マイ学会履歴: 参加した) -->
          ${isAttended ? '<span class="conf-history-attended-badge">✓ 参加済</span>' : ''}
          <!-- 学会参加予定バッジ (会期前の学会のみ) -->
          ${!isConferenceEndedEvent && isConferenceAttending ? '<span class="conf-attending-badge">✓ 参加予定</span>' : ''}
          <!-- 開催形式バッジ -->
          <span class="format-badge ${formatClass}">${escapeHtml(event.format)}</span>
          <!-- カレンダー予定空き状況バッジ -->
          <span class="schedule-badge ${effective.badgeClass}">${escapeHtml(effective.badgeText)}</span>
        </div>
      </div>

      <!-- 予定重複アラート（重複時のみ表示） -->
      ${conflictAlertHtml}

      <!-- 中段: タイトル・サブタイトル・概要 -->
      <div class="card-content-block">
        ${parentConferenceBadgeHtml}
        <h3 class="card-title">${escapeHtml(event.title)}</h3>
        <p class="card-subtitle">${escapeHtml(event.subtitle)}</p>
        <p class="card-desc">${escapeHtml(event.description)}</p>
      </div>

      <!-- 学会特有メタ情報（国内学会・海外学会のみ） -->
      ${conferenceBlockHtml}

      <!-- メタ情報: 診療領域・共催・取得単位 -->
      <div class="card-meta-list">
        <div class="card-meta-item">
          <span class="card-meta-label">専門領域:</span>
          <strong>${escapeHtml(event.specialty)}</strong>
        </div>
        <div class="card-meta-item">
          <span class="card-meta-label">種別:</span>
          <span>${escapeHtml(event.eventType)}</span>
        </div>
        <div class="card-meta-item">
          <span class="card-meta-label">主催/共催:</span>
          <span>${escapeHtml(event.sponsor)}</span>
        </div>
        <div class="card-meta-item">
          <span class="card-meta-label">認定単位:</span>
          <span class="credits-highlight">${escapeHtml(event.credits)}</span>
        </div>
      </div>

      <!-- タグ一覧 -->
      <div class="card-tags-list">
        ${event.tags.map(t => `<span class="tag-item">#${escapeHtml(t)}</span>`).join("")}
      </div>

      <!-- 下段: 3つの操作ボタン (カレンダーに追加 / 案内PDF / 公式申込ページ) -->
      <div class="card-actions-row">
        <!-- 1. カレンダーに追加 -->
        <button class="btn btn-calendar" data-action="add-calendar" title="Google/iCloud/Outlookに追加 (.ics)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <line x1="12" y1="14" x2="12" y2="18"></line>
            <line x1="10" y1="16" x2="14" y2="16"></line>
          </svg>
          カレンダーに追加
        </button>

        <!-- 2. 案内PDF -->
        <button class="btn btn-outline" data-action="view-pdf" title="案内チラシ・抄録PDFを表示">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          案内PDF
        </button>

        <!-- 3. 公式申込ページ (別タブで開く) -->
        <a href="${escapeHtml(event.officialUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn btn-official" title="公式サイト・事前参加登録ページへ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          公式申込ページ
        </a>
      </div>
    </article>
  `;
}

/**
 * カード内ボタンクリック時のイベントリスナー登録
 */
function attachCardActionListeners() {
  elements.eventList.querySelectorAll(".event-card").forEach(card => {
    const eventId = card.getAttribute("data-id");
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    // 案内PDFプレビュー
    const pdfBtn = card.querySelector('[data-action="view-pdf"]');
    if (pdfBtn) {
      pdfBtn.addEventListener("click", () => showPdfModal(event));
    }

    // カレンダー追加
    const calBtn = card.querySelector('[data-action="add-calendar"]');
    if (calBtn) {
      calBtn.addEventListener("click", () => addToCalendar(event));
    }

    // 学会カードの「参加予定（あり・なし）」排他2択ボタン
    const choiceButtons = card.querySelectorAll('[data-action="attend-choice"]');
    choiceButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.getAttribute("data-choice");
        const isCurrentlyYes = state.attendingConferences.has(event.id);

        if (choice === "yes") {
          // すでに「あり」なら未選択に戻す、そうでなければ「あり」へ設定
          setConferenceAttendance(event.id, isCurrentlyYes ? "none" : "yes");
        } else if (choice === "no") {
          // 「なし」へ設定（一覧から非表示）
          setConferenceAttendance(event.id, "no");
        }
      });
    });

    // 学会カードの「参加しましたか？（参加した・参加しなかった）」排他2択ボタン
    const historyChoiceButtons = card.querySelectorAll('[data-action="record-history"]');
    historyChoiceButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.getAttribute("data-history-choice");
        const existing = state.conferenceHistory.get(event.id);
        const currentStatus = existing ? existing.status : "none";

        if (choice === currentStatus) {
          // すでに選択済みのボタンを再度クリックしたら解除
          setConferenceHistoryStatus(event.id, "none");
        } else {
          setConferenceHistoryStatus(event.id, choice);
        }
      });
    });
  });
}

/**
 * ヘッダーの登録件数バッジ更新
 */
function updateRegisteredBadge() {
  const registeredCount = state.events.filter(e => e.calendarStatus?.isAdded || e.scheduleStatus === "registered").length;
  elements.registeredBadgeCount.textContent = registeredCount;
}

/**
 * 案内状PDFモーダルの表示（将来的な実PDF保存構造を想定）
 */
function showPdfModal(event) {
  elements.pdfModalTitle.textContent = `眼科プログラム案内状 - ${event.title}`;
  elements.pdfModalBody.innerHTML = `
    <div class="pdf-paper">
      <div class="pdf-paper-header">
        <span class="pdf-stamp">OPHTHALMOLOGY PROGRAM GUIDE</span>
        <h2 class="pdf-main-title">${escapeHtml(event.title)}</h2>
        <p style="font-size:0.9rem; color:#475569; margin-top:4px;">${escapeHtml(event.subtitle)}</p>
      </div>

      <div class="pdf-paper-meta">
        <div><strong>【日時 / 会期】</strong> ${escapeHtml(event.period || `${event.date} ${event.time}`)}</div>
        ${getEventJapanTimes(event).length ? `<div><strong>【開催時刻】</strong> ${renderEventTimeHtml(event)}</div>` : ""}
        <div><strong>【開催形式】</strong> ${escapeHtml(event.format)} (${escapeHtml(event.region)})</div>
        <div><strong>【会場】</strong> ${renderVenueHtml(event)}</div>
        <div><strong>【主催】</strong> ${escapeHtml(event.sponsor)}</div>
        <div><strong>【眼科単位】</strong> <span style="color:#0284c7; font-weight:600;">${escapeHtml(event.credits)}</span></div>
        ${event.abstractDeadline ? `<div><strong>【演題締切】</strong> ${escapeHtml(event.abstractDeadline)}</div>` : ""}
      </div>

      <div style="font-size: 0.85rem; line-height: 1.6; color: #334155;">
        <h4 style="font-size: 0.9rem; margin-bottom: 6px; color: #0f172a; border-left: 3px solid #0284c7; padding-left: 8px;">抄録・講演概要</h4>
        <p>${escapeHtml(event.description)}</p>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; font-size: 0.8rem; color: #166534;">
        💡 <strong>保存ファイル名:</strong> <code>assets/${escapeHtml(event.pdfUrl)}</code><br>
        ※ 将来的にはアップロード保存されたPDFの実ファイルが直接プレビュー・ダウンロードされます。
      </div>
    </div>
  `;

  elements.pdfModal.showModal();
}

/**
 * カレンダー連携処理
 * 設定値 (state.calendarSettings.defaultCalendar) に応じて処理:
 *  - "google": Googleカレンダー予定作成画面を別タブで開く
 *  - "icloud": .icsファイルを直接ダウンロード
 *  - "ask": 選択ダイアログ/トースト経由で両方を提供
 */
function addToCalendar(event) {
  const dateStr = event.date; // YYYY-MM-DD
  const times = event.time.split("-").map(t => t.trim());
  const startTimeStr = times[0] ? times[0].replace(/[^0-9:]/g, "") : "19:00";
  const endTimeStr = times[1] ? times[1].replace(/[^0-9:]/g, "") : "20:30";

  const safeStartTime = startTimeStr.includes(":") ? startTimeStr : "19:00";
  const safeEndTime = endTimeStr.includes(":") ? endTimeStr : "20:30";

  const startIso = `${dateStr.replace(/-/g, "")}T${safeStartTime.replace(":", "")}00`;
  const endIso = `${dateStr.replace(/-/g, "")}T${safeEndTime.replace(":", "")}00`;

  const dest = state.calendarSettings.defaultCalendar || "ask";

  // Google Calendar URL
  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(event.description + "\n\n主催: " + event.sponsor + "\n単位: " + event.credits + "\n公式URL: " + event.officialUrl)}&location=${encodeURIComponent(getEventVenueName(event))}`;

  // iCalendar (.ics) データ
  const icsData = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OphthalConf//OphthalmologyEvent//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, " ")} (${event.credits})\\n公式: ${event.officialUrl}`,
    `LOCATION:${getEventVenueName(event)}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const downloadIcs = () => {
    const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.id}_event.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (dest === "google") {
    window.open(gCalUrl, "_blank", "noopener,noreferrer");
    showToast(`📅 Googleカレンダーに「${event.title}」の登録画面を開きました`);
  } else if (dest === "icloud") {
    downloadIcs();
    showToast(`📅 iCloud/Appleカレンダー用ファイル(.ics)をダウンロードしました`);
  } else {
    downloadIcs();
    showToast(`📅 カレンダーファイル(.ics)をダウンロードしました (Googleカレンダーにも追加可)`);
  }

  // カレンダー登録済みステータスに更新
  if (!event.calendarStatus) {
    event.calendarStatus = { google: { status: "free", conflicts: [] }, icloud: { status: "free", conflicts: [] } };
  }
  event.calendarStatus.isAdded = true;
  event.scheduleStatus = "registered";
  event.conflictDetail = null;

  updateRegisteredBadge();
  renderEvents();
}

/**
 * トースト通知
 */
let toastTimeout;
function showToast(message, action = null) {
  clearTimeout(toastTimeout);
  if (!elements.toast) return;

  elements.toast.innerHTML = "";

  const textSpan = document.createElement("span");
  textSpan.className = "toast-message";
  textSpan.textContent = message;
  elements.toast.appendChild(textSpan);

  if (action && action.label && typeof action.onClick === "function") {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "toast-action-btn";
    actionBtn.textContent = action.label;
    actionBtn.addEventListener("click", () => {
      action.onClick();
      hideToast();
    });
    elements.toast.appendChild(actionBtn);
  }

  elements.toast.classList.add("show");

  const duration = action ? 5000 : 3200;
  toastTimeout = setTimeout(() => {
    hideToast();
  }, duration);
}

function hideToast() {
  clearTimeout(toastTimeout);
  if (elements.toast) {
    elements.toast.classList.remove("show");
  }
}

/**
 * XSSサニタイズ用ヘルパー
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", initApp);
