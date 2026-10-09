const { fetchOfficialPage } = require('./fetch');
const { text, compact } = require('./extract');

const normalize = value => compact(value).normalize('NFKC').toLowerCase();
function identity(event) {
  const year = Number(event.date?.slice(0, 4));
  const editions = [...event.title.matchAll(/第\s*(\d+)\s*回|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2]));
  const name = event.title.replace(/第\s*\d+\s*回/g, '').replace(/\b\d+(?:st|nd|rd|th)\b/gi, '')
    .replace(/20\d{2}/g, '').replace(/\([^)]*\)|（[^）]*）/g, '').trim();
  // Annual meetings without numbered editions use their annual year as edition identity.
  return { year, editions, name, annual: !editions.length && /Annual Meeting|FujiRetina/i.test(event.title) };
}
function cleanHtmlForEvidence(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}
function cleanHtmlForLinks(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}
function cleanHtml(html) {
  return cleanHtmlForEvidence(html);
}
function publicUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      !/^(localhost|127\.|\[|10\.|192\.168\.|169\.254\.)/i.test(u.hostname) ? u.href : null;
  } catch { return null; }
}
function key(value) { const u = new URL(value); u.hash = ''; u.search = ''; u.pathname = u.pathname.replace(/index\.html?$/i, '').replace(/\/$/, '') || '/'; return u.href; }
function checkIdentity(evidence, expected) {
  const input = normalize(evidence);
  const years = [...new Set([...evidence.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map(m => Number(m[1])))];
  const editions = [...evidence.matchAll(/第\s*(\d+)\s*回|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2]));
  const nameMatches = input.includes(normalize(expected.name));
  const yearMatches = years.length === 1 && years[0] === expected.year;
  const editionMatches = expected.editions.length ? expected.editions.every(n => editions.includes(n)) : expected.annual && yearMatches;
  return { nameMatches, yearMatches, editionMatches, years, editions };
}
function pageEvidence(html) {
  const clean = cleanHtmlForEvidence(html);
  const title = text(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const headings = [...clean.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)].map(m => text(m[1]));
  // Ignore news dates, copyright and earlier meetings: use headings and labeled meeting dates.
  const dates = [...clean.matchAll(/(?:会\s*期|開催期間|Date(?:s)?\s*:)[\s\S]{0,240}/gi)].map(m => text(m[0]));
  const imageDates = [...clean.matchAll(/<img\b[^>]*\balt=["']([^"']+)["'][^>]*>/gi)]
    .map(m => m[1]).filter(alt => /20\d{2}.*(?:年|Date|[A-Z][a-z]+)|(?:Date|会期).*20\d{2}/.test(alt));
  return [title, ...headings, ...dates, ...imageDates].join(' ');
}
function links(html, base, expected, limit) {
  const clean = cleanHtmlForLinks(html), result = [];
  for (const m of clean.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url; try { url = publicUrl(new URL(m[1].replace(/&amp;/g, '&'), base).href); } catch { continue; }
    if (!url || /\.(pdf|png|jpe?g|gif|zip)(?:$|\?)/i.test(url)) continue;
    const label = text(m[2]) + ' ' + [...m[2].matchAll(/\balt=["']([^"']+)["']/gi)].map(x => x[1]).join(' ');
    // Context is only a lead for fetching. It cannot establish a match on the target page.
    const before = clean.slice(0, m.index);
    const rowStart = before.toLowerCase().lastIndexOf('<tr');
    const rowEnd = clean.toLowerCase().indexOf('</tr>', m.index);
    const inRow = rowStart >= 0 && before.toLowerCase().lastIndexOf('</tr>') < rowStart && rowEnd >= 0;
    const context = text(inRow ? clean.slice(rowStart, rowEnd + 5) : clean.slice(Math.max(0, m.index - 400), m.index + m[0].length + 100));
    const relevantName = normalize(label + ' ' + context).includes(normalize(expected.name));
    // An adjacent meeting in a list must not become a candidate for this card.
    const namedOtherMeeting = /学会|Congress|Annual Meeting|Society/i.test(label) && !normalize(label).includes(normalize(expected.name));
    const relevantEdition = expected.editions.some(n => new RegExp(`第\\s*${n}\\s*回|\\b${n}(?:st|nd|rd|th)\\b`, 'i').test(label));
    if (!namedOtherMeeting && relevantName && (url.includes(String(expected.year)) || context.includes(String(expected.year)) || relevantEdition)) result.push({ url, label, context });
  }
  return [...new Map(result.map(r => [key(r.url), r])).values()].slice(0, limit);
}

