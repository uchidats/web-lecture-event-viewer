'use strict';
// Per-field decisions in the Gemini monitor panel (eventId + field + value), the apply queue the monitor consumes, and compatibility.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const uiSource = fs.readFileSync(path.join(root, 'gemini-review-ui.js'), 'utf8');
const client = require('../../scripts/gemini-monitor/firestore-client');
const admin = { email: 'uchidats@gmail.com', emailVerified: true, getIdToken: async () => 'TOKEN' };

// WGC 2027 as shown on 2026-10-16: the location label must stay Japanese, the official title is adopted.
const wgc = () => ({
  eventId: 'conf-int-wgc-2027', eventName: 'World Glaucoma Congress 2027 (WGC 2027)', severity: 'high', reason: 'test', sourceQuality: 'official_event_page',
  confidence: 0.98, sourceUrl: 'https://worldglaucomacongress.org/',
  fieldChanges: [
    { field: 'cityCountry', before: '京都市（京都府） / 日本', after: 'Kyoto', severity: 'medium' },
    { field: 'title', before: 'World Glaucoma Congress 2027 (WGC 2027)', after: '12th World Glaucoma Congress (WGC-2027)', severity: 'high' }
  ]
});
const withReason = (item, field, patch) => ({ ...item, fieldChanges: item.fieldChanges.map(c => (c.field === field ? { ...c, ...patch } : c)) });
const [LOCATION, TITLE] = [0, 1];

function loadUi(report = { date: '2026-10-16', metrics: {}, wouldAutoUpdateCount: 0, adminVisibleItems: [wgc()] }) {
  const storage = new Map(), patches = [];
  const container = { innerHTML: '', handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, querySelectorAll: () => [] };
  const sandbox = {
    console: { warn() {}, log() {}, error() {} },
    document: { getElementById: id => (id === 'gemini-monitor-panel' ? container : null) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    fetch: async (url, options = {}) => {
      if (String(url).startsWith('reports/gemini-monitor/')) return { ok: true, status: 200, json: async () => report };
      if (options.method === 'PATCH') { patches.push(JSON.parse(JSON.parse(options.body).fields.json.stringValue)); return { ok: true, status: 200, json: async () => ({}) }; }
      return { ok: false, status: 404, json: async () => ({}) };
    },
    Intl, Date, JSON, Math, Promise, setTimeout, clearTimeout, String, Array, Object, Map, Set, Number
  };
  sandbox.window = sandbox;
  vm.runInNewContext(uiSource, sandbox);
  const ui = sandbox.OphthalGeminiMonitorUI;
  return { ui, store: ui.store, container, patches, storage };
}
async function ready(env) { env.ui.setMockUser(admin); await new Promise(resolve => setTimeout(resolve, 20)); return env; }
const queue = (store, eventId) => Object.values(store.data.items).filter(r => r.eventId === eventId && r.status === 'acknowledged');
const fieldsOf = record => record.fieldChanges.map(c => c.field).sort();

test('WGC 2027: 開催地＝変更しない／学会名＝採用 → 適用待ちの fieldChanges には学会名だけが入る', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'kept');
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  const records = queue(env.store, item.eventId);
  assert.equal(records.length, 1);
  assert.deepEqual(fieldsOf(records[0]), ['title']);
  assert.equal(records[0].fieldChanges[0].after, '12th World Glaucoma Congress (WGC-2027)');
  assert.ok(!JSON.stringify(records[0]).includes('Kyoto'), 'the kept location is not in the apply queue');
  const view = env.store.cardView(item);
  assert.equal(view.state, 'done');
  assert.deepEqual(view.rows.map(r => [r.change.field, r.status, r.applyState]), [['cityCountry', 'kept', null], ['title', 'adopted', 'pending']]);
});

test('2項目を順番に採用しても、1イベント1レコードのまま両方が保持される', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['title']);
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'adopted');
  const records = queue(env.store, item.eventId);
  assert.equal(records.length, 1, 'one pending record per event');
  assert.deepEqual(fieldsOf(records[0]), ['cityCountry', 'title']);
});

test('採用後に「変更しない」へ変えた項目は適用待ちから外れる（最後の1項目ならレコードも消える）', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideAll(item, 'adopted');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['cityCountry', 'title']);
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'kept');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['title']);
  await env.store.decideField(item, item.fieldChanges[TITLE], 'kept');
  assert.equal(queue(env.store, item.eventId).length, 0);
  assert.equal(env.store.cardView(item).state, 'done');
});

test('保留は適用待ちに入らない。採用→保留へ変えても適用待ちから外れる', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'deferred');
  assert.equal(queue(env.store, item.eventId).length, 0);
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['title']);
  await env.store.decideField(item, item.fieldChanges[TITLE], 'deferred');
  assert.equal(queue(env.store, item.eventId).length, 0);
});

