/**
 * Google Official Event URL Discoverer & Gemini 3.8 Flash Verifier
 * 
 * Rules:
 * - Major vs Standard Classification:
 *   - Major: 日本眼科学会, 日本臨床眼科学会, 日本眼科手術学会, 日本網膜硝子体学会, 日本緑内障学会,
 *            AAO, ASCRS, ARVO, EURETINA, ESCRS, APAO, APACRS, WGC, FujiRetina, etc.
 *   - Standard: All other subspecialty / allied conferences.
 * - Mandatory URL Discovery Window (when eventOfficialUrl is empty):
 *   - Major: within 365 days of start date (diffDays <= 365).
 *   - Standard: within 180 days of start date (diffDays <= 180).
 *   - Beyond window: absence of dedicated page is treated as NORMAL state ('dedicated-page-not-yet-created-normal');
 *     do NOT flag as needs_review.
 *   - Ended events (diffDays < 0): skip discovery entirely ('ended-skip').
 * - Search engine is strictly limited to Google (no HTML scraping; official API or legitimate means only).
 * - Query formation:
 *   - Primary: 第○回 + 正式学会名 + 開催年 (or 正式学会名 + 開催年 if no edition)
 *   - Supplementary: 正式学会名 + 開催年 + 開催都市
 *   - English / International: 英語名 + 開催年 (+ city)
 * - Candidate evaluation (up to 3 evaluated):
 *   - Rank #1 is evaluated first against 5 criteria:
 *     1. Dedicated official page for this specific conference edition?
 *     2. Conference year matches?
 *     3. Numbered edition matches?
 *     4. Official domain (society, conference, secretariat)?
 *     5. Not commercial blog, third-party summary, or news?
 *   - If verified with confidence >= 0.85, auto-adopt as eventOfficialUrl (safe_auto_update).
 *   - If rank #1 inappropriate, advance to rank #2, then rank #3. Max 3 evaluated total.
 * - Google #1 / Bot protection:
 *   - Cloudflare / 403 fetch failure does not immediately discard official candidate ('bot-protected-official-candidate').
 * - Failure / unfound:
 *   - If top 3 evaluated and none pass: record 'official_url_not_found'.
 */

const { GEMINI_MODEL, GEMINI_API_URL } = require('./constants');
const { compact } = require('../auto-updater/extract');

const normalize = str => compact(str || '').normalize('NFKC').toLowerCase();

const MAJOR_CONFERENCE_PATTERNS = [
  /日本眼科学会/i,
  /日本臨床眼科学会|臨眼/i,
  /日本眼科手術学会/i,
  /日本網膜硝子体学会/i,
  /日本緑内障学会/i,
  /日本角膜学会|角膜カンファランス/i,
  /日本白内障屈折矯正手術学会|\bJSCRS\b/i,
  /\bAAO\b|American Academy of Ophthalmology/i,
  /\bASCRS\b|American Society of Cataract and Refractive Surgery/i,
  /\bARVO\b/i,
  /\bEURETINA\b/i,
  /\bESCRS\b/i,
  /\bAPAO\b|Asia-Pacific Academy of Ophthalmology/i,
  /\bAPACRS\b/i,
  /\bWGC\b|World Glaucoma Congress/i,
  /\bWOC\b|World Ophthalmology Congress/i,
  /\bFujiRetina\b/i,
  /\bAPVRS\b/i
];

/**
 * Determine if an event belongs to major ophthalmic conferences.
 */
function isMajorConference(event) {
  if (!event) return false;
  if (event.conferenceTier === 'primary') return true;
  const targetText = `${event.title || ''} ${event.sponsor || ''} ${event.id || ''}`;
  for (const pattern of MAJOR_CONFERENCE_PATTERNS) {
    if (pattern.test(targetText)) return true;
  }
  return false;
}

/**
 * Determine mandatory discovery window status for an event.
 */
