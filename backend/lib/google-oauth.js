'use strict';
const {MemoryTokenStore}=require('./token-store');
const {MemoryOAuthSessionStore,randomId,digest}=require('./oauth-state');
const {OAuth2Client}=require('google-auth-library');
const {ALLOWED_FRONTEND_URLS}=require('./frontend-urls');
const CALENDAR_SCOPES=['https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events'];
const SCOPES=[...CALENDAR_SCOPES,'openid'];
const COOKIE_NAME='ophthalconf_calendar_oauth';
const identityClient=new OAuth2Client();
async function verifyGoogleIdentity(idToken,audience){
  const ticket=await identityClient.verifyIdToken({idToken,audience});
  return ticket.getPayload()?.sub;
}
function readOAuthConfig(env=process.env,clientSecret,{requireSecret=true}={}){
  const config={clientId:env.GOOGLE_OAUTH_CLIENT_ID,clientSecret,
    redirectUri:env.GOOGLE_OAUTH_REDIRECT_URI,frontendUrl:env.FRONTEND_URL||'http://localhost:8000/'};
  if(!config.clientId&&!config.clientSecret&&!config.redirectUri)return null;
  if(!config.clientId||!config.redirectUri||(requireSecret&&!config.clientSecret))throw new Error('All three Google OAuth settings are required');
  const redirect=new URL(config.redirectUri),frontend=new URL(config.frontendUrl);
  const local=redirect.protocol==='http:'&&redirect.hostname==='localhost'&&redirect.port==='8080';
  if((!local&&redirect.protocol!=='https:')||redirect.username||redirect.password||redirect.search||redirect.hash||redirect.pathname!=='/api/google-calendar/callback')throw new Error('Invalid GOOGLE_OAUTH_REDIRECT_URI');
  if(!ALLOWED_FRONTEND_URLS.has(frontend.href))throw new Error('FRONTEND_URL must be an allowed frontend URL');
  if(env.OAUTH_SESSION_STORE==='firestore'&&env.TOKEN_STORE!=='firestore')throw new Error('Firestore sessions require TOKEN_STORE=firestore');
  if(env.K_SERVICE||env.NODE_ENV==='production'){
    if(env.OAUTH_SESSION_STORE!=='firestore'||env.TOKEN_STORE!=='firestore')throw new Error('Memory OAuth storage is local-only');
    if(redirect.protocol!=='https:'||frontend.protocol!=='https:')throw new Error('Production OAuth requires HTTPS');
    if(env.FIRESTORE_EMULATOR_HOST)throw new Error('Production OAuth cannot use an emulator');
  }
  return config;
}
function createGoogleOAuth({config,tokenStore=new MemoryTokenStore(),sessionStore,stateStore,fetchImpl=fetch,verifyIdentity=verifyGoogleIdentity}={}){
  const sessions=sessionStore||stateStore||new MemoryOAuthSessionStore();
  if(sessions.transactional&&(!tokenStore.saveRefreshTokenIfCurrent||!tokenStore.deleteRefreshTokenIfCurrent))throw new Error('Shared sessions require a transactional TokenStore');
  function requireConfig(){if(!config)throw new Error('oauth_not_configured');}
  async function post(url,params){
    const response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),
      redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('oauth_provider_failed');return response;
  }
  function cookie(nonce,clear=false){
    const secure=config?.redirectUri.startsWith('https:')?'; Secure':'';
    return COOKIE_NAME+'='+nonce+'; HttpOnly; SameSite=Lax; Path=/api/google-calendar/callback; Max-Age='+(clear?0:600)+secure;
  }
  async function saveCurrent(session,token){
    if(tokenStore.saveRefreshTokenIfCurrent)return tokenStore.saveRefreshTokenIfCurrent(session.uid,token,sessions,session.generation);
    return sessions.runIfCurrent(session.uid,session.generation,()=>tokenStore.saveRefreshToken(session.uid,token));
  }
  async function deleteCurrent(uid,generation){
    if(tokenStore.deleteRefreshTokenIfCurrent)return tokenStore.deleteRefreshTokenIfCurrent(uid,sessions,generation);
    return sessions.runIfCurrent(uid,generation,()=>tokenStore.deleteRefreshToken(uid));
  }
  return{
    async connect(uid,googleSubject){
      requireConfig();
      if(typeof googleSubject!=='string'||!googleSubject||googleSubject.length>255)throw new Error('google_identity_required');
      const generation=await sessions.rotate(uid),state=randomId(),browserNonce=randomId(),codeVerifier=randomId(),createdAt=sessions.now();
      await sessions.save(state,{uid,googleSubject,generation,codeVerifier,browserDigest:digest(browserNonce),createdAt,expiresAt:createdAt+sessions.ttlMs,
        frontendUrl:config.frontendUrl,clientId:config.clientId,redirectUri:config.redirectUri});
      const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',
        scope:SCOPES.join(' '),access_type:'offline',prompt:'consent',state,code_challenge:digest(codeVerifier),code_challenge_method:'S256'}).toString();
      return{authorizationUrl:url.href,cookie:cookie(browserNonce)};
    },
    async callback(query,cookieHeader=''){
      requireConfig();
      if(['state','code','error'].some(key=>query.getAll(key).length>1))throw new Error('oauth_invalid_callback');
      const pairs=cookieHeader.split(';').map(value=>value.trim()).filter(value=>value.startsWith(COOKIE_NAME+'='));
      const nonce=pairs.length===0?null:pairs.length===1?pairs[0].slice(COOKIE_NAME.length+1):'';
      const session=await sessions.consume(query.get('state'),nonce);
      if(!session)throw new Error('oauth_invalid_state');
      if(session.clientId!==config.clientId||session.redirectUri!==config.redirectUri)throw new Error('oauth_invalid_state');
      const redirect=new URL(session.frontendUrl);let outcome='failed';
      if(query.has('error'))outcome='denied';
      else if(query.get('code')&&query.get('code').length<=4096){
        try{
          const response=await post('https://oauth2.googleapis.com/token',{client_id:config.clientId,client_secret:config.clientSecret,
            redirect_uri:session.redirectUri,grant_type:'authorization_code',code:query.get('code'),code_verifier:session.codeVerifier});
          const tokens=await response.json(),granted=typeof tokens.scope==='string'?tokens.scope.split(/\s+/):[];
          if(!CALENDAR_SCOPES.every(scope=>granted.includes(scope))||typeof tokens.id_token!=='string'||!tokens.id_token)throw new Error('oauth_identity_or_scopes_missing');
          // A valid state identifies the initiating Firebase user. Signed Google identity prevents login CSRF without a cookie.
          if(await verifyIdentity(tokens.id_token,config.clientId)!==session.googleSubject)throw new Error('oauth_account_mismatch');
          if(sessions.now()>=session.expiresAt)throw new Error('oauth_expired');
          let saved;
          if(typeof tokens.refresh_token==='string'&&tokens.refresh_token)saved=await saveCurrent(session,tokens.refresh_token);
          else{
            if(!(await tokenStore.getRefreshToken(session.uid)))throw new Error('oauth_refresh_token_missing');
            saved=await sessions.runIfCurrent(session.uid,session.generation,async()=>{});
          }
          if(!saved)throw new Error('oauth_superseded');
          outcome='connected';
        }catch{outcome='failed';}
      }
      redirect.searchParams.set('calendar_oauth',outcome);
      return{redirectUrl:redirect.href,cookie:cookie('',true)};
    },
    async status(uid){return{connected:!!(typeof tokenStore.hasRefreshToken==='function'?await tokenStore.hasRefreshToken(uid):await tokenStore.getRefreshToken(uid))};},
    async disconnect(uid){
      const generation=await sessions.rotate(uid,{disconnecting:true});let revoked=false,deleted;
      try{
        const token=await tokenStore.getRefreshToken(uid);
        if(token){try{await post('https://oauth2.googleapis.com/revoke',{token});revoked=true;}catch{}}
      }finally{try{deleted=await deleteCurrent(uid,generation);}finally{await sessions.release(uid,generation);}}
      if(!deleted)throw new Error('oauth_superseded');
      return{connected:false,revoked};
    }
  };
}
module.exports={createGoogleOAuth,readOAuthConfig,SCOPES,CALENDAR_SCOPES};
