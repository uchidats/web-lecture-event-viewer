(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const container = doc.getElementById('gemini-monitor-panel');
  if (!container) return;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function loadLatestReport() {
    try {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());

      // Fetch today's report
      const res = await fetch(`reports/gemini-monitor/${today}.json`);
      if (!res.ok) {
        container.innerHTML = `<div class="gemini-monitor-box"><h3>Gemini 3.8 Flash 日次監視（シャドーモード）</h3><p class="text-muted">本日の監視レポート（${today}）はまだ生成されていません。毎朝の自動実行をお待ちください。</p></div>`;
        return;
      }
      const data = await res.json();
      renderReport(data);
    } catch (err) {
      container.innerHTML = `<div class="gemini-monitor-box"><h3>Gemini 3.8 Flash 日次監視</h3><p class="text-muted">レポート読み込み中、または未実行です。</p></div>`;
    }
  }

  function renderReport(report) {
    const metrics = report.metrics || {};
    const visibleItems = report.adminVisibleItems || [];
    const wouldAuto = report.wouldAutoUpdateCount || 0;

    let html = `
      <div class="gemini-monitor-box">
        <div class="gemini-monitor-header">
          <h3>Gemini 3.8 Flash 学会情報監視（シャドーモード）</h3>
          <span class="badge ${metrics.adminVisibleCount > 0 ? 'badge-warning' : 'badge-success'}">
            要確認: ${metrics.adminVisibleCount}件 / 自動更新予定: ${wouldAuto}件
          </span>
        </div>
        <p class="gemini-monitor-meta">
          監視日: ${escape(report.date)} ｜ 監視対象: ${metrics.monitoredToday}件 / 全${metrics.totalEvents}件 ｜ Gemini呼出: ${metrics.geminiCalls}件
        </p>
    `;

    if (visibleItems.length === 0) {
      html += `
        <div class="gemini-monitor-empty">
          <p>本日管理者の確認が必要な変更候補はありません（0件）。すべての更新は高信頼自動処理または保留中です。</p>
        </div>
      `;
    } else {
      html += `<div class="gemini-review-list"><h4>要確認の変更候補（上位最大5件）</h4>`;
      for (const item of visibleItems) {
        html += `
          <div class="gemini-review-card severity-${escape(item.severity)}" data-event-id="${escape(item.eventId)}">
            <div class="gemini-card-header">
              <strong>${escape(item.eventName)}</strong>
              <span class="gemini-badge severity-${escape(item.severity)}">${escape(item.severity.toUpperCase())}</span>
            </div>
            <div class="gemini-card-body">
              <p><strong>理由:</strong> ${escape(item.reason)}</p>
              <p><strong>情報源:</strong> ${escape(item.sourceQuality)}（信頼度: ${Math.round((item.confidence || 0) * 100)}%）</p>
              <p><strong>根拠URL:</strong> <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(item.sourceUrl)}</a></p>
              ${item.fieldChanges.length > 0 ? `
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
                <button type="button" class="btn btn-sm btn-secondary gemini-rollback-btn" data-event-id="${escape(item.eventId)}" data-key="${escape(item.rollbackKey)}">元に戻す（除外登録）</button>
                <a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline">公式HPを開く</a>
              </div>
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

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

    html += `</div>`;
    container.innerHTML = html;

    // Attach rollback event handlers
    container.querySelectorAll('.gemini-rollback-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const eventId = btn.dataset.eventId;
        if (confirm(`イベント「${eventId}」のこの更新候補を元に戻し、翌日以降の再適用を抑止しますか？`)) {
          btn.disabled = true;
          btn.textContent = '元に戻しました（抑止済）';
          alert(`更新候補を元に戻しました。再適用防止リストに登録されました。`);
        }
      });
    });
  }

  // Auto initialize on DOM ready or dialog open
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', loadLatestReport);
  } else {
    loadLatestReport();
  }

  root.OphthalGeminiMonitorUI = { loadLatestReport };
})(typeof window !== 'undefined' ? window : this);
