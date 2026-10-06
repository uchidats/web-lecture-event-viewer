'use strict';
const {MemoryOAuthSessionStore}=require('./oauth-state');
function createOAuthSessionStore(env=process.env,{getFirestoreClient=(...args)=>require('./firebase').getFirestoreClient(...args)}={}) {
  const mode=env.OAUTH_SESSION_STORE===undefined?'memory':env.OAUTH_SESSION_STORE;
  if(mode==='memory')return new MemoryOAuthSessionStore();
  if(mode!=='firestore')throw new Error('OAUTH_SESSION_STORE must be memory or firestore');
  const {FirestoreOAuthSessionStore}=require('./firestore-oauth-session-store');
  return new FirestoreOAuthSessionStore({firestore:getFirestoreClient(env)});
}
module.exports={createOAuthSessionStore};
