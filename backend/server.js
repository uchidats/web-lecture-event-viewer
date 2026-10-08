'use strict';
const http = require('node:http');
const {createGoogleOAuth} = require('./lib/google-oauth');
const {loadOAuthConfig} = require('./lib/oauth-config');
const {assertProductionConfig} = require('./lib/production-config');
const ROUTES = new Map([
  ['/health','GET'], ['/api/me','GET'],
  ['/api/google-calendar/connect','POST'], ['/api/google-calendar/callback','GET'],
  ['/api/google-calendar/status','GET'], ['/api/google-calendar/disconnect','POST']
]);
const ALLOWED_ORIGINS = new Set(['https://uchidats.github.io', 'http://localhost:8000', 'https://medconf.jp']);
const INVALID_TOKEN_CODES = new Set([
  'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token',
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'
]);
function send(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}
function createServer({verifyIdToken, googleOAuth = createGoogleOAuth()} = {}) {
  if (typeof verifyIdToken !== 'function') throw new Error('A Firebase token verifier is required');
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.has(origin)) return send(res, 403, {error: 'origin_not_allowed'});
    if (origin) {res.setHeader('Access-Control-Allow-Origin', origin);res.setHeader('Access-Control-Allow-Credentials', 'true');}
    let url;
    try {url = new URL(req.url, 'http://backend');} catch {return send(res, 400, {error: 'bad_request'});}
    const pathname = url.pathname, expectedMethod = ROUTES.get(pathname);
    if (!expectedMethod) return send(res, 404, {error: 'not_found'});
    if (req.method === 'OPTIONS') {
      const method = req.headers['access-control-request-method'];
      const headers = (req.headers['access-control-request-headers'] || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!origin || method !== expectedMethod || headers.some(value => value !== 'authorization')) {
        return send(res, 403, {error: 'preflight_not_allowed'});
      }
      res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      res.setHeader('Access-Control-Allow-Methods', expectedMethod);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
      res.writeHead(204); return res.end();
    }
    if (req.method !== expectedMethod) {res.setHeader('Allow', `${expectedMethod}, OPTIONS`); return send(res, 405, {error: 'method_not_allowed'});}
    if (pathname === '/health') return send(res, 200, {ok: true});
    if (pathname === '/api/google-calendar/callback') {
      try {
        const result = await googleOAuth.callback(url.searchParams,req.headers.cookie);
        res.writeHead(303, {'Location':result.redirectUrl,'Set-Cookie':result.cookie});res.end();
      } catch (error) {
        const unavailable=['oauth_not_configured','oauth_session_store_unavailable'].includes(error.message);
        send(res, unavailable?503:400, {error:unavailable?'oauth_unavailable':'invalid_oauth_callback'});
      }
      return;
    }
    const match = typeof req.headers.authorization === 'string' && req.headers.authorization.match(/^Bearer ([^\s,]+)$/i);
    if (!match) {res.setHeader('WWW-Authenticate', 'Bearer'); return send(res, 401, {error: 'unauthorized'});}
    let decoded;
    try {
      decoded = await verifyIdToken(match[1]);
      if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) {
        res.setHeader('WWW-Authenticate', 'Bearer'); return send(res, 401, {error: 'unauthorized'});
      }
    } catch (error) {
      if (INVALID_TOKEN_CODES.has(error?.code)) {
        res.setHeader('WWW-Authenticate', 'Bearer'); send(res, 401, {error: 'unauthorized'});
      } else {
        // Do not log the token, Authorization header, claims or full SDK error.
        console.error('Firebase token verification unavailable');
        send(res, 503, {error: 'authentication_unavailable'});
      }
      return;
    }
    // Trust only the verified claim, never query parameters or a frontend-supplied uid.
    try {
      if (pathname === '/api/me') return send(res, 200, {uid:decoded.uid, authenticated:true});
      if (pathname === '/api/google-calendar/connect') {
        const identities=decoded.firebase?.identities?.['google.com'];
        if(!Array.isArray(identities)||identities.length!==1||typeof identities[0]!=='string')return send(res,403,{error:'google_identity_required'});
        const result = await googleOAuth.connect(decoded.uid,identities[0]);
        res.setHeader('Set-Cookie',result.cookie);return send(res, 200, {authorizationUrl:result.authorizationUrl});
      }
      if (pathname === '/api/google-calendar/status') return send(res,200,await googleOAuth.status(decoded.uid));
      if (pathname === '/api/google-calendar/disconnect') return send(res,200,await googleOAuth.disconnect(decoded.uid));
    } catch (error) {
      send(res, error.message==='oauth_not_configured'?503:['oauth_superseded','oauth_busy'].includes(error.message)?409:500, {error:error.message==='oauth_not_configured'?'oauth_not_configured':'calendar_connection_failed'});
    }
  });
}
async function start(env = process.env) {
  assertProductionConfig(env);
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const {createVerifier} = require('./lib/firebase');
  const {createTokenStore} = require('./lib/token-store-factory');
  const {createOAuthSessionStore} = require('./lib/oauth-session-store-factory');
  const config = await loadOAuthConfig(env);
  const tokenStore = createTokenStore(env);
  const sessionStore=createOAuthSessionStore(env);
  const googleOAuth = createGoogleOAuth({config, tokenStore, sessionStore});
  const server = createServer({verifyIdToken: createVerifier(env), googleOAuth});
  server.listen(port, '0.0.0.0', () => console.info(`OphthalConf backend listening on port ${port}`));
  server.on('error', () => {console.error('Backend server failed to listen'); process.exitCode = 1;});
  process.once('SIGTERM', () => {server.close(); setTimeout(() => process.exit(0), 10000).unref();});
  return server;
}
if (require.main === module) start().catch(error=>{
  if (error.code === 'UNSAFE_PRODUCTION_CONFIGURATION') console.error(error.message);
  else console.error('Backend startup failed. Check OAuth settings, secret provider access and store configuration.');
  process.exitCode=1;
});
module.exports = {createServer, start};
