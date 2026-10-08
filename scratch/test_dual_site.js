const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { buildDualSite, PUBLIC_FILES } = require('../scripts/build-dual-site');
const { createPreviewServer } = require('../scripts/preview-dual-site');
async function main() {
  const root = path.resolve(__dirname, '..');
  const before = new Map([...PUBLIC_FILES, 'CNAME'].map(file => [file, fs.readFileSync(path.join(root, file))]));
  const first = buildDualSite(root), second = buildDualSite(root);
  assert.deepEqual(first.files, second.files);
  for (const file of first.files) {
    const original = fs.readFileSync(path.join(root, file));
    assert.deepEqual(fs.readFileSync(path.join(first.output, file)), original, file + ': root unchanged');
    assert.deepEqual(fs.readFileSync(path.join(first.output, 'ophthalconf', file)), original, file + ': identical subpath');
  }
  for (const [file, bytes] of before) assert.deepEqual(fs.readFileSync(path.join(root, file)), bytes);
  for (const excluded of ['backend', '.git', '.github', 'node_modules', 'scripts', 'scratch', 'reports/auto-update-backups'])
    assert.equal(fs.existsSync(path.join(first.output, excluded)), false, excluded);
  const server = createPreviewServer(first.output); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const prefix of ['/', '/ophthalconf/']) {
      const page = await fetch(base + prefix, { redirect: 'manual' }); assert.equal(page.status, 200);
      const html = await page.text();
      assert.equal(html, fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
      for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        const resource = new URL(match[1], base + prefix);
        if (resource.origin !== base) continue;
        assert.ok(resource.pathname.startsWith(prefix));
        const response = await fetch(resource); assert.equal(response.status, 200, resource.href); await response.body.cancel();
      }
      assert.equal((await (await fetch(base + prefix + 'reports/auto-update-review.json')).json()).version, 1);
    }
    const redirect = await fetch(base + '/ophthalconf?adminReview=1', { redirect: 'manual' });
    assert.equal(redirect.status, 301); assert.equal(redirect.headers.get('location'), '/ophthalconf/?adminReview=1');
    assert.equal((await fetch(base + '/backend/server.js')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log(`PASS: identical root/subpath ${first.files.length} public files, 14 local asset URLs and review JSON at both paths, slash redirect/query retention, source integrity and excluded private/build files`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
