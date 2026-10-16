(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const container = doc.getElementById('gemini-monitor-panel');
  if (!container) return;

  const STORAGE_KEY = 'ophthalconf_gemini_monitor_acknowledgements_v1';
  const ADMIN_EMAIL = 'uchidats@gmail.com';

  const model = root.OphthalReviewModel;
  const label = field => model?.fieldLabels?.[field] || field;
  const fmt = (field, value) => model ? model.formatValue(field, value) : String(value ?? '');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentAdminUser = null;
  let activeReport = null;
  let view = 'pending';

  // ---- decision keys -------------------------------------------------------------------------------
  // A decision belongs to eventId + field + the proposed value. Structured values use a canonical form, so key order or
  // array order never creates a different decision; a changed value always starts undecided.
  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize).map(entry => JSON.stringify(entry)).sort();
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) if (value[key] !== undefined) out[key] = canonicalize(value[key]);
      return out;
    }
    return value;
  }
  function hash53(text) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }
  function valueToken(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return `h:${hash53(JSON.stringify(canonicalize(value)))}`;
    return String(value);
  }
  // A change whose proposed value is empty (withheld by validation) cannot be adopted.
  const isAdoptable = change => change.after !== null && change.after !== undefined && change.after !== '';

  // Firestore Primary Store with Local Offline Fallback
  // data = { version, items: { <apply-queue / legacy card records> }, fieldDecisions: { <per-field decisions> } }
  //  - items keeps the existing format and statuses (acknowledged → applied by the monitor). One pending record per event.
  //  - fieldDecisions holds adopted / kept / deferred per eventId + field + value; the monitor ignores it and writes it back untouched.
  const store = {
    data: { version: 1, items: {}, fieldDecisions: {} },
    isFirestoreSynced: false,
    // Outcome of the latest Firestore write / read. Only a 2xx response counts as success; tokens are never stored here.
    lastSave: null, // { state: 'synced' | 'failed', status: number | null, reason?: 'no-auth' | 'network' | 'http', local: boolean }
    lastLoad: null, // { state: 'synced' | 'failed', status: number | null, reason?: ... }

    ensureShape() {
      if (!this.data || typeof this.data !== 'object') this.data = { version: 1, items: {} };
      if (!this.data.items || typeof this.data.items !== 'object') this.data.items = {};
      if (!this.data.fieldDecisions || typeof this.data.fieldDecisions !== 'object') this.data.fieldDecisions = {};
      return this.data;
    },

    async loadPrimary(user) {
      this.lastLoad = null;
      // 1. Try Primary: Firestore
      if (user && user.email === ADMIN_EMAIL && user.emailVerified === true) {
        try {
          const authHeader = await user.getIdToken?.();
          if (authHeader) {
            const url = `https://firestore.googleapis.com/v1/projects/ophthalconf/databases/(default)/documents/gemini_monitor_acknowledgements/state`;
            const res = await fetch(url, {
              headers: { 'Authorization': `Bearer ${authHeader}` }
            });
            if (res.ok) {
              this.lastLoad = { state: 'synced', status: res.status };
              const docData = await res.json();
              const remoteJsonStr = docData.fields?.json?.stringValue;
              if (remoteJsonStr) {
                const remoteObj = JSON.parse(remoteJsonStr);
                this.data = remoteObj;
                this.ensureShape();
                this.isFirestoreSynced = true;
                this.saveLocalCache();
                return this.data;
              }
            } else if (res.status === 404) {
              // The state document is created by the first successful write; nothing to load yet.
              this.lastLoad = { state: 'synced', status: 404, reason: 'not-created' };
            } else {
              this.lastLoad = { state: 'failed', status: res.status, reason: 'http' };
              console.warn(`[Gemini Monitor] Firestore load failed: HTTP ${res.status}. Showing the local cache.`);
            }
          } else {
            this.lastLoad = { state: 'failed', status: null, reason: 'no-auth' };
            console.warn('[Gemini Monitor] Firestore load skipped: no sign-in token available. Showing the local cache.');
          }
        } catch (err) {
          this.lastLoad = { state: 'failed', status: null, reason: 'network' };
          console.warn(`[Gemini Monitor] Firestore load failed (${err?.name || 'error'}). Showing the local cache.`);
        }
      }

      // 2. Fallback: Local Cache
      return this.loadLocalCache();
    },

    loadLocalCache() {
      try {
        const raw = root.localStorage?.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.items === 'object') {
            this.data = parsed;
          }
        }
      } catch (_) {}
      return this.ensureShape();
    },

    saveLocalCache() {
      try {
        this.data.updatedAt = new Date().toISOString();
        root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
        return true;
      } catch (_) { return false; }
    },

    // Returns the sync outcome. Success means a 2xx Firestore response; anything else leaves the change in this browser only.
    async savePrimary(user) {
      this.data.updatedAt = new Date().toISOString();
      const local = this.saveLocalCache();
      const fail = (reason, status) => {
        this.isFirestoreSynced = false;
        this.lastSave = { state: 'failed', status, reason, local };
        return this.lastSave;
      };

      if (!(user && user.email === ADMIN_EMAIL && user.emailVerified === true)) return fail('no-auth', null);
      try {
        const authHeader = await user.getIdToken?.();
        if (!authHeader) {
          console.warn('[Gemini Monitor] Firestore sync failed: no sign-in token available. Saved in this browser only.');
          return fail('no-auth', null);
        }
        const url = `https://firestore.googleapis.com/v1/projects/ophthalconf/databases/(default)/documents/gemini_monitor_acknowledgements/state`;
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${authHeader}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              json: { stringValue: JSON.stringify(this.data) },
              updatedAt: { stringValue: this.data.updatedAt }
            }
          })
        });
        if (!res.ok) {
          console.warn(`[Gemini Monitor] Firestore sync failed: HTTP ${res.status}. Saved in this browser only.`);
          return fail('http', res.status);
        }
        this.isFirestoreSynced = true;
        this.lastSave = { state: 'synced', status: res.status, local };
        return this.lastSave;
      } catch (err) {
        console.warn(`[Gemini Monitor] Firestore sync failed (${err?.name || 'error'}). Saved in this browser only.`);
        return fail('network', null);
      }
    },

    // Human readable sync state for the panel; null when nothing has been attempted yet.
    syncNotice() {
      const save = this.lastSave, load = this.lastLoad;
      const where = r => r.status ? `HTTP ${r.status}` : r.reason === 'no-auth' ? '認証情報なし' : '通信エラー';
      if (save?.state === 'failed') {
        return { state: 'failed', text: `Firestore同期失敗（${where(save)}）: 変更はこのブラウザのlocalStorage${save.local ? 'にのみ保存されました' : 'にも保存できませんでした'}。他の端末や自動監視には反映されません。` };
      }
      if (load?.state === 'failed') {
        return { state: 'failed', text: `Firestore読み込み失敗（${where(load)}）: このブラウザのlocalStorageの内容を表示しています。` };
      }
      if (save?.state === 'synced') return { state: 'synced', text: 'Firestore同期済み' };
      return null;
    },

    // Card-level key: unchanged, so records written before per-field decisions stay readable.
    getItemKey(item) {
      if (Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0) {
        const changeParts = item.fieldChanges.map(c => `${c.field}=${c.after}`).sort().join(';');
        return `${item.eventId}::${changeParts}`;
      }
      return `${item.eventId}::${item.reason || 'review'}`;
    },

    // Per-field decision key: eventId + field + canonical fingerprint of the proposed value.
    fieldKey(item, change) {
      return `${item.eventId}::${change.field}@${valueToken(change.after)}`;
    },

    // Legacy card-level record (acknowledged / applied / rolled_back ...) written by earlier versions or by the card-level path.
    legacyRecord(item) {
      const record = this.data.items[this.getItemKey(item)];
      return record && record.origin !== 'field-decisions' ? record : null;
    },

    // State of one change row: { status: 'undecided'|'adopted'|'kept'|'deferred', applyState: null|'pending'|'applied', source }
    fieldState(item, change) {
      const decision = this.data.fieldDecisions[this.fieldKey(item, change)];
      if (decision) {
        let applyState = null;
        if (decision.status === 'adopted') {
          const queued = decision.queueKey ? this.data.items[decision.queueKey] : null;
          applyState = queued && queued.status !== 'acknowledged' ? 'applied' : 'pending';
        }
        return { status: decision.status, applyState, source: 'field' };
      }
      const legacy = this.legacyRecord(item);
      if (legacy) {
        if (['acknowledged', 'applied', 'auto_applied'].includes(legacy.status)) {
          return { status: 'adopted', applyState: legacy.status === 'acknowledged' ? 'pending' : 'applied', source: 'legacy' };
        }
        if (['rolled_back', 'rollback_requested'].includes(legacy.status)) return { status: 'kept', applyState: null, source: 'legacy' };
      }
      return { status: 'undecided', applyState: null, source: null };
    },

    // Card state from its rows: any undecided → pending; all decided with any deferred → hold; otherwise done.
    cardView(item) {
      const changes = Array.isArray(item.fieldChanges) ? item.fieldChanges : [];
      if (!changes.length) {
        const legacy = this.legacyRecord(item);
        const state = legacy && ['acknowledged', 'applied', 'auto_applied', 'rolled_back', 'rollback_requested'].includes(legacy.status) ? 'done' : 'pending';
        return { state, rows: [] };
      }
      const rows = changes.map(change => ({ change, key: this.fieldKey(item, change), adoptable: isAdoptable(change), ...this.fieldState(item, change) }));
      const state = rows.some(row => row.status === 'undecided') ? 'pending' : rows.some(row => row.status === 'deferred') ? 'hold' : 'done';
      return { state, rows };
    },

    getStatus(item) {
      const state = this.cardView(item).state;
      return state === 'pending' ? 'pending' : state;
    },

    // Records written by the legacy card-level path become explicit per-field decisions before a field is changed,
    // and a still-pending legacy acknowledgement is dropped (the apply queue is rebuilt from the decisions).
    materializeLegacy(item) {
      const legacy = this.legacyRecord(item);
      if (!legacy || !Array.isArray(item.fieldChanges)) return;
      const adopted = ['acknowledged', 'applied', 'auto_applied'].includes(legacy.status);
      const kept = ['rolled_back', 'rollback_requested'].includes(legacy.status);
      if (!adopted && !kept) return;
      for (const change of item.fieldChanges) {
        const key = this.fieldKey(item, change);
        if (this.data.fieldDecisions[key]) continue;
        this.data.fieldDecisions[key] = this.newDecision(item, change, adopted ? 'adopted' : 'kept', legacy.timestamp);
        if (adopted && legacy.status !== 'acknowledged') this.data.fieldDecisions[key].queueKey = legacy.key || this.getItemKey(item);
      }
      if (legacy.status === 'acknowledged') delete this.data.items[legacy.key || this.getItemKey(item)];
    },

    newDecision(item, change, status, at) {
      return {
        key: this.fieldKey(item, change),
        eventId: item.eventId,
        eventName: item.eventName,
        field: change.field,
        before: change.before ?? null,
        after: change.after ?? null,
        status, // 'adopted' | 'kept' | 'deferred'
        decidedAt: at || new Date().toISOString(),
        decidedBy: currentAdminUser?.email || ADMIN_EMAIL,
        reportDate: activeReport?.date || (at || new Date().toISOString()).slice(0, 10),
        sourceUrl: item.sourceUrl || null,
        sourceQuality: item.sourceQuality || null,
        confidence: item.confidence ?? null,
        change: JSON.parse(JSON.stringify(change))
      };
    },

    // One pending "acknowledged" record per event, holding only the currently adopted, not yet applied fields.
    // Fields whose record is already applied are frozen. Earlier adoptions are merged, never overwritten.
    syncApplyQueue(item) {
      const items = this.data.items, decisions = Object.values(this.data.fieldDecisions).filter(d => d.eventId === item.eventId);
      const frozen = d => d.queueKey && items[d.queueKey] && items[d.queueKey].status !== 'acknowledged';
      const pending = decisions.filter(d => d.status === 'adopted' && !frozen(d) && isAdoptable(d.change || { after: d.after }));

      for (const key of Object.keys(items)) {
        const record = items[key];
        if (record && record.origin === 'field-decisions' && record.eventId === item.eventId && record.status === 'acknowledged') delete items[key];
      }
      for (const d of decisions) if (!frozen(d)) delete d.queueKey;
      if (!pending.length) return null;

      const now = new Date().toISOString();
      const queueKey = `${item.eventId}::${pending.map(d => `${d.field}@${valueToken(d.after)}`).sort().join(';')}`;
      const first = pending[0];
      items[queueKey] = {
        key: queueKey,
        origin: 'field-decisions',
        eventId: item.eventId,
        eventName: item.eventName,
        status: 'acknowledged',
        field: first.field,
        beforeValue: first.before || null,
        afterValue: first.after || null,
        currentValue: first.after || null,
        fingerprint: queueKey,
        reason: 'Admin adopted individual changes',
        fieldChanges: pending.map(d => JSON.parse(JSON.stringify(d.change || { field: d.field, before: d.before, after: d.after }))),
        evidenceUrl: item.sourceUrl,
        sourceUrl: item.sourceUrl,
        sourceQuality: item.sourceQuality || null,
        confidence: item.confidence || null,
        reportId: activeReport?.date || now.slice(0, 10),
        reportDate: activeReport?.date || now.slice(0, 10),
        timestamp: now,
        acknowledgedAt: now,
        acknowledgedBy: currentAdminUser?.email || ADMIN_EMAIL,
        reviewerEmail: currentAdminUser?.email || ADMIN_EMAIL,
        storagePrimary: 'firestore'
      };
      for (const d of pending) d.queueKey = queueKey;
      return queueKey;
    },

    // entries: [{ change, status }] with status 'adopted' | 'kept' | 'deferred' | 'undecided' (clears the decision).
    setDecisions(item, entries) {
      this.ensureShape();
      this.materializeLegacy(item);
      const now = new Date().toISOString();
      for (const { change, status } of entries) {
        const key = this.fieldKey(item, change);
        const current = this.data.fieldDecisions[key];
        if (current && current.status === 'adopted' && current.queueKey && this.data.items[current.queueKey]?.status !== 'acknowledged' && this.data.items[current.queueKey]) {
          continue; // already applied to events.js: the decision can no longer be changed here
        }
        if (status === 'undecided') delete this.data.fieldDecisions[key];
        else if (status === 'adopted' && !isAdoptable(change)) continue;
        else this.data.fieldDecisions[key] = this.newDecision(item, change, status, now);
      }
      this.syncApplyQueue(item);
      return this.savePrimary(currentAdminUser);
    },

    decideField(item, change, status) { return this.setDecisions(item, [{ change, status }]); },

    // "All adopt" skips changes that cannot be adopted; "all keep" covers every row.
    decideAll(item, status) {
      const changes = Array.isArray(item.fieldChanges) ? item.fieldChanges : [];
      return this.setDecisions(item, changes.map(change => ({ change, status })));
    },

    // Card-level action kept for compatibility: cards with field changes route to per-field decisions;
    // cards without any use the original card-level record.
    async recordAction(item, status, reason = '') {
      if (Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0 && ['acknowledged', 'rolled_back'].includes(status)) {
        return this.decideAll(item, status === 'acknowledged' ? 'adopted' : 'kept');
      }
      const key = this.getItemKey(item);
      const now = new Date().toISOString();
      const firstChange = Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0 ? item.fieldChanges[0] : null;

      this.data.items[key] = {
        key,
        eventId: item.eventId,
        eventName: item.eventName,
        status, // 'acknowledged' | 'applied' | 'rollback_requested' | 'rolled_back'
        field: firstChange?.field || 'all',
        beforeValue: firstChange?.before || null,
        afterValue: firstChange?.after || null,
        currentValue: firstChange?.after || null,
        fingerprint: key,
        reason,
        fieldChanges: item.fieldChanges || [],
        evidenceUrl: item.sourceUrl,
        sourceUrl: item.sourceUrl,
        sourceQuality: item.sourceQuality || null,
        confidence: item.confidence || null,
        reportId: activeReport?.date || now.slice(0, 10),
        reportDate: activeReport?.date || now.slice(0, 10),
        timestamp: now,
        acknowledgedAt: status === 'acknowledged' ? now : undefined,
        acknowledgedBy: status === 'acknowledged' ? (currentAdminUser?.email || ADMIN_EMAIL) : undefined,
        rollbackRequestedAt: status === 'rollback_requested' ? now : undefined,
        reviewerEmail: currentAdminUser?.email || ADMIN_EMAIL,
        storagePrimary: 'firestore'
      };
      return this.savePrimary(currentAdminUser);
    },

    // Entries for the history table: per-field decisions plus legacy card-level records (queue records are covered by their decisions).
    getRecentHistory(days = 30) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const legacy = Object.values(this.data.items)
        .filter(entry => entry.origin !== 'field-decisions' && entry.timestamp >= cutoff);
      const decisions = Object.values(this.data.fieldDecisions || {})
        .filter(d => d.decidedAt >= cutoff)
        .map(d => ({ ...d, timestamp: d.decidedAt, isFieldDecision: true, applyState: this.fieldState({ eventId: d.eventId, sourceUrl: d.sourceUrl }, { field: d.field, after: d.after }).applyState }));
      return [...legacy, ...decisions].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
  };

  async function loadLatestReport() {
    if (!currentAdminUser || currentAdminUser.email !== ADMIN_EMAIL || currentAdminUser.emailVerified !== true) {
      container.innerHTML = '';
      return;
    }

    try {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());

      // 1. Primary Load: Firestore (with local fallback)
      await store.loadPrimary(currentAdminUser);

      const res = await fetch(`reports/gemini-monitor/${today}.json`);
      if (!res.ok) {
        container.innerHTML = `<div class="gemini-monitor-box"><h3>Gemini 3.8 Flash 日次監視（シャドーモード）</h3><p class="text-muted">本日の監視レポート（${today}）はまだ生成されていません。毎朝の自動実行をお待ちください。</p></div>`;
        return;
      }
      activeReport = await res.json();
      renderReport(activeReport);
    } catch (err) {
      container.innerHTML = `<div class="gemini-monitor-box"><h3>Gemini 3.8 Flash 日次監視</h3><p class="text-muted">レポート読み込み中、または未実行です。</p></div>`;
    }
  }

  function syncNoticeHtml() {
    const notice = store.syncNotice();
    if (!notice) return '';
    return `<p class="gemini-sync-status gemini-sync-${notice.state}" role="${notice.state === 'failed' ? 'alert' : 'status'}" data-sync-state="${notice.state}">${escape(notice.text)}</p>`;
  }

  const STATE_LABELS = { pending: '未処理', hold: '保留', done: '処理済み' };
  function decisionLabel(row) {
    if (row.status === 'adopted') return row.applyState === 'applied' ? '採用・適用済み' : '採用・適用待ち（次回の監視で実データへ反映）';
    return { kept: '変更しない', deferred: '保留', undecided: '未判断' }[row.status];
  }
  function rowHtml(row) {
    const c = row.change, locked = row.applyState === 'applied';
    const button = (status, text, disabled) => `<button type="button" class="btn btn-sm gemini-decision-btn ${row.status === status ? 'is-active' : ''}" data-action="decide-field" data-field-key="${escape(row.key)}" data-status="${status}" aria-pressed="${row.status === status}" ${disabled ? 'disabled' : ''}>${text}</button>`;
    return `<tr data-field-key="${escape(row.key)}" data-decision="${row.status}">
      <td>${escape(label(c.field))}</td>
      <td>${escape(c.before == null ? '（なし）' : fmt(c.field, c.before))}</td>
      <td><strong>${escape(c.after == null ? (c.validationReason ? '（確認が必要なため保留）' : '（なし）') : fmt(c.field, c.after))}</strong></td>
      <td class="gemini-decision-cell">
        <span class="gemini-decision-state gemini-decision-${row.status}${row.applyState ? ' apply-' + row.applyState : ''}">${escape(decisionLabel(row))}</span>
        <span class="gemini-decision-buttons">${button('adopted', '採用', locked || !row.adoptable)}${button('kept', '変更しない', locked)}${button('deferred', '保留', locked)}</span>
      </td>
    </tr>`;
  }

  function cardHtml(item, view) {
    const itemKey = store.getItemKey(item);
    const hasRows = view.rows.length > 0;
    return `
      <div class="gemini-review-card severity-${escape(item.severity)} state-${view.state}" data-item-key="${escape(itemKey)}" data-event-id="${escape(item.eventId)}" data-card-state="${view.state}">
        <div class="gemini-card-header">
          <strong>${escape(item.eventName)}</strong>
          <span class="gemini-badge severity-${escape(item.severity)}">${escape(item.severity.toUpperCase())}</span>
          <span class="gemini-state-badge state-${view.state}">${STATE_LABELS[view.state]}</span>
        </div>
        <div class="gemini-card-body">
          <p><strong>理由:</strong> ${escape(item.reason)}</p>
          <p><strong>情報源:</strong> ${escape(item.sourceQuality)}（信頼度: ${Math.round((item.confidence || 0) * 100)}%）</p>
          <p><strong>根拠URL:</strong> <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(item.sourceUrl)}</a></p>
          ${hasRows ? `
            <div class="gemini-changes-table">
              <table>
                <thead><tr><th>変更項目</th><th>変更前</th><th>変更後</th><th>判断</th></tr></thead>
                <tbody>${view.rows.map(rowHtml).join('')}</tbody>
              </table>
            </div>
          ` : ''}
          <div class="gemini-card-actions">
            <button type="button" class="btn btn-sm btn-primary" data-action="decide-all" data-status="adopted">すべて採用</button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="decide-all" data-status="kept">すべて変更しない</button>
            <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">公式HPを開く</a>
          </div>
        </div>
      </div>`;
  }

  function historyStatus(entry) {
    if (entry.isFieldDecision) {
      if (entry.status === 'adopted') return entry.applyState === 'applied' ? '<span class="status-badge applied">採用・適用済み</span>' : '<span class="status-badge ack">採用・適用待ち</span>';
      return entry.status === 'deferred' ? '<span class="status-badge auto">保留</span>' : '<span class="status-badge rollback">変更しない</span>';
    }
    if (entry.status === 'applied') return '<span class="status-badge applied">適用済み</span>';
    if (entry.status === 'auto_applied') return '<span class="status-badge auto">自動更新</span>';
    if (entry.status === 'rolled_back' || entry.status === 'rollback_requested') return '<span class="status-badge rollback">変更しない</span>';
    return '<span class="status-badge ack">採用・適用待ち</span>';
  }

  function renderReport(report) {
    if (!currentAdminUser || currentAdminUser.email !== ADMIN_EMAIL || currentAdminUser.emailVerified !== true) {
      container.innerHTML = '';
      return;
    }

    const metrics = report.metrics || {};
    const rawVisibleItems = report.adminVisibleItems || [];
    const wouldAuto = report.wouldAutoUpdateCount || 0;

    const cards = rawVisibleItems.map(item => ({ item, view: store.cardView(item) }));
    const counts = { pending: 0, hold: 0, done: 0 };
    for (const card of cards) counts[card.view.state]++;
    const shown = cards.filter(card => card.view.state === view);
    const recentHistory = store.getRecentHistory(30);

    let html = `
      <div class="gemini-monitor-box">
        <div class="gemini-monitor-header">
          <h3>Gemini 3.8 Flash 学会情報監視（シャドーモード）</h3>
          <span class="badge ${counts.pending > 0 ? 'badge-warning' : 'badge-success'}">
            要確認: ${counts.pending}件 / 自動更新予定: ${wouldAuto}件
          </span>
        </div>
        ${syncNoticeHtml()}
        <p class="gemini-monitor-meta">
          監視日: ${escape(report.date)} ｜ 監視対象: ${metrics.monitoredToday}件 / 全${metrics.totalEvents}件 ｜ Gemini呼出: ${metrics.geminiCalls}件
          <br>取得状態（要確認とは別）：取得不能 ${metrics.deadlineStatuses?.unavailable||0}件・未公開 ${metrics.deadlineStatuses?.unpublished||0}件・リンク未検出 ${metrics.deadlineStatuses?.['link-not-found']||0}件・抽出失敗 ${metrics.deadlineStatuses?.['extraction-failed']||0}件
        </p>
        <div class="gemini-view-tabs" role="group" aria-label="表示する状態">
          ${['pending', 'hold', 'done'].map(key => `<button type="button" class="review-tab" data-action="set-view" data-view="${key}" aria-pressed="${view === key}">${STATE_LABELS[key]} <span class="review-tab-count">${counts[key]}件</span></button>`).join('')}
        </div>
    `;

    if (shown.length === 0) {
      html += `
        <div class="gemini-monitor-empty">
          <p>${view === 'pending' ? '本日管理者の確認が必要な未処理の項目はありません（0件）。すべての更新は処理済み・保留・または高信頼自動処理です。' : `「${STATE_LABELS[view]}」の候補はありません。`}</p>
        </div>
      `;
    } else {
      html += `<div class="gemini-review-list"><h4>変更候補（上位最大5件）— 項目ごとに「採用」「変更しない」「保留」を選べます</h4>`;
      for (const { item, view: cardView } of shown) html += cardHtml(item, cardView);
      html += `</div>`;
    }

    // Shadow mode summary
    if (wouldAuto > 0) {
      html += `
        <details class="gemini-shadow-details">
          <summary>高信頼自動更新予定（シャドーモードのため未適用）: ${wouldAuto}件のサマリーを表示</summary>
          <ul>
            ${(report.wouldAutoUpdateSummary || []).map(s => `<li><strong>${escape(s.eventName)}</strong>: ${escape(s.changes.map(c => model ? model.formatChangeSummary(c) : c).join(' / '))}（信頼度: ${Math.round((s.confidence||0)*100)}%）</li>`).join('')}
          </ul>
        </details>
      `;
    }

    // History accordion (last 30 days)
    if (recentHistory.length > 0) {
      html += `
        <details class="gemini-history-details">
          <summary>確認済み・処理履歴（直近30日: ${recentHistory.length}件）</summary>
          <div class="gemini-history-table-wrap">
            <table class="gemini-history-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>イベント名</th>
                  <th>変更内容</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                ${recentHistory.map(entry => {
                  const changesStr = entry.isFieldDecision
                    ? `${label(entry.field)}：${entry.before == null ? '未定' : fmt(entry.field, entry.before)} → ${entry.after == null ? '未定' : fmt(entry.field, entry.after)}`
                    : Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0
                      ? entry.fieldChanges.map(c => `${label(c.field)}：${c.before == null ? '未定' : fmt(c.field, c.before)} → ${c.after == null ? '未定' : fmt(c.field, c.after)}`).join(' / ')
                      : entry.reason || '（詳細なし）';
                  return `
                    <tr>
                      <td>${escape(new Date(entry.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
                      <td><strong>${escape(entry.eventName || entry.eventId)}</strong></td>
                      <td>${escape(changesStr)}</td>
                      <td>${historyStatus(entry)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </details>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  // One delegated handler: row decisions, card-level bulk actions and view tabs. The panel re-renders after the sync outcome is known.
  async function onPanelClick(event) {
    const button = event.target?.closest?.('[data-action]');
    if (!button || !activeReport) return;
    const action = button.dataset.action;
    if (action === 'set-view') {
      view = button.dataset.view;
      renderReport(activeReport);
      return;
    }
    const card = button.closest('.gemini-review-card');
    const item = (activeReport.adminVisibleItems || []).find(i => store.getItemKey(i) === card?.dataset.itemKey);
    if (!item) return;
    if (action === 'decide-field') {
      const change = (item.fieldChanges || []).find(c => store.fieldKey(item, c) === button.dataset.fieldKey);
      if (!change) return;
      await store.decideField(item, change, button.dataset.status);
    } else if (action === 'decide-all') {
      await (item.fieldChanges?.length ? store.decideAll(item, button.dataset.status) : store.recordAction(item, button.dataset.status === 'adopted' ? 'acknowledged' : 'rolled_back'));
    } else return;
    renderReport(activeReport);
  }
  if (typeof container.addEventListener === 'function') container.addEventListener('click', onPanelClick);

  // Subscribe to auth state so ONLY uchidats@gmail.com sees and operates the panel
  if (root.OphthalAuth?.subscribe) {
    root.OphthalAuth.subscribe(state => {
      const user = state?.user;
      if (user && user.email === ADMIN_EMAIL && user.emailVerified === true) {
        currentAdminUser = user;
        loadLatestReport();
      } else {
        currentAdminUser = null;
        activeReport = null;
        container.innerHTML = '';
      }
    });
  }

  // Local development / direct invocation API
  root.OphthalGeminiMonitorUI = {
    loadLatestReport,
    store,
    canonicalize,
    valueToken,
    onPanelClick,
    setMockUser(user) {
      currentAdminUser = user;
      loadLatestReport();
    }
  };
})(typeof window !== 'undefined' ? window : this);
