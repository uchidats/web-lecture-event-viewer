const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runGeminiMonitor } = require('../scripts/gemini-monitor/monitor');
async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ophthal-zero-mail-'));
  const original = fs.readFileSync(path.resolve(__dirname,'../events.js'));
  fs.writeFileSync(path.join(root,'events.js'),original);
  const old = {user:process.env.SMTP_USER,pass:process.env.SMTP_PASS,apply:process.env.ENABLE_AUTO_APPLY,cloudToken:process.env.CLOUD_ACCESS_TOKEN,serviceAccount:process.env.FIREBASE_SERVICE_ACCOUNT_KEY};
  try {
    delete process.env.SMTP_USER;delete process.env.SMTP_PASS;process.env.ENABLE_AUTO_APPLY='false';
    delete process.env.CLOUD_ACCESS_TOKEN;delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const result = await runGeminiMonitor({root,today:'2040-01-01',offline:true});
    assert.equal(result.metrics.monitoredToday,0);
    assert.equal(result.metrics.wouldAutoUpdate,0);
    assert.ok(result.notification,'Even zero selected events must reach the notification dispatcher');
    assert.equal(result.notification.subject,'【OphthalConf】本日の更新はありません');
    assert.equal(result.notification.reason,'smtp_credentials_missing_dry_run');
    assert.deepEqual(fs.readFileSync(path.join(root,'events.js')),original);
  } finally {
    for(const [name,value] of Object.entries({SMTP_USER:old.user,SMTP_PASS:old.pass,ENABLE_AUTO_APPLY:old.apply,CLOUD_ACCESS_TOKEN:old.cloudToken,FIREBASE_SERVICE_ACCOUNT_KEY:old.serviceAccount})) {
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
  console.log('PASS: zero-update/zero-selected shadow monitor still dispatches health-check notification; no real email sent');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
