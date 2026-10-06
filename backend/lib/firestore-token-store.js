'use strict';
const {FieldValue} = require('firebase-admin/firestore');
const COLLECTION = 'googleCalendarTokens';
// Future KMS adapters can implement async encode/decode without changing OAuth callers.
const plaintextCodec = Object.freeze({encode: async token => token, decode: async value => value});
class FirestoreTokenStore {
  #db; #codec; #timestamp;
  constructor({firestore, codec = plaintextCodec, serverTimestamp = () => FieldValue.serverTimestamp()} = {}) {
    if (!firestore || typeof firestore.collection !== 'function' || typeof firestore.runTransaction !== 'function') throw new Error('Firestore client required');
    if (typeof codec.encode !== 'function' || typeof codec.decode !== 'function') throw new Error('Token codec required');
    this.#db = firestore; this.#codec = codec; this.#timestamp = serverTimestamp;
  }
  #ref(uid) {
    if (typeof uid !== 'string' || !uid || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid token store uid');
    return this.#db.collection(COLLECTION).doc(uid);
  }
  async saveRefreshToken(uid, token) {
    if (typeof token !== 'string' || !token) throw new Error('Invalid token store input');
    try {
      const ref = this.#ref(uid), encoded = await this.#codec.encode(token, uid);
      if (typeof encoded !== 'string' || !encoded) throw new Error('Invalid encoded token');
      await this.#db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        // Write only this schema; never persist access tokens, codes or provider responses.
        tx.set(ref, {refreshToken:encoded, createdAt:snapshot.exists && snapshot.data().createdAt || this.#timestamp(),
          updatedAt:this.#timestamp(), provider:'google'});
      });
    } catch {throw new Error('token_store_unavailable');} // Never expose an SDK/codec error containing a token.
  }
  async getRefreshToken(uid) {
    try {
      const snapshot = await this.#ref(uid).get();
      const encoded = snapshot.exists ? snapshot.data().refreshToken : null;
      if (typeof encoded !== 'string' || !encoded) return null;
      const token = await this.#codec.decode(encoded, uid);
      if (typeof token !== 'string' || !token) throw new Error('Invalid decoded token');
      return token;
    } catch {throw new Error('token_store_unavailable');}
  }
  async hasRefreshToken(uid) {
    try {
      const snapshot = await this.#ref(uid).get();
      const value = snapshot.exists ? snapshot.data().refreshToken : null;
      return typeof value === 'string' && !!value;
    } catch {throw new Error('token_store_unavailable');}
  }
  async deleteRefreshToken(uid) {
    try {await this.#ref(uid).delete();} catch {throw new Error('token_store_unavailable');}
  }
  async saveRefreshTokenIfCurrent(uid,token,sessionStore,generation) {
    try {
      if(!sessionStore.transactional)return await sessionStore.runIfCurrent(uid,generation,()=>this.saveRefreshToken(uid,token));
      if(sessionStore.firestore!==this.#db)throw new Error('Store database mismatch');
      const ref=this.#ref(uid),encoded=await this.#codec.encode(token,uid);
      if(typeof encoded!=='string'||!encoded)throw new Error('Invalid encoded token');
      return await sessionStore.runIfCurrent(uid,generation,async tx=>{
        const snapshot=await tx.get(ref);tx.set(ref,{refreshToken:encoded,createdAt:snapshot.data()?.createdAt||this.#timestamp(),updatedAt:this.#timestamp(),provider:'google'});
      });
    }catch{throw new Error('token_store_unavailable');}
  }
  async deleteRefreshTokenIfCurrent(uid,sessionStore,generation) {
    try {
      if(!sessionStore.transactional)return await sessionStore.runIfCurrent(uid,generation,()=>this.deleteRefreshToken(uid));
      if(sessionStore.firestore!==this.#db)throw new Error('Store database mismatch');
      const ref=this.#ref(uid);return await sessionStore.runIfCurrent(uid,generation,async tx=>{tx.delete(ref);});
    }catch{throw new Error('token_store_unavailable');}
  }
}
module.exports = {FirestoreTokenStore, COLLECTION};
