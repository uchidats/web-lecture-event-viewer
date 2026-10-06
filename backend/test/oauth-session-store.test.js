'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {MemoryOAuthSessionStore,randomId,digest}=require('../lib/oauth-state');
const {FirestoreOAuthSessionStore}=require('../lib/firestore-oauth-session-store');
const {createOAuthSessionStore}=require('../lib/oauth-session-store-factory');
const {FirestoreTokenStore}=require('../lib/firestore-token-store');
const {createGoogleOAuth,SCOPES,readOAuthConfig}=require('../lib/google-oauth');
const {fakeFirestore}=require('./helpers/firestore');
const config={clientId:'fixture.apps.googleusercontent.com',clientSecret:'fixture-only-secret',redirectUri:'http://localhost:8080/api/google-calendar/callback',frontendUrl:'http://localhost:8000/'};
async function saveFixture(store,uid='uid-a',overrides={}){
  const state=randomId(),nonce=randomId(),generation=await store.rotate(uid);
  const data={uid,googleSubject:'google-subject',generation,codeVerifier:randomId(),browserDigest:digest(nonce),createdAt:store.now(),expiresAt:store.now()+store.ttlMs,
    frontendUrl:config.frontendUrl,clientId:config.clientId,redirectUri:config.redirectUri,...overrides};
  await store.save(state,data);return{state,nonce,data};
}
for(const mode of ['memory','firestore'])test(mode+' sessions: save/delete, expiry, optional-cookie and atomic consume',async()=>{
  const f=fakeFirestore();let now=1000;const store=mode==='memory'?new MemoryOAuthSessionStore({now:()=>now}):new FirestoreOAuthSessionStore({firestore:f.db,now:()=>now});
  const first=await saveFixture(store);assert.equal(await store.consume(first.state,randomId()),null);
  const consumed=await Promise.all([store.consume(first.state,first.nonce),store.consume(first.state,first.nonce)]);assert.equal(consumed.filter(Boolean).length,1);assert.equal(await store.consume(first.state),null);
  const next=await saveFixture(store);await store.delete(next.state);assert.equal(await store.consume(next.state),null);
  const expired=await saveFixture(store);now=expired.data.expiresAt;assert.equal(await store.consume(expired.state),null);
  const absent=await saveFixture(store);assert.equal((await store.consume(absent.state)).uid,'uid-a');
  assert.equal(await store.runIfCurrent('missing-user',undefined,()=>{throw new Error('must not run');}),false);
});
test('default does not initialize Firestore; shared implementation selected explicitly',()=>{
  let calls=0;const f=fakeFirestore(),options={getFirestoreClient:()=>{calls++;return f.db;}};
  assert.ok(createOAuthSessionStore({},options) instanceof MemoryOAuthSessionStore);assert.equal(calls,0);
  assert.ok(createOAuthSessionStore({OAUTH_SESSION_STORE:'firestore'},options) instanceof FirestoreOAuthSessionStore);assert.equal(calls,1);
  assert.throws(()=>createOAuthSessionStore({OAUTH_SESSION_STORE:'typo'},options),/OAUTH_SESSION_STORE/);
});
function sharedFixture(options={}){
  const f=fakeFirestore(),store=()=>new FirestoreOAuthSessionStore({firestore:f.db}),tokens=()=>new FirestoreTokenStore({firestore:f.db});let exchanges=0;
  const service=()=>createGoogleOAuth({config,sessionStore:store(),tokenStore:tokens(),verifyIdentity:async()=>{if(options.identityError)throw new Error('fixture-sensitive-value');return options.subject||'google-subject';},
    fetchImpl:async(url)=>{if(url.endsWith('/token')){exchanges++;if(options.gate)await options.gate;}return{ok:true,json:async()=>({scope:SCOPES.join(' '),id_token:'fixture-id-token',refresh_token:'fixture-refresh-token'})};}});
  return{...f,store,tokens,service,get exchanges(){return exchanges;}};
}
test('instance A starts; regenerated instance B callbacks without cookie; replay rejects',async()=>{
  const f=sharedFixture(),a=f.service(),b=f.service(),started=await a.connect('uid-a','google-subject'),state=new URL(started.authorizationUrl).searchParams.get('state');
  const persisted=f.documents.get('oauthSessions/'+state);assert.ok(persisted.expiresAt.toMillis()>Date.now());assert.equal(persisted.refreshToken,undefined);assert.equal(persisted.clientSecret,undefined);
  const queries=new URLSearchParams({state,code:'fixture-code'});
  const [one,two]=await Promise.allSettled([b.callback(queries),f.service().callback(queries)]);
  assert.equal([one,two].filter(result=>result.status==='fulfilled').length,1);assert.equal(f.exchanges,1);assert.deepEqual(await a.status('uid-a'),{connected:true});
});
test('missing cookie requires Google identity match; invalid Google ID token fails closed',async()=>{
  for(const options of [{subject:'other-google-account'},{identityError:true}]){
    const f=sharedFixture(options),a=f.service(),started=await a.connect('uid-a','google-subject'),state=new URL(started.authorizationUrl).searchParams.get('state');
    const result=await f.service().callback(new URLSearchParams({state,code:'fixture-code'}));assert.equal(new URL(result.redirectUrl).searchParams.get('calendar_oauth'),'failed');assert.deepEqual(await a.status('uid-a'),{connected:false});
  }
});
test('disconnect on another instance fences a callback already exchanging code',async()=>{
  let release;const f=sharedFixture({gate:new Promise(resolve=>release=resolve)}),a=f.service(),started=await a.connect('uid-a','google-subject'),state=new URL(started.authorizationUrl).searchParams.get('state');
  const callback=f.service().callback(new URLSearchParams({state,code:'fixture-code'}));
  while(f.exchanges===0)await new Promise(resolve=>setImmediate(resolve));
  const disconnected=await f.service().disconnect('uid-a');release();const result=await callback;
  assert.equal(disconnected.connected,false);assert.equal(new URL(result.redirectUrl).searchParams.get('calendar_oauth'),'failed');assert.deepEqual(await a.status('uid-a'),{connected:false});
});
test('superseded disconnect cannot delete a newer connection',async()=>{
  const f=sharedFixture(),tokens=f.tokens(),sessions=f.store();await tokens.saveRefreshToken('uid-a','fixture-old');
  const old=await sessions.rotate('uid-a'),next=await f.store().rotate('uid-a');
  assert.equal(await tokens.saveRefreshTokenIfCurrent('uid-a','fixture-new',f.store(),next),true);
  assert.equal(await tokens.deleteRefreshTokenIfCurrent('uid-a',sessions,old),false);assert.equal(await tokens.getRefreshToken('uid-a'),'fixture-new');
});
test('shared disconnect lease blocks new connect until revoke/delete completes',async()=>{
  const f=sharedFixture();await f.tokens().saveRefreshToken('uid-a','fixture-old');let release,started=false;
  const disconnect=createGoogleOAuth({sessionStore:f.store(),tokenStore:f.tokens(),fetchImpl:async()=>{started=true;await new Promise(resolve=>release=resolve);return{ok:true};}}).disconnect('uid-a');
  while(!started)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(f.service().connect('uid-a','google-subject'),/oauth_busy/);
  release();await disconnect;await f.service().connect('uid-a','google-subject');
});
test('errors are redacted, sessions exclude unexpected fields, production requires shared stores',async()=>{
  const f=fakeFirestore(),store=new FirestoreOAuthSessionStore({firestore:f.db}),saved=await saveFixture(store,'uid-a',{refreshToken:'must-not-copy',clientSecret:'must-not-copy'});
  assert.equal(f.documents.get('oauthSessions/'+saved.state).refreshToken,undefined);assert.equal(f.documents.get('oauthSessions/'+saved.state).clientSecret,undefined);
  f.fail(true);await assert.rejects(store.consume(saved.state),error=>error.message==='oauth_session_store_unavailable'&&!error.cause&&!error.stack.includes('fixture-sensitive'));
  const env={GOOGLE_OAUTH_CLIENT_ID:config.clientId,GOOGLE_OAUTH_CLIENT_SECRET:config.clientSecret,GOOGLE_OAUTH_REDIRECT_URI:'https://backend.example/api/google-calendar/callback',FRONTEND_URL:'https://uchidats.github.io/web-lecture-event-viewer/',K_SERVICE:'fixture-service',TOKEN_STORE:'firestore',OAUTH_SESSION_STORE:'firestore'};
  assert.equal(readOAuthConfig(env,config.clientSecret).frontendUrl,env.FRONTEND_URL);assert.throws(()=>readOAuthConfig({...env,OAUTH_SESSION_STORE:'memory'},config.clientSecret),/local-only/);
});
