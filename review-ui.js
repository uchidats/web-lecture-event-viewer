(function (root) {
  'use strict';
  const doc = root.document, model = root.OphthalReviewModel;
  if (!doc || !model) return;
  const entry = doc.getElementById('review-entry'), dialog = doc.getElementById('review-dialog');
  if (!entry || !dialog) return;
  const provider = root.OphthalReviewData.createProvider();
  const access = model.createAccess({ hostname: root.location.hostname, search: root.location.search,
    developmentMode: root.OphthalReviewConfig?.developmentMode === true });
  let store, items = [], reviewerId = null, loading = false, loaded = false;
  const list = doc.getElementById('review-list'), message = doc.getElementById('review-message'), filter = doc.getElementById('review-filter');
  const labels = { low: '低リスク', medium: '中リスク', high: '高リスク' };
  const decisions = { approved: '採用済み', rejected: '変更しない', deferred: '保留中' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function announce(text) { message.textContent = text; }
  function verificationHtml(item) {
    if (!item.fetchFailure) return '';
    const checks = item.checks || {}, label = value => value === true ? '一致' : value === false ? '不一致' : '未確認';
    const failure = item.fetchFailure;
    return `<dt>本文取得</dt><dd>${escape(failure.state === 'not-found-response' ? '404／410応答（Bot保護とは別）' : failure.botProtected ? 'Bot保護を検出' : '取得失敗・Bot保護の可能性')}（HTTP ${escape(failure.httpStatus ?? '応答なし')}） ${escape(failure.error)}</dd>
      <dt>別経路の照合</dt><dd>公式学会ドメイン：${label(checks.officialSocietyDomain)}／開催年：${label(checks.yearMatches)}／学会名：${label(checks.nameMatches)}／開催回：${label(checks.editionMatches)}／開催地：${label(checks.cityMatches)} ${escape(checks.city || '')}</dd>
      <dt>公式性の確認根拠</dt><dd>${(item.officialEvidence || []).map(e => `${escape(e.evidence)} ${model.safeUrl(e.url) ? `<a href="${escape(model.safeUrl(e.url))}" target="_blank" rel="noopener noreferrer">根拠ページ</a>` : ''}`).join('<br>') || '未確認'}</dd>`;
  }
  function render() {
    if (!reviewerId) return;
    const latest = item => store.latest(item, reviewerId);
    const pending = items.filter(item => !item.blocked && !['approved', 'rejected'].includes(latest(item)?.decision));
    entry.textContent = `更新確認 ${pending.length}件`;
    doc.getElementById('review-summary').textContent = `要確認 ${items.filter(i => !i.blocked).length}件・停止候補 ${items.filter(i => i.blocked).length}件・未判断／保留 ${pending.length}件`;
    const visible = items.filter(item => filter.value === 'all' || (filter.value === 'blocked' ? item.blocked : !item.blocked && (filter.value !== 'pending' || pending.includes(item))));
    list.innerHTML = visible.map(item => {
      const event = typeof sampleEvents !== 'undefined' ? sampleEvents.find(e => e.id === item.eventId) : null;
      const decision = latest(item), index = items.indexOf(item), url = model.safeUrl(item.url);
      return `<article class="review-card risk-${item.riskLevel}" data-review-index="${index}">
        <div class="review-card-heading"><h3>${escape(event?.title || '学会情報が見つかりません')}</h3><span class="review-risk">${labels[item.riskLevel]}</span></div>
        <p class="review-field">変更項目：${escape(model.fieldLabels[item.field] || '取得・検証の問題')}</p>
        ${item.blocked ? '<p class="review-blocked">大量変更停止で保留された候補</p>' : ''}
        <div class="review-values"><div><h4>現在（取得時）</h4><p>${escape(model.formatValue(item.field, item.oldValue))}</p></div><div><h4>公式サイトから検出</h4><p>${escape(model.formatValue(item.field, item.value))}</p></div></div>
        <dl><dt>根拠</dt><dd>${escape(item.evidence || '根拠テキストなし')}</dd><dt>信頼度</dt><dd>${Number.isFinite(item.confidence) ? Math.round(item.confidence * 100) + '%' : '不明'}</dd><dt>確認理由</dt><dd>${escape(model.reasonLabels[item.reason] || '自動更新条件を満たさないため、確認が必要です')}</dd><dt>情報源URL</dt><dd>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}</a>` : '有効なHTTPS情報源URLなし'}</dd>${model.safeUrl(item.candidateUrl) ? `<dt>発見した候補URL</dt><dd><a href="${escape(model.safeUrl(item.candidateUrl))}" target="_blank" rel="noopener noreferrer">${escape(item.candidateUrl)}</a></dd>` : ''}</dl>
        ${item.fetchFailure ? `<dl>${verificationHtml(item)}</dl>` : ''}
        <p class="review-decision">${decision ? `${decisions[decision.decision]} · ${escape(new Date(decision.decidedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}` : '未判断'}</p>
        ${item.riskLevel === 'low' ? `<label class="review-automation"><input type="checkbox" ${decision?.automationCandidate ? 'checked' : ''}> 今後、この種類の変更は自動承認候補にする（検討用）</label>` : ''}
        <div class="review-actions"><button type="button" class="btn btn-primary" data-decision="approved" ${!item.actionable ? 'disabled' : ''} aria-pressed="${decision?.decision === 'approved'}">採用</button><button type="button" class="btn btn-secondary" data-decision="rejected" aria-pressed="${decision?.decision === 'rejected'}">変更しない</button><button type="button" class="btn btn-secondary" data-decision="deferred" aria-pressed="${decision?.decision === 'deferred'}">保留</button>${url ? `<a class="btn btn-secondary" href="${escape(url)}" target="_blank" rel="noopener noreferrer">公式サイトを見る</a>` : ''}</div>
      </article>`;
    }).join('') || '<p class="review-empty">この表示条件の候補はありません。</p>';
  }
  async function load() {
    if (!reviewerId || loading) return;
    loading = true; announce('レビュー情報を読み込み中…');
    try {
      const data = await provider.load();
      if (!reviewerId) return;
      store = model.createStore(root.localStorage); store.read();
      items = model.normalize(data); loaded = true; render(); announce('');
    } catch (error) { announce(`${error.message} 「再読み込み」で再試行できます。`); }
    finally { loading = false; }
  }
  root.OphthalAuth?.subscribe(state => {
    const previousReviewerId = reviewerId;
    reviewerId = access.reviewerId(state.user);
    entry.hidden = !reviewerId;
    if (previousReviewerId !== reviewerId) {
      if (dialog.open) dialog.close();
      list.replaceChildren(); items = []; loaded = false;
      entry.textContent = '更新確認';
      doc.getElementById('review-summary').textContent = '';
      announce('');
    }
    if (!reviewerId) { if (dialog.open) dialog.close(); list.replaceChildren(); loaded = false; items = []; }
    else if (previousReviewerId !== reviewerId) { loaded = false; load(); }
  });
  entry.addEventListener('click', () => { if (!reviewerId) return; dialog.showModal(); if (!loaded) load(); });
  doc.getElementById('review-close').addEventListener('click', () => dialog.close());
  doc.getElementById('review-reload').addEventListener('click', load);
  doc.getElementById('review-export-urls')?.addEventListener('click', () => {
    if (!reviewerId || !loaded) return;
    try {
      const approvals = store.exportEventUrlApprovals(items, reviewerId);
      if (!approvals.decisions.length) { announce('承認済みのURLはありません。'); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify(approvals, null, 2)], { type: 'application/json' }));
      const link = doc.createElement('a'); link.href = url; link.download = 'event-url-human-approvals.json'; link.click();
      URL.revokeObjectURL(url); announce('承認したURLを出力しました。イベントデータへの反映は管理者が行います。');
    } catch (error) { announce(error.message); }
  });
  filter.addEventListener('change', () => { try { render(); } catch (error) { announce(error.message); } });
  list.addEventListener('click', event => {
    const button = event.target.closest('button[data-decision]');
    if (!reviewerId || !button) return;
    const card = button.closest('[data-review-index]'), item = items[Number(card.dataset.reviewIndex)];
    try {
      store.decide(item, button.dataset.decision, { reviewerId, items, automationCandidate: card.querySelector('input')?.checked === true });
      render();
      const replacement = list.querySelector(`[data-review-index="${items.indexOf(item)}"] button[data-decision="${button.dataset.decision}"]`);
      (replacement || filter).focus();
      announce('判断をこのブラウザに保存しました。');
    } catch (error) { announce(`保存できませんでした：${error.message}`); }
  });
})(globalThis);
