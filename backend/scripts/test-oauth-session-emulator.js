'use strict';
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {randomId,digest}=require('../lib/oauth-state');
const {getFirestoreClient}=require('../lib/firebase');
const {createOAuthSessionStore}=require('../lib/oauth-session-store-factory');
const {createTokenStore}=require('../lib/token-store-factory');
const {createGoogleOAuth,SCOPES}=require('../lib/google-oauth');
async function main(){
  if(!/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Local emulator required');
  process.env.FIREBASE_PROJECT_ID||='demo-ophthalconf';if(!process.env.FIREBASE_PROJECT_ID.startsWith('demo-'))throw new Error('Demo project required');
  const env={...process.env,TOKEN_STORE:'firestore',OAUTH_SESSION_STORE:'firestore'},db=getFirestoreClient(env),uid='session-fixture-'+randomUUID(),ids=[];
  const stores=()=>createOAuthSessionStore(env),tokens=()=>createTokenStore(env);
  const config={clientId:'fixture-client',clientSecret:'fixture-only-secret',redirectUri:'http://localhost:8080/api/google-calendar/callback',frontendUrl:'http://localhost:8000/'};
  async function save(overrides={}){
    const store=stores(),id=randomId(),now=Date.now();ids.push(id);
    await store.save(id,{uid,googleSubject:'fixture-subject',generation:await store.rotate(uid),codeVerifier:randomId(),browserDigest:digest(randomId()),createdAt:now,expiresAt:now+600000,...config,...overrides});return id;
  }
  let exchanges=0;
  const service=()=>createGoogleOAuth({config,sessionStore:stores(),tokenStore:tokens(),verifyIdentity:async()=>'fixture-subject',fetchImpl:async()=>{
    exchanges++;return{ok:true,json:async()=>({scope:SCOPES.join(' '),id_token:'synthetic-id-token',refresh_token:'synthetic-refresh-token'})};}});
  try{
    const id=await save();const consumed=await Promise.all(Array.from({length:8},()=>stores().consume(id)));
    assert.equal(consumed.filter(Boolean).length,1);assert.equal(await stores().consume(id),null);
    const expired=await save({createdAt:Date.now()-1000,expiresAt:Date.now()-1});assert.equal(await stores().consume(expired),null);
    const deleted=await save();await stores().delete(deleted);assert.equal(await stores().consume(deleted),null);
    const a=service(),start=await a.connect(uid,'fixture-subject'),state=new URL(start.authorizationUrl).searchParams.get('state');ids.push(state);
    // Completely recreate service/stores; no Cookie or local generation Map is carried over.
    const result=await service().callback(new URLSearchParams({state,code:'synthetic-code'}));
    assert.equal(new URL(result.redirectUrl).searchParams.get('calendar_oauth'),'connected');assert.equal(exchanges,1);
    await assert.rejects(service().callback(new URLSearchParams({state,code:'synthetic-replay'})),/invalid_state/);
    assert.deepEqual(await service().status(uid),{connected:true});
    const older=await stores().rotate(uid);await stores().rotate(uid);
    assert.equal(await tokens().saveRefreshTokenIfCurrent(uid,'synthetic-stale-token',stores(),older),false);
    assert.equal(await tokens().deleteRefreshTokenIfCurrent(uid,stores(),older),false);
    assert.equal(await tokens().getRefreshToken(uid),'synthetic-refresh-token');
    let release,exchanging=false;
    const slow=createGoogleOAuth({config,sessionStore:stores(),tokenStore:tokens(),verifyIdentity:async()=>'fixture-subject',fetchImpl:async()=>{
      exchanging=true;await new Promise(resolve=>release=resolve);return{ok:true,json:async()=>({scope:SCOPES.join(' '),id_token:'synthetic-id-token',refresh_token:'synthetic-late-token'})};}});
    const pending=await service().connect(uid,'fixture-subject'),pendingState=new URL(pending.authorizationUrl).searchParams.get('state');ids.push(pendingState);
    const callback=slow.callback(new URLSearchParams({state:pendingState,code:'synthetic-delayed-code'}));
    while(!exchanging)await new Promise(resolve=>setImmediate(resolve));
    await service().disconnect(uid);release();assert.equal(new URL((await callback).redirectUrl).searchParams.get('calendar_oauth'),'failed');
    assert.deepEqual(await service().status(uid),{connected:false});
    console.log('PASS: real Firestore Emulator save/delete, 8 concurrent consumes (one winner), replay/expiry rejection, recreated-instance cookieless callback, conditional token writes and cross-instance disconnect fencing.');
  }finally{
    try{for(const id of ids)await stores().delete(id);await tokens().deleteRefreshToken(uid);await db.collection('oauthConnectionGenerations').doc(uid).delete();}finally{await db.terminate();}
  }
}
main().catch(()=>{console.error('OAuth session emulator test failed; require localhost emulator and demo project. Secret values are not logged.');process.exitCode=1;});