function getDiscoveryWindowStatus(event, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const eventDate = new Date(event.date || event.startDate);
  const isMajor = isMajorConference(event);
  const thresholdDays = isMajor ? 365 : 180;

  if (Number.isNaN(eventDate.getTime())) {
    return {
      isEnded: false,
      diffDays: 0,
      diffYears: 0,
      isMajor,
      thresholdDays,
      inMandatoryWindow: false,
      status: 'invalid-date',
      reason: 'invalid-date'
    };
  }

  // Use midnight-to-midnight comparison
  const nowDateNorm = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const eventDateNorm = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffTime = eventDateNorm.getTime() - nowDateNorm.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365.25;

  if (diffDays < 0) {
    return {
      isEnded: true,
      diffDays,
      diffYears,
      isMajor,
      thresholdDays,
      inMandatoryWindow: false,
      status: 'ended-skip',
      reason: 'event-already-ended'
    };
  }

  const inMandatoryWindow = diffDays <= thresholdDays;

  return {
    isEnded: false,
    diffDays,
    diffYears,
    isMajor,
    thresholdDays,
    inMandatoryWindow,
    status: inMandatoryWindow ? 'mandatory-discovery-window' : 'dedicated-page-not-yet-created-normal',
    reason: inMandatoryWindow ? 'within-mandatory-window' : 'dedicated-page-not-yet-created-normal'
  };
}

/**
 * Backward compatibility helper for horizon status.
 */
function getEventHorizonStatus(event, now = new Date()) {
  const status = getDiscoveryWindowStatus(event, now);
  let horizon = 'under_1y';
  if (status.diffYears >= 2) horizon = 'over_2y';
  else if (status.diffYears >= 1) horizon = '1y_to_2y';
  return {
    ...status,
    horizon
  };
}

const GOOGLE_URL_VERIFICATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isOfficialEventPage: {
      type: 'BOOLEAN',
      description: 'True if dedicated official page for this specific conference edition'
    },
    yearMatches: {
      type: 'BOOLEAN',
      description: 'True if conference year matches'
    },
    editionMatches: {
      type: 'BOOLEAN',
      description: 'True if conference numbered edition matches'
    },
    isOfficialDomain: {
      type: 'BOOLEAN',
      description: 'True if domain is official society, conference, or secretariat domain'
    },
    isThirdParty: {
      type: 'BOOLEAN',
      description: 'True if commercial blog, summary, or news aggregator'
    },
    confidence: {
      type: 'NUMBER',
      description: 'Confidence between 0.0 and 1.0'
    },
    reason: {
      type: 'STRING',
      description: 'Concise explanation of the verification decision'
    }
  },
  required: [
    'isOfficialEventPage',
    'yearMatches',
    'editionMatches',
    'isOfficialDomain',
    'isThirdParty',
    'confidence',
    'reason'
  ]
};

// Known official organizer / convention / academic portal domains in Japanese ophthalmology
const KNOWN_OFFICIAL_DOMAINS = [
  'ganki.jp',
  'umin.ac.jp',
  'umin.ne.jp',
  'congre.co.jp',
  'convention.co.jp',
  'n-practice.co.jp',
  'jtbcom.co.jp',
  'm-toyou.com',
  'intergroup.co.jp',
  'c-linkage.co.jp',
  'c-work.co.jp',
  'coac.co.jp'
];

// Known third party summary, PR, or commercial portal domains
const KNOWN_THIRD_PARTY_DOMAINS = [
  'prtimes.jp',
  'atpress.ne.jp',
  'm3.com',
  'carenet.com',
  'medical-tribune.co.jp',
  'nikkei.com',
  'wikipedia.org',
  'ameblo.jp',
  'note.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'peatix.com',
  'connpass.com'
];

/**
 * Build Google search queries for an event.
 */
