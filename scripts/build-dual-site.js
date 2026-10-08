// Build a static artifact with identical root and /ophthalconf/ applications.
const fs = require('node:fs');
const path = require('node:path');
const PUBLIC_FILES = ['index.html', 'style.css', 'review.css', 'venues.js', 'companies.js', 'events.js',
  'google-calendar-config.js', 'google-calendar.js', 'script.js', 'firebase-config.js', 'firebase-auth.js',
  'review-data.js', 'review-config.js', 'review-model.js', 'review-ui.js'];
const PUBLIC_REPORTS = ['auto-update-review.json', 'auto-update-report.json', 'venue-corrections.json',
  'event-url-audit-2026-10-07.json', 'event-url-missing-audit-2026-10-08.json', 'event-metadata-audit-2026-10-09.json'];

function buildDualSite(root = path.resolve(__dirname, '..')) {
  root = path.resolve(root);
  const output = path.resolve(root, '_site'), marker = path.join(output, '.ophthalconf-generated');
  if (output !== path.join(root, '_site') || output === root) throw new Error('Unsafe output directory');
  // Only remove our own generated directory; never delete a source directory or follow a link.
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink() || !fs.existsSync(marker) || fs.readFileSync(marker, 'utf8') !== 'dual-site-v1')
      throw new Error('Refusing to replace an unrecognized _site directory');
  }
  for (const file of [...PUBLIC_FILES, 'CNAME', 'reports/auto-update-review.json']) {
    if (!fs.existsSync(path.join(root, file)) || !fs.lstatSync(path.join(root, file)).isFile()) throw new Error('Missing public asset: ' + file);
  }
  if (fs.readFileSync(path.join(root, 'CNAME'), 'utf8').trim() !== 'medconf.jp') throw new Error('Unexpected CNAME');
  if (fs.existsSync(output)) fs.rmSync(output, { recursive: true });
  fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(marker, 'dual-site-v1');
  const copied = [];
  function copy(file) {
    const source = path.join(root, file);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error('Public assets must not be symlinks');
    for (const base of [output, path.join(output, 'ophthalconf')]) {
      const target = path.join(base, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
    }
    copied.push(file);
  }
  PUBLIC_FILES.forEach(copy);
  for (const file of PUBLIC_REPORTS) if (fs.existsSync(path.join(root, 'reports', file))) copy('reports/' + file);
  function copyDocs(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Docs must not be symlinks');
      const file = directory + '/' + entry.name;
      if (entry.isDirectory()) copyDocs(file);
      else if (/\.(md|txt|pdf|png|svg|jpg)$/i.test(entry.name)) copy(file);
    }
  }
  if (fs.existsSync(path.join(root, 'docs'))) copyDocs('docs');
  fs.copyFileSync(path.join(root, 'CNAME'), path.join(output, 'CNAME'));
  return { output, files: copied, rootUrl: 'https://medconf.jp/', applicationUrl: 'https://medconf.jp/ophthalconf/' };
}
if (require.main === module) console.log(JSON.stringify(buildDualSite(), null, 2));
module.exports = { buildDualSite, PUBLIC_FILES, PUBLIC_REPORTS };
