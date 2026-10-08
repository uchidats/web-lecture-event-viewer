const { text, compact, blocks } = require('../auto-updater/extract');

/**
 * Extract concise structured facts from HTML so Gemini receives only relevant content.
 * Avoids passing entire multi-megabyte HTML documents.
 */
function extractMonitoringContext(html, currentEvent = {}) {
  if (!html) {
    return {
      title: '',
      headings: [],
      overviewPairs: [],
      datesText: '',
      venueText: '',
      abstractText: '',
      registrationText: '',
      nextMeetingNotice: '',
      detectedYears: [],
      detectedEditions: [],
      summaryPromptText: 'HTML content is empty.'
    };
  }

  // Strip scripts, styles, navigations, footers
  const cleanHtml = html
    .replace(/<(script|style|noscript|iframe|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 1. Page title
  const titleMatch = cleanHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? compact(text(titleMatch[1])) : '';

  // 2. Headings (h1 - h3)
  const headings = [...cleanHtml.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map(m => compact(text(m[1])))
    .filter(h => h.length > 0 && h.length < 300)
    .slice(0, 15);

  // 3. Key-value overview blocks (dl, table, etc.)
  const rawPairs = blocks(cleanHtml);
  const overviewPairs = [];
  let datesText = '';
  let venueText = '';
  let abstractText = '';
  let registrationText = '';
  let nextMeetingNotice = '';

  for (const [key, val] of rawPairs) {
    const k = compact(key);
    const v = compact(text(val));
    if (!k || !v) continue;

    if (/^(学会名|大会名|会議名|名称|会名|Title|Meeting)$/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 200) });
    } else if (/^(会期|日程|日時|開催期間|Dates?)$/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 200) });
      datesText += ` ${v}`;
    } else if (/^(会場|会場名|開催会場|開催地|開催都市|Venue|Location|City)$/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 200) });
      venueText += ` ${v}`;
    } else if (/^(主催|主催学会|主催団体|会長|Organizer|President)$/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 200) });
    } else if (/^(テーマ|大会テーマ|Theme)$/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 200) });
    } else if (/演題|Abstract/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 300) });
      abstractText += ` ${k}: ${v}`;
    } else if (/参加登録|Registration/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 300) });
      registrationText += ` ${k}: ${v}`;
    } else if (/次回|Next/i.test(k)) {
      overviewPairs.push({ label: k, value: v.slice(0, 300) });
      nextMeetingNotice += ` ${k}: ${v}`;
    }
  }

  // 4. Fallback search for abstract / registration / next meeting in text paragraphs if overview is empty
  const plainText = text(cleanHtml);
  if (!abstractText) {
    const abstractMatches = plainText.match(/(?:演題(?:募集|登録|締切)|Call for Abstracts)[^\n]{0,250}/gi);
    if (abstractMatches) abstractText = abstractMatches.slice(0, 3).join(' | ');
  }
  if (!registrationText) {
    const regMatches = plainText.match(/(?:参加登録|事前参加登録|Registration Period|Early bird)[^\n]{0,250}/gi);
    if (regMatches) registrationText = regMatches.slice(0, 3).join(' | ');
  }
  if (!nextMeetingNotice) {
    const nextMatches = plainText.match(/(?:次回開催|次期開催|次回学術集会|Next Annual Meeting)[^\n]{0,300}/gi);
    if (nextMatches) nextMeetingNotice = nextMatches.slice(0, 2).join(' | ');
  }

  // 5. Detect years and editions
  const detectedYears = [...new Set([...plainText.matchAll(/\b(202[0-9])年?\b/g)].map(m => Number(m[1])))].sort();
  const detectedEditions = [...new Set([...plainText.matchAll(/第\s*(\d+)\s*(?:回|(?=日本))|(\d+)(?:st|nd|rd|th)\b/gi)].map(m => Number(m[1] || m[2])))].sort((a,b)=>a-b);

  // 6. Build compact representation for prompt
  const lines = [];
  if (pageTitle) lines.push(`[Page Title]: ${pageTitle}`);
  if (headings.length) lines.push(`[Key Headings]: ${headings.join(' / ')}`);
  if (overviewPairs.length) {
    lines.push('[Overview Details]:');
    for (const p of overviewPairs.slice(0, 10)) {
      lines.push(`  - ${p.label}: ${p.value}`);
    }
  }
  if (datesText) lines.push(`[Dates Mentioned]: ${datesText.trim()}`);
  if (venueText) lines.push(`[Venue Mentioned]: ${venueText.trim()}`);
  if (abstractText) lines.push(`[Abstract Submission]: ${abstractText.trim()}`);
  if (registrationText) lines.push(`[Registration]: ${registrationText.trim()}`);
  if (nextMeetingNotice) lines.push(`[Next Meeting Notice]: ${nextMeetingNotice.trim()}`);
  if (detectedYears.length) lines.push(`[Years Detected in Page]: ${detectedYears.join(', ')}`);
  if (detectedEditions.length) lines.push(`[Editions Detected in Page]: ${detectedEditions.join(', ')}`);

  return {
    pageTitle,
    headings,
    overviewPairs,
    datesText: datesText.trim(),
    venueText: venueText.trim(),
    abstractText: abstractText.trim(),
    registrationText: registrationText.trim(),
    nextMeetingNotice: nextMeetingNotice.trim(),
    detectedYears,
    detectedEditions,
    summaryPromptText: lines.join('\n')
  };
}

module.exports = {
  extractMonitoringContext
};
