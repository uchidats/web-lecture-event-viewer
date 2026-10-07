const assert = require('node:assert/strict');
const {createController, mount} = require('../firebase-auth.js');
const config = {apiKey:'public-test', authDomain:'test.firebaseapp.com', projectId:'test', appId:'test-app'};
function fixture() {
  let persisted = null, observer, error, hold, popupCalls = 0;
  const order = [];
  const sdk = {
    getApps: () => [], initializeApp: (cfg, name) => {assert.equal(cfg, config); assert.equal(name,'ophthalconf-auth');return {};},
    getAuth: () => ({}), browserLocalPersistence:'local',
    setPersistence: async (_, persistence) => {assert.equal(persistence,'local');order.push('persistence');},
    onAuthStateChanged: (_, next) => {order.push('observer');observer = next;next(persisted);},
    GoogleAuthProvider: class {setCustomParameters(params) {assert.deepEqual(params,{prompt:'select_account'});}},
    signInWithPopup: async () => {popupCalls++; if(hold) await hold; if(error) throw {code:error}; persisted={uid:'same-google-uid', displayName:'<img onerror=alert(1)>', email:'test@example.org',getIdToken:async()=> 'mock-id-token'}; observer(persisted);},
    signOut: async () => {if(error) throw {code:error};persisted=null;observer(null);}
  };
  return {controller: () => createController({config,load:async()=>sdk}), order,
    setError(value){error=value;},setHold(value){hold=value;},get popupCalls(){return popupCalls;},
    setVerified(value){persisted.emailVerified=value;observer(persisted);},
    externalLogout(){persisted=null;observer(null);}};
}
async function main() {
  let loads=0;const missing=createController({config:{},load:()=>{loads++;}});await missing.init();assert.equal(missing.snapshot().phase,'unconfigured');await missing.login();assert.equal(loads,0);
  const f=fixture(), auth=f.controller();await auth.init();assert.deepEqual(f.order,['persistence','observer']);assert.equal(auth.getUid(),null);
  await auth.login();assert.equal(auth.getUid(),'same-google-uid');assert.equal(await auth.getIdToken(),'mock-id-token');
  assert.equal(auth.snapshot().user.emailVerified,false,'missing verification must default to false');
  f.setVerified(true);assert.equal(auth.snapshot().user.emailVerified,true);
  f.setVerified('true');assert.equal(auth.snapshot().user.emailVerified,false,'only boolean true is verified');
  const restored=f.controller();await restored.init();assert.equal(restored.getUid(),auth.getUid(),'SDK persisted user restores after controller recreation');
  await restored.logout();assert.equal(restored.getUid(),null);await assert.rejects(restored.getIdToken(),/not-signed-in/);
  f.setError('auth/popup-blocked');await restored.login();assert.equal(restored.getUid(),null);assert.match(restored.snapshot().message,/ポップアップ/);assert.equal(restored.snapshot().busy,false);
  f.setError(null);let release;f.setHold(new Promise(resolve=>release=resolve));const login=restored.login();await restored.login();assert.equal(f.popupCalls,3,'double clicks do not open another popup');release();await login;
  f.setError('auth/network-request-failed');await restored.logout();assert.equal(restored.getUid(),'same-google-uid','failed logout preserves observed identity');f.setError(null);f.externalLogout();assert.equal(restored.getUid(),null);
  const nodes=Object.fromEntries(['auth-login','auth-logout','auth-user','auth-status'].map(id=>[id,{addEventListener(type,fn){this.click=fn;}}]));
  const ui=f.controller();mount(ui,{getElementById:id=>nodes[id]});await ui.init();assert.equal(nodes['auth-login'].disabled,false);assert.equal(nodes['auth-logout'].hidden,true);
  await nodes['auth-login'].click();assert.equal(nodes['auth-user'].textContent,'<img onerror=alert(1)>');assert.equal(nodes['auth-login'].hidden,true);await nodes['auth-logout'].click();assert.equal(nodes['auth-user'].hidden,true);
  const unavailable=createController({config,load:async()=>{throw new Error('offline');}});await unavailable.init();assert.equal(unavailable.snapshot().phase,'error');
  console.log('PASS: Firebase config guard, local persistence setup, observed identity, restoration, logout, popup/errors, double click and safe UI rendering (mock SDK).');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
