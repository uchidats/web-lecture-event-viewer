'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {randomBytes}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {EnvironmentSecretProvider,GoogleSecretManagerProvider,createSecretProvider}=require('../lib/secret-provider');
const {loadOAuthConfig}=require('../lib/oauth-config');
const {createGoogleOAuth,SCOPES}=require('../lib/google-oauth');
// All credential-like test values are generated at runtime and never used against Google.
const synthetic=()=>randomBytes(32).toString('hex');
const settings={FIREBASE_PROJECT_ID:'demo-ophthalconf',GOOGLE_OAUTH_CLIENT_ID:'synthetic-client',GOOGLE_OAUTH_REDIRECT_URI:'http://localhost:8080/api/google-calendar/callback'};
test('default env provider does not construct a remote client and caches the value',async()=>{
  let clients=0;const value=synthetic(),env={...settings,GOOGLE_OAUTH_CLIENT_SECRET:value};
  const provider=createSecretProvider(env,{clientFactory:()=>{clients++;throw new Error('must not connect');}});
  assert.ok(provider instanceof EnvironmentSecretProvider);assert.equal(await provider.getGoogleOAuthClientSecret(),value);
  env.GOOGLE_OAUTH_CLIENT_SECRET=synthetic();assert.equal(await provider.getGoogleOAuthClientSecret(),value);assert.equal(clients,0);
  const config=await loadOAuthConfig({...settings,GOOGLE_OAUTH_CLIENT_SECRET:value});assert.equal(config.clientSecret,value);
  assert.equal(await loadOAuthConfig({}),null);
});
test('Secret Manager is selected explicitly, accesses latest with ADC client and single-flight cache',async()=>{
  const value=synthetic();let calls=0,clients=0,closed=0;
  const provider=createSecretProvider({...settings,SECRET_PROVIDER:'secret-manager',GOOGLE_OAUTH_CLIENT_SECRET:synthetic(),GOOGLE_OAUTH_CLIENT_SECRET_NAME:'ophthalconf-google-oauth-client-secret'},
    {clientFactory:()=>{clients++;return{accessSecretVersion:async(request,options)=>{
      calls++;assert.equal(request.name,'projects/demo-ophthalconf/secrets/ophthalconf-google-oauth-client-secret/versions/latest');assert.equal(options.timeout,10000);
      return[{payload:{data:Buffer.from(value)}}];},close:async()=>{closed++;}};}});
  assert.ok(provider instanceof GoogleSecretManagerProvider);assert.equal(clients,0);
  const results=await Promise.all(Array.from({length:8},()=>provider.getGoogleOAuthClientSecret()));assert.ok(results.every(result=>result===value));
  assert.equal(await provider.getGoogleOAuthClientSecret(),value);assert.equal(calls,1);assert.equal(clients,1);assert.equal(closed,1);
  const config=await loadOAuthConfig({...settings,SECRET_PROVIDER:'secret-manager'},{provider});assert.equal(config.clientSecret,value);assert.equal(calls,1);
});
test('env and mocked Secret Manager values reach OAuth exchange without logging',async t=>{
  const logs=[],originals={};for(const level of ['info','warn','error','log']){originals[level]=console[level];console[level]=(...args)=>logs.push(args);}
  t.after(()=>{for(const level of Object.keys(originals))console[level]=originals[level];});
  for(const mode of ['env','secret-manager']){
    const value=synthetic();let reads=0,exchanges=0;
    const env={...settings,SECRET_PROVIDER:mode,GOOGLE_OAUTH_CLIENT_SECRET:value};
    const provider=createSecretProvider(env,{clientFactory:()=>({accessSecretVersion:async()=>{reads++;return[{payload:{data:Buffer.from(value)}}];},close:async()=>{}})});
    const config=await loadOAuthConfig(env,{provider});
    const oauth=createGoogleOAuth({config,verifyIdentity:async()=>'synthetic-google-subject',fetchImpl:async(_,request)=>{
      exchanges++;assert.equal(new URLSearchParams(request.body).get('client_secret'),value);
      return{ok:true,json:async()=>({scope:SCOPES.join(' '),id_token:'synthetic-id-token',refresh_token:synthetic()})};}});
    for(let i=0;i<2;i++){const started=await oauth.connect('synthetic-uid','synthetic-google-subject');const state=new URL(started.authorizationUrl).searchParams.get('state');
      const callback=await oauth.callback(new URLSearchParams({state,code:'synthetic-code'}));assert.equal(new URL(callback.redirectUrl).searchParams.get('calendar_oauth'),'connected');}
    assert.equal(exchanges,2);assert.equal(reads,mode==='secret-manager'?1:0);assert.equal(JSON.stringify(logs).includes(value),false);
  }
});
test('missing/empty secret, remote and client-construction failures are safely redacted and cached',async()=>{
  const value=synthetic();let calls=0;
  const providers=[new EnvironmentSecretProvider({}),new EnvironmentSecretProvider({GOOGLE_OAUTH_CLIENT_SECRET:'  '}),
    new GoogleSecretManagerProvider({projectId:'demo-ophthalconf',clientFactory:()=>{throw new Error(value);}}),
    new GoogleSecretManagerProvider({projectId:'demo-ophthalconf',clientFactory:()=>({accessSecretVersion:async()=>{calls++;throw new Error(value);},close:async()=>{}})}),
    new GoogleSecretManagerProvider({projectId:'demo-ophthalconf',clientFactory:()=>({accessSecretVersion:async()=>[{payload:{data:Buffer.alloc(0)}}],close:async()=>{}})})];
  for(const provider of providers)for(let i=0;i<2;i++)await assert.rejects(provider.getGoogleOAuthClientSecret(),error=>error.message==='oauth_secret_unavailable'&&!error.cause&&!error.stack.includes(value));
  assert.equal(calls,1);
  await assert.rejects(loadOAuthConfig(settings,{provider:{getGoogleOAuthClientSecret:async()=>{throw new Error(value);}}}),error=>error.message==='oauth_secret_unavailable'&&!error.cause);
});
test('bad public config avoids remote calls; production env mode refuses startup without leaking',async()=>{
  let calls=0;await assert.rejects(loadOAuthConfig({GOOGLE_OAUTH_CLIENT_ID:'synthetic-client'},{provider:{getGoogleOAuthClientSecret:async()=>{calls++;return synthetic();}}}));assert.equal(calls,0);
  assert.throws(()=>createSecretProvider({SECRET_PROVIDER:'invalid'}),/SECRET_PROVIDER/);
  for(const env of [{NODE_ENV:'production'},{NODE_ENV:'production',SECRET_PROVIDER:'env'},{K_SERVICE:'synthetic-cloud-run'}])assert.throws(()=>createSecretProvider(env),/Production requires/);
  assert.ok(createSecretProvider({...settings,NODE_ENV:'production',SECRET_PROVIDER:'secret-manager'}) instanceof GoogleSecretManagerProvider);
  const value=synthetic();const result=spawnSync(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',env:{...process.env,...settings,NODE_ENV:'production',TOKEN_STORE:'firestore',OAUTH_SESSION_STORE:'firestore',SECRET_PROVIDER:'env',GOOGLE_OAUTH_CLIENT_SECRET:value}});
  assert.equal(result.status,1);assert.match(result.stderr,/Production configuration is unsafe: SECRET_PROVIDER must be secret-manager/);assert.equal((result.stdout+result.stderr).includes(value),false);
});
