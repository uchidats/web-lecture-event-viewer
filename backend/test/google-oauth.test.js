'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {once} = require('node:events');
const {createHash} = require('node:crypto');
const {createServer} = require('../server');
const {createGoogleOAuth,readOAuthConfig,SCOPES} = require('../lib/google-oauth');
const {MemoryTokenStore} = require('../lib/token-store');
const {MemoryOAuthStateStore} = require('../lib/oauth-state');
const config = {clientId:'fixture.apps.googleusercontent.com', clientSecret:'fixture-only-secret',
  redirectUri:'http://localhost:8080/api/google-calendar/callback',frontendUrl:'http://localhost:8000/'};
function fixture(options={}) {
  const store = new MemoryTokenStore(), calls=[];
  const service = createGoogleOAuth({config,tokenStore:store,stateStore:options.stateStore,verifyIdentity:async()=>options.identity || 'google-subject',
    fetchImpl:async(url,request)=>{
      calls.push({url,params:new URLSearchParams(request.body)});
      if (options.gate && url.endsWith('/token')) await options.gate;
      if (options.fail || (options.revokeFail && url.endsWith('/revoke'))) return {ok:false};
      return {ok:true,json:async()=>({...options.tokens || {scope:SCOPES.join(' '),refresh_token:'fixture-refresh-value',access_token:'fixture-access-value'},id_token:'fixture-id-token'})};
    }});
  async function start(uid='uid-a') {const result=await service.connect(uid,'google-subject');return {...result,state:new URL(result.authorizationUrl).searchParams.get('state'),cookieHeader:result.cookie.split(';')[0]};}
  const finish = (session, extra={code:'fixture-code'})=>service.callback(new URLSearchParams({state:session.state,...extra}),session.cookieHeader);
  return {service,store,calls,start,finish};
}
test('offline consent, PKCE, uid isolation, refresh-only storage and revoke',async()=>{
  const f=fixture(), session=await f.start(), url=new URL(session.authorizationUrl);
  for (const [key,value] of Object.entries({access_type:'offline',prompt:'consent',response_type:'code',redirect_uri:config.redirectUri,code_challenge_method:'S256'})) assert.equal(url.searchParams.get(key),value);
  assert.deepEqual(url.searchParams.get('scope').split(' '),SCOPES);assert.ok(!session.state.includes('uid-a'));assert.ok(session.cookie.includes('HttpOnly'));assert.ok(session.cookie.includes('SameSite=Lax'));
  assert.deepEqual(await f.service.status('uid-a'),{connected:false});
  const result=await f.finish(session);assert.equal(new URL(result.redirectUrl).searchParams.get('calendar_oauth'),'connected');assert.ok(!result.redirectUrl.includes('fixture-code'));assert.ok(result.cookie.includes('Max-Age=0'));
  assert.equal(await f.store.getRefreshToken('uid-a'),'fixture-refresh-value');assert.deepEqual(await f.service.status('uid-b'),{connected:false});
  const params=f.calls[0].params;assert.equal(params.get('client_secret'),config.clientSecret);assert.equal(params.get('code'),'fixture-code');assert.equal(createHash('sha256').update(params.get('code_verifier')).digest('base64url'),url.searchParams.get('code_challenge'));
  await assert.rejects(f.finish(session),/oauth_invalid_state/);assert.equal(f.calls.length,1,'replay cannot exchange another code');
  assert.deepEqual(await f.service.disconnect('uid-a'),{connected:false,revoked:true});assert.equal(f.calls[1].url,'https://oauth2.googleapis.com/revoke');assert.equal(await f.store.getRefreshToken('uid-a'),null);
});
test('state rejects wrong browser, expiry, duplicates and superseded flows',async()=>{
  let now=0;const f=fixture({stateStore:new MemoryOAuthStateStore({now:()=>now,ttlMs:1000})});let session=await f.start();
  const other=await f.start('uid-b');await assert.rejects(f.service.callback(new URLSearchParams({state:session.state,code:'fixture-code'}),other.cookieHeader),/invalid_state/);
  assert.equal(f.calls.length,0);now=1000;await assert.rejects(f.finish(session),/invalid_state/);
  session=await f.start();const next=await f.start();await assert.rejects(f.finish(session),/invalid_state/);
  await assert.rejects(f.service.callback(new URLSearchParams(`state=${next.state}&state=${next.state}&code=fixture-code`),next.cookieHeader),/invalid_callback/);
  await f.service.disconnect('uid-a');await assert.rejects(f.finish(next),/invalid_state/);
  assert.equal(f.calls.length,0);
});
test('consent denial, failed exchange, missing scopes and missing refresh fail safely',async()=>{
  const denied=fixture(), session=await denied.start();assert.equal(new URL((await denied.finish(session,{error:'access_denied'})).redirectUrl).searchParams.get('calendar_oauth'),'denied');assert.equal(denied.calls.length,0);
  for (const options of [{fail:true},{tokens:{scope:SCOPES[0],refresh_token:'fixture-partial'}},{tokens:{scope:SCOPES.join(' '),access_token:'fixture-access-only'}}]) {
    const f=fixture(options), session=await f.start();assert.equal(new URL((await f.finish(session)).redirectUrl).searchParams.get('calendar_oauth'),'failed');assert.deepEqual(await f.service.status('uid-a'),{connected:false});await assert.rejects(f.finish(session),/invalid_state/);
  }
  const reconnect=fixture({tokens:{scope:SCOPES.join(' ')}});await reconnect.store.saveRefreshToken('uid-a','fixture-existing');await reconnect.finish(await reconnect.start());assert.equal(await reconnect.store.getRefreshToken('uid-a'),'fixture-existing');
  const failedRevoke=fixture({revokeFail:true});await failedRevoke.store.saveRefreshToken('uid-a','fixture-existing');assert.deepEqual(await failedRevoke.service.disconnect('uid-a'),{connected:false,revoked:false});assert.equal(await failedRevoke.store.getRefreshToken('uid-a'),null);
});
test('disconnect during exchange cannot resurrect a refresh token',async()=>{
  let release;const f=fixture({gate:new Promise(resolve=>release=resolve)}),session=await f.start();const callback=f.finish(session);
  while(f.calls.length===0) await new Promise(resolve=>setImmediate(resolve));
  const disconnect=f.service.disconnect('uid-a');release();await Promise.all([callback,disconnect]);assert.deepEqual(await f.service.status('uid-a'),{connected:false});
});
test('configuration guard, fixed return URL and local-only storage',()=>{
  assert.equal(readOAuthConfig({}),null);
  assert.throws(()=>readOAuthConfig({GOOGLE_OAUTH_CLIENT_ID:'fixture'}),/three/);
  const env={GOOGLE_OAUTH_CLIENT_ID:config.clientId,GOOGLE_OAUTH_CLIENT_SECRET:config.clientSecret,GOOGLE_OAUTH_REDIRECT_URI:config.redirectUri};
  assert.deepEqual(readOAuthConfig(env,config.clientSecret),config);
  assert.throws(()=>readOAuthConfig({...env,FRONTEND_URL:'https://evil.example/'},config.clientSecret),/FRONTEND_URL/);
  assert.throws(()=>readOAuthConfig({...env,K_SERVICE:'fixture-cloud-run'},config.clientSecret),/local-only/);
  assert.throws(()=>readOAuthConfig({...env,GOOGLE_OAUTH_REDIRECT_URI:'http://evil.example/api/google-calendar/callback'},config.clientSecret),/REDIRECT_URI/);
});
test('authenticated HTTP start/status/disconnect and cookie-bound public callback',async t=>{
  const f=fixture(),server=createServer({googleOAuth:f.service,verifyIdToken:async token=>{if(token==='fixture-firebase')return {uid:'uid-a',firebase:{identities:{'google.com':['google-subject']}}};if(token==='fixture-firebase-b')return {uid:'uid-b'};throw {code:'auth/argument-error'};}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
  for (const [path,method] of [['connect','POST'],['status','GET'],['disconnect','POST']]) assert.equal((await fetch(base+'/api/google-calendar/'+path,{method})).status,401);
  const preflight=await fetch(base+'/api/google-calendar/connect',{method:'OPTIONS',headers:{Origin:'http://localhost:8000','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-credentials'),'true');
  const started=await fetch(base+'/api/google-calendar/connect',{method:'POST',headers:{Authorization:'Bearer fixture-firebase',Origin:'http://localhost:8000'}});assert.equal(started.status,200);const state=new URL((await started.json()).authorizationUrl).searchParams.get('state');const cookie=started.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/google-calendar/callback?code=fixture-code&state=invalid-state',{redirect:'manual'})).status,400);
  const callback=await fetch(base+'/api/google-calendar/callback?code=fixture-code&state='+state,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'http://localhost:8000/?calendar_oauth=connected');assert.equal(callback.headers.get('referrer-policy'),'no-referrer');
  for(const [token,connected] of [['fixture-firebase',true],['fixture-firebase-b',false]]){const status=await fetch(base+'/api/google-calendar/status',{headers:{Authorization:'Bearer '+token}});assert.deepEqual(await status.json(),{connected});}
  const disconnected=await fetch(base+'/api/google-calendar/disconnect',{method:'POST',headers:{Authorization:'Bearer fixture-firebase'}});assert.deepEqual(await disconnected.json(),{connected:false,revoked:true});
});
