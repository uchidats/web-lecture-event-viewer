/* Replace this read-only provider with an artifact/API provider in the future. */
(function (root) {
  'use strict';
  function createProvider({ url = root.OphthalReviewConfig?.reviewDataUrl || 'reports/auto-update-review.json', readBaseline = root.OphthalReviewConfig?.readBaseline || [], fetchImpl = (...args) => root.fetch(...args) } = {}) {
    return { async load() {
      const response = await fetchImpl(url, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('レビュー情報を読み込めませんでした。');
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('レビュー情報の形式が正しくありません。');
      if (readBaseline.length) {
        const read = new Set(readBaseline);
        const normalized = root.OphthalReviewModel.normalize(data);
        const candidates = data.items.filter(item => item.status === 'needs-review' || !item.status);
        await Promise.all(normalized.map(async (item, index) => {
          const digest = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(item.signature));
          const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          if (read.has(key)) candidates[index].read = true;
        }));
      }
      return data;
    } };
  }
  root.OphthalReviewData = { createProvider };
  if (typeof module !== 'undefined') module.exports = { createProvider };
})(globalThis);
