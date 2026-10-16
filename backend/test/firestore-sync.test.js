'use strict';
// Firestore sync reporting: a failed write must never be shown or logged as success, and no token may leak.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const uiSource = fs.readFileSync(path.join(root, 'gemini-review-ui.js'), 'utf8');
const TOKEN = 'SECRET-ID-TOKEN-0123456789';
const STORAGE_KEY = 'ophthalconf_gemini_monitor_acknowledgements_v1';
const admin = { email: 'uchidats@gmail.com', emailVerified: true, getIdToken: async () => TOKEN };

const report = { date: '2026-10-16', metrics: { monitoredToday: 1, totalEvents: 1, geminiCalls: 0, deadlineStatuses: {} }, wouldAutoUpdateCount: 0,
  adminVisibleItems: [{ eventId: 'ev-1', eventName: '大会1', severity: 'medium', reason: 'test', sourceQuality: 'official', confidence: 0.9, sourceUrl: 'https://example.org/p',
    fieldChanges: [{ field: 'venue', before: 'A', after: 'B' }] }] };

// Loads gemini-review-ui.js in a fake browser. `patch(method)` decides the Firestore PATCH outcome.
function loadUi({ patch, localStorageBroken = false }) {
  const logs = [], requests = [], storage = new Map();
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const sandbox = {
    console: { warn: (...a) => logs.push(a.join(' ')), log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) },
    document: { getElementById: id => (id === 'gemini-monitor-panel' ? container : null) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => { if (localStorageBroken) throw new Error('quota'); storage.set(k, v); } },
    fetch: async (url, options = {}) => {
      requests.push({ url, method: options.method || 'GET', authorization: options.headers?.Authorization });
      if (String(url).startsWith('reports/gemini-monitor/')) return { ok: true, status: 200, json: async () => report };
      if (options.method === 'PATCH') return patch();
      return { ok: false, status: 404, json: async () => ({}) };
    },
    Intl, Date, JSON, Math, Promise, setTimeout, clearTimeout, String, Array, Object, Map, Set, Number
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSource, sandbox);
  return { ui: sandbox.OphthalGeminiMonitorUI, container, logs, requests, storage };
}
const respond = status => () => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) });
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
const item = report.adminVisibleItems[0];

async function acknowledge(env) {
  env.ui.setMockUser(admin);
  await settle();
  const result = await env.ui.store.recordAction(item, 'acknowledged');
  await env.ui.loadLatestReport();
  return result;
}

test('PATCH 200 → 同期成功。「Firestore同期済み」を表示する', async () => {
  const env = loadUi({ patch: respond(200) });
  const result = await acknowledge(env);
  assert.equal(result.state, 'synced');
  assert.equal(result.status, 200);
  assert.equal(env.ui.store.isFirestoreSynced, true);
  assert.match(env.container.innerHTML, /data-sync-state="synced"/);
  assert.match(env.container.innerHTML, /Firestore同期済み/);
  assert.doesNotMatch(env.container.innerHTML, /同期失敗/);
  assert.ok(env.requests.some(r => r.method === 'PATCH' && /gemini_monitor_acknowledgements\/state$/.test(r.url)));
});

for (const status of [403, 400, 404, 500, 503]) {
  test(`PATCH ${status} → 同期失敗として表示。HTTP statusを確認でき、localStorageにのみ保存された旨を明示する`, async () => {
    const env = loadUi({ patch: respond(status) });
    const result = await acknowledge(env);
    assert.equal(result.state, 'failed');
    assert.equal(result.status, status);
    assert.equal(env.ui.store.isFirestoreSynced, false);
    assert.match(env.container.innerHTML, /data-sync-state="failed"/);
    assert.match(env.container.innerHTML, new RegExp(`Firestore同期失敗（HTTP ${status}）`));
    assert.match(env.container.innerHTML, /localStorageにのみ保存/);
    assert.match(env.container.innerHTML, /role="alert"/);
    assert.doesNotMatch(env.container.innerHTML, /同期済み/);
    assert.ok(env.logs.some(line => line.includes(`HTTP ${status}`)), 'status is logged');
  });
}

test('network error → 同期失敗（通信エラー）', async () => {
  const env = loadUi({ patch: () => { throw new TypeError('fetch failed'); } });
  const result = await acknowledge(env);
  assert.equal(result.state, 'failed');
  assert.equal(result.status, null);
  assert.equal(result.reason, 'network');
  assert.match(env.container.innerHTML, /Firestore同期失敗（通信エラー）/);
  assert.doesNotMatch(env.container.innerHTML, /同期済み/);
});