test('カードの状態: 未判断あり→未処理（保留混在でも未処理）／全判断済みで保留あり→保留／保留なし→処理済み', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  assert.equal(env.store.cardView(item).state, 'pending');
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'deferred');
  assert.equal(env.store.cardView(item).state, 'pending', 'undecided + deferred stays pending');
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  assert.equal(env.store.cardView(item).state, 'hold');
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'kept');
  assert.equal(env.store.cardView(item).state, 'done');
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'undecided');
  assert.equal(env.store.cardView(item).state, 'pending');
});

test('after値が変われば、過去の判断は引き継がれない', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideAll(item, 'kept');
  assert.equal(env.store.cardView(item).state, 'done');
  const changed = withReason(item, 'title', { after: '12th World Glaucoma Congress' });
  const view = env.store.cardView(changed);
  assert.equal(view.rows[TITLE].status, 'undecided');
  assert.equal(view.rows[LOCATION].status, 'kept', 'the unchanged field keeps its decision');
  assert.equal(view.state, 'pending');
  assert.notEqual(env.store.fieldKey(item, item.fieldChanges[TITLE]), env.store.fieldKey(changed, changed.fieldChanges[TITLE]));
});

test('structured value でも判断キーが安定する（キー順・配列順の違いで別判断にならず、中身が違えば別キー）', async () => {
  const env = await ready(loadUi());
  const a = { eventId: 'e', field: 'registration', after: { type: 'domestic', periods: [{ label: 'A', deadline: '2026-01-01' }, { label: 'B', deadline: '2026-02-01', start: '2026-01-02' }] } };
  const reordered = { eventId: 'e', field: 'registration', after: { periods: [{ start: '2026-01-02', deadline: '2026-02-01', label: 'B' }, { deadline: '2026-01-01', label: 'A' }], type: 'domestic' } };
  const different = { eventId: 'e', field: 'registration', after: { type: 'domestic', periods: [{ label: 'A', deadline: '2026-01-01' }, { label: 'B', deadline: '2026-02-02' }] } };
  const key = c => env.store.fieldKey({ eventId: c.eventId }, c);
  assert.equal(key(a), key(reordered));
  assert.notEqual(key(a), key(different));
  assert.match(key(a), /@h:[0-9a-f]{14}$/, 'objects use a fingerprint, never the raw string');
  assert.ok(!key(a).includes('[object'));
  assert.equal(env.ui.valueToken(['x', 'y']), env.ui.valueToken(['y', 'x']));
  // strings stay readable
  assert.equal(key({ eventId: 'e', field: 'venue', after: 'Kyoto' }), 'e::venue@Kyoto');
});

test('「すべて採用」は採用できない行（after空）を飛ばして未判断のまま残し、「すべて変更しない」は全行を処理済みにする', async () => {
  const env = await ready(loadUi());
  const item = {
    ...wgc(),
    fieldChanges: [...wgc().fieldChanges, { field: 'registration', before: null, after: null, validationReason: 'registration-conflicting-deadlines' }]
  };
  await env.store.decideAll(item, 'adopted');
  const view = env.store.cardView(item);
  assert.deepEqual(view.rows.map(r => r.status), ['adopted', 'adopted', 'undecided']);
  assert.equal(view.rows[2].adoptable, false);
  assert.equal(view.state, 'pending');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['cityCountry', 'title']);
  await env.store.decideField(item, item.fieldChanges[2], 'adopted');
  assert.equal(env.store.cardView(item).rows[2].status, 'undecided', 'a withheld value cannot be adopted');
  await env.store.decideAll(item, 'kept');
  assert.equal(env.store.cardView(item).state, 'done');
  assert.equal(queue(env.store, item.eventId).length, 0);
});

test('既存のカード単位レコードとの互換: acknowledged は全項目採用・適用待ち、rolled_back は全項目「変更しない」として読む', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  const key = env.store.getItemKey(item);
  env.store.data.items[key] = { key, eventId: item.eventId, status: 'acknowledged', fieldChanges: item.fieldChanges, timestamp: new Date().toISOString() };
  let view = env.store.cardView(item);
  assert.equal(view.state, 'done');
  assert.deepEqual(view.rows.map(r => [r.status, r.applyState, r.source]), [['adopted', 'pending', 'legacy'], ['adopted', 'pending', 'legacy']]);

  env.store.data.items[key].status = 'applied';
  assert.deepEqual(env.store.cardView(item).rows.map(r => r.applyState), ['applied', 'applied']);

  env.store.data.items[key].status = 'rolled_back';
  view = env.store.cardView(item);
  assert.deepEqual(view.rows.map(r => r.status), ['kept', 'kept']);
  assert.equal(view.state, 'done');
});

test('既存の acknowledged（未適用）のカードで1項目を「変更しない」にすると、古いカード単位レコードは外れ、残りだけが適用待ちになる', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  const key = env.store.getItemKey(item);
  env.store.data.items[key] = { key, eventId: item.eventId, status: 'acknowledged', fieldChanges: item.fieldChanges, timestamp: new Date().toISOString() };
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'kept');
  assert.equal(env.store.data.items[key], undefined, 'the legacy whole-card acknowledgement no longer applies the kept field');
  const records = queue(env.store, item.eventId);
  assert.equal(records.length, 1);
  assert.deepEqual(fieldsOf(records[0]), ['title']);
});

