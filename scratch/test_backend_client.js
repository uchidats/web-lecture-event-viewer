const assert = require('node:assert/strict');
const {createController} = require('../firebase-auth');
async function main() {
  let observer, calls=[], mode='ok', tokenCalls=0;
  const user={uid:'verified-uid',getIdToken:async()=>{tokenCalls++;return 'mock-firebase-id-token';}};
  const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>({}),browserLocalPersistence:'local',setPersistence:async()=>{},onAuthStateChanged:(_,fn)=>{observer=fn;fn(user);}};
  const controller=createController({config:{apiKey:'test',authDomain:'test',projectId:'test',appId:'test'},load:async()=>sdk,
    fetchImpl:async(url,options)=>{
      calls.push({url,options});return {ok:mode!=='401',status:mode==='401'?401:200,json:async()=>{
        if(url.endsWith('/connect'))return {authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'};
        if(url.endsWith('/status'))return {connected:true};
        if(url.endsWith('/disconnect'))return {connected:false,revoked:true};
        return {uid:mode==='wrong'?'attacker':user.uid,authenticated:true,email:'discarded'};
      }};
    }});
  await controller.init();assert.deepEqual(await controller.testBackend('http://localhost:8080'),{uid:'verified-uid',authenticated:true});
  assert.equal(calls[0].url,'http://localhost:8080/api/me');assert.equal(calls[0].options.headers.Authorization,'Bearer mock-firebase-id-token');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');
  await controller.testBackend('https://service.example');
  for(const url of ['http://evil.example','https://user:pass@service.example','https://service.example/path','https://service.example?token=x','https://service.example/#x']) await assert.rejects(controller.testBackend(url));
  assert.equal(tokenCalls,2,'invalid URLs are rejected before token retrieval');
  mode='401';await assert.rejects(controller.testBackend('https://service.example'),/backend-http-401/);
  mode='wrong';await assert.rejects(controller.testBackend('https://service.example'),/backend-identity-mismatch/);
  mode='ok';assert.deepEqual(await controller.getCalendarConnectionStatus(),{connected:true});
  assert.equal(calls.at(-1).url,'http://localhost:8080/api/google-calendar/status');
  await controller.connectServerCalendar();assert.equal(calls.at(-1).options.method,'POST');assert.equal(calls.at(-1).options.credentials,'include');
  assert.deepEqual(await controller.disconnectServerCalendar(),{connected:false,revoked:true});assert.equal(calls.at(-1).options.method,'POST');
  observer(null);await assert.rejects(controller.testBackend('http://localhost:8080'),/not-signed-in/);
  console.log('PASS: backend client Firebase bearer header, destination validation, response identity, HTTP failure and signed-out rejection.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