function buildSearchQueries(event) {
  const year = Number((event.date || event.startDate || '').slice(0, 4)) || new Date().getFullYear();
  const rawTitle = event.title || '';

  const editionJpMatch = rawTitle.match(/第\s*(\d+)\s*回/);
  const editionEnMatch = rawTitle.match(/(\d+)(?:st|nd|rd|th)\b/i);
  const editionNumber = editionJpMatch ? Number(editionJpMatch[1]) : (editionEnMatch ? Number(editionEnMatch[1]) : null);
  const editionStr = editionJpMatch ? `第${editionNumber}回` : (editionEnMatch ? `${editionNumber}th` : '');

  const isEnglishOrInt = event.conferenceRegion === 'international' || /^[a-zA-Z0-9\s:()\-–—]+$/.test(rawTitle);

  let cleanTitle = rawTitle
    .replace(/20\d{2}/g, '')
    .replace(/第\s*\d+\s*回/g, '')
    .replace(/\([^)]*\)|（[^）]*）/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) {
    cleanTitle = event.sponsor || rawTitle;
  }

  let primaryQuery = '';
  if (editionStr && !isEnglishOrInt) {
    primaryQuery = `${editionStr} ${cleanTitle} ${year}`.trim();
  } else {
    primaryQuery = `${cleanTitle} ${year}`.trim();
  }

  const city = (event.cityCountry || '').split(/[/／,]/)[0].replace(/[（(].*?[）)]/g, '').trim();
  let secondaryQuery = null;
  if (city && !primaryQuery.includes(city)) {
    secondaryQuery = `${primaryQuery} ${city}`.trim();
  }

  return {
    primaryQuery,
    secondaryQuery,
    year,
    editionNumber,
    editionStr,
    cleanTitle,
    isEnglishOrInt
  };
}

/**
 * Check if a domain looks like an official domain.
 */
