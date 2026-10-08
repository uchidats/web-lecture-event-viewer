'use strict';
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {ALLOWED_FRONTEND_URLS}=require('./frontend-urls');
const randomId=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('base64url');
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
function validateSession(data){
  if(!data||typeof data.uid!=='string'||!data.uid||data.uid.includes('/')||typeof data.googleSubject!=='string'||!data.googleSubject||
    !validId(data.generation)||!validId(data.codeVerifier)||!validId(data.browserDigest)||!Number.isFinite(data.createdAt)||!Number.isFinite(data.expiresAt)||
    data.expiresAt<=data.createdAt||data.expiresAt-data.createdAt>600000||
    !ALLOWED_FRONTEND_URLS.has(data.frontendUrl)||
    typeof data.clientId!=='string'||typeof data.redirectUri!=='string')throw new Error('invalid_oauth_session');
  return Object.fromEntries(['uid','googleSubject','generation','codeVerifier','browserDigest','createdAt','expiresAt','frontendUrl','clientId','redirectUri'].map(key=>[key,data[key]]));
}
function cookieMatches(session,nonce){
  if(nonce===undefined||nonce===null)return true;
  if(!validId(nonce)||!validId(session.browserDigest))return false;
  return timingSafeEqual(Buffer.from(session.browserDigest,'base64url'),Buffer.from(digest(nonce),'base64url'));
}
class MemoryOAuthSessionStore{
  #sessions=new Map();#generations=new Map();#locks=new Map();#leases=new Map();
  constructor({now=Date.now,ttlMs=600000,limit=1000}={}){this.now=now;this.ttlMs=ttlMs;this.limit=limit;this.transactional=false;}
  async #exclusive(uid,work){
    const previous=this.#locks.get(uid)||Promise.resolve(),task=previous.catch(()=>{}).then(work);this.#locks.set(uid,task);
    try{return await task;}finally{if(this.#locks.get(uid)===task)this.#locks.delete(uid);}
  }
  async rotate(uid,{disconnecting=false}={}){return this.#exclusive(uid,()=>{
    if((this.#leases.get(uid)||0)>this.now())throw new Error('oauth_busy');
    const generation=randomId();this.#generations.set(uid,generation);
    if(disconnecting)this.#leases.set(uid,this.now()+60000);else this.#leases.delete(uid);return generation;
  });}
  async release(uid,generation){return this.#exclusive(uid,()=>{if(this.#generations.get(uid)===generation)this.#leases.delete(uid);});}
  async save(id,data){
    if(!validId(id))throw new Error('invalid_oauth_session');const session=validateSession(data);
    for(const [key,value]of this.#sessions)if(value.expiresAt<=this.now())this.#sessions.delete(key);
    if(this.#sessions.size>=this.limit||this.#sessions.has(id))throw new Error('oauth_session_capacity');
    this.#sessions.set(id,session);
  }
  async consume(id,nonce){
    if(!validId(id))return null;const session=this.#sessions.get(id);if(!session)return null;
    if(session.expiresAt<=this.now()||this.#generations.get(session.uid)!==session.generation){this.#sessions.delete(id);return null;}
    if(!cookieMatches(session,nonce))return null;
    this.#sessions.delete(id);return {...session};
  }
  async delete(id){this.#sessions.delete(id);}
  async runIfCurrent(uid,generation,work){if(!validId(generation))return false;return this.#exclusive(uid,async()=>{if(this.#generations.get(uid)!==generation)return false;await work();return true;});}
}
module.exports={MemoryOAuthSessionStore,MemoryOAuthStateStore:MemoryOAuthSessionStore,randomId,digest,validId,validateSession,cookieMatches};
