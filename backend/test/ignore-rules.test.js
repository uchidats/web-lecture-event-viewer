'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const excluded=['client_secret.json','client-secret.json','service-account.json','serviceAccount.json',
  'backend/client-secret.json','backend/serviceAccount.json','backend/tokens.json','backend/refresh-token.json',
  'backend/access-token.json','backend/private.p12','emulator-data/export.json','backend/emulator-data/export.json',
  'nested/oauth-client-secret.json','nested/clientSecret.json','nested/service_account_key.json',
  'nested/refresh_token.json','nested/accessToken.json','nested/private.P12','nested/private.pfx'];
const allowed=['package.json','package-lock.json','backend/package.json','backend/package-lock.json','backend/app-settings.json','events.json','firebase-config.json','frontend/data.json'];
for(const policy of ['.gitignore','backend/.gcloudignore'])test(`${policy} ignores credential variants without ignoring normal JSON`,()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ophthalconf-ignore-test-'));
  try {
    const init=spawnSync('git',['init','--quiet',temp],{encoding:'utf8'});assert.equal(init.status,0);
    fs.writeFileSync(path.join(temp,'.gitignore'),fs.readFileSync(path.join(root,policy)));
    // An isolated Git repository tests each policy independently, including gcloud's matching rules.
    const result=spawnSync('git',['check-ignore','--no-index','--stdin'],{cwd:temp,input:[...excluded,...allowed].join('\n')+'\n',encoding:'utf8'});
    assert.equal(result.status,0);const ignored=new Set(result.stdout.trim().split(/\r?\n/));
    for(const file of excluded)assert.ok(ignored.has(file),`${policy}: ${file} must be excluded`);
    for(const file of allowed)assert.ok(!ignored.has(file),`${policy}: ${file} must remain included`);
  } finally {
    const resolved=fs.realpathSync(temp),tempRoot=fs.realpathSync(os.tmpdir());
    assert.ok(resolved.toLowerCase().startsWith((tempRoot+path.sep).toLowerCase())&&path.basename(resolved).startsWith('ophthalconf-ignore-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
});
