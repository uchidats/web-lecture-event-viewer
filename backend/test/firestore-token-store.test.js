'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {FirestoreTokenStore,COLLECTION} = require('../lib/firestore-token-store');
const {MemoryTokenStore} = require('../lib/token-store');
const {createTokenStore} = require('../lib/token-store-factory');
const {createGoogleOAuth,SCOPES} = require('../lib/google-oauth');
const {createServer} = require('../server');
const {getAdminApp,getFirestoreClient,createVerifier} = require('../lib/firebase');
const {once} = require('node:events');

function fakeFirestore() {
  const docs = new Map();let failure = false;
  const check = () => {if(failure)throw new Error('SDK error includes fixture-sensitive-value');};
  const snapshot = key => ({exists:docs.has(key),data:()=>docs.get(key)});
  const db = {
    collection: name => {assert.equal(name,COLLECTION);return {doc:uid=>({key:uid,get:async()=>{check();return snapshot(uid);},delete:async()=>{check();docs.delete(uid);}})};},
    runTransaction:async work=>{check();return work({get:async ref=>{check();return snapshot(ref.key);},set:(ref,value)=>{check();docs.set(ref.key,value);}});}
  };
  return {db,docs,fail(value){failure=value;}};
}
test('memory interface, default selection and explicit firestore selection',async()=>{
  let attempts=0;const f=fakeFirestore(), options={getFirestoreClient:()=>{attempts++;return f.db;}};
  for(const env of [{},{TOKEN_STORE:'memory'}]) {
    const store=createTokenStore(env,options);assert.ok(store instanceof MemoryTokenStore);
    await store.saveRefreshToken('uid','fixture-token');assert.equal(await store.hasRefreshToken('uid'),true);await store.deleteRefreshToken('uid');assert.equal(await store.hasRefreshToken('uid'),false);
  }
  assert.equal(attempts,0,'memory must not initialize Firestore');
  assert.ok(createTokenStore({TOKEN_STORE:'firestore'},options) instanceof FirestoreTokenStore);assert.equal(attempts,1);
  assert.throws(()=>createTokenStore({TOKEN_STORE:'typo'},options),/TOKEN_STORE/);assert.equal(attempts,1);
});
test('save/get/has/delete, timestamps, uid separation and persistence across store recreation',async()=>{
  const f=fakeFirestore();let clock=0;const options={firestore:f.db,serverTimestamp:()=>++clock};let store=new FirestoreTokenStore(options);
  assert.equal(await store.getRefreshToken('a'),null);assert.equal(await store.hasRefreshToken('a'),false);
  await store.saveRefreshToken('a','fixture-refresh-a');const first=f.docs.get('a');
  assert.deepEqual(Object.keys(first).sort(),['createdAt','provider','refreshToken','updatedAt']);assert.equal(first.provider,'google');
  await store.saveRefreshToken('a','fixture-refresh-new');assert.equal(f.docs.get('a').createdAt,first.createdAt);assert.ok(f.docs.get('a').updatedAt>first.updatedAt);
  await store.saveRefreshToken('b','fixture-refresh-b');store=new FirestoreTokenStore(options);
  assert.equal(await store.getRefreshToken('a'),'fixture-refresh-new');assert.equal(await store.hasRefreshToken('a'),true);assert.equal(await store.getRefreshToken('b'),'fixture-refresh-b');
  await store.deleteRefreshToken('a');await store.deleteRefreshToken('a');assert.equal(await store.hasRefreshToken('a'),false);assert.equal(await store.hasRefreshToken('b'),true);
});
test('codec extension point and safe exceptions without credentials or SDK error causes',async()=>{
  const f=fakeFirestore(), codec={encode:async(token,uid)=>`${uid}:${token}`,decode:async(value,uid)=>{assert.ok(value.startsWith(uid+':'));return value.slice(uid.length+1);}};
  const store=new FirestoreTokenStore({firestore:f.db,codec});await store.saveRefreshToken('a','fixture-sensitive-value');assert.equal(f.docs.get('a').refreshToken,'a:fixture-sensitive-value');assert.equal(await store.getRefreshToken('a'),'fixture-sensitive-value');
  f.fail(true);
  for(const operation of [()=>store.saveRefreshToken('a','fixture-sensitive-value'),()=>store.getRefreshToken('a'),()=>store.hasRefreshToken('a'),()=>store.deleteRefreshToken('a')]) {
    await assert.rejects(operation(),error=>error.message==='token_store_unavailable'&&!error.cause&&!error.stack.includes('fixture-sensitive-value'));
  }
  const broken=new FirestoreTokenStore({firestore:fakeFirestore().db,codec:{encode:async()=>{throw new Error('fixture-sensitive-value');},decode:async()=>''}});
  await assert.rejects(broken.saveRefreshToken('a','fixture-sensitive-value'),/token_store_unavailable/);
});
test('shared Admin app is reused for Auth and Firestore without network requests',()=>{
  const env={FIREBASE_PROJECT_ID:'demo-ophthalconf'};const app=getAdminApp(env);
  assert.equal(getAdminApp(env),app);assert.equal(typeof createVerifier(env),'function');assert.equal(getFirestoreClient(env),getFirestoreClient(env));
  assert.throws(()=>getAdminApp({FIREBASE_PROJECT_ID:'other-project'}),/mismatch/);
});
test('Firestore OAuth status never returns credentials and disconnect deletes despite revoke failure',async t=>{
  const f=fakeFirestore(),store=new FirestoreTokenStore({firestore:f.db}), events=[],logs=[];
  const originalError=console.error;console.error=(...args)=>logs.push(args);t.after(()=>{console.error=originalError;});
  const service=createGoogleOAuth({tokenStore:store,fetchImpl:async()=>{events.push('revoke');assert.equal(f.docs.has('a'),true,'revoke precedes deletion');throw new Error('fixture-sensitive-value');}});
  await store.saveRefreshToken('a','fixture-sensitive-value');
  const server=createServer({googleOAuth:service,verifyIdToken:async()=>({uid:'a'})});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`,headers={Authorization:'Bearer fixture-firebase'};
  assert.deepEqual(await(await fetch(base+'/api/google-calendar/status',{headers})).json(),{connected:true});
  const response=await fetch(base+'/api/google-calendar/disconnect',{method:'POST',headers});assert.deepEqual(await response.json(),{connected:false,revoked:false});assert.deepEqual(events,['revoke']);assert.equal(f.docs.has('a'),false);
  assert.deepEqual(await(await fetch(base+'/api/google-calendar/status',{headers})).json(),{connected:false});
  f.fail(true);const failed=await fetch(base+'/api/google-calendar/status',{headers});assert.equal(failed.status,500);assert.deepEqual(await failed.json(),{error:'calendar_connection_failed'});assert.equal(JSON.stringify(logs).includes('fixture-sensitive-value'),false);
});
test('OAuth callback persists refresh token only and a new service reads the same record',async()=>{
  const f=fakeFirestore(),store=new FirestoreTokenStore({firestore:f.db});
  const config={clientId:'fixture',clientSecret:'fixture-sensitive-value',redirectUri:'http://localhost:8080/api/google-calendar/callback',frontendUrl:'http://localhost:8000/'};
  const service=createGoogleOAuth({config,tokenStore:store,verifyIdentity:async()=>'google-subject',fetchImpl:async()=>({ok:true,json:async()=>({scope:SCOPES.join(' '),refresh_token:'fixture-refresh-only',access_token:'fixture-access-discarded',id_token:'fixture-id-token'})})});
  const session=await service.connect('a','google-subject'),state=new URL(session.authorizationUrl).searchParams.get('state');
  await service.callback(new URLSearchParams({state,code:'fixture-code-discarded'}),session.cookie.split(';')[0]);
  const restored=createGoogleOAuth({tokenStore:new FirestoreTokenStore({firestore:f.db})});assert.deepEqual(await restored.status('a'),{connected:true});
  const persisted=JSON.stringify([...f.docs.values()]);assert.ok(persisted.includes('fixture-refresh-only'));for(const discarded of ['fixture-access-discarded','fixture-code-discarded','fixture-sensitive-value'])assert.equal(persisted.includes(discarded),false);
});
test('delete failure never reports a successful disconnect; retry removes the token',async()=>{
  const f=fakeFirestore(),store=new FirestoreTokenStore({firestore:f.db});let blocked=true;
  await store.saveRefreshToken('a','fixture-refresh-value');
  const service=createGoogleOAuth({tokenStore:{getRefreshToken:uid=>store.getRefreshToken(uid),hasRefreshToken:uid=>store.hasRefreshToken(uid),
    deleteRefreshToken:async uid=>{if(blocked)throw new Error('token_store_unavailable');await store.deleteRefreshToken(uid);}},fetchImpl:async()=>({ok:true})});
  await assert.rejects(service.disconnect('a'),/token_store_unavailable/);assert.deepEqual(await service.status('a'),{connected:true});
  blocked=false;assert.deepEqual(await service.disconnect('a'),{connected:false,revoked:true});assert.deepEqual(await service.status('a'),{connected:false});
});
