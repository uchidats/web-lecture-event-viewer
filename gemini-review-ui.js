(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const container = doc.getElementById('gemini-monitor-panel');
  if (!container) return;

  const STORAGE_KEY = 'ophthalconf_gemini_monitor_acknowledgements_v1';
  const ADMIN_EMAIL = 'uchidats@gmail.com';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentAdminUser = null;
  let activeReport = null;

  // Firestore Primary Store with Local Offline Fallback
  const store = {
    data: { version: 1, items: {} },
    isFirestoreSynced: false,

    async loadPrimary(user) {
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
              const docData = await res.json();
              const remoteJsonStr = docData.fields?.json?.stringValue;
              if (remoteJsonStr) {
                const remoteObj = JSON.parse(remoteJsonStr);
                this.data = remoteObj;
                this.isFirestoreSynced = true;
                this.saveLocalCache();
                return this.data;
              }
            }
          }
        } catch (err) {
          console.warn('[Gemini Monitor] Firestore load failed, falling back to local cache:', err);
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
      return this.data;
    },

    saveLocalCache() {
      try {
        this.data.updatedAt = new Date().toISOString();
        root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (_) {}
    },

    async savePrimary(user) {
      this.data.updatedAt = new Date().toISOString();
      this.saveLocalCache();

      // Push to Primary: Firestore
      if (user && user.email === ADMIN_EMAIL && user.emailVerified === true) {
        try {
          const authHeader = await user.getIdToken?.();
          if (authHeader) {
            const url = `https://firestore.googleapis.com/v1/projects/ophthalconf/databases/(default)/documents/gemini_monitor_acknowledgements/state`;
            await fetch(url, {
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
            this.isFirestoreSynced = true;
          }
        } catch (err) {
          console.warn('[Gemini Monitor] Firestore save failed, persisted in local cache:', err);
        }
      }
    },

    getItemKey(item) {
      if (Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0) {
        const changeParts = item.fieldChanges.map(c => `${c.field}=${c.after}`).sort().join(';');
        return `${item.eventId}::${changeParts}`;
      }
      return `${item.eventId}::${item.reason || 'review'}`;
    },

    getStatus(item) {
      const key = this.getItemKey(item);
      const record = this.data.items[key];
      if (!record) return 'pending';
      return record.status || 'pending';
    },

    async recordAction(item, status, reason = '') {
      const key = this.getItemKey(item);
      const now = new Date().toISOString();
      this.data.items[key] = {
        key,
        eventId: item.eventId,
        eventName: item.eventName,
        status, // 'acknowledged' | 'rolled_back'
        reason,
        fieldChanges: item.fieldChanges || [],
        sourceUrl: item.sourceUrl,
        reportDate: activeReport?.date || now.slice(0, 10),
        timestamp: now,
        reviewerEmail: currentAdminUser?.email || ADMIN_EMAIL,
        storagePrimary: 'firestore'
      };
      await this.savePrimary(currentAdminUser);
    },

    getRecentHistory(days = 30) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      return Object.values(this.data.items)
        .filter(entry => entry.timestamp >= cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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

  function renderReport(report) {
    if (!currentAdminUser || currentAdminUser.email !== ADMIN_EMAIL || currentAdminUser.emailVerified !== true) {
      container.innerHTML = '';
      return;
    }

    const metrics = report.metrics || {};
    const rawVisibleItems = report.adminVisibleItems || [];
    const wouldAuto = report.wouldAutoUpdateCount || 0;

    // Filter out items already acknowledged or rolled back
    const pendingItems = rawVisibleItems.filter(item => store.getStatus(item) === 'pending');
    const recentHistory = store.getRecentHistory(30);

    let html = `
      <div class="gemini-monitor-box">
        <div class="gemini-monitor-header">
          <h3>Gemini 3.8 Flash 学会情報監視（シャドーモード）</h3>
          <span class="badge ${pendingItems.length > 0 ? 'badge-warning' : 'badge-success'}">
            要確認: ${pendingItems.length}件 / 自動更新予定: ${wouldAuto}件
          </span>
        </div>
        <p class="gemini-monitor-meta">
          監視日: ${escape(report.date)} ｜ 監視対象: ${metrics.monitoredToday}件 / 全${metrics.totalEvents}件 ｜ Gemini呼出: ${metrics.geminiCalls}件
        </p>
    `;

    if (pendingItems.length === 0) {
      html += `
        <div class="gemini-monitor-empty">
          <p>本日管理者の確認が必要な未確認項目はありません（0件）。すべての更新は確認済み・高信頼自動処理・または保留中です。</p>
        </div>
      `;
    } else {
      html += `<div class="gemini-review-list"><h4>要確認の変更候補（上位最大5件・未確認のみ）</h4>`;
      for (const item of pendingItems) {
        const itemKey = store.getItemKey(item);
        html += `
          <div class="gemini-review-card severity-${escape(item.severity)}" data-item-key="${escape(itemKey)}" data-event-id="${escape(item.eventId)}">
            <div class="gemini-card-header">
              <strong>${escape(item.eventName)}</strong>
              <span class="gemini-badge severity-${escape(item.severity)}">${escape(item.severity.toUpperCase())}</span>
            </div>
            <div class="gemini-card-body">
              <p><strong>理由:</strong> ${escape(item.reason)}</p>
              <p><strong>情報源:</strong> ${escape(item.sourceQuality)}（信頼度: ${Math.round((item.confidence || 0) * 100)}%）</p>
              <p><strong>根拠URL:</strong> <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(item.sourceUrl)}</a></p>
              ${Array.isArray(item.fieldChanges) && item.fieldChanges.length > 0 ? `
                <div class="gemini-changes-table">
                  <table>
                    <thead><tr><th>変更項目</th><th>変更前</th><th>変更後</th></tr></thead>
                    <tbody>
                      ${item.fieldChanges.map(c => `<tr><td>${escape(c.field)}</td><td>${escape(c.before || '（なし）')}</td><td><strong>${escape(c.after)}</strong></td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
              <div class="gemini-card-actions">
                <button type="button" class="btn btn-sm btn-primary gemini-ack-btn" data-key="${escape(itemKey)}">確認済み</button>
                <button type="button" class="btn btn-sm btn-secondary gemini-rollback-btn" data-key="${escape(itemKey)}" data-event-id="${escape(item.eventId)}">元に戻す（除外登録）</button>
                <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">公式HPを開く</a>
              </div>
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

    // Shadow mode summary
    if (wouldAuto > 0) {
      html += `
        <details class="gemini-shadow-details">
          <summary>高信頼自動更新予定（シャドーモードのため未適用）: ${wouldAuto}件のサマリーを表示</summary>
          <ul>
            ${(report.wouldAutoUpdateSummary || []).map(s => `<li><strong>${escape(s.eventName)}</strong>: ${escape(s.changes.join(', '))}（信頼度: ${Math.round((s.confidence||0)*100)}%）</li>`).join('')}
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
                  const statusLabel = entry.status === 'acknowledged' ? '<span class="status-badge ack">確認済み</span>' : '<span class="status-badge rollback">元に戻した</span>';
                  const changesStr = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0
                    ? entry.fieldChanges.map(c => `${c.field}: ${c.before || '未定'} → ${c.after}`).join(', ')
                    : entry.reason || '（詳細なし）';
                  return `
                    <tr>
                      <td>${escape(new Date(entry.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td>
                      <td><strong>${escape(entry.eventName || entry.eventId)}</strong></td>
                      <td>${escape(changesStr)}</td>
                      <td>${statusLabel}</td>
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

    // Attach "確認済み" handler
    container.querySelectorAll('.gemini-ack-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemKey = btn.dataset.key;
        const card = btn.closest('.gemini-review-card');
        const item = pendingItems.find(i => store.getItemKey(i) === itemKey);
        if (!item) return;

        store.recordAction(item, 'acknowledged');

        // Immediate removal animation/deletion
        if (card) {
          card.style.transition = 'opacity 0.25s, transform 0.25s';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.96)';
          setTimeout(() => renderReport(report), 250);
        } else {
          renderReport(report);
        }
      });
    });

    // Attach "元に戻す" handler
    container.querySelectorAll('.gemini-rollback-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemKey = btn.dataset.key;
        const eventId = btn.dataset.eventId;
        const card = btn.closest('.gemini-review-card');
        const item = pendingItems.find(i => store.getItemKey(i) === itemKey);
        if (!item) return;

        if (confirm(`イベント「${eventId}」の更新候補を元に戻しますか？\n※現在はシャドーモードのため events.js は変更せず、再適用防止リストおよび処理済み履歴へテスト登録されます。`)) {
          store.recordAction(item, 'rolled_back', 'Admin rollback (shadow mode test)');
          if (card) {
            card.style.transition = 'opacity 0.25s, transform 0.25s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.96)';
            setTimeout(() => renderReport(report), 250);
          } else {
            renderReport(report);
          }
        }
      });
    });
  }

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
    setMockUser(user) {
      currentAdminUser = user;
      loadLatestReport();
    }
  };
})(typeof window !== 'undefined' ? window : this);
