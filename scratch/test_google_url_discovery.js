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
const { loadEvents } = require('../scripts/auto-updater/storage');

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
  console.log('PASS: Domain classifier checks passed\n');

  console.log('================================================================');
  console.log('ALL 10 GOOGLE OFFICIAL URL DISCOVERY REGRESSION TESTS PASSED!');
  console.log('================================================================');
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
