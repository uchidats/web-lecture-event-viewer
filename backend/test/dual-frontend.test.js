'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { readOAuthConfig, createGoogleOAuth, SCOPES } = require('../lib/google-oauth');
const { createServer } = require('../server');
const { ALLOWED_FRONTEND_URLS } = require('../lib/frontend-urls');
test('old and medconf frontends pass configuration and session validation, including denied callback return', async () => {
  for (const frontendUrl of ALLOWED_FRONTEND_URLS) {
    const config = readOAuthConfig({ GOOGLE_OAUTH_CLIENT_ID: 'fixture', GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example/api/google-calendar/callback', FRONTEND_URL: frontendUrl }, 'fixture-secret');
    const service = createGoogleOAuth({ config });
    const started = await service.connect('fixture-uid', 'fixture-subject');
    const state = new URL(started.authorizationUrl).searchParams.get('state');
    const result = await service.callback(new URLSearchParams({ state, error: 'access_denied' }), started.cookie.split(';')[0]);
    assert.equal(result.redirectUrl, frontendUrl + '?calendar_oauth=denied');
    const successful = createGoogleOAuth({ config, verifyIdentity: async () => 'fixture-subject',
      fetchImpl: async () => new Response(JSON.stringify({ refresh_token: 'fixture-refresh', id_token: 'fixture-id', scope: SCOPES.join(' ') }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    const connected = await successful.connect('fixture-uid', 'fixture-subject');
    const successState = new URL(connected.authorizationUrl).searchParams.get('state');
    const callback = await successful.callback(new URLSearchParams({ state: successState, code: 'fixture-code' }), connected.cookie.split(';')[0]);
    assert.equal(callback.redirectUrl, frontendUrl + '?calendar_oauth=connected');
  }
  for (const frontendUrl of ['https://evil.example/', 'https://medconf.jp.evil.example/ophthalconf/', 'https://medconf.jp/retinasight/', 'https://medconf.jp/ophthalconf/?next=evil'])
    assert.throws(() => readOAuthConfig({ GOOGLE_OAUTH_CLIENT_ID: 'fixture', GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example/api/google-calendar/callback', FRONTEND_URL: frontendUrl }, 'fixture-secret'), /allowed frontend/);
});
test('medconf origin CORS is allowed without paths; existing and rejected origins remain constrained', async t => {
  const server = createServer({ verifyIdToken: async () => ({ uid: 'fixture-uid' }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const origin of ['https://medconf.jp', 'https://uchidats.github.io', 'http://localhost:8000']) {
    const preflight = await fetch(base + '/api/google-calendar/connect', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' } });
    assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    const response = await fetch(base + '/api/me', { headers: { Origin: origin, Authorization: 'Bearer fixture' } });
    assert.equal(response.status, 200);
  }
  for (const origin of ['https://medconf.jp/ophthalconf/', 'https://medconf.jp.evil.example', 'http://medconf.jp', 'null'])
    assert.equal((await fetch(base + '/api/me', { headers: { Origin: origin, Authorization: 'Bearer fixture' } })).status, 403);
});
