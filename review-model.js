(function (root) {
  'use strict';
  const storageKey = 'ophthalconf.review-decisions.v1';
  const fieldLabels = { registration: '参加登録期間', title: '学会名', date: '開催開始日', endDate: '開催終了日', venue: '開催会場', city: '開催都市', country: '開催国', officialUrl: '公式サイトURL',
    'abstractSubmission.startDate': '演題募集開始', 'abstractSubmission.deadline': '演題締切', 'abstractSubmission.status': '演題募集状況', 'abstractSubmission.url': '演題募集URL' };
  const reasonLabels = { 'multiple-candidates': '公式サイトに複数の候補があります', 'related-field-needs-review': '関連する情報に確認が必要です',
    'registration-periods-needs-review': '参加登録の各期間を公式情報と照合してください', 'invalid-registration': '参加登録期間の日付・構造を確認してください',
    'registration-type-conflict': '国内・海外の区分が既存情報と異なります', 'registration-dates-unextractable': '参加登録期間を抽出できませんでした',
    'deadline-extension-possible': '締切延長の可能性があります', 'deadline-change-needs-review': '採用済みの締切日と異なるため確認が必要です',
    'mass-change-limit': '過去の大量変更停止で保留された候補', 'low-confidence': '情報の信頼度が基準未満です',
    'fetch-failed': '情報源を取得できませんでした', 'official-domain-changed': '公式サイトのドメインが変わっています',
    'conference-name-change': '学会名が変わっています', 'large-date-shift': '日付が大きく変わっています',
    'existing-venue-change-needs-review': '既存の会場が変わっています', 'location-contradiction': '所在地が既存情報と異なります',
    'invalid-date-order': '日付の前後関係に矛盾があります', 'unsupported-confidence': '抽出方法と信頼度を確認してください',
    'untrusted-domain': '候補URLが許可されたドメインではありません', 'untrusted-evidence-url': '情報源URLの確認が必要です',
    'deadline-time-would-be-lost': '締切の時刻情報が失われます', 'auto-update-disabled': 'この学会の自動更新は無効です' };
  const statuses = { open: '募集中', upcoming: '募集開始前', closed: '募集終了', unknown: '未確認' };
  function safeUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } }
  function riskLevel(item) {
    if (['title', 'date', 'endDate', 'venue', 'city', 'country'].includes(item.field) || item.reason === 'official-domain-changed') return 'high';
    if (item.field === 'officialUrl') {
      try { if (!item.oldValue || new URL(item.oldValue).hostname !== new URL(item.value).hostname) return 'high'; } catch { return 'high'; }
    }
    // Uncertain evidence takes priority over completion/status convenience.
    if (['multiple-candidates', 'related-field-needs-review'].includes(item.reason)) return 'medium';
    const abstract = item.field?.startsWith('abstractSubmission.');
    const reliable = item.confidence >= 0.95 && item.confidence <= 1 && !!safeUrl(item.url) && !!item.evidence &&
      (!item.reason || item.reason === 'mass-change-limit');
    if (abstract && reliable && (item.oldValue === null || item.field === 'abstractSubmission.status') &&
        (!item.field.endsWith('.url') || safeUrl(item.value))) return 'low';
    return 'medium';
  }
  function formatValue(field, value) {
    if (value == null || value === '') return '未入力';
    if (field === 'registration' && Array.isArray(value.periods)) return value.periods.map(p => `${p?.label || '名称未確認'}：${p?.start ? p.start + ' ～ ' : ''}${p?.deadline || '締切未確認'}`).join(' / ');
    if (field === 'abstractSubmission.status') return statuses[value] || '未確認の状態';
    return String(value).replace(/^(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
  }
  function normalize(data) {
    return data.items.filter(item => item.status === 'needs-review' || !item.status).map(item => {
      const signature = JSON.stringify([item.eventId, item.field, item.oldValue, item.value, item.reason, item.url, item.evidence]);
      return { ...item, reviewId: item.id || signature, signature, riskLevel: riskLevel(item),
        blocked: item.reason === 'mass-change-limit', actionable: !!item.field && !!safeUrl(item.url) &&
          (typeof item.value === 'string' && !!item.value || item.field === 'registration' && item.reason !== 'invalid-registration' && ['domestic', 'international'].includes(item.value?.type) &&
            Array.isArray(item.value.periods) && item.value.periods.length > 0 && item.value.periods.every(p => p && typeof p.label === 'string' && !!p.label && (p.start || p.deadline))) };
    });
  }
  function createStore(storage) {
    function read() {
      const raw = storage.getItem(storageKey);
      const data = raw ? JSON.parse(raw) : { version: 1, history: [] };
      if (data.version !== 1 || !Array.isArray(data.history)) throw new Error('保存された判断履歴を読み込めません。');
      return data;
    }
    function latest(item, reviewerId) { return read().history.findLast(entry => entry.reviewId === item.reviewId && entry.signature === item.signature && entry.reviewerId === reviewerId); }
    function decide(item, decision, { reviewerId, automationCandidate = false, items = [], now = new Date().toISOString() }) {
      if (!reviewerId || !['approved', 'rejected', 'deferred'].includes(decision)) throw new Error('判断内容が正しくありません。');
      if (decision === 'approved' && !item.actionable) throw new Error('候補値や情報源がない項目は採用できません。');
      if (decision === 'approved' && items.some(other => other.reviewId !== item.reviewId && other.eventId === item.eventId && other.field === item.field && JSON.stringify(other.value) !== JSON.stringify(item.value) && latest(other, reviewerId)?.decision === 'approved')) {
        throw new Error('同じ項目の別候補が採用済みです。先にその判断を変更してください。');
      }
      const data = read();
      const previous = latest(item, reviewerId);
      const candidateFlag = item.riskLevel === 'low' && automationCandidate === true;
      if (previous?.decision === decision && previous.automationCandidate === candidateFlag) return previous;
      const entry = { reviewId: item.reviewId, signature: item.signature, reviewerId, eventId: item.eventId, decision, decidedAt: now,
        field: item.field, reason: item.reason, riskLevel: item.riskLevel, oldValue: item.oldValue, value: item.value,
        automationCandidate: candidateFlag, scope: 'local-only' };
      data.history.push(entry);
      storage.setItem(storageKey, JSON.stringify(data));
      return entry;
    }
    function statistics(item, reviewerId) {
      const entries = read().history.filter(entry => entry.reviewerId === reviewerId && entry.field === item.field && entry.reason === item.reason && entry.riskLevel === item.riskLevel);
      return { approvalCount: entries.filter(entry => entry.decision === 'approved').length, hasRejection: entries.some(entry => entry.decision === 'rejected'), latest: entries.at(-1) || null };
    }
    return { read, latest, decide, statistics };
  }
  function isAdminUser(user) {
    return !!user?.uid && user.email === 'uchidats@gmail.com' && user.emailVerified === true;
  }
  function createAccess({ hostname, search, developmentMode = false, authorizeUser = isAdminUser }) {
    const local = developmentMode === true && ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && new URLSearchParams(search).get('adminReview') === '1';
    return { reviewerId(user) { return user?.uid && authorizeUser(user) === true ? user.uid : local ? 'local-admin' : null; } };
  }
  const api = { storageKey, fieldLabels, reasonLabels, safeUrl, riskLevel, formatValue, normalize, createStore, createAccess, isAdminUser };
  root.OphthalReviewModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