function isDomainOfficial(urlStr, event = {}) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (KNOWN_THIRD_PARTY_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      return false;
    }

    if (event.societyUrl) {
      try {
        const socHost = new URL(event.societyUrl).hostname.toLowerCase().replace(/^www\./, '');
        if (host === socHost || host.endsWith('.' + socHost)) return true;
      } catch {}
    }

    if (KNOWN_OFFICIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d))) {
      return true;
    }

    // Specific conference domain e.g. lowvision2027.jp, jscrs2027.org, fujiretina.com, ascrs.org
    if (/\.(jp|org|com|net|ac\.jp|ne\.jp)$/.test(host) && !/blog|news|media|portal|aggregate|summary/.test(host)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if domain is third party.
 */
function isDomainThirdParty(urlStr) {
  try {
    const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
    return KNOWN_THIRD_PARTY_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * Build the Gemini 3.8 Flash prompt for lightweight verification.
 */
function buildUrlVerificationPrompt(event, candidate, rank) {
  const year = (event.date || event.startDate || '').slice(0, 4);
  const botInfo = candidate.isBotProtected || candidate.pageFetchError
    ? `\n[NOTE: Direct HTTP fetch encountered bot protection / challenge (${candidate.pageFetchError || 'WAF'}). Rely on URL structure, domain, title, and search snippet for verification.]`
    : '';

  return `You are an expert conference metadata verifier for Japanese ophthalmology events (OphthalConf).
Evaluate this Google Search result candidate (Rank #${rank}) to determine if it should be adopted as the official conference URL.

CONFERENCE DETAILS:
- Title: ${event.title}
- Year: ${year}
- Dates: ${event.date} ~ ${event.endDate || event.date}
- Venue: ${event.venue || 'N/A'}
- City/Country: ${event.cityCountry || 'N/A'}
- Sponsor Society: ${event.sponsor || 'N/A'}
- Society URL: ${event.societyUrl || 'None'}

GOOGLE SEARCH RESULT CANDIDATE (Rank #${rank}):
- URL: ${candidate.url}
- Title: ${candidate.title || 'N/A'}
- Snippet: ${candidate.snippet || 'N/A'}
- Page Content Evidence: ${candidate.pageEvidence ? candidate.pageEvidence.slice(0, 1000) : 'None'}${botInfo}

VERIFICATION CRITERIA:
1. Is this the dedicated official page for THIS specific conference edition (not past year, not generic society top page)?
2. Does the conference year match (${year})?
3. Does the numbered edition match?
4. Is the domain an official society, official conference, or official organizer/secretariat (e.g. ganki.jp, umin.ac.jp, convention.co.jp)?
5. Is it free from third-party summary sites, blogs, and commercial PR/news articles?

Determine whether to adopt this candidate. Answer strictly using the JSON schema.`;
}

/**
 * Deterministic offline validator for testing or when GEMINI_API_KEY is not available.
 */
function verifyCandidateOffline(event, candidate) {
  const year = Number((event.date || event.startDate || '').slice(0, 4)) || new Date().getFullYear();
  const rawTitle = event.title || '';
  const editionMatch = rawTitle.match(/第\s*(\d+)\s*回/) || rawTitle.match(/(\d+)(?:st|nd|rd|th)\b/i);
  const editionNumber = editionMatch ? Number(editionMatch[1]) : null;

  const textCombined = normalize(`${candidate.url} ${candidate.title || ''} ${candidate.snippet || ''} ${candidate.pageEvidence || ''}`);

  const isThirdParty = isDomainThirdParty(candidate.url);
  const isOfficialDomain = isDomainOfficial(candidate.url, event);

  // Check year
  const yearMatches = textCombined.includes(String(year)) || candidate.url.includes(String(year));

  // Check edition
  const editionMatches = editionNumber
    ? (textCombined.includes(String(editionNumber)) || textCombined.includes(`第${editionNumber}回`))
    : true;

  // Bot-protected detection
  const isBotProtected = Boolean(
    candidate.isBotProtected ||
    candidate.pageFetchError ||
    (candidate.pageEvidence && /cloudflare|access denied|challenge|robot/i.test(candidate.pageEvidence))
  );

  // Check official page
  const notPastYear = !textCombined.includes(String(year - 1)) || textCombined.includes(String(year));
  const isOfficialPage = isOfficialDomain && !isThirdParty && yearMatches && editionMatches && notPastYear;

  let domainType = 'other';
  if (isThirdParty) {
    domainType = 'third_party_aggregator';
  } else if (isOfficialDomain) {
    if (KNOWN_OFFICIAL_DOMAINS.some(d => candidate.url.includes(d))) {
      domainType = 'official_organizer';
    } else if (event.societyUrl && candidate.url.includes(new URL(event.societyUrl).hostname.replace(/^www\./, ''))) {
      domainType = 'official_society';
    } else {
      domainType = 'official_conference';
    }
  }

  const confidence = (isOfficialPage && !isThirdParty && isOfficialDomain && yearMatches && editionMatches) ? 0.95 : 0.2;
  const recommended_action = (confidence >= 0.85) ? 'adopt_official_url' : 'reject_and_continue';
  const reason = (confidence >= 0.85)
    ? (isBotProtected
        ? `[bot-protected-official-candidate] Verified official conference page for ${year} on official domain despite fetch challenge.`
        : `Verified official conference page for ${year} on official domain.`)
    : `Candidate failed criteria (official: ${isOfficialPage}, domain: ${isOfficialDomain}, 3rdParty: ${isThirdParty}, year: ${yearMatches}).`;

  const isOfficial = Boolean(isOfficialPage);
  return {
    isOfficialEventPage: isOfficial,
    is_official_page: isOfficial,
    yearMatches,
    year_matches: yearMatches,
    editionMatches,
    edition_matches: editionMatches,
    isOfficialDomain,
    is_official_domain: isOfficialDomain,
    isThirdParty,
    is_third_party: isThirdParty,
    isBotProtected,
    is_bot_protected: isBotProtected,
    domain_type: domainType,
    confidence,
    recommended_action,
    reason
  };
}

/**
 * Normalize verification output from Gemini or offline fallback.
 */
function normalizeVerificationOutput(parsed) {
  const isOfficial = Boolean(parsed.isOfficialEventPage ?? parsed.is_official_page);
  const yearMatches = Boolean(parsed.yearMatches ?? parsed.year_matches);
  const editionMatches = Boolean(parsed.editionMatches ?? parsed.edition_matches);
  const isOfficialDomain = Boolean(parsed.isOfficialDomain ?? parsed.is_official_domain);
  const isThirdParty = Boolean(parsed.isThirdParty ?? parsed.is_third_party);
  const confidence = Number(parsed.confidence || 0);
  const reason = String(parsed.reason || '');

  return {
    isOfficialEventPage: isOfficial,
    is_official_page: isOfficial,
    yearMatches,
    year_matches: yearMatches,
    editionMatches,
    edition_matches: editionMatches,
    isOfficialDomain,
    is_official_domain: isOfficialDomain,
    isThirdParty,
    is_third_party: isThirdParty,
    confidence,
    reason,
    recommended_action: confidence >= 0.85 ? 'adopt_official_url' : 'reject_and_continue'
  };
}

/**
 * Verify a candidate using Gemini 3.8 Flash (or offline fallback).
 */
async function verifyCandidateWithGemini(event, candidate, rank, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || options.offline) {
    return verifyCandidateOffline(event, candidate);
  }

  const prompt = buildUrlVerificationPrompt(event, candidate, rank);
  const endpoint = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GOOGLE_URL_VERIFICATION_SCHEMA
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) throw new Error('Empty Gemini response');
    const parsed = JSON.parse(textOutput);
    return normalizeVerificationOutput(parsed);
  } catch {
    // Graceful deterministic fallback
    return verifyCandidateOffline(event, candidate);
  }
}

