const crypto = require('node:crypto');
const { eventSourceUrl, isSocietyUrl } = require('./event-urls');

function text(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(?:div|p|li|tr|dd|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').normalize('NFKC')
    .split('\n').map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

function normalizeVenue(value) {
  return text(value).split('\n').filter(line => !/〒|\d{3}-\d{4}|(?:都|道|府|県).+市.+(?:丁目|番地|\d)|^https?:|^TEL/i.test(line))
    .join('、').replace(/\s+/g, ' ').trim();
}

function normalizeDate(value, inherited = {}) {
  const clean = text(value);
  const iso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/);
  const jp = clean.match(/^(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日/);
  const match = iso || jp;
  if (!match) return null;
  const year = Number(match[1] || inherited.year);
  const month = Number(match[2] || inherited.month);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (!year || !month || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const time = clean.match(/(?:\s|T)(\d{1,2}):(\d{2})/) || clean.match(/(\d{1,2})時(?:(\d{2})分)?/) || (clean.includes('正午') ? ['', '12', '00'] : null);
  if (time && !time[2]) time[2] = '00';
  if (time && (Number(time[1]) > 23 || Number(time[2]) > 59)) return null;
  return date + (time ? ` ${time[1].padStart(2, '0')}:${time[2]}` : '');
}

// Explicit start year is required for high confidence. Abbreviated end dates inherit it.
function dateRanges(value, sourceYear) {
  const clean = text(value).replace(/\([^)]*\)/g, '');
  const token = '(?:\\d{4}年)?(?:\\d{1,2}月)?\\d{1,2}日(?:\\s*(?:\\d{1,2}:\\d{2}|\\d{1,2}時(?:\\d{2}分)?|正午))?';
  const regex = new RegExp(`(${token})\\s*[~〜～－–—-]\\s*(${token})`, 'g');
  return [...clean.matchAll(regex)].map(m => {
    const explicit = /\d{4}年/.test(m[1]);
    const start = normalizeDate(m[1], { year: sourceYear });
    const end = normalizeDate(m[2], { year: Number(start?.slice(0, 4)), month: Number(start?.slice(5, 7)) });
    return { start, end, confidence: explicit ? 0.98 : 0.8, evidence: m[0] };
  });
}

function blocks(html) {
  const result = [];
  for (const m of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) result.push([text(m[1]), m[2]]);
  for (const m of html.matchAll(/<tr\b[^>]*>\s*<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) result.push([text(m[1]), m[2]]);
  const headings = [...html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const end = headings.slice(i + 1).find(next => Number(next[1]) <= Number(h[1]))?.index || html.length;
    result.push([text(h[2]), html.slice(h.index + h[0].length, end)]);
  }
  for (const m of html.matchAll(/<div\b[^>]*class=["'][^"']*meta-card-label[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*meta-card-val[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) result.push([text(m[1]), m[2]]);
  return result;
}

function compact(value) { return text(value).replace(/\s+/g, ''); }

function registrationPeriods(labeled, source) {
  const type = source.registrationType || (source.id.startsWith('conf-jp-') || /日本/.test(source.name) ? 'domestic' : 'international');
  const stage = type === 'domestic' ? /(事前参加登録|直前・当日登録|直前参加登録|当日登録|参加登録期間|参加登録受付期間)/ : /(Early\s*bird|Regular|Late|On[ -]?site)/i;
  const periods = [], evidence = [];
  for (const [label, html] of labeled) {
    if (/演題|ランチョン|セミナー|協賛|展示/.test(label)) continue;
    const content = text(html);
    const combined = stage.test(content) ? content : stage.test(label) ? label + '：' + content : '';
    const matches = [...combined.matchAll(new RegExp(stage.source, 'gi'))];
    const inputs = matches.map((match, i) => combined.slice(match.index, matches[i + 1]?.index ?? combined.length));
    for (const input of inputs) {
      const match = input.match(stage);
      if (!match) continue;
      const periodLabel = match[0];
      const dates = input.slice(match.index + periodLabel.length).replace(/^\s*[:：]\s*/, '');
      const ranges = dateRanges(dates, source.year);
      if (ranges.length) {
        for (const range of ranges) if (range.start && range.end) {
          periods.push({ label: periodLabel, start: range.start.replace(' ', 'T'), deadline: range.end.replace(' ', 'T') });
          evidence.push(input);
        }
      } else {
        // ISO and English month dates are common on international registration tables.
        const tokens = dates.replace(/\([^)]*\)/g, '').match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[ T]\d{1,2}:\d{2})?|(?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\s*(?:正午|\d{1,2}:\d{2}))?|(?:\d{1,2}\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:\d{1,2},?\s+)?\d{4}/gi) || [];
        const normalized = tokens.map(token => {
          const date = normalizeDate(token, { year: source.year });
          if (date) return date.replace(' ', 'T');
          const parsed = Date.parse(token + ' UTC');
          return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
        });
        if (normalized.length && normalized.every(Boolean)) {
          if (normalized.length > 2) {
            for (const deadline of normalized) periods.push({ label: periodLabel, deadline });
          } else periods.push({ label: periodLabel, ...(normalized.length > 1 ? { start: normalized[0] } : {}), deadline: normalized.at(-1) });
          evidence.push(input);
        }
      }
    }
  }
  const unique = [...new Map(periods.map(period => [JSON.stringify(period), period])).values()];
  return { value: { type, periods: unique }, evidence: evidence.join('\n') };
}

function extractOfficialHtml(document, source) {
  const { html, url, role } = document;
  const candidates = [], issues = [];
  const add = (field, value, confidence, method, evidence) => {
    if (value !== null && value !== undefined && value !== '') candidates.push({ field, value, confidence, method, url,
      evidence: text(evidence || String(value)).slice(0, 500),
      ...(field === 'venue' ? { sourceRole: role, venueEvidence: method === 'labeled-html' ? 'labeled-venue' : method === 'json-ld' ? 'event-location' : null } : {}) });
  };
  if (!/<(?:html|body|main|table|dl)\b/i.test(html)) return { candidates, issues: ['invalid-html'] };
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  if (role === 'society') {
    if (!source.societyIdentity?.length || !source.societyIdentity.every(token => compact(title).includes(compact(token)))) {
      return { candidates, issues: ['society-identity-missing'] };
    }
    add('societyUrl', url, 0.98, 'official-society-page', title);
    return { candidates, issues };
  }
  const identityMatched = source.identity.every(token => compact(title).includes(compact(token)));
  const eventUrl = (value, confidence, method, evidence) => {
    add('eventOfficialUrl', value, confidence, method, evidence);
    const candidate = candidates.at(-1);
    if (candidate?.field === 'eventOfficialUrl') Object.assign(candidate, {
      sourceRole: role, eventIdentityMatched: identityMatched,
      eventTitleYears: [...new Set([...text(title).matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map(match => Number(match[1])))],
      eventPageKind: isSocietyUrl(value, source) || isSocietyUrl(url, source) ? 'society' : 'event', eventYears: []
    });
  };
  // Identity must occur in the document title, not a footer or a list of other editions.
  if (!identityMatched) {
    if (role === 'overview') eventUrl(url, 0.99, 'pinned-event-url', title);
    return { candidates, issues: ['conference-identity-missing'] };
  }
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const labeled = blocks(clean);
  if (role === 'registration' || role === 'overview') {
    const registration = registrationPeriods(labeled, source);
    if (registration.value.periods.length) add('registration', registration.value, 0.96, 'labeled-html', registration.evidence);
    else if (role === 'registration') issues.push('registration-dates-unextractable');
  }
  if (role === 'overview') {
    const name = text(title).split(/[|｜丨]/).at(-1).trim();
    add('title', name, 0.96, 'official-title', title);
    eventUrl(eventSourceUrl(source), 0.99, 'pinned-event-url', title);
    for (const match of clean.matchAll(/<(?:link|meta)\b[^>]*>/gi)) {
      const tag = match[0];
      if (!/\brel\s*=\s*["']canonical["']|\bproperty\s*=\s*["']og:url["']/i.test(tag)) continue;
      const target = tag.match(/\b(?:href|content)\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!target) continue;
      try { eventUrl(new URL(target.replace(/&amp;/g, '&'), url).href, 0.98, 'official-canonical-url', title); }
      catch { issues.push('invalid-event-canonical-url'); }
    }
    for (const match of clean.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      let target;
      try { target = new URL(match[1].replace(/&amp;/g, '&'), url).href; } catch { continue; }
      if (source.societyUrl && target === new URL(source.societyUrl).href &&
          source.societyIdentity?.every(token => compact(match[2]).includes(compact(token)))) {
        add('societyUrl', target, 0.99, 'pinned-society-url', text(match[2]));
      }
    }
    for (const [label, value] of labeled) {
      if (/^(会\s*期|日\s*時|開催期間)(?:\s*\/.*)?$/.test(label)) {
        const ranges = dateRanges(value, source.year);
        if (!ranges.length) issues.push('conference-dates-unextractable');
        for (const range of ranges) {
          if (!range.start || !range.end) { issues.push('invalid-date'); continue; }
          add('date', range.start.slice(0, 10), range.confidence, 'labeled-html', range.evidence);
          add('endDate', range.end.slice(0, 10), range.confidence, 'labeled-html', range.evidence);
        }
      }
      if (/^会\s*場(?:\s*\/.*)?$/.test(label)) {
        const venue = normalizeVenue(value);
        add('venue', venue, 0.97, 'labeled-html', value);
        // Only the venue section is used; secretariat addresses are never a venue city.
        const cities = [...text(value).matchAll(/(?:東京都|北海道|京都府|大阪府|.{2,3}県)([^\s\d〒、]+?市)/g)].map(m => m[1]);
        for (const city of new Set(cities)) add('city', city, 0.96, 'venue-address', value);
        if (cities.length) add('country', '日本', 0.96, 'venue-address', value);
      }
      if (/^(都市|開催都市|City)$/i.test(label)) add('city', text(value), 0.98, 'labeled-html', value);
      if (/^(国|開催国|Country)$/i.test(label)) add('country', text(value), 0.98, 'labeled-html', value);
    }
    if (!candidates.some(c => c.field === 'venue')) issues.push('venue-unextractable');
    if (!candidates.some(c => c.field === 'date')) issues.push('conference-dates-unextractable');
  } else if (role === 'abstract') {
    const periods = labeled.filter(([label]) => /(?:演題|登録|募集).*(?:募集期間|登録期間|受付期間)|^演題募集期間$/.test(label));
    for (const [, value] of periods) {
      for (const range of dateRanges(value, source.year)) {
        if (!range.start || !range.end) { issues.push('invalid-date'); continue; }
        add('abstractSubmission.startDate', range.start, range.confidence, 'labeled-html', range.evidence);
        add('abstractSubmission.deadline', range.end, range.confidence, 'labeled-html', range.evidence);
      }
      if (/終了しました|締め切りました|受付終了|募集終了/.test(text(value))) add('abstractSubmission.status', 'closed', 0.98, 'labeled-html', value);
    }
    if (!candidates.some(c => c.field === 'abstractSubmission.deadline')) issues.push('abstract-dates-unextractable');
    for (const [label, value] of labeled) {
      if (/^(演題募集開始日|演題登録開始日|演題締切日|演題登録締切|演題登録締切日)$/.test(label)) {
        const date = normalizeDate(text(value), { year: source.year });
        if (!date) issues.push('invalid-date');
        add(label.includes('開始') ? 'abstractSubmission.startDate' : 'abstractSubmission.deadline', date,
          /^\d{4}/.test(text(value)) ? 0.98 : 0.8, 'labeled-html', value);
      }
    }
    // The official call-for-abstracts page is a safe entry URL, without following registration vendor links.
    if (/演題募集|一般演題登録/.test(title)) add('abstractSubmission.url', url, 0.98, 'official-abstract-page', title);
  }

  // Adapter extension point: structured Event data, scoped by edition identity.
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(script[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for (const event of nodes.filter(n => [n['@type']].flat().includes('Event'))) {
        if (!source.identity.every(token => compact(event.name || '').includes(compact(token)))) continue;
        add('title', event.name, 0.99, 'json-ld', event.name);
        for (const [field, raw] of [['date', event.startDate], ['endDate', event.endDate]]) {
          if (!raw) continue;
          const date = normalizeDate(raw);
          if (!date) issues.push('invalid-date');
          add(field, date?.slice(0, 10), 0.99, 'json-ld', raw);
        }
        add('venue', event.location?.name, 0.99, 'json-ld', event.location?.name);
        add('city', event.location?.address?.addressLocality, 0.99, 'json-ld');
        const country = event.location?.address?.addressCountry;
        add('country', typeof country === 'object' ? country.name : country, 0.99, 'json-ld');
        if (event.url) eventUrl(event.url, 0.99, 'json-ld', event.name);
        if (event.organizer?.url && source.societyIdentity?.every(token => compact(event.organizer.name || '').includes(compact(token)))) {
          add('societyUrl', event.organizer.url, 0.99, 'json-ld', event.organizer.name);
        }
      }
    } catch { issues.push('invalid-json-ld'); }
  }
  const years = [...new Set(candidates.filter(c => c.field === 'date' && c.confidence >= 0.95).map(c => Number(c.value.slice(0, 4))))];
  for (const candidate of candidates.filter(c => c.field === 'eventOfficialUrl')) candidate.eventYears = years;
  return { candidates, issues: [...new Set(issues)], fingerprint: document.fingerprint || crypto.createHash('sha256').update(html).digest('hex') };
}

const adapters = { 'official-html': extractOfficialHtml };
module.exports = { text, compact, blocks, normalizeVenue, normalizeDate, dateRanges, registrationPeriods, extractOfficialHtml, adapters };
