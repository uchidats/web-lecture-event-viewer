'use strict';
const {MemoryTokenStore} = require('./token-store');
function createTokenStore(env = process.env, {getFirestoreClient = (...args)=>require('./firebase').getFirestoreClient(...args), codec} = {}) {
  const mode = env.TOKEN_STORE === undefined ? 'memory' : env.TOKEN_STORE;
  if (mode === 'memory') return new MemoryTokenStore();
  if (mode !== 'firestore') throw new Error('TOKEN_STORE must be memory or firestore');
  const {FirestoreTokenStore} = require('./firestore-token-store');
  return new FirestoreTokenStore({firestore:getFirestoreClient(env), codec});
}
module.exports = {createTokenStore};
