const crypto = require('node:crypto');

function trustedUrl(value, source, kind = 'event') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      (kind === 'society' ? source.allowedSocietyHosts || [] : source.allowedHosts || []).includes(url.hostname);
  } catch { return false; }
}

async function fetchOfficialPage(page, source, limits, fetchImpl = fetch) {
  let url = page.url;
  const signal = AbortSignal.timeout(limits.timeoutMs);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!trustedUrl(url, source, page.role === 'society' ? 'society' : 'event')) throw new Error('untrusted-domain');
    let response;
    try {
      response = await fetchImpl(url, {
        signal, redirect: 'manual', headers: { 'User-Agent': 'ConferenceAutoUpdater/1.0 (+https://github.com/uchidats/web-lecture-event-viewer)' }
      });
    } catch (error) {
      limits.onRequest?.({ url, httpStatus: null, error: error.message });
      throw error;
    }
    limits.onRequest?.({ url, httpStatus: response.status,
      ...([301, 302, 303, 307, 308].includes(response.status) ? { redirectTo: response.headers.get('location') } : {}) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (response.body) await response.body.cancel();
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok && ![403, 429, 503].includes(response.status)) {
      const error = new Error(`http-${response.status}`);
      Object.assign(error, { httpStatus: response.status, fetchState: response.status === 404 || response.status === 410 ? 'not-found-response' : 'http-error' });
      throw error;
    }
    const type = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error('non-html-response');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limits.maxResponseBytes) throw new Error('response-too-large');
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const charset = type.match(/charset=["']?([^\s;"']+)/i)?.[1] ||
      buffer.toString('ascii').match(/charset=["']?([a-z0-9_-]+)/i)?.[1] || 'utf-8';
    const html = new TextDecoder(charset).decode(buffer);
    const botProtected = response.headers.get('cf-mitigated') === 'challenge' ||
      /<title[^>]*>\s*(?:Just a moment|Attention Required)|cf-chl-|challenge-platform|Verify you are human|Checking your browser/i.test(html);
    if (botProtected || !response.ok) {
      const error = new Error(botProtected ? 'bot-protected' : `http-${response.status}`);
      Object.assign(error, { httpStatus: response.status, botProtected,
        fetchState: botProtected ? 'bot-protected' : response.status === 403 ? 'access-denied' : 'http-error' });
      throw error;
    }
    if (!/<(?:html|body|main|table|dl)\b/i.test(html)) throw new Error('invalid-html');
    return { ...page, url, html, httpStatus: response.status, fingerprint: crypto.createHash('sha256').update(buffer).digest('hex') };
  }
  throw new Error('too-many-redirects');
}

module.exports = { fetchOfficialPage, trustedUrl };
