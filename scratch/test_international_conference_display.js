const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const venuesJsCode = fs.readFileSync(path.join(root, 'venues.js'), 'utf8');
const companiesJsCode = fs.readFileSync(path.join(root, 'companies.js'), 'utf8');
const eventsJsCode = fs.readFileSync(path.join(root, 'events.js'), 'utf8');
const scriptJsCode = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Build minimal DOM sandbox
function createSandbox() {
  const localStorageMock = new Map();
  const context = {
    console,
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    JSON,
    Intl,
    parseInt,
    parseFloat,
    window: {},
    document: {
      getElementById: (id) => ({ innerHTML: '', querySelectorAll: () => [], addEventListener: () => {} }),
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {} } }),
      addEventListener: () => {}
    },
    localStorage: {
      getItem: (k) => localStorageMock.get(k) || null,
      setItem: (k, v) => localStorageMock.set(k, String(v)),
      removeItem: (k) => localStorageMock.delete(k)
    }
  };
  context.window = context;
  context.self = context;

  vm.createContext(context);
  vm.runInContext(venuesJsCode, context);
  vm.runInContext(companiesJsCode, context);
  vm.runInContext(eventsJsCode, context);
  vm.runInContext(scriptJsCode, context);
  context.sampleEvents = vm.runInContext('sampleEvents', context);
  context.evaluate = (code) => vm.runInContext(code, context);
  return context;
}