test('localStorageには保存できるがFirestore同期に失敗したケース: 判断はこの端末に残り、失敗が明示される', async () => {
  const env = loadUi({ patch: respond(403) });
  await acknowledge(env);
  const saved = JSON.parse(env.storage.get(STORAGE_KEY));
  assert.equal(Object.values(saved.items)[0].status, 'acknowledged');
  assert.equal(env.ui.store.lastSave.local, true);
  assert.match(env.container.innerHTML, /localStorageにのみ保存されました/);
});

test('localStorageにもFirestoreにも保存できない場合は、その旨を明示する', async () => {
  const env = loadUi({ patch: respond(500), localStorageBroken: true });
  const result = await acknowledge(env);
  assert.equal(result.local, false);
  assert.match(env.container.innerHTML, /localStorageにも保存できませんでした/);
});

test('認証情報なしでも成功扱いにしない', async () => {
  const env = loadUi({ patch: respond(200) });
  const result = await env.ui.store.savePrimary(null);
  assert.equal(result.state, 'failed');
  assert.equal(result.reason, 'no-auth');
  assert.equal(env.requests.filter(r => r.method === 'PATCH').length, 0);
  assert.match(env.ui.store.syncNotice().text, /Firestore同期失敗（認証情報なし）/);
});

test('読み込み失敗（HTTP 403）も画面で確認できる。404（未作成）は失敗扱いにしない', async () => {
  const load403 = loadWithGet(403);
  await load403.ui.store.loadPrimary(admin);
  assert.equal(load403.ui.store.lastLoad.state, 'failed');
  assert.equal(load403.ui.store.lastLoad.status, 403);
  assert.match(load403.ui.store.syncNotice().text, /Firestore読み込み失敗（HTTP 403）/);
  assert.ok(load403.logs.some(line => line.includes('HTTP 403')));
  const load404 = loadWithGet(404);
  await load404.ui.store.loadPrimary(admin);
  assert.equal(load404.ui.store.lastLoad.state, 'synced');
  assert.equal(load404.ui.store.syncNotice(), null);
});

