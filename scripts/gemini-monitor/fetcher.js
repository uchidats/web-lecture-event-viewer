const crypto = require('node:crypto');
const { fetchOfficialPage } = require('../auto-updater/fetch');

/**
 * Compute SHA-256 hash of a string.
 */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Normalize HTML text to produce a stable hash that ignores transient/dynamic differences:
 * - Cookie consent banners, modal dialogs
 * - Navbars, footers, breadcrumbs
 * - Scripts, styles, noscript, iframes, SVGs
 * - Current timestamp expressions, access counters
 * - Extra whitespace, case normalization
 */
function normalizeContentForHash(html) {
  if (!html) return '';

  let cleaned = html;

  // 1. Remove non-content tags and their inner content
  cleaned = cleaned.replace(/<(script|style|noscript|iframe|svg|canvas)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 2. Remove standard navigation and footer elements
  cleaned = cleaned.replace(/<(nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 3. Remove common cookie / consent / privacy banners and trackers
  cleaned = cleaned.replace(/<div\b[^>]*(?:cookie|consent|banner|tracking|popup|modal)[^>]*>[\s\S]*?<\/div>/gi, '');

  // 4. Strip strike-through or deleted text
  cleaned = cleaned.replace(/<(s|del|strike)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 5. Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 6. Convert all HTML tags to space to extract raw text structure
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 7. Decode basic HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 8. Mask transient date-time stamps like "現在日時: 2026/10/09 02:15" or "アクセス数: 1234"
  cleaned = cleaned.replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s+\d{1,2}:\d{2}(?::\d{2})?/g, '');
  cleaned = cleaned.replace(/(?:アクセス数|閲覧数|PV|counter)[：:]\s*\d+/gi, '');

  // 9. Normalize Unicode (NFKC) and collapse consecutive whitespace
  cleaned = cleaned.normalize('NFKC');
  cleaned = cleaned.replace(/\s+/g, ' ').trim().toLowerCase();

  return cleaned;
}

/**
 * Fetch official page and check hash against previous known hash.
 *
 * @param {string} url - Target URL
 * @param {string} previousHash - Previous SHA-256 hash if known
 * @param {Object} options - Fetch options and overrides
 */
async function fetchAndCheckHash(url, previousHash = null, options = {}) {
  const getPage = options.getPage || (async page => fetchOfficialPage(page, options.source || { id: 'temp', allowedHosts: [new URL(url).hostname] }, { timeoutMs: 15000 }));

  try {
    const document = await getPage({ url, role: 'overview' });
    const rawHtml = document.html || '';
    const normalized = normalizeContentForHash(rawHtml);
    const hash = sha256(normalized);

    const isUnchanged = Boolean(previousHash && previousHash === hash);

    return {
      success: true,
      url,
      httpStatus: document.httpStatus || 200,
      rawHtml,
      normalizedLength: normalized.length,
      hash,
      unchanged: isUnchanged,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      url,
      httpStatus: error.status || 0,
      rawHtml: null,
      normalizedLength: 0,
      hash: null,
      unchanged: false,
      error: error.message
    };
  }
}

module.exports = {
  sha256,
  normalizeContentForHash,
  fetchAndCheckHash
};