function testInternationalDisplay() {
  console.log('=== Test 1: FujiRetina 2027 Classification & Card Display ===');
  const ctx = createSandbox();
  const sampleEvents = ctx.sampleEvents;

  const fuji2027 = sampleEvents.find(e => e.id === 'conf-int-fujiretina-2027');
  assert.ok(fuji2027, 'conf-int-fujiretina-2027 must exist in sampleEvents');

  // Verify conferenceRegion and location
  assert.equal(fuji2027.conferenceRegion, 'international');
  assert.equal(fuji2027.cityCountry, '東京都 / 日本');
  assert.equal(fuji2027.venue, '虎ノ門ヒルズフォーラム');

  // Generate card HTML
  const fujiCardHtml = ctx.createEventCardHtml(fuji2027);

  // 1. Badge must be 国際学会
  assert.ok(fujiCardHtml.includes('<span class="conf-category-badge region">国際学会</span>'),
    'FujiRetina 2027 badge must display 国際学会');
  assert.ok(!fujiCardHtml.includes('海外学会'),
    'FujiRetina 2027 card must NOT contain 海外学会');

  // 2. Meta 種別 must be 国際学会
  assert.ok(fujiCardHtml.includes('<span class="card-meta-label">種別:</span>\n          <span>国際学会</span>') ||
            fujiCardHtml.includes('種別:</span>') && fujiCardHtml.includes('<span>国際学会</span>'),
    'FujiRetina 2027 card-meta 種別 must display 国際学会');

  console.log('PASS: FujiRetina 2027 is classified and displayed as 国際学会 (held in Tokyo, Japan)');

  console.log('\n=== Test 2: FujiRetina 2028 & Other International Conferences ===');
  const fuji2028 = sampleEvents.find(e => e.id === 'conf-int-fujiretina-2028');
  assert.ok(fuji2028, 'conf-int-fujiretina-2028 must exist');
  const fuji2028Card = ctx.createEventCardHtml(fuji2028);
  assert.ok(fuji2028Card.includes('国際学会'));
  assert.ok(!fuji2028Card.includes('海外学会'));

  const internationalIds = [
    'oph-004', // AAO 2026
    'conf-int-euretina-2026', // EURETINA 2026
    'oph-010', // APACRS 2026
    'conf-int-apao-2027', // APAO 2027
    'conf-int-ascrs-2027', // ASCRS 2027
    'conf-int-wgc-2027' // WGC 2027 (Kyoto)
  ];

  for (const id of internationalIds) {
    const ev = sampleEvents.find(e => e.id === id);
    assert.ok(ev, `${id} must exist`);
    const cardHtml = ctx.createEventCardHtml(ev);
    assert.ok(cardHtml.includes('<span class="conf-category-badge region">国際学会</span>'), `${id} (${ev.title}) card badge must display 国際学会`);
    assert.ok(cardHtml.includes('<span>国際学会</span>'), `${id} (${ev.title}) card meta 種別 must display 国際学会`);
    assert.ok(!cardHtml.includes('海外学会</span>'), `${id} (${ev.title}) card must NOT display 海外学会`);
  }
  console.log(`PASS: All sample international conferences (${internationalIds.length} checked) display 国際学会`);

  console.log('\n=== Test 3: Domestic Conferences Display 国内学会 ===');
  const domesticIds = [
    'conf-jp-jos-2026', // 日本眼科学会
    'conf-jp-glaucoma-2026', // 日本緑内障学会
    'conf-jp-jrvs-2026' // 日本網膜硝子体学会
  ];

  for (const id of domesticIds) {
    const ev = sampleEvents.find(e => e.id === id);
    assert.ok(ev, `${id} must exist`);
    const cardHtml = ctx.createEventCardHtml(ev);
    assert.ok(cardHtml.includes('<span class="conf-category-badge region">国内学会</span>'), `${id} (${ev.title}) card badge must display 国内学会`);
    assert.ok(cardHtml.includes('<span>国内学会</span>'), `${id} (${ev.title}) card meta 種別 must display 国内学会`);
    assert.ok(!cardHtml.includes('<span class="conf-category-badge region">国際学会</span>'), `${id} (${ev.title}) badge must NOT display 国際学会`);
  }
  console.log(`PASS: Domestic conferences (${domesticIds.length} checked) display 国内学会`);

  console.log('\n=== Test 4: Filter Options Label Mapping ===');
  // Check getEventTypeDisplayLabel helper
  assert.equal(ctx.getEventTypeDisplayLabel('海外学会'), '国際学会');
  assert.equal(ctx.getEventTypeDisplayLabel('国内学会'), '国内学会');
  assert.equal(ctx.getEventTypeDisplayLabel('講演会・勉強会'), '講演会・勉強会');
  assert.equal(ctx.getEventTypeDisplayLabel('地方会・研究会'), '地方会・研究会');

  // Verify filter-eventType chips generation in DOM
  const mockContainer = { innerHTML: '' };
  ctx.document.getElementById = (id) => id === 'filter-eventType' ? mockContainer : { innerHTML: '' };
  const state = ctx.evaluate('state');
  state.events = sampleEvents;
  ctx.evaluate('renderFilterOptions()');

  assert.ok(mockContainer.innerHTML.includes('国際学会'), 'filter-eventType must render 国際学会 label');
  assert.ok(!mockContainer.innerHTML.includes('>海外学会<') && !mockContainer.innerHTML.includes('海外学会 ('),
    'filter-eventType must NOT render 海外学会 user-visible label');
  // Checkbox value remains 海外学会 for internal logic
  assert.ok(mockContainer.innerHTML.includes('value="海外学会"'), 'Checkbox value preserved as 海外学会');
  console.log('PASS: Filter chip renders 国際学会 with preserved internal value 海外学会');

  console.log('\n=== Test 5: Filter State Storage Compatibility ===');
  // Case A: User with legacy saved state containing '海外学会'
  const legacyState = {
    version: 1,
    filters: { eventType: ['海外学会'], keyword: '' },
    sortBy: 'date-asc'
  };
  ctx.localStorage.setItem('ophthalconf_filter_state', JSON.stringify(legacyState));
  ctx.evaluate('loadFilterState()');
  assert.ok(state.filters.eventType.has('海外学会'), 'Legacy state with 海外学会 must load into filters');

  // Case B: State with '国際学会' normalized smoothly to '海外学会'
  const modernState = {
    version: 1,
    filters: { eventType: ['国際学会'], keyword: '' },
    sortBy: 'date-asc'
  };
  ctx.localStorage.setItem('ophthalconf_filter_state', JSON.stringify(modernState));
  ctx.evaluate('loadFilterState()');
  assert.ok(state.filters.eventType.has('海外学会'), 'State with 国際学会 must normalize to 海外学会');
  console.log('PASS: Filter state storage bidirectional compatibility verified');

  console.log('\n=== Test 6: Zero Remaining User-Facing "海外学会" in HTML/JS ===');
  // Verify index.html does not display 海外学会
  assert.ok(!indexHtml.includes('>海外学会<'));
  console.log('PASS: No user-facing 海外学会 in index.html');

  console.log('\n=== ALL INTERNATIONAL CONFERENCE DISPLAY TESTS PASSED! ===');
}

testInternationalDisplay();
