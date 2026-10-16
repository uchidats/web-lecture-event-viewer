'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../review-model');

const memoryStorage = (initial) => {
  const map = new Map(initial ? [[model.storageKey, JSON.stringify(initial)]] : []);
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};
const reviewer = 'admin-1';
const candidate = (id, over = {}) => ({ id, eventId: `e-${id}`, field: 'title', oldValue: 'A', value: `B-${id}`, reason: 'low-confidence',
  url: 'https://example.org/x', evidence: 'ev', confidence: 0.99, status: 'needs-review', ...over });
const setup = (initial) => {
  const store = model.createStore(memoryStorage(initial));
  const items = model.normalize({ version: 1, items: [candidate('1'), candidate('2'), candidate('3')] });
  return { store, items };
};
const ids = list => list.map(item => item.id);

test('未処理 → 採用/変更しない は処理済み、保留は保留になり未処理一覧から消える', () => {
  const { store, items } = setup();
  assert.deepEqual(ids(model.pendingItems(items, store, reviewer)), ['1', '2', '3']);
  store.decide(items[0], 'approved', { reviewerId: reviewer, items });
  store.decide(items[1], 'rejected', { reviewerId: reviewer, items });
  store.decide(items[2], 'deferred', { reviewerId: reviewer, items });
  assert.deepEqual(ids(model.pendingItems(items, store, reviewer)), []);
  assert.deepEqual(items.map(item => model.reviewState(item, store, reviewer)), ['done', 'done', 'hold']);
});

test('保留・処理済みから未処理へ戻せる（履歴は削除されず追記される）', () => {
  const { store, items } = setup();
  store.decide(items[0], 'approved', { reviewerId: reviewer, items });
  store.decide(items[2], 'deferred', { reviewerId: reviewer, items });
  store.decide(items[0], 'reset', { reviewerId: reviewer, items });
  store.decide(items[2], 'reset', { reviewerId: reviewer, items });
  assert.deepEqual(ids(model.pendingItems(items, store, reviewer)), ['1', '2', '3']);
  assert.deepEqual(store.read().history.map(entry => entry.decision), ['approved', 'deferred', 'reset', 'reset']);
  assert.equal(store.exportEventUrlApprovals(items, reviewer).decisions.length, 0);
});

test('未判断への reset は履歴を増やさない', () => {
  const { store, items } = setup();
  assert.equal(store.decide(items[0], 'reset', { reviewerId: reviewer, items }), null);
  assert.equal(store.read().history.length, 0);
});

test('既存のlocalStorage履歴（approved/rejected/deferred）をそのまま読める', () => {
  const { items } = setup();
  const entry = (item, decision) => ({ reviewId: item.reviewId, signature: item.signature, reviewerId: reviewer, eventId: item.eventId, decision, decidedAt: '2026-10-01T00:00:00Z' });
  const store = model.createStore(memoryStorage({ version: 1, history: [entry(items[0], 'approved'), entry(items[1], 'deferred'), entry(items[2], 'rejected')] }));
  assert.deepEqual(items.map(item => model.reviewState(item, store, reviewer)), ['done', 'hold', 'done']);
  assert.deepEqual(ids(model.pendingItems(items, store, reviewer)), []);
});

test('判断は担当者ごとに分離される', () => {
  const { store, items } = setup();
  store.decide(items[0], 'approved', { reviewerId: reviewer, items });
  assert.equal(model.reviewState(items[0], store, 'someone-else'), 'pending');
});

test('formatValue は [object Object] やJSON配列を出さない', () => {
  const samples = [
    ['abstractSubmission', { status: 'unknown', startDate: null, deadline: null, url: null }],
    ['abstractSubmission', { status: 'open', startDate: '2026-03-03T12:00', deadline: '2026-05-21', url: 'https://x.example/' }],
    ['registration', { type: 'domestic', periods: [{ label: '事前', start: '2026-03-03T12:00', deadline: '2026-09-25', category: 'regular', advanceEligible: true }] }],
    ['registration', [{ label: '事前', deadline: '2026-01-01' }]],
    [null, { title: '学会', date: '2026-02-19', venue: '会場', extra: { a: 1 } }],
    ['edition', { number: 3 }],
  ];
  for (const [field, value] of samples) {
    const text = model.formatValue(field, value);
    assert.ok(!/\[object|"\w+":|^[[{]/.test(text), text);
  }
  assert.equal(model.formatValue('abstractSubmission', { status: 'open', deadline: '2026-05-21' }), '状態：募集中／締切：2026/05/21');
  assert.equal(model.formatValue('registration', { periods: [{ label: '事前', start: '2026-03-03T12:00', deadline: '2026-09-25T12:00' }] }), '事前：2026/03/03 12:00 ～ 2026/09/25 12:00');
});

test('formatChangeSummary はGeminiの要約文から [object Object] を除く', () => {
  assert.equal(model.formatChangeSummary('registration: null -> [object Object]'), '参加登録期間：未入力 → （構造化データ）');
  assert.equal(model.formatChangeSummary('abstractSubmission.deadline: null -> 2026-05-21T12:00'), '演題締切：未入力 → 2026/05/21 12:00');
});

test('formatText は根拠欄のJSON文字列を人間向けに整形する', () => {
  const json = JSON.stringify([{ label: 'Early bird fee', deadline: '2027-01-18', category: 'early', advanceEligible: true, sourceUrl: 'https://example.org' }]);
  assert.equal(model.formatText(json), 'Early bird fee：2027/01/18 [early]（事前登録対象：はい）');
  assert.equal(model.formatText('公式ページに明記'), '公式ページに明記');
  assert.equal(model.formatText('[壊れたJSON'), '[壊れたJSON');
});