/**
 * Extract links from Gemini Google Search Grounding response.
 */
function extractLinksFromGrounding(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const results = [];
  for (const chunk of chunks) {
    if (chunk.web?.uri && !results.some(r => r.url === chunk.web.uri)) {
      results.push({
        rank: results.length + 1,
        url: chunk.web.uri,
        title: chunk.web.title || '',
        snippet: ''
      });
      if (results.length >= 3) break;
    }
  }

  // If groundingChunks was not populated directly, extract URLs mentioned in the text
  if (results.length === 0) {
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const linkMatches = [...textOutput.matchAll(/https?:\/\/[^\s)\]]+/g)];
    for (const m of linkMatches) {
      const cleanUrl = m[0].replace(/[.,;:]$/, '');
      if (!results.some(r => r.url === cleanUrl)) {
        results.push({
          rank: results.length + 1,
          url: cleanUrl,
          title: '',
          snippet: ''
        });
        if (results.length >= 3) break;
      }
    }
  }
  return results;
}

/**
 * Execute Google Search via legitimate official methods (Custom Search API or injected provider).
 * Never scrapes Google HTML.
 */
async function searchGoogle(query, options = {}) {
  if (typeof options.searchProvider === 'function') {
    return await options.searchProvider(query, options);
  }

  const apiKey = options.googleApiKey || process.env.GOOGLE_SEARCH_API_KEY;
  const cx = options.googleCx || process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID;

  if (apiKey && cx) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=3`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google Custom Search API HTTP ${res.status}`);
    }
    const data = await res.json();
    const items = data.items || [];
    return items.slice(0, 3).map((item, idx) => ({
      rank: idx + 1,
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      displayLink: item.displayLink
    }));
  }

  // If Gemini API with search grounding is available
  const geminiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey && !options.offline) {
    try {
      const endpoint = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `Search Google for: "${query}". Return the top organic search result links.` }]
          }],
          tools: [{ googleSearch: {} }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const results = extractLinksFromGrounding(data);
        if (results.length > 0) return results;
      }
    } catch {}
  }

  return [];
}

/**
 * Main URL discovery procedure adhering strictly to user requirements.
 */
