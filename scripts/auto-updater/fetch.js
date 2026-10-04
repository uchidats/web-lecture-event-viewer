const crypto = require('node:crypto');

function trustedUrl(value, source) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && source.allowedHosts.includes(url.hostname);
  } catch { return false; }
}

async function fetchOfficialPage(page, source, limits, fetchImpl = fetch) {
  let url = page.url;
  const signal = AbortSignal.timeout(limits.timeoutMs);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!trustedUrl(url, source)) throw new Error('untrusted-domain');
    const response = await fetchImpl(url, {
      signal, redirect: 'manual', headers: { 'User-Agent': 'ConferenceAutoUpdater/1.0 (+https://github.com/uchidats/web-lecture-event-viewer)' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (response.body) await response.body.cancel();
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok) throw new Error(`http-${response.status}`);
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
    if (!/<(?:html|body|main|table|dl)\b/i.test(html)) throw new Error('invalid-html');
    return { ...page, url, html, fingerprint: crypto.createHash('sha256').update(buffer).digest('hex') };
  }
  throw new Error('too-many-redirects');
}

module.exports = { fetchOfficialPage, trustedUrl };