function alternativeEvidence(evidence, expected, entry, event) {
  let matchedText = evidence;
  for (const alias of entry?.nameAliases || []) matchedText = matchedText.replaceAll(alias, expected.name);
  const checks = checkIdentity(matchedText, expected);
  const city = event.cityCountry?.split(/[/／]/)[0].replace(/[（(].*?[）)]/g, '').trim() || null;
  checks.city = city;
  const baseCity = city && city.length > 2 ? city.replace(/[都道府県市町村]$/, '') : city;
  const cityNames = [city, baseCity, ...(entry?.cityAliases || [])].filter(Boolean);
  checks.cityMatches = city ? cityNames.some(name => normalize(evidence).includes(normalize(name))) : null;
  return checks;
}
function officialDomain(url, entry, event) {
  const roots = [...(entry?.officialSocietyDomains || [])];
  if (event.societyUrl) try { roots.push(new URL(event.societyUrl).hostname.replace(/^www\./, '')); } catch {}
  for (const idx of entry?.indexUrls || []) try { roots.push(new URL(idx).hostname.replace(/^www\./, '')); } catch {}
  const host = new URL(url).hostname.replace(/^www\./, '');
  return roots.some(root => host === root || host.endsWith('.' + root));
}

const ORGANIZER_PATTERNS = [
  {
    domain: 'www.ganki.jp',
    societySlugs: [
      { slug: 'lowvision', keywords: ['ロービジョン', 'jslrr'] },
      { slug: 'jips', keywords: ['視野画像', 'jips', 'perimetry'] },
      { slug: 'myopia', keywords: ['近視', 'myopia'] },
      { slug: 'jsoo', keywords: ['眼腫瘍', 'jsoo', 'oncology'] },
      { slug: 'jsop', keywords: ['眼薬理', 'jsop', 'pharmacology'] },
      { slug: 'cornea', keywords: ['角膜カンファ', '角膜'] }
    ]
  }
];

