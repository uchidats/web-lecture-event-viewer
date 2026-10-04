/**
 * OphthaHub - 眼科医専用 講演会・学会検索アプリ
 * 即時絞り込み・カレンダー重複表示・ICS連携・学会詳細メタ情報
 */

// アプリケーションの状態管理
let state = {
  events: [...sampleEvents], // sampleEvents from events.js
  filters: {
    keyword: "",
    specialty: new Set(),
    eventType: new Set(),
    format: new Set(),
    region: new Set(),
    scheduleStatus: new Set(["free", "partial_conflict", "conflict", "registered"]), // 全ステータスを初期表示
    registeredOnly: false
  },
  sortBy: "date-asc",
  // カレンダー連携設定 (localStorage永続化)
  calendarSettings: {
    calendarProvider: "both", // "google", "icloud", "both", "none"
    defaultCalendar: "ask"    // "google", "icloud", "ask"
  }
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
  loadCalendarSettings();
  renderFilterOptions();
  updateRegisteredBadge();
  setupEventListeners();
  renderEvents();
}

/**
 * localStorageからカレンダー連携設定をロード
 */
const CALENDAR_SETTINGS_KEY = "ophthahub_calendar_settings";

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
 * フィルター項目のチェックボックス（チップUI）を動的生成
 */
function renderFilterOptions() {
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

    ["specialty", "eventType", "format", "region"].forEach(key => {
      state.filters[key].clear();
    });

    // スケジュール状況は全選択に戻す
    state.filters.scheduleStatus = new Set(["free", "partial_conflict", "conflict", "registered"]);
    state.filters.registeredOnly = false;
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
  return state.events.filter(event => {
    const effective = computeEffectiveScheduleStatus(event);

    // 登録済み限定フィルター
    if (state.filters.registeredOnly && !effective.isRegistered) {
      return false;
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

    // 開催形式
    if (state.filters.format.size > 0 && !state.filters.format.has(event.format)) {
      return false;
    }

    // 地域
    if (state.filters.region.size > 0 && !state.filters.region.has(event.region)) {
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
    } else if (state.sortBy === "date-desc") {
      return new Date(b.date) - new Date(a.date);
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

  if (state.filters.keyword) {
    chips.push({ group: "keyword", label: `検索: "${state.filters.keyword}"`, value: "" });
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
 * 1件の眼科イベントカードHTML生成
 */
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

  // 学会（国内学会・海外学会）特有の表示ブロック
  let conferenceBlockHtml = "";
  if (event.isConference) {
    conferenceBlockHtml = `
      <div class="conference-special-box">
        <div class="conf-item conf-item-full">
          <span class="conf-label">会期:</span>
          <span class="conf-val">${escapeHtml(event.period || event.date)}</span>
        </div>
        <div class="conf-item conf-item-full">
          <span class="conf-label">開催都市・国:</span>
          <span class="conf-val">${escapeHtml(event.cityCountry || event.venue)}</span>
        </div>
        <div class="conf-deadlines-row">
          <div class="conf-item">
            <span class="conf-label">演題登録締切:</span>
            <span class="conf-val deadline-highlight">${escapeHtml(event.abstractDeadline || "要確認")}</span>
          </div>
          <div class="conf-item">
            <span class="conf-label">早期登録締切:</span>
            <span class="conf-val deadline-highlight">${escapeHtml(event.earlyBirdDeadline || "要確認")}</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <article class="event-card ${effective.isRegistered ? 'status-registered-card' : ''}" data-id="${event.id}">
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
              ${escapeHtml(event.time)}
            </div>
            <div class="location-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>[${escapeHtml(event.region)}] ${escapeHtml(event.venue)}</span>
            </div>
          </div>
        </div>

        <div class="badges-group">
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
        <div><strong>【開催形式】</strong> ${escapeHtml(event.format)} (${escapeHtml(event.region)})</div>
        <div><strong>【会場】</strong> ${escapeHtml(event.venue)}</div>
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
  const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(event.description + "\n\n主催: " + event.sponsor + "\n単位: " + event.credits + "\n公式URL: " + event.officialUrl)}&location=${encodeURIComponent(event.venue)}`;

  // iCalendar (.ics) データ
  const icsData = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OphthaHub//OphthalmologyEvent//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, " ")} (${event.credits})\\n公式: ${event.officialUrl}`,
    `LOCATION:${event.venue}`,
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
function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3200);
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
