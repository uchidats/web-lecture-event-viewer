'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {spawnSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
const {assertProductionConfig}=require('../lib/production-config');
const {start}=require('../server');
const safe={NODE_ENV:'production',TOKEN_STORE:'firestore',OAUTH_SESSION_STORE:'firestore',SECRET_PROVIDER:'secret-manager'};
for(const [name,bad] of [['TOKEN_STORE','memory'],['OAUTH_SESSION_STORE','memory'],['SECRET_PROVIDER','env']]) {
  for(const value of [undefined,bad])test(`production rejects ${name} ${value===undefined?'unset':value} before OAuth or listening`,async()=>{
    const env={...safe};if(value===undefined)delete env[name];else env[name]=value;
    // OAuth, Firebase project and PORT are deliberately unset: this guard must run first.
    const expected=`Production configuration is unsafe: ${name} must be ${safe[name]}`;
    await assert.rejects(start(env),error=>error.message===expected&&error.code==='UNSAFE_PRODUCTION_CONFIGURATION');
    const childEnv={...process.env,...env};
    for(const key of ['GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_REDIRECT_URI','FRONTEND_URL','FIREBASE_PROJECT_ID','GOOGLE_CLOUD_PROJECT','PORT'])delete childEnv[key];
    if(value===undefined)delete childEnv[name];
    const marker=randomBytes(32).toString('hex');childEnv.GOOGLE_OAUTH_CLIENT_SECRET=marker;
    const child=spawnSync(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:childEnv,encoding:'utf8',timeout:10000});
    assert.equal(child.status,1);assert.equal(child.stderr.trim(),expected);assert.equal(child.stdout.trim(),'');assert.equal(child.stderr.includes(marker),false);
  });
}
test('all three production selections pass; later setup is not bypassed',async()=>{
  assert.doesNotThrow(()=>assertProductionConfig(safe));
  // A later, unrelated validation failure proves start has passed this guard without remote access.
  await assert.rejects(start({...safe,PORT:'invalid'}),/Invalid PORT/);
  assert.doesNotThrow(()=>assertProductionConfig({}));
});