async function discoverOfficialUrlWithGoogle(event, options = {}) {
  const windowStatus = getDiscoveryWindowStatus(event, options.now);

  // 1. Ended events: do not search
  if (windowStatus.isEnded) {
    return {
      status: 'skipped',
      windowStatus,
      reason: 'ended-skip',
      detail: `開催終了済みイベント（diffDays: ${windowStatus.diffDays}日）のため公式URL探索をスキップします。`,
      adoptedUrl: null
    };
  }

  // 2. Beyond mandatory window: normal state, do not force search or flag needs_review
  // (unless specifically targeted via options.forceSearch or options.singleEventId === event.id)
  const isTargeted = Boolean(options.forceSearch || (options.singleEventId && options.singleEventId === event.id));
  if (!windowStatus.inMandatoryWindow && !isTargeted) {
    return {
      status: 'normal-not-yet-created',
      windowStatus,
      reason: 'dedicated-page-not-yet-created-normal',
      detail: `${windowStatus.isMajor ? '主要学会(365日以内)' : '一般学会(180日以内)'}の探索必須期間前（開催まで${windowStatus.diffDays}日）のため、公式大会ページ未開設を正常状態として扱います。`,
      adoptedUrl: null
    };
  }

  // 3. Within mandatory window: execute Google search
  const { primaryQuery, secondaryQuery } = buildSearchQueries(event);
  const queries = [primaryQuery];
  if (secondaryQuery && secondaryQuery !== primaryQuery) {
    queries.push(secondaryQuery);
  }

  const evaluatedCandidates = [];

  for (const query of queries) {
    if (evaluatedCandidates.length >= 3) break;
    let searchResults = [];
    try {
      searchResults = await searchGoogle(query, options);
    } catch (err) {
      if (options.onRequest) options.onRequest({ query, error: err.message });
      continue;
    }

    if (!searchResults || !searchResults.length) continue;

    // Evaluate rank 1 first; if inappropriate, advance to rank 2, then rank 3 (max 3 total)
    for (const candidate of searchResults) {
      if (evaluatedCandidates.length >= 3) break;

      // Optional page content fetch
      if (options.getPage && !candidate.pageEvidence) {
        try {
          const doc = await options.getPage({ url: candidate.url, role: 'discovery-event' });
          if (doc?.html) {
            candidate.pageEvidence = doc.html.slice(0, 2000);
          } else if (doc?.error) {
            candidate.pageFetchError = doc.error;
          }
        } catch (fetchErr) {
          candidate.pageFetchError = fetchErr.message;
        }
      }

      const verification = await verifyCandidateWithGemini(event, candidate, candidate.rank, options);
      evaluatedCandidates.push({ candidate, verification });

      const meetsAllCriteria =
        verification.is_official_page &&
        verification.year_matches &&
        verification.edition_matches &&
        verification.is_official_domain &&
        !verification.is_third_party &&
        verification.confidence >= 0.85;

      if (meetsAllCriteria) {
        // High confidence match found! Auto-adopt as eventOfficialUrl.
        return {
          status: 'adopted',
          action: 'safe_auto_update',
          windowStatus,
          query,
          rank: candidate.rank,
          adoptedUrl: candidate.url,
          confidence: verification.confidence,
          isBotProtected: Boolean(verification.is_bot_protected || candidate.isBotProtected || candidate.pageFetchError),
          verification,
          reason: verification.reason,
          evaluatedCount: evaluatedCandidates.length
        };
      }
      // If rank #1 is inappropriate, the loop advances to rank #2, rank #3
    }
  }

  // If top 3 evaluated and no official URL found
  return {
    status: 'not-found',
    windowStatus,
    reason: 'official_url_not_found',
    detail: 'Google検索上位候補（最大3件）を検証しましたが、公式大会ページの要件を満たす高信頼候補はありませんでした。',
    adoptedUrl: null,
    evaluatedCount: evaluatedCandidates.length,
    evaluatedCandidates
  };
}

module.exports = {
  isMajorConference,
  getDiscoveryWindowStatus,
  getEventHorizonStatus,
  buildSearchQueries,
  searchGoogle,
  verifyCandidateWithGemini,
  verifyCandidateOffline,
  discoverOfficialUrlWithGoogle,
  GOOGLE_URL_VERIFICATION_SCHEMA,
  isDomainOfficial,
  isDomainThirdParty
};
