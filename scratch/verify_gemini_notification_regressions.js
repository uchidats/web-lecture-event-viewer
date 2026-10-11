// Run the full suite with fake SMTP secrets and a connection guard in every child.
// Preserve existing report edits, including reports modified before this verification.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ophthal-notification-verification-'));
const guard = path.join(temporary, 'smtp-guard.cjs');
const attempts = path.join(temporary, 'smtp-attempts.txt');
fs.writeFileSync(guard, `const tls = require('node:tls'); tls.connect = function () {
  require('node:fs').appendFileSync(${JSON.stringify(attempts)}, 'SMTP connection attempted\\n');
  process.exitCode = 1; throw new Error('Real SMTP forbidden during regression verification');
};`);
function reportFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? reportFiles(file) : entry.isFile() ? [file] : [];
  });
}
const reports = path.join(root, 'reports');
const originals = new Map(reportFiles(reports).map(file => [file, fs.readFileSync(file)]));
const env = { ...process.env, SMTP_USER: 'mock@example.invalid', SMTP_PASS: 'mock-password',
  NOTIFICATION_EMAIL: 'recipient@example.invalid', ENABLE_AUTO_APPLY: 'false',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(guard)}` };
delete env.CLOUD_ACCESS_TOKEN;
delete env.FIREBASE_SERVICE_ACCOUNT_KEY;
try {
  for (const script of ['scripts/check-conference-regressions.js', 'scratch/test_auto_updater_integration.js',
    'scratch/test_dual_site.js', 'scripts/build-dual-site.js']) {
    console.log(`Running ${script}`);
    const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: 'utf8', timeout: 180000 });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error || result.status !== 0) throw new Error(`${script} failed: ${result.error || result.status}`);
  }
  if (fs.existsSync(attempts)) throw new Error('Regression suite attempted SMTP');
  console.log('PASS: full regressions, real apply integration, dual-site checks and build; fake SMTP secrets present; SMTP attempts=0');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const file of reportFiles(reports)) {
    if (!originals.has(file)) {
      const archive = path.join(temporary, path.relative(root, file));
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      fs.renameSync(file, archive);
    }
  }
  for (const [file, contents] of originals) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}
