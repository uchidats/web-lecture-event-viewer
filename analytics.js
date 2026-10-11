/* Consent-gated GA4. Never reads app records, login state or form/link values. */
(function (root) {
  'use strict';
  if (root.OphthalAnalytics) return;
  const config = Object.freeze({ measurementId: 'G-JXE3ZH9PVS',
    hostname: 'medconf.jp', path: '/ophthalconf/',
    consentKey: 'ophthalconf_analytics_consent_v1', consentDays: 180,
    pageTitle: 'OphthalConf' });
  const document = root.document;
  const enabled = root.location.protocol === 'https:' && root.location.hostname === config.hostname &&
    [config.path, config.path + 'index.html'].includes(root.location.pathname);
  const canonical = 'https://' + config.hostname + config.path;
  const disableKey = 'ga-disable-' + config.measurementId;
  const modes = ['list', 'calendar', 'compact'];
  const statuses = ['planned', 'not_planned', 'unselected', 'attended', 'not_attended'];
  const names = ['view_mode_change', 'filter_open', 'filter_apply', 'official_link_click',
    'pdf_click', 'calendar_add_click', 'attendance_status_change'];
  const $ = id => document.getElementById(id);
  let choice = null, expiresAt = 0, started = false, ready = false, pageSent = false;
  let pending = [], desktopFilterActive = false;
  function savedChoice() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(config.consentKey));
      return saved?.version === 1 && ['granted', 'denied'].includes(saved.choice) &&
        Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now() ? saved : null;
    } catch { return null; }
  }
  function ui() {
    if ($('analytics-notice')) $('analytics-notice').hidden = !enabled || choice !== null;
    if ($('analytics-settings')) $('analytics-settings').hidden = !enabled;
    if ($('analytics-choice')) $('analytics-choice').textContent = !enabled ? '' :
      choice === 'granted' ? 'アクセス解析：許可中' : choice === 'denied' ? 'アクセス解析：許可しない' : 'アクセス解析：未選択';
  }
  function eraseCookies() {
    // This stream's path-scoped cookies only; app storage and authentication are untouched.
    for (const item of document.cookie.split(';')) {
      const name = item.split('=')[0].trim();
      if (!['_ga', '_ga_' + config.measurementId.slice(2)].includes(name)) continue;
      for (const domain of ['', config.hostname, '.' + config.hostname]) {
        document.cookie = name + '=; Max-Age=0; path=' + config.path +
          (domain ? '; domain=' + domain : '') + '; SameSite=Lax; Secure';
      }
    }
  }
  function disable() {
    root[disableKey] = true;
    pending = [];
    eraseCookies();
    // Unload the running tag. Do not send a denied-mode ping on withdrawal.
    if (started) root.location.reload();
  }
  function permitted() {
    if (!enabled || choice !== 'granted' || root[disableKey]) return false;
    if (expiresAt <= Date.now()) { choice = null; ui(); disable(); return false; }
    return true;
  }
  function emit(name, attributes = {}) {
    root.gtag('event', name, { ...attributes, send_to: config.measurementId,
      page_location: canonical, page_title: config.pageTitle, page_referrer: '' });
  }
  function pageView() {
    if (!ready || pageSent || !permitted()) return;
    pageSent = true;
    emit('page_view');
  }
  function track(name, attributes = {}) {
    if (!permitted() || !names.includes(name)) return;
    // Closed schema: unexpected attributes, IDs, text and URLs are never forwarded.
    const safe = {};
    if (name === 'view_mode_change') {
      if (!modes.includes(attributes.view_mode)) return;
      safe.view_mode = attributes.view_mode;
    }
    if (name === 'attendance_status_change') {
      if (!statuses.includes(attributes.status) || !['plan', 'history'].includes(attributes.record_type)) return;
      safe.status = attributes.status;
      safe.record_type = attributes.record_type;
    }
    if (ready) emit(name, safe);
    else if (pending.length < 50) pending.push([name, safe]);
  }
  function start() {
    if (!permitted() || started) return;
    started = true;
    root.dataLayer = root.dataLayer || [];
    root.gtag = function () { root.dataLayer.push(arguments); };
    const deniedAds = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
    root.gtag('consent', 'default', { analytics_storage: 'denied', ...deniedAds });
    root.gtag('consent', 'update', { analytics_storage: 'granted', ...deniedAds });
    root.gtag('set', 'ads_data_redaction', true);
    root.gtag('set', 'url_passthrough', false);
    root.gtag('js', new Date());
    root.gtag('config', config.measurementId, { send_page_view: false,
      page_location: canonical, page_title: config.pageTitle, page_referrer: '',
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: 'none', cookie_path: config.path, cookie_expires: config.consentDays * 86400,
      cookie_flags: 'SameSite=Lax;Secure' });
    const script = document.createElement('script');
    script.id = 'ophthalconf-gtag'; script.async = true; script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + config.measurementId;
    script.onload = () => {
      ready = true; pageView();
      const queued = pending; pending = [];
      if (permitted()) for (const [name, attributes] of queued) emit(name, attributes);
    };
    script.onerror = () => {
      pending = [];
      if ($('analytics-message')) $('analytics-message').textContent = 'アクセス解析を読み込めませんでした。サイトの機能はそのまま利用できます。';
    };
    document.head.appendChild(script);
  }
  function setConsent(value) {
    if (!enabled || !['granted', 'denied'].includes(value)) return;
    choice = value; expiresAt = Date.now() + config.consentDays * 86400000;
    try { root.localStorage.setItem(config.consentKey, JSON.stringify({ version: 1, choice, expiresAt })); }
    catch { /* Explicit choice still applies to this page when storage is unavailable. */ }
    root[disableKey] = value !== 'granted'; ui();
    if (value === 'granted') { start(); pageView(); } else disable();
  }
  function bindActions() {
    // One delegated capture listener survives card rerenders and calendar detail dialogs.
    document.addEventListener('click', event => {
      if (!permitted()) return;
      if (!root.matchMedia('(max-width: 980px)').matches) {
        const inFilter = Boolean(event.target.closest?.('#filter-sidebar'));
        if (inFilter && !desktopFilterActive) track('filter_open');
        desktopFilterActive = inFilter;
      }
      const target = event.target.closest?.('button, a');
      if (!target || target.disabled) return;
      const mode = { 'view-list': 'list', 'view-calendar': 'calendar', 'view-compact': 'compact' }[target.id];
      if (mode) {
        if (target.getAttribute('aria-pressed') !== 'true') track('view_mode_change', { view_mode: mode });
        return;
      }
      if (target.id === 'mobile-filter-btn') {
        if (!$('filter-sidebar').classList.contains('open')) track('filter_open');
        return;
      }
      if (target.matches('.btn-official, .conference-title-link, .abstract-submit-link, #conference-history-modal a[target="_blank"]')) {
        track('official_link_click'); return;
      }
      const action = target.getAttribute('data-action');
      if (action === 'view-pdf' || target.id === 'download-mock-pdf') { track('pdf_click'); return; }
      if (action === 'add-calendar') { track('calendar_add_click'); return; }
      if (action === 'attend-choice') {
        const status = target.getAttribute('data-choice') === 'yes'
          ? target.getAttribute('aria-pressed') === 'true' ? 'unselected' : 'planned' : 'not_planned';
        track('attendance_status_change', { record_type: 'plan', status }); return;
      }
      if (action === 'record-history') {
        track('attendance_status_change', { record_type: 'history', status:
          target.getAttribute('aria-pressed') === 'true' ? 'unselected' : target.getAttribute('data-history-choice') }); return;
      }
      if (action === 'cancel-attended') { track('attendance_status_change', { record_type: 'history', status: 'unselected' }); return; }
      if (target.matches('.btn-restore-conf')) { track('attendance_status_change', { record_type: 'plan', status: 'unselected' }); return; }
      if (target.matches('#apply-mobile-filter, #reset-filter-btn, #empty-reset-btn, #clear-search-btn, #toggle-registered-filter, #clear-registered-filter, .group-select-all, .group-select-domestic, .badge-remove')) track('filter_apply');
    }, true);
    document.addEventListener('change', event => {
      if (!permitted() || !event.target.matches?.('#filter-sidebar input[type="checkbox"], #keyword-search')) return;
      if (!root.matchMedia('(max-width: 980px)').matches && !desktopFilterActive) {
        desktopFilterActive = true; track('filter_open');
      }
      track('filter_apply');
    }, true);
  }
  function init() {
    if (!enabled) { ui(); return; }
    const saved = savedChoice(); choice = saved?.choice || null; expiresAt = saved?.expiresAt || 0;
    root[disableKey] = choice !== 'granted';
    $('analytics-accept').addEventListener('click', () => setConsent('granted'));
    $('analytics-decline').addEventListener('click', () => setConsent('denied'));
    $('analytics-settings').addEventListener('click', () => { $('analytics-notice').hidden = false; $('analytics-decline').focus(); });
    root.addEventListener('storage', event => {
      if (event.key !== config.consentKey && event.key !== null) return;
      const saved = savedChoice(); choice = saved?.choice || null; expiresAt = saved?.expiresAt || 0;
      root[disableKey] = choice !== 'granted'; ui();
      if (choice === 'granted') start(); else disable();
    });
    bindActions(); ui(); if (choice === 'granted') start();
  }
  root.OphthalAnalytics = Object.freeze({ config, track, setConsent, getConsent: () => choice });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(window);
