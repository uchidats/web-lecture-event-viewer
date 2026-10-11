const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../analytics.js'), 'utf8');
const valid = choice => JSON.stringify({ version: 1, choice, expiresAt: Date.now() + 86400000 });
function run(url = 'https://medconf.jp/ophthalconf/', saved = null, blocked = false) {
  const scripts = [], reads = [], writes = [], nodes = {}, listeners = {}, windowListeners = {};
  for (const id of ['analytics-notice', 'analytics-settings', 'analytics-choice', 'analytics-accept', 'analytics-decline', 'analytics-message']) {
    nodes[id] = { hidden: true, textContent: '', focus() {}, addEventListener(type, fn) { this[type] = fn; } };
  }
  const cookies = new Map([['_ga', 'synthetic'], ['_ga_JXE3ZH9PVS', 'synthetic'], ['login_cookie', 'keep']]);
  const location = new URL(url); location.reload = () => { location.reloads = (location.reloads || 0) + 1; };
  const document = { readyState: 'complete',
    get cookie() { return [...cookies].map(([k, v]) => k + '=' + v).join('; '); },
    set cookie(value) { if (value.includes('Max-Age=0')) cookies.delete(value.split('=')[0]); },
    getElementById: id => nodes[id], createElement: () => ({}),
    head: { appendChild: script => scripts.push(script) },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); } };
  const root = { document, location, matchMedia: () => ({ matches: false }),
    addEventListener(type, fn) { windowListeners[type] = fn; },
    localStorage: {
      getItem(key) { reads.push(key); if (blocked) throw Error('blocked'); return saved; },
      setItem(key, value) { writes.push([key, value]); if (blocked) throw Error('blocked'); saved = value; }
    } };
  const context = vm.createContext({ window: root, Date, console });
  const again = () => vm.runInContext(source, context);
  again();
  return { root, nodes, scripts, reads, writes, listeners, windowListeners, again,
    saved: value => { saved = value; },
    commands: () => Array.from(root.dataLayer || [], row => Array.from(row)),
    events: () => Array.from(root.dataLayer || [], row => Array.from(row)).filter(row => row[0] === 'event') };
}
test('Explicit consent only; one script/page_view; canonical metadata and closed event schema', () => {
  const r = run('https://medconf.jp/ophthalconf/?email=private@example.invalid#private-login');
  assert.equal(r.scripts.length, 0); assert.equal(r.root.dataLayer, undefined);
  r.root.OphthalAnalytics.track('pdf_click'); assert.equal(r.scripts.length, 0);
  r.nodes['analytics-accept'].click(); r.nodes['analytics-accept'].click(); r.again();
  assert.equal(r.scripts.length, 1);
  assert.equal(r.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-JXE3ZH9PVS');
  assert.equal(r.scripts[0].referrerPolicy, 'no-referrer');
  const config = r.commands().find(row => row[0] === 'config')[2];
  assert.equal(config.send_page_view, false); assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false); assert.equal(config.cookie_path, '/ophthalconf/');
  assert.equal(r.events().length, 0);
  r.root.OphthalAnalytics.track('pdf_click', { user_id: 'private-login', email: 'private@example.invalid' });
  r.scripts[0].onload(); r.scripts[0].onload(); r.nodes['analytics-accept'].click();
  assert.deepEqual(r.events().map(row => row[1]), ['page_view', 'pdf_click']);
  for (const mode of ['list', 'calendar', 'compact']) r.root.OphthalAnalytics.track('view_mode_change', { view_mode: mode, keyword: 'private-login' });
  for (const name of ['filter_open', 'filter_apply', 'official_link_click', 'calendar_add_click']) r.root.OphthalAnalytics.track(name, { event_id: 'private-login' });
  r.root.OphthalAnalytics.track('attendance_status_change', { status: 'planned', record_type: 'plan', email: 'private@example.invalid' });
  const count = r.events().length;
  for (const mode of ['private-login', null]) r.root.OphthalAnalytics.track('view_mode_change', { view_mode: mode });
  r.root.OphthalAnalytics.track('other_event'); r.root.OphthalAnalytics.track('attendance_status_change', { status: 'private-login' });
  assert.equal(r.events().length, count);
  assert.equal(/private-login|private@example|event_id|user_id|keyword/.test(JSON.stringify(r.commands())), false);
  for (const row of r.events()) assert.equal(row[2].page_location, 'https://medconf.jp/ophthalconf/');
  for (const row of r.commands().filter(row => row[0] === 'consent')) {
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(row[2][key], 'denied');
  }
  assert.ok(r.reads.every(key => key === 'ophthalconf_analytics_consent_v1'));
  assert.equal(r.listeners.click.length, 1, 'Repeated initializer cannot attach duplicate listeners');
});
test('Root, local, previews and unrelated origins never load even with stored permission', () => {
  for (const url of ['https://medconf.jp/', 'https://medconf.jp/index.html', 'https://medconf.jp/ophthalconf/preview.html',
    'http://medconf.jp/ophthalconf/', 'https://example.com/ophthalconf/', 'http://localhost/ophthalconf/',
    'http://127.0.0.1/ophthalconf/', 'file:///C:/site/index.html']) {
    const r = run(url, valid('granted')); r.root.OphthalAnalytics.setConsent('granted');
    assert.equal(r.scripts.length, 0, url); assert.equal(r.reads.length, 0, url);
  }
});
test('Denial, invalid/expired consent, blocked storage, stored grant and tag failure', () => {
  for (const saved of [valid('denied'), '{}', 'invalid', JSON.stringify({ version: 1, choice: 'granted', expiresAt: 0 })]) assert.equal(run(undefined, saved).scripts.length, 0);
  const grant = run('https://medconf.jp/ophthalconf/index.html', valid('granted')); assert.equal(grant.scripts.length, 1);
  const r = run(undefined, null, true); assert.equal(r.scripts.length, 0);
  r.nodes['analytics-accept'].click(); r.scripts[0].onerror(); assert.equal(r.events().length, 0);
  assert.ok(r.nodes['analytics-message'].textContent.includes('そのまま利用'));
});
test('Withdrawal during load and across tabs prevents events and preserves login data', () => {
  const r = run(); r.nodes['analytics-decline'].click(); assert.equal(r.scripts.length, 0);
  r.nodes['analytics-settings'].click(); assert.equal(r.nodes['analytics-notice'].hidden, false);
  r.nodes['analytics-accept'].click(); r.root.OphthalAnalytics.track('pdf_click');
  r.nodes['analytics-decline'].click(); r.scripts[0].onload();
  assert.equal(r.events().length, 0); assert.equal(r.root['ga-disable-G-JXE3ZH9PVS'], true);
  assert.equal(r.root.location.reloads, 1); assert.equal(r.root.document.cookie, 'login_cookie=keep');
  const other = run(undefined, valid('granted')); other.scripts[0].onload(); other.saved(valid('denied'));
  other.windowListeners.storage({ key: 'ophthalconf_analytics_consent_v1' });
  other.root.OphthalAnalytics.track('filter_apply'); assert.equal(other.events().length, 1);
  assert.equal(other.root.location.reloads, 1);
});
test('Dual-site assets and no unconditional GA tags/preconnect', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert.equal((html.match(/src="analytics.js"/g) || []).length, 1);
  assert.ok(!/googletagmanager|google-analytics/.test(html));
  assert.ok(html.includes('href="analytics.css"'));
});
