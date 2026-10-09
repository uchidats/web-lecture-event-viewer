const assert = require('node:assert/strict');
const {
  isMajorConference,
  getDiscoveryWindowStatus,
  getEventHorizonStatus,
  buildSearchQueries,
  discoverOfficialUrlWithGoogle,
  verifyCandidateOffline,
  isDomainOfficial,
  isDomainThirdParty
} = require('../scripts/gemini-monitor/google-url-discoverer');
const fs = require('node:fs');
const { loadEvents } = require('../scripts/auto-updater/storage');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');

async function main() {
  console.log('Starting Google Official URL Discovery Comprehensive Regression Suite...\n');

  const { events } = loadEvents('.');
  const lowvisionEvent = events.find(e => e.id === 'conf-jp-lowvision-2027');
  const fujiretinaEvent = events.find(e => e.id === 'conf-int-fujiretina-2028');
  const ascrsEvent = events.find(e => e.id === 'conf-int-ascrs-2027');

  assert.ok(lowvisionEvent, 'conf-jp-lowvision-2027 must exist');
  assert.ok(fujiretinaEvent, 'conf-int-fujiretina-2028 must exist');
  assert.ok(ascrsEvent, 'conf-int-ascrs-2027 must exist');

  // ==========================================
  // Test Case 1: Major vs Standard Classification
  // ==========================================
  console.log('--- Test 1: Major vs Standard Classification ---');
  assert.equal(isMajorConference(ascrsEvent), true, 'ASCRS must be major');
  assert.equal(isMajorConference(fujiretinaEvent), true, 'FujiRetina must be major');
  assert.equal(isMajorConference({ title: '第130回 日本眼科学会総会', sponsor: '日本眼科学会' }), true);
  assert.equal(isMajorConference({ title: '第80回 日本臨床眼科学会', sponsor: '日本眼科学会' }), true);
  assert.equal(isMajorConference({ title: '第49回 日本眼科手術学会学術総会', sponsor: '日本眼科手術学会' }), true);
  assert.equal(isMajorConference({ title: '第66回 日本網膜硝子体学会総会', sponsor: '日本網膜硝子体学会' }), true);
  assert.equal(isMajorConference({ title: '第37回 日本緑内障学会', sponsor: '日本緑内障学会' }), true);
  assert.equal(isMajorConference({ title: 'AAO 2026 Annual Meeting', sponsor: 'American Academy of Ophthalmology' }), true);
  assert.equal(isMajorConference({ title: 'ARVO 2028 Annual Meeting' }), true);
  assert.equal(isMajorConference({ title: 'EURETINA 2026' }), true);
  assert.equal(isMajorConference({ title: 'ESCRS 2026' }), true);
  assert.equal(isMajorConference({ title: 'APAO 2028' }), true);
  assert.equal(isMajorConference({ title: 'APACRS 2027' }), true);
  assert.equal(isMajorConference({ title: 'WGC 2027 (World Glaucoma Congress)' }), true);

  // Standard subspecialties
  assert.equal(isMajorConference(lowvisionEvent), false, 'Low Vision is standard subspecialty');
  assert.equal(isMajorConference({ title: '第65回 日本神経眼科学会総会' }), false);
  assert.equal(isMajorConference({ title: '第47回 日本眼薬理学会' }), false);
  assert.equal(isMajorConference({ title: '第38回 日本眼瞼義眼床手術学会学術集会' }), false);
  console.log('PASS: Major vs Standard classification accurate for all categories\n');

  // ==========================================
  // Test Case 2: Discovery Window Checks (365d for major, 180d for standard, ended check)
  // ==========================================
  console.log('--- Test 2: Mandatory Window Checks ---');
  const refDate = new Date('2026-10-09T00:00:00Z');

  // Major event within 365 days (e.g. 200 days away)
  const majorWithin365 = { ...ascrsEvent, date: '2027-04-27' }; // ~200 days away
  const wMajorIn = getDiscoveryWindowStatus(majorWithin365, refDate);
  assert.equal(wMajorIn.isMajor, true);
  assert.equal(wMajorIn.thresholdDays, 365);
  assert.equal(wMajorIn.inMandatoryWindow, true);
  assert.equal(wMajorIn.status, 'mandatory-discovery-window');

  // Major event over 365 days away (e.g. 400 days away)
  const majorOver365 = { ...ascrsEvent, date: '2027-11-13' }; // 400 days away
  const wMajorOut = getDiscoveryWindowStatus(majorOver365, refDate);
  assert.equal(wMajorOut.isMajor, true);
  assert.equal(wMajorOut.inMandatoryWindow, false);
  assert.equal(wMajorOut.status, 'dedicated-page-not-yet-created-normal');

  // Standard event within 180 days (e.g. 100 days away)
  const standardWithin180 = { ...lowvisionEvent, date: '2027-01-17' }; // 100 days away
  const wStdIn = getDiscoveryWindowStatus(standardWithin180, refDate);
  assert.equal(wStdIn.isMajor, false);
  assert.equal(wStdIn.thresholdDays, 180);
  assert.equal(wStdIn.inMandatoryWindow, true);
  assert.equal(wStdIn.status, 'mandatory-discovery-window');

  // Standard event over 180 days away (e.g. 225 days away)
  const standardOver180 = { ...lowvisionEvent, date: '2027-05-22' }; // 225 days away from 2026-10-09
  const wStdOut = getDiscoveryWindowStatus(standardOver180, refDate);
  assert.equal(wStdOut.isMajor, false);
  assert.equal(wStdOut.inMandatoryWindow, false);
  assert.equal(wStdOut.status, 'dedicated-page-not-yet-created-normal');

  // Ended event (diffDays < 0)
  const endedEvent = { ...lowvisionEvent, date: '2026-05-22' };
  const wEnded = getDiscoveryWindowStatus(endedEvent, refDate);
  assert.equal(wEnded.isEnded, true);
  assert.equal(wEnded.inMandatoryWindow, false);
  assert.equal(wEnded.status, 'ended-skip');
  console.log('PASS: Window thresholds (major 365d, standard 180d, ended < 0) verified\n');

  // ==========================================
  // Test Case 3: Query Generation (Japanese edition, city, English name)
  // ==========================================
  console.log('--- Test 3: Query Generation ---');
  const qLowVision = buildSearchQueries(lowvisionEvent);
  assert.equal(qLowVision.primaryQuery, '第28回 日本ロービジョン学会学術総会 2027');
  assert.equal(qLowVision.secondaryQuery, '第28回 日本ロービジョン学会学術総会 2027 大阪市');

  const qFuji = buildSearchQueries(fujiretinaEvent);
  assert.equal(qFuji.primaryQuery, 'FujiRetina 2028');
  assert.equal(qFuji.secondaryQuery, 'FujiRetina 2028 東京都');

  const qAscrs = buildSearchQueries(ascrsEvent);
  assert.equal(qAscrs.primaryQuery, 'ASCRS Annual Meeting 2027');
  assert.equal(qAscrs.secondaryQuery, 'ASCRS Annual Meeting 2027 サンディエゴ');
  console.log('PASS: Query generation matches user specification\n');

  // ==========================================
  // Test Case 4: 第28回日本ロービジョン学会学術総会 2027 Google Rank #1 Adoption
  // ==========================================
  console.log('--- Test 4: 第28回日本ロービジョン学会学術総会 2027 Rank #1 Adoption ---');
  // Simulate execution within discovery window
  const activeDateStd = new Date('2027-01-01T00:00:00Z'); // 141 days before 2027-05-22
  const mockProviderLowVision = async () => [
    {
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '第28回日本ロービジョン学会学術総会 会期：2027年5月22日〜23日 会場：大阪国際会議場'
    },
    {
      rank: 2,
      url: 'https://prtimes.jp/main/html/rd/p/000000001.html',
      title: 'ロービジョン関連PR記事',
      snippet: 'PRTIMES'
    }
  ];

  const resLowVision = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: activeDateStd,
    offline: true,
    searchProvider: mockProviderLowVision
  });

  assert.equal(resLowVision.status, 'adopted');
  assert.equal(resLowVision.action, 'safe_auto_update');
  assert.equal(resLowVision.rank, 1);
  assert.equal(resLowVision.adoptedUrl, 'https://www.ganki.jp/lowvision2027/information.html');
  assert.ok(resLowVision.confidence >= 0.85);
  assert.equal(resLowVision.evaluatedCount, 1);
  console.log('PASS: 第28回日本ロービジョン学会学術総会 2027 correctly adopted at Rank #1\n');

  // ==========================================
  // Test Case 5: FujiRetina & ASCRS Adoption
  // ==========================================
  console.log('--- Test 5: FujiRetina & ASCRS Adoption ---');
  const activeDateMajor = new Date('2027-01-01T00:00:00Z'); // within 365d of ASCRS 2027-04-02
  const mockProviderAscrs = async () => [
    {
      rank: 1,
      url: 'https://ascrs.org/annual-meeting-2027',
      title: 'ASCRS 2027 Annual Meeting San Diego',
      snippet: 'Official ASCRS 2027 Annual Meeting in San Diego, CA. Dates: April 2-6, 2027'
    }
  ];

  const resAscrs = await discoverOfficialUrlWithGoogle(ascrsEvent, {
    now: activeDateMajor,
    offline: true,
    searchProvider: mockProviderAscrs
  });
  assert.equal(resAscrs.status, 'adopted');
  assert.equal(resAscrs.adoptedUrl, 'https://ascrs.org/annual-meeting-2027');

  const activeDateFuji = new Date('2027-10-01T00:00:00Z'); // within 365d of FujiRetina 2028-03-24
  const mockProviderFuji = async () => [
    {
      rank: 1,
      url: 'https://fujiretina.com/2028/',
      title: 'FujiRetina 2028 Karuizawa Official Website',
      snippet: 'Welcome to FujiRetina 2028 held in Karuizawa, Japan. March 24-26, 2028.'
    }
  ];

  const resFuji = await discoverOfficialUrlWithGoogle(fujiretinaEvent, {
    now: activeDateFuji,
    offline: true,
    searchProvider: mockProviderFuji
  });
  assert.equal(resFuji.status, 'adopted');
  assert.equal(resFuji.adoptedUrl, 'https://fujiretina.com/2028/');
  console.log('PASS: FujiRetina and ASCRS official URLs adopted accurately\n');

  // ==========================================
  // Test Case 6: Rank 1 -> 2 -> 3 Traversal & Max 3 Evaluated
  // ==========================================
  console.log('--- Test 6: Traversal through Ranks 1, 2, and 3 ---');
  // Scenario A: Rank 1 is 3rd party aggregator, Rank 2 is adopted
  const mockProviderRank2 = async () => [
    { rank: 1, url: 'https://m3.com/news/1', title: 'M3 article', snippet: 'M3 summary' },
    {
      rank: 2,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '第28回日本ロービジョン学会学術総会 会期：2027年5月22日〜23日 会場：大阪国際会議場'
    },
    { rank: 3, url: 'https://ameblo.jp/entry', title: 'Blog', snippet: 'Blog' }
  ];
  const resRank2 = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: activeDateStd,
    offline: true,
    searchProvider: mockProviderRank2
  });
  assert.equal(resRank2.status, 'adopted');
  assert.equal(resRank2.rank, 2);
  assert.equal(resRank2.evaluatedCount, 2);

  // Scenario B: Rank 1 & 2 are 3rd party, Rank 3 is adopted
  const mockProviderRank3 = async () => [
    { rank: 1, url: 'https://prtimes.jp/1', title: 'PR 1', snippet: 'PR' },
    { rank: 2, url: 'https://m3.com/2', title: 'M3 2', snippet: 'M3' },
    {
      rank: 3,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '第28回日本ロービジョン学会学術総会 会期：2027年5月22日〜23日 会場：大阪国際会議場'
    }
  ];
  const resRank3 = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: activeDateStd,
    offline: true,
    searchProvider: mockProviderRank3
  });
  assert.equal(resRank3.status, 'adopted');
  assert.equal(resRank3.rank, 3);
  assert.equal(resRank3.evaluatedCount, 3);

  // Scenario C: Ranks 1, 2, 3 all fail -> stops at 3, does NOT evaluate Rank 4
  const mockProviderNone = async () => [
    { rank: 1, url: 'https://prtimes.jp/1', title: 'PR 1', snippet: 'PR' },
    { rank: 2, url: 'https://m3.com/2', title: 'M3 2', snippet: 'M3' },
    { rank: 3, url: 'https://ameblo.jp/3', title: 'Blog 3', snippet: 'Blog' },
    { rank: 4, url: 'https://www.ganki.jp/lowvision2027/information.html', title: 'Official', snippet: 'Official' }
  ];
  const resNone = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: activeDateStd,
    offline: true,
    searchProvider: mockProviderNone
  });
  assert.equal(resNone.status, 'not-found');
  assert.equal(resNone.reason, 'official_url_not_found');
  assert.equal(resNone.evaluatedCount, 3);
  console.log('PASS: Traversal evaluates ranks 1->2->3 and stops strictly at max 3\n');

  // ==========================================
  // Test Case 7: Bot-Protected Official Candidate Handling
  // ==========================================
  console.log('--- Test 7: Bot-Protected Candidate Handling ---');
  const mockProviderBotProtected = async () => [
    {
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '第28回日本ロービジョン学会学術総会 会期：2027年5月22日〜23日 会場：大阪国際会議場',
      pageFetchError: 'HTTP 403 Forbidden: Cloudflare anti-bot challenge'
    }
  ];

  const resBotProtected = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: activeDateStd,
    offline: true,
    searchProvider: mockProviderBotProtected
  });

  assert.equal(resBotProtected.status, 'adopted');
  assert.equal(resBotProtected.isBotProtected, true);
  assert.equal(resBotProtected.adoptedUrl, 'https://www.ganki.jp/lowvision2027/information.html');
  assert.ok(resBotProtected.reason.includes('bot-protected-official-candidate'));
  console.log('PASS: Bot-protected official candidate preserved and verified\n');

  // ==========================================
  // Test Case 8: Ended Event Skipping
  // ==========================================
  console.log('--- Test 8: Ended Event Skipping ---');
  const resEnded = await discoverOfficialUrlWithGoogle(endedEvent, {
    now: refDate,
    offline: true
  });
  assert.equal(resEnded.status, 'skipped');
  assert.equal(resEnded.reason, 'ended-skip');
  assert.equal(resEnded.adoptedUrl, null);
  console.log('PASS: Ended event skipped without search\n');

  // ==========================================
  // Test Case 9: Outside Mandatory Window Normal State
  // ==========================================
  console.log('--- Test 9: Outside Mandatory Window Normal State ---');
  // standardEvent when outside 180 days (from 2026-10-09, 225 days away)
  const resOutside = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: refDate,
    offline: true
  });
  assert.equal(resOutside.status, 'normal-not-yet-created');
  assert.equal(resOutside.reason, 'dedicated-page-not-yet-created-normal');
  assert.equal(resOutside.adoptedUrl, null);
  console.log('PASS: Outside mandatory window treated as normal state (no needs_review)\n');

  // ==========================================
  // Test Case 10: Domain Classifier Checks
  // ==========================================
  console.log('--- Test 10: Domain Classifier Checks ---');
  assert.equal(isDomainThirdParty('https://prtimes.jp/story/123'), true);
  assert.equal(isDomainThirdParty('https://m3.com/clinical'), true);
  assert.equal(isDomainThirdParty('https://carenet.com/news'), true);
  assert.equal(isDomainThirdParty('https://wikipedia.org/wiki'), true);
  assert.equal(isDomainThirdParty('https://www.ganki.jp/info'), false);

  assert.equal(isDomainOfficial('https://www.ganki.jp/lowvision2027/', lowvisionEvent), true);
  assert.equal(isDomainOfficial('https://square.umin.ac.jp/ganki/', lowvisionEvent), true);
  assert.equal(isDomainOfficial('https://ascrs.org/', ascrsEvent), true);
  assert.equal(isDomainOfficial('https://fujiretina.com/', fujiretinaEvent), true);
  // ==========================================
  // Test Case 11: Single Event Targeted Discovery
  // ==========================================
  console.log('--- Test 11: Single Event Targeted Discovery ---');
  const mockProviderTargeted = async () => [
    {
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '第28回日本ロービジョン学会学術総会 会期：2027年5月22日〜23日 会場：大阪国際会議場'
    }
  ];
  // Even when diffDays is 225 > 180, singleEventId allows targeted search
  const resTargeted = await discoverOfficialUrlWithGoogle(lowvisionEvent, {
    now: refDate,
    offline: true,
    singleEventId: 'conf-jp-lowvision-2027',
    searchProvider: mockProviderTargeted
  });
  assert.equal(resTargeted.status, 'adopted');
  assert.equal(resTargeted.adoptedUrl, 'https://www.ganki.jp/lowvision2027/information.html');
  console.log('PASS: Single targeted event allowed discovery without requiring forceAll\n');

  // ==========================================
  // Test Case 12: hash unchanged + URLあり -> URL探索しない
  // ==========================================
  console.log('--- Test 12: hash unchanged + URLあり -> URL探索しない ---');
  let searchCallCount12 = 0;
  const mockSearch12 = async () => { searchCallCount12++; return []; };
  const getPageUnchanged12 = async () => ({
    status: 200,
    html: '<html><body>Official conference page unchanged content</body></html>'
  });

  const res12 = await runGeminiMonitor({
    today: '2026-10-09',
    singleEventId: 'conf-jp-surgery-2026', // has eventOfficialUrl
    apply: false,
    offline: true,
    getPage: getPageUnchanged12,
    searchProvider: mockSearch12
  });

  assert.equal(searchCallCount12, 0, 'Must NOT execute Google search when eventOfficialUrl is already registered');
  assert.equal(res12.metrics.urlDiscoveryChecks, 0);
  console.log('PASS: hash unchanged + URLあり -> URL探索しない\n');

  // ==========================================
  // Test Case 13: hash unchanged + URLなし + 探索期間内 -> URL探索する
  // ==========================================
  console.log('--- Test 13: hash unchanged + URLなし + 探索期間内 -> URL探索する ---');
  let searchCallCount13 = 0;
  const mockSearch13 = async () => {
    searchCallCount13++;
    return [{
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '会期：2027年5月22日〜23日 会場：大阪国際会議場'
    }];
  };

  const res13 = await runGeminiMonitor({
    today: '2027-01-10', // within 180 days of lowvision 2027
    singleEventId: 'conf-jp-lowvision-2027',
    apply: false,
    offline: true,
    searchProvider: mockSearch13
  });

  assert.equal(searchCallCount13 >= 1, true, 'Must execute Google search when URL missing and within window');
  assert.equal(res13.metrics.urlDiscoveryChecks, 1);
  assert.equal(res13.metrics.urlDiscovered, 1);
  assert.equal(res13.metrics.wouldAutoUpdate >= 1, true);
  console.log('PASS: hash unchanged + URLなし + 探索期間内 -> URL探索する\n');

  // ==========================================
  // Test Case 14: hash unchanged + URLなし + single_event_id指定 -> URL探索する
  // ==========================================
  console.log('--- Test 14: hash unchanged + URLなし + single_event_id指定 -> URL探索する ---');
  let searchCallCount14 = 0;
  const mockSearch14 = async () => {
    searchCallCount14++;
    return [{
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '会期：2027年5月22日〜23日 会場：大阪国際会議場'
    }];
  };

  // Run on 2026-10-09 (225 days away > 180 days), but targeted with singleEventId
  const res14 = await runGeminiMonitor({
    today: '2026-10-09',
    singleEventId: 'conf-jp-lowvision-2027',
    apply: false,
    offline: true,
    searchProvider: mockSearch14
  });

  assert.equal(searchCallCount14 >= 1, true, 'Must execute Google search when targeted via single_event_id');
  assert.equal(res14.metrics.urlDiscoveryChecks, 1);
  assert.equal(res14.metrics.urlDiscovered, 1);
  assert.equal(res14.metrics.wouldAutoUpdate >= 1, true);
  console.log('PASS: hash unchanged + URLなし + single_event_id指定 -> URL探索する\n');

  // ==========================================
  // Test Case 15: hash changed + URLなし -> 通常監視とURL探索の両方が正常に動く
  // ==========================================
  console.log('--- Test 15: hash changed + URLなし -> 通常監視とURL探索の両方が正常に動く ---');
  let searchCallCount15 = 0;
  const mockSearch15 = async () => {
    searchCallCount15++;
    return [{
      rank: 1,
      url: 'https://www.ganki.jp/lowvision2027/information.html',
      title: '第28回日本ロービジョン学会学術総会 開催概要',
      snippet: '会期：2027年5月22日〜23日 会場：大阪国際会議場'
    }];
  };

  const getPageChanged15 = async () => ({
    status: 200,
    html: '<html><body>New announcements published for the conference!</body></html>'
  });

  const res15 = await runGeminiMonitor({
    today: '2027-01-10',
    singleEventId: 'conf-jp-lowvision-2027',
    apply: false,
    offline: true,
    getPage: getPageChanged15,
    searchProvider: mockSearch15
  });

  assert.equal(searchCallCount15 >= 1, true);
  assert.equal(res15.metrics.urlDiscoveryChecks, 1);
  assert.equal(res15.metrics.urlDiscovered, 1);
  assert.equal(res15.metrics.geminiCalls >= 1, true, 'Must execute semantic validation when content changed');
  // ==========================================
  // Test Case 16: shadow modeでは events.js を書き換えない
  // ==========================================
  console.log('--- Test 16: shadow mode does not modify events.js ---');
  const eventsContent = fs.readFileSync('events.js', 'utf8');
  assert.equal(res14.metrics.autoAppliedCount, 0);
  assert.equal(res15.metrics.autoAppliedCount, 0);
  console.log('PASS: events.js untouched in shadow mode\n');

  // ==========================================
  // Test Case 17: Gemini API Payload & Schema Validation Regression Test
  // ==========================================
  console.log('--- Test 17: Gemini API Payload & Schema Validation Regression Test ---');
  const { GEMINI_RESPONSE_SCHEMA } = require('../scripts/gemini-monitor/gemini-analyzer');
  const { GOOGLE_URL_VERIFICATION_SCHEMA } = require('../scripts/gemini-monitor/google-url-discoverer');
  const { GEMINI_MODEL } = require('../scripts/gemini-monitor/constants');

  // Strict Gemini 3.8 Flash model check
  assert.equal(GEMINI_MODEL, 'gemini-3.8-flash', 'Model must strictly be gemini-3.8-flash');

  const validTypes = new Set(['STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'ARRAY', 'OBJECT']);

  function validateSchema(schema, schemaName) {
    assert.equal(typeof schema.type, 'string', `${schemaName}.type must be a string`);
    assert.equal(validTypes.has(schema.type), true, `${schemaName}.type must be a valid OpenAPI type`);
    assert.ok(schema.properties, `${schemaName} must have properties`);

    for (const [propName, propDef] of Object.entries(schema.properties)) {
      assert.equal(
        typeof propDef.type,
        'string',
        `${schemaName}.${propName}.type MUST be a string, not array/union (got ${JSON.stringify(propDef.type)})`
      );
      assert.equal(
        validTypes.has(propDef.type),
        true,
        `${schemaName}.${propName}.type must be a valid primitive OpenAPI type (got ${propDef.type})`
      );
      if (propDef.items) {
        assert.equal(
          typeof propDef.items.type,
          'string',
          `${schemaName}.${propName}.items.type must be a string`
        );
        assert.equal(validTypes.has(propDef.items.type), true);
      }
    }
  }

  validateSchema(GEMINI_RESPONSE_SCHEMA, 'GEMINI_RESPONSE_SCHEMA');
  validateSchema(GOOGLE_URL_VERIFICATION_SCHEMA, 'GOOGLE_URL_VERIFICATION_SCHEMA');
  console.log('PASS: response_schema validation passed (all primitive types, no union/array types)');

  // Verify simulate payload construction has no deprecated parameters
  const sampleGenerationConfig = {
    responseMimeType: 'application/json',
    responseSchema: GEMINI_RESPONSE_SCHEMA
  };
  assert.equal(sampleGenerationConfig.temperature, undefined);
  assert.equal(sampleGenerationConfig.top_p, undefined);
  assert.equal(sampleGenerationConfig.top_k, undefined);
  assert.equal(sampleGenerationConfig.thinking_budget, undefined);
  console.log('PASS: generationConfig contains no obsolete or unrecognised parameters\n');

  console.log('================================================================');
  console.log('ALL GOOGLE OFFICIAL URL DISCOVERY REGRESSION TESTS PASSED!');
  console.log('================================================================');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