test('適用済みの採用は固定され、後から別項目を採用すると新しい適用待ちレコードが作られる（適用済みは保持）', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  const [first] = queue(env.store, item.eventId);
  first.status = 'applied'; // the monitor applied it to events.js
  assert.equal(env.store.cardView(item).rows[TITLE].applyState, 'applied');
  await env.store.decideField(item, item.fieldChanges[TITLE], 'kept'); // cannot undo an applied change here
  assert.equal(env.store.cardView(item).rows[TITLE].status, 'adopted');
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'adopted');
  assert.equal(env.store.data.items[first.key].status, 'applied');
  const pending = queue(env.store, item.eventId);
  assert.equal(pending.length, 1);
  assert.deepEqual(fieldsOf(pending[0]), ['cityCountry']);
});

test('監視側との互換: 適用待ちは既存形式の acknowledged（1イベント1件）で、fieldDecisions は書き戻しでも保持される', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  await env.store.decideField(item, item.fieldChanges[LOCATION], 'kept');
  await env.store.decideField(item, item.fieldChanges[TITLE], 'adopted');
  const state = env.patches.at(-1);
  assert.deepEqual(Object.values(state.items).map(r => r.status), ['acknowledged'], 'no new status values in items');
  assert.ok(Object.keys(state.fieldDecisions).length === 2);

  // what the monitor reads: only acknowledged records, with the fieldChanges to apply
  const original = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ fields: { json: { stringValue: JSON.stringify(state) } } }) });
  let pending;
  try { pending = await client.getPendingActionsFromFirestore({ token: 'TOKEN', applyMode: true }); } finally { global.fetch = original; }
  assert.equal(pending.acknowledgedToApply.length, 1);
  assert.deepEqual(pending.acknowledgedToApply[0].fieldChanges.map(c => c.field), ['title']);

  // the monitor writes the whole state back after marking it applied: decisions must survive
  let body;
  global.fetch = async (url, options) => { body = JSON.parse(JSON.parse(options.body).fields.json.stringValue); return { ok: true, status: 200 }; };
  try {
    pending.remoteState.items[pending.acknowledgedToApply[0].key].status = 'applied';
    await client.saveRemoteState('TOKEN', pending.remoteState);
  } finally { global.fetch = original; }
  assert.equal(Object.keys(body.fieldDecisions).length, 2);
  assert.equal(Object.values(body.items)[0].status, 'applied');
});

test('画面: 各行に採用／変更しない／保留、カード下部に「すべて採用」「すべて変更しない」。採用した行は「採用・適用待ち」と表示される', async () => {
  const env = await ready(loadUi());
  assert.equal((env.container.innerHTML.match(/data-action="decide-field"/g) || []).length, 6);
  assert.match(env.container.innerHTML, /すべて採用/);
  assert.match(env.container.innerHTML, /すべて変更しない/);
  assert.match(env.container.innerHTML, /data-card-state="pending"/);

  const click = async (selectorMatch, dataset, cardKey) => {
    const card = { dataset: { itemKey: cardKey } };
    const button = { dataset, closest: sel => (sel === '.gemini-review-card' ? card : null) };
    await env.container.handlers.click({ target: { closest: sel => (sel === '[data-action]' ? button : null) } });
  };
  const item = wgc();
  const cardKey = env.store.getItemKey(item);
  await click(null, { action: 'decide-field', fieldKey: env.store.fieldKey(item, item.fieldChanges[LOCATION]), status: 'kept' }, cardKey);
  await click(null, { action: 'decide-field', fieldKey: env.store.fieldKey(item, item.fieldChanges[TITLE]), status: 'adopted' }, cardKey);
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['title']);
  // all rows decided without a deferral: the card left 未処理 immediately
  assert.match(env.container.innerHTML, /未処理の項目はありません/);
  await click(null, { action: 'set-view', view: 'done' }, cardKey);
  assert.match(env.container.innerHTML, /data-card-state="done"/);
  assert.match(env.container.innerHTML, /採用・適用待ち（次回の監視で実データへ反映）/);
  assert.match(env.container.innerHTML, /変更しない/);
});

test('既存の recordAction（確認済み／元に戻す）は項目単位の判断として扱われ、従来どおり acknowledged レコードができる', async () => {
  const env = await ready(loadUi());
  const item = wgc();
  const result = await env.store.recordAction(item, 'acknowledged');
  assert.equal(result.state, 'synced');
  assert.deepEqual(fieldsOf(queue(env.store, item.eventId)[0]), ['cityCountry', 'title']);
  await env.store.recordAction(item, 'rolled_back', 'x');
  assert.equal(queue(env.store, item.eventId).length, 0);
  assert.equal(env.store.cardView(item).state, 'done');
});