function generateOrganizerCandidates(event, expected, knownUrls = []) {
  const generated = [];
  const year = expected.year;
  if (!year) return generated;
  for (const org of ORGANIZER_PATTERNS) {
    const matchedSlugs = new Set();
    const titleNorm = normalize(event.title);
    const catNorm = normalize(event.conferenceCategory || '');
    const tagsNorm = (event.tags || []).map(t => normalize(t)).join(' ');
    for (const item of org.societySlugs) {
      if (item.keywords.some(k => titleNorm.includes(normalize(k)) || catNorm.includes(normalize(k)) || tagsNorm.includes(normalize(k)))) {
        matchedSlugs.add(item.slug);
      }
    }
    for (const u of knownUrls) {
      try {
        const parsed = new URL(u);
        if (parsed.hostname === org.domain) {
          const m = parsed.pathname.match(/^\/([a-z0-9_-]+)(?:20\d{2})?\/?$/i);
          if (m) {
            const cleanSlug = m[1].replace(/20\d{2}$/, '');
            matchedSlugs.add(cleanSlug);
          }
        }
      } catch {}
    }
    for (const slug of matchedSlugs) {
      generated.push({
        url: `https://${org.domain}/${slug}${year}/information.html`,
        pattern: 'organizer-pattern-information'
      });
      generated.push({
        url: `https://${org.domain}/${slug}${year}/`,
        pattern: 'organizer-pattern-root'
      });
    }
  }
  return generated;
}
async function discoverMissingEventUrls({ events, config, getPage = fetchOfficialPage, checkedAt = new Date().toISOString() }) {
  const settings = config.discovery;
  const review = [], records = [], cache = new Map();
  if (!settings?.enabled) return { review, records, enabled: false };
  const eventHosts = new Set(settings.allowedEventHosts || []);
  for (const source of config.sources) for (const host of source.allowedHosts) eventHosts.add(host);
  const fetchPage = async (url, role, allowedHosts) => {
    const cacheKey = JSON.stringify([url, allowedHosts.toSorted()]);
    if (!cache.has(cacheKey)) cache.set(cacheKey, (async () => {
      const requests = [];
      try {
        const document = await getPage({ url, role }, { allowedHosts }, { ...config.defaults,
          onRequest: request => requests.push(request) });
        if (!requests.length) requests.push({ url, httpStatus: document.httpStatus ?? null });
        return { document, requests };
      } catch (error) {
        if (!requests.length) requests.push({ url, httpStatus: error.httpStatus ?? null, error: error.message });
        return { error: error.message, requests, failure: { error: error.message,
          httpStatus: error.httpStatus ?? requests.at(-1)?.httpStatus ?? null,
          botProtected: error.botProtected === true,
          state: error.fetchState || (/http-(404|410)/.test(error.message) ? 'not-found-response' : /http-403/.test(error.message) ? 'access-denied' : 'fetch-failed') } };
      }
    })());
    return cache.get(cacheKey);
  };
  for (const event of events.filter(e => e.isConference && ['国内学会', '海外学会'].includes(e.eventType) && !e.eventOfficialUrl)) {
    const expected = identity(event);
    const entry = settings.entries.find(e => e.eventId === event.id);
    const indexUrls = entry?.indexUrls || (event.societyUrl ? [event.societyUrl] : []);
    const record = { eventId: event.id, expected, searchQueries: [
      `${expected.name} ${expected.year} ${expected.editions.map(n => `第${n}回`).join(' ')} 公式`,
      `${expected.name} 学術集会案内 Annual Meeting Congress`
    ], searchMethod: 'official-index-links', indexUrls, requests: [], candidates: [], reason: null };
    records.push(record);
    if (entry?.integrityReview) {
      record.reason = 'discovery-card-integrity-needs-review';
      review.push({ eventId: event.id, field: null, oldValue: null, value: null, confidence: 0,
        method: 'official-index-discovery', url: indexUrls[0] || null, evidence: entry.integrityReview,
        reason: record.reason, searchQueries: record.searchQueries });
      continue;
    }
    if (!indexUrls.length) { record.reason = 'discovery-no-index-source'; continue; }
    const leads = new Map(), indexQueue = [...indexUrls], visitedIndexes = new Set();
    const alternatives = new Map();
    const remember = (candidateUrl, evidence, url, sourceKind) => {
      if (!publicUrl(candidateUrl)) return;
      const checks = alternativeEvidence(evidence, expected, entry, event);
      const values = alternatives.get(key(candidateUrl)) || [];
      values.push({ url, evidence, sourceKind, checks }); alternatives.set(key(candidateUrl), values);
      leads.set(key(candidateUrl), { url: candidateUrl, indexUrl: url, context: evidence });
    };
    for (const saved of entry?.verifiedEvidence || []) {
      const age = (Date.parse(checkedAt) - Date.parse(saved.checkedOn)) / 86400000;
      if (age >= 0 && age <= 30 && indexUrls.includes(saved.url) && entry.candidateUrls?.includes(saved.candidateUrl))
        remember(saved.candidateUrl, saved.evidence, saved.url, 'verified-material-snapshot');
    }
    for (let i = 0; i < indexQueue.length && visitedIndexes.size < (settings.maxIndexPagesPerEvent || 3); i++) {
      const raw = indexQueue[i];
      const url = publicUrl(raw);
      if (!url || visitedIndexes.has(key(url))) continue;
      visitedIndexes.add(key(url));
      const result = await fetchPage(url, 'discovery-index', [new URL(url).hostname]);
      record.requests.push(...result.requests);
      if (result.error) {
        review.push({ eventId: event.id, field: null, oldValue: null, value: null, url,
          confidence: 0, reason: 'discovery-fetch-failed', error: result.error, evidence: '公式学会一覧の取得失敗。URL不存在とは判定しません。' });
        continue;
      }
      for (const lead of links(result.document.html, result.document.url, expected, settings.maxLinksPerIndex)) {
        if (key(lead.url) !== key(url)) leads.set(key(lead.url), { ...lead, indexUrl: url });
        if (key(lead.url) !== key(url)) remember(lead.url, lead.context, url, 'official-list-link');
      }
      // A registered official document may link to the meeting home before its dated heading.
      for (const candidateUrl of entry?.candidateUrls || []) {
        const linked = [...result.document.html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].some(m => {
          try { return key(new URL(m[1].replace(/&amp;/g, '&'), result.document.url).href) === key(candidateUrl); } catch { return false; }
        });
        if (linked) remember(candidateUrl, pageEvidence(result.document.html), result.document.url, 'official-document-link');
      }
      // Follow the society's meeting-index navigation, within the same host only.
      for (const m of cleanHtmlForLinks(result.document.html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        if (!/学術集会|総会案内|学術総会|Annual Meetings?|Congresses|Future Meetings/i.test(text(m[2]))) continue;
        let next; try { next = publicUrl(new URL(m[1].replace(/&amp;/g, '&'), result.document.url).href); } catch { continue; }
        if (next && new URL(next).hostname === new URL(url).hostname && !visitedIndexes.has(key(next)) &&
            !indexQueue.includes(next)) indexQueue.push(next);
      }
    }

    // Generate organizer pattern candidates (e.g. ganki.jp)
    const discoveredUrls = [...leads.values()].map(l => l.url);
    const hasOrganizerIndex = indexUrls.some(u => ORGANIZER_PATTERNS.some(p => u.includes(p.domain)));
    if (hasOrganizerIndex) {
      const generated = generateOrganizerCandidates(event, expected, discoveredUrls);
      for (const gen of generated) {
        const matchingLead = [...leads.values()].find(l => {
          try { return new URL(l.url).hostname === new URL(gen.url).hostname; } catch { return false; }
        });
        const parentContext = matchingLead ? matchingLead.context : `公式運営ドメインパターン: ${expected.name} ${expected.year}`;
        remember(gen.url, parentContext, matchingLead?.indexUrl || indexUrls[0], 'organizer-pattern');
      }
    }

    record.indexLimitReached = indexQueue.some(url => !visitedIndexes.has(key(url)));
    let pageCount = 0;
    // Prefer information.html candidates first
    const sortedLeads = [...leads.values()].sort((a, b) => {
      const aInfo = /\/information\.html$/i.test(a.url);
      const bInfo = /\/information\.html$/i.test(b.url);
      return (bInfo ? 1 : 0) - (aInfo ? 1 : 0);
    });

    for (const lead of sortedLeads) {
      const candidate = { url: lead.url, indexUrl: lead.indexUrl, evidence: lead.context, reason: null, checks: null };
      record.candidates.push(candidate);
      if (pageCount >= settings.maxPagesPerEvent) { candidate.reason = 'discovery-search-limit'; continue; }
      if (!eventHosts.has(new URL(lead.url).hostname)) {
        candidate.reason = 'untrusted-domain';
      } else {
        pageCount++;
        const result = await fetchPage(lead.url, 'discovery-event', [...eventHosts]);
        record.requests.push(...result.requests);
        if (result.error) {
          candidate.reason = result.failure.state === 'not-found-response' ? 'discovery-url-not-found-response' : 'discovery-fetch-failed';
          candidate.error = result.error;
          candidate.fetchFailure = result.failure;
          candidate.officialEvidence = alternatives.get(key(lead.url)) || [];
          const evidence = candidate.officialEvidence.find(e => e.checks.nameMatches && e.checks.yearMatches && e.checks.editionMatches);
          const conflict = candidate.officialEvidence.find(e => e.sourceKind !== 'verified-material-snapshot' &&
            (e.checks.years.some(y => y !== expected.year) || e.checks.editions.length && !e.checks.editionMatches || !e.checks.nameMatches));
          const urlYears = [...new URL(lead.url).pathname.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map(m => Number(m[1]));
          if (result.failure.state !== 'not-found-response' && result.failure.error !== 'untrusted-domain' &&
              officialDomain(lead.url, entry, event) && evidence && !conflict && !urlYears.some(y => y !== expected.year)) {
            candidate.reason = 'bot-protected-official-candidate';
            candidate.checks = { ...evidence.checks, officialSocietyDomain: true, targetBodyVerified: false };
            candidate.evidence = evidence.evidence;
          }
          if (conflict) { candidate.checks = conflict.checks; candidate.reason = conflict.checks.years.some(y => y !== expected.year) ?
            'event-url-year-mismatch' : !conflict.checks.nameMatches ? 'discovery-name-mismatch' : 'event-url-edition-mismatch'; }
        }
        else {
          candidate.url = result.document.url;
          candidate.evidence = pageEvidence(result.document.html);
          candidate.checks = checkIdentity(candidate.evidence, expected);
          // A homepage with image-only dates can be corroborated by its own overview.
          if (candidate.checks.nameMatches && !candidate.checks.yearMatches && !candidate.checks.years.length) {
            for (const link of cleanHtmlForLinks(result.document.html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
              if (pageCount >= settings.maxPagesPerEvent) break;
              if (!/開催概要|学会概要|Overview|General Information|About.*Meeting|information\.html/i.test(text(link[2]) + ' ' + link[1])) continue;
              let overview; try { overview = publicUrl(new URL(link[1].replace(/&amp;/g, '&'), candidate.url).href); } catch { continue; }
              if (!overview || new URL(overview).hostname !== new URL(candidate.url).hostname) continue;
              pageCount++;
              const child = await fetchPage(overview, 'discovery-event', [...eventHosts]);
              record.requests.push(...child.requests);
              if (child.error) continue;
              const evidence = pageEvidence(child.document.html), checks = checkIdentity(evidence, expected);
              if (!checks.nameMatches) continue;
              candidate.evidence = evidence;
              candidate.checks = checks;
              candidate.corroboratingUrl = child.document.url;
              break;
            }
          }
          const checks = candidate.checks;
          const target = new URL(candidate.url);
          checks.urlYears = [...(target.hostname + target.pathname).matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map(m => Number(m[1]));
          const societyHome = indexUrls.some(u => key(u) === key(candidate.url) ||
            (new URL(u).hostname === new URL(candidate.url).hostname && new URL(candidate.url).pathname === '/')) ||
            (event.societyUrl && key(event.societyUrl) === key(candidate.url));
          candidate.reason = societyHome ? 'event-url-is-society-homepage' :
            !checks.nameMatches ? 'discovery-name-mismatch' :
            checks.urlYears.some(year => year !== expected.year) || checks.years.length && !checks.yearMatches ? 'event-url-year-mismatch' :
            checks.editions.length && !checks.editionMatches ? 'event-url-edition-mismatch' :
            !checks.yearMatches || !checks.editionMatches ? 'event-url-edition-unverified' : 'discovery-single-high-confidence';
        }
      }
    }
    // Deduplicate / coalesce candidates belonging to the same subsite
    let candidateList = [...new Map(record.candidates.map(c => [key(c.url), c])).values()];
    const verifiedInformationCandidates = candidateList.filter(c =>
      (c.reason === 'discovery-single-high-confidence' || c.reason === 'bot-protected-official-candidate') && /\/information\.html$/i.test(c.url)
    );
    if (verifiedInformationCandidates.length === 1) {
      const winner = verifiedInformationCandidates[0];
      const winnerBaseDir = new URL(winner.url).pathname.replace(/\/information\.html$/i, '');
      candidateList = candidateList.filter(c => {
        if (key(c.url) === key(winner.url)) return true;
        const cPath = new URL(c.url).pathname.replace(/\/$/, '');
        if (new URL(c.url).hostname === new URL(winner.url).hostname && cPath === winnerBaseDir) return false;
        return true;
      });
    }

    const multiple = candidateList.length > 1;
    for (const candidate of candidateList) {
      const isWinner = !multiple && (candidate.reason === 'discovery-single-high-confidence' ||
        (candidate.reason === 'bot-protected-official-candidate' && candidate.checks?.cityMatches !== false));
      const reason = multiple ? 'multiple-candidates' :
        (!isWinner && record.indexLimitReached) ? 'discovery-search-limit' : candidate.reason;
      // Mismatches/failed fetches are inspection-only. Never offer a URL-only approval.
      const valid = !multiple && (reason === 'discovery-single-high-confidence' ||
        reason === 'bot-protected-official-candidate' && candidate.checks.cityMatches !== false);
      review.push({ eventId: event.id, field: valid ? 'eventOfficialUrl' : null,
        value: valid ? candidate.url : null, oldValue: null, candidateUrl: candidate.url,
        confidence: valid ? reason === 'bot-protected-official-candidate' ? 0.9 : 0.98 : 0, method: 'official-index-discovery', url: candidate.indexUrl,
        evidence: candidate.evidence.slice(0, 1000), reason, candidateReason: candidate.reason,
        checks: candidate.checks, fetchFailure: candidate.fetchFailure, officialEvidence: candidate.officialEvidence,
        requiresHumanApproval: true, reviewSnapshot: Object.fromEntries(['title', 'date', 'endDate', 'venue', 'cityCountry'].map(k => [k, event[k] ?? null])),
        searchQueries: record.searchQueries });
    }
    const singleWinner = !multiple && candidateList[0] &&
      (candidateList[0].reason === 'discovery-single-high-confidence' || candidateList[0].reason === 'bot-protected-official-candidate');
    record.reason = multiple ? 'multiple-candidates' :
      singleWinner ? candidateList[0].reason :
      record.indexLimitReached ? 'discovery-search-limit' : candidateList[0]?.reason ||
      (record.requests.some(r => r.error || r.httpStatus >= 400) ? 'discovery-fetch-failed' : 'discovery-dedicated-url-not-found');
  }
  return { enabled: true, review, records };
}

module.exports = { discoverMissingEventUrls, identity, checkIdentity, links, pageEvidence };
