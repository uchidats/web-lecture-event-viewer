'use strict';
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createTokenStore} = require('../lib/token-store-factory');
const {getFirestoreClient} = require('../lib/firebase');
async function main() {
  // Refuse all production endpoints/projects, even if a caller forgets a setting.
  if (!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
  process.env.FIREBASE_PROJECT_ID ||= 'demo-ophthalconf';
  if (!process.env.FIREBASE_PROJECT_ID.startsWith('demo-')) throw new Error('Demo project required');
  const env = {...process.env,TOKEN_STORE:'firestore'}, uid='emulator-fixture-'+randomUUID();
  const db=getFirestoreClient(env),store=createTokenStore(env);let created=false;
  try {
    assert.equal(await store.hasRefreshToken(uid),false);
    await store.saveRefreshToken(uid,'synthetic-emulator-fixture');created=true;
    const restored=createTokenStore(env);assert.equal(await restored.getRefreshToken(uid),'synthetic-emulator-fixture');assert.equal(await restored.hasRefreshToken(uid),true);
    await restored.deleteRefreshToken(uid);created=false;assert.equal(await restored.hasRefreshToken(uid),false);
    console.log('PASS: local Firestore emulator save/get/has/delete and store recreation.');
  } finally {
    try {if(created)await store.deleteRefreshToken(uid);} finally {await db.terminate();}
  }
}
main().catch(()=>{console.error('Firestore emulator test failed. Use a local emulator and a demo project; no production fallback is allowed.');process.exitCode=1;});
