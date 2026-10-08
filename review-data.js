/* Replace this read-only provider with an artifact/API provider in the future. */
(function (root) {
  'use strict';
  function createProvider({ url = root.OphthalReviewConfig?.reviewDataUrl || 'reports/auto-update-review.json', fetchImpl = (...args) => root.fetch(...args) } = {}) {
    return { async load() {
      const response = await fetchImpl(url, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('レビュー情報を読み込めませんでした。');
      const data = await response.json();
      if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('レビュー情報の形式が正しくありません。');
      return data;
    } };
  }
  root.OphthalReviewData = { createProvider };
  if (typeof module !== 'undefined') module.exports = { createProvider };
})(globalThis);