function loadWithGet(status) {
  const logs = [], storage = new Map();
  const container = { innerHTML: '', querySelectorAll: () => [] };
  const sandbox = {
    console: { warn: (...a) => logs.push(a.join(' ')), log() {}, error() {} },
    document: { getElementById: id => (id === 'gemini-monitor-panel' ? container : null) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    fetch: async () => ({ ok: status >= 200 && status < 300, status, json: async () => ({}) }),
    Intl, Date, JSON, Math, Promise, setTimeout, clearTimeout, String, Array, Object, Map, Set, Number
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSource, sandbox);
  return { ui: sandbox.OphthalGeminiMonitorUI, logs };
}

test('tokenそのものを画面・ログ・localStorageへ出さない', async () => {
  for (const status of [200, 403, 500]) {
    const env = loadUi({ patch: respond(status) });
    await acknowledge(env);
    const everything = [env.container.innerHTML, env.logs.join('\n'), [...env.storage.values()].join('\n')].join('\n');
    assert.ok(!everything.includes(TOKEN), `token leaked for ${status}`);
    assert.ok(!/Bearer/i.test(env.container.innerHTML + env.logs.join('\n')));
  }
  const failing = loadUi({ patch: () => { throw new Error(`boom ${TOKEN}`); } });
  await acknowledge(failing);
  assert.ok(!(failing.container.innerHTML + failing.logs.join('\n')).includes(TOKEN), 'error messages are not echoed');
});

// ---- monitor side: scripts/gemini-monitor/firestore-client.js ----
const client = require('../../scripts/gemini-monitor/firestore-client');

async function withFetch(fetchImpl, fn) {
  const original = global.fetch, warn = console.warn, log = console.log, logs = [];
  global.fetch = fetchImpl;
  console.warn = (...a) => logs.push(a.join(' '));
  console.log = (...a) => logs.push(a.join(' '));
  try { return { value: await fn(), logs }; } finally { global.fetch = original; console.warn = warn; console.log = log; }
}

test('監視側: saveRemoteState は 200 のみ成功、403/500/通信エラーは false で、HTTP statusを警告に残す', async () => {
  const ok = await withFetch(async () => ({ ok: true, status: 200 }), () => client.saveRemoteState(TOKEN, { version: 1, items: {} }));
  assert.equal(ok.value, true);
  for (const status of [403, 500]) {
    const r = await withFetch(async () => ({ ok: false, status }), () => client.saveRemoteState(TOKEN, { version: 1, items: {} }));
    assert.equal(r.value, false);
    assert.ok(r.logs.some(line => line.includes(`HTTP ${status}`) && /write failed/i.test(line)), `status ${status} logged`);
    assert.ok(!r.logs.join('\n').includes(TOKEN));
  }
  const net = await withFetch(async () => { throw new TypeError(`fetch failed ${TOKEN}`); }, () => client.saveRemoteState(TOKEN, { version: 1, items: {} }));
  assert.equal(net.value, false);
  assert.ok(net.logs.some(line => /write failed/i.test(line) && /network/i.test(line)));
  assert.ok(!net.logs.join('\n').includes(TOKEN));
});

test('監視側: fetchRemoteState の失敗はHTTP statusを残して null。404 は未作成として空状態', async () => {
  const forbidden = await withFetch(async () => ({ ok: false, status: 403 }), () => client.fetchRemoteState(TOKEN));
  assert.equal(forbidden.value, null);
  assert.ok(forbidden.logs.some(line => line.includes('HTTP 403')));
  const missing = await withFetch(async () => ({ ok: false, status: 404 }), () => client.fetchRemoteState(TOKEN));
  assert.deepEqual(missing.value, { version: 1, items: {} });
  const net = await withFetch(async () => { throw new TypeError('fetch failed'); }, () => client.fetchRemoteState(TOKEN));
  assert.equal(net.value, null);
});

test('監視側: 認証情報がなければ、production_apply では明確な WARNING。シミュレーションでは情報ログ。どちらも監視は継続', async () => {
  const saved = { token: process.env.CLOUD_ACCESS_TOKEN, key: process.env.FIREBASE_SERVICE_ACCOUNT_KEY };
  delete process.env.CLOUD_ACCESS_TOKEN; delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  try {
    const apply = await withFetch(async () => { throw new Error('must not be called'); }, () => client.getPendingActionsFromFirestore({ applyMode: true }));
    assert.equal(apply.value.authenticated, false);
    assert.deepEqual(apply.value.acknowledgedToApply, []);
    assert.ok(apply.logs.some(line => line.startsWith('WARNING:') && /NOT synchronized/.test(line) && /Production apply mode/.test(line)));
    const sim = await withFetch(async () => { throw new Error('must not be called'); }, () => client.getPendingActionsFromFirestore({ applyMode: false }));
    assert.equal(sim.value.authenticated, false);
    assert.ok(!sim.logs.some(line => line.startsWith('WARNING:')));
    assert.ok(sim.logs.some(line => /No Firestore credentials/.test(line)));
  } finally {
    if (saved.token !== undefined) process.env.CLOUD_ACCESS_TOKEN = saved.token;
    if (saved.key !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_KEY = saved.key;
  }
});

test('監視側: Firestoreが 403 でも例外にならず、承認なしとして監視を続ける', async () => {
  const r = await withFetch(async () => ({ ok: false, status: 403 }), () => client.getPendingActionsFromFirestore({ token: TOKEN, applyMode: true }));
  assert.equal(r.value.authenticated, true);
  assert.deepEqual(r.value.acknowledgedToApply, []);
  assert.deepEqual(r.value.rollbackRequests, []);
  assert.ok(r.logs.some(line => line.includes('HTTP 403')));
});

test('監視側: 不正なサービスアカウントキーの断片をログへ出さない', async () => {
  const saved = process.env.FIREBASE_SERVICE_ACCOUNT_KEY, savedToken = process.env.CLOUD_ACCESS_TOKEN;
  delete process.env.CLOUD_ACCESS_TOKEN;
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '-----BEGIN PRIVATE KEY----- not json SECRET-KEY-FRAGMENT';
  try {
    const r = await withFetch(async () => { throw new Error('must not be called'); }, () => client.getPendingActionsFromFirestore({ applyMode: true }));
    assert.equal(r.value.authenticated, false);
    assert.ok(!r.logs.join('\n').includes('SECRET-KEY-FRAGMENT'));
    assert.ok(!r.logs.join('\n').includes('PRIVATE KEY'));
  } finally {
    if (saved === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY; else process.env.FIREBASE_SERVICE_ACCOUNT_KEY = saved;
    if (savedToken !== undefined) process.env.CLOUD_ACCESS_TOKEN = savedToken;
  }
});
