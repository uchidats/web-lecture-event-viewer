const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { buildDualSite } = require('./build-dual-site');
function createPreviewServer(output) {
  output = path.resolve(output);
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://preview');
    let file;
    try { file = path.resolve(output, '.' + decodeURIComponent(url.pathname)); } catch { res.writeHead(400).end(); return; }
    if (file !== output && !file.startsWith(output + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    if (fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); fs.createReadStream(file).pipe(res);
  });
}
if (require.main === module) {
  const result = buildDualSite(), server = createPreviewServer(result.output), port = Number(process.env.PREVIEW_PORT || 8000);
  server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}/ and http://127.0.0.1:${port}/ophthalconf/`));
}
module.exports = { createPreviewServer };
