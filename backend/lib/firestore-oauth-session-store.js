'use strict';
const {Timestamp,FieldValue}=require('firebase-admin/firestore');
const {randomId,validId,validateSession,cookieMatches}=require('./oauth-state');
const COLLECTION='oauthSessions',COORDINATION_COLLECTION='oauthConnectionGenerations';
class FirestoreOAuthSessionStore {
  constructor({firestore,now=Date.now,ttlMs=600000}={}) {
    if(!firestore || typeof firestore.runTransaction!=='function')throw new Error('Firestore client required');
    this.firestore=firestore;this.now=now;this.ttlMs=ttlMs;this.transactional=true;
  }
  #sessionRef(id){if(!validId(id))throw new Error('invalid_oauth_session');return this.firestore.collection(COLLECTION).doc(id);}
  #userRef(uid){if(typeof uid!=='string'||!uid||uid.includes('/')||uid==='.'||uid==='..')throw new Error('invalid_oauth_session');return this.firestore.collection(COORDINATION_COLLECTION).doc(uid);}
  async rotate(uid,{disconnecting=false}={}) {
    try {
      const ref=this.#userRef(uid),generation=randomId();
      await this.firestore.runTransaction(async tx=>{
        const current=await tx.get(ref);
        if((current.data()?.leaseUntil?.toMillis()||0)>this.now())throw new Error('oauth_busy');
        const data={generation,updatedAt:FieldValue.serverTimestamp()};
        if(disconnecting)data.leaseUntil=Timestamp.fromMillis(this.now()+60000);
        tx.set(ref,data);
      });return generation;
    }catch(error){throw new Error(error.message==='oauth_busy'?'oauth_busy':'oauth_session_store_unavailable');}
  }
  async release(uid,generation){
    try{const ref=this.#userRef(uid);await this.firestore.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.generation===generation)tx.set(ref,{generation,updatedAt:FieldValue.serverTimestamp()});});}
    catch{throw new Error('oauth_session_store_unavailable');}
  }
  async save(id,data) {
    try {
      const session=validateSession(data),ref=this.#sessionRef(id);
      await ref.create({...session,createdAt:Timestamp.fromMillis(session.createdAt),expiresAt:Timestamp.fromMillis(session.expiresAt)});
    }catch{throw new Error('oauth_session_store_unavailable');}
  }
  async consume(id,nonce) {
    if(!validId(id))return null;
    try {
      const ref=this.#sessionRef(id);
      return await this.firestore.runTransaction(async tx=>{
        const snapshot=await tx.get(ref);if(!snapshot.exists)return null;
        const raw=snapshot.data();let session;
        try{session=validateSession({...raw,createdAt:raw.createdAt?.toMillis(),expiresAt:raw.expiresAt?.toMillis()});}catch{tx.delete(ref);return null;}
        if(session.expiresAt<=this.now()){tx.delete(ref);return null;}
        const current=await tx.get(this.#userRef(session.uid));
        if(current.data()?.generation!==session.generation){tx.delete(ref);return null;}
        if(!cookieMatches(session,nonce))return null;
        tx.delete(ref);return session;
      });
    }catch{throw new Error('oauth_session_store_unavailable');}
  }
  async delete(id){try{await this.#sessionRef(id).delete();}catch{throw new Error('oauth_session_store_unavailable');}}
  async runIfCurrent(uid,generation,work) {
    if(!validId(generation))return false;
    try{return await this.firestore.runTransaction(async tx=>{const current=await tx.get(this.#userRef(uid));if(current.data()?.generation!==generation)return false;await work(tx);return true;});}
    catch{throw new Error('oauth_session_store_unavailable');}
  }
}
module.exports={FirestoreOAuthSessionStore,COLLECTION,COORDINATION_COLLECTION};
