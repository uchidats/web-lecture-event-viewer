'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {once} = require('node:events');
const {createServer} = require('../server');
const {createVerifier} = require('../lib/firebase');

test('HTTP routes, verified identity, denied tokens and restricted CORS', async t => {
  const received = [];
  const server = createServer({verifyIdToken: async token => {
    received.push(token);
    if (token === 'valid-fixture') return {uid:'verified-uid', email:'not-returned@example.org'};
    if (token === 'missing-uid') return {};
    if (token === 'outage') throw {code:'auth/internal-error'};
    throw {code: token === 'expired-fixture' ? 'auth/id-token-expired' : 'auth/argument-error'};
  }});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (route, headers={}, method='GET') => fetch(url+route,{headers,method});
  const health = await request('/health');assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true});assert.equal(received.length,0);
  for (const authorization of [undefined,'Basic example','Bearer','Bearer two tokens','Bearer bad-fixture','Bearer expired-fixture','Bearer missing-uid']) {
    const response = await request('/api/me',authorization ? {authorization} : {});
    assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthorized'});assert.equal(response.headers.get('www-authenticate'),'Bearer');
  }
  const response = await request('/api/me?uid=attacker', {authorization:'Bearer valid-fixture',origin:'https://uchidats.github.io'});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{uid:'verified-uid',authenticated:true});assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('access-control-allow-origin'),'https://uchidats.github.io');
  for (const origin of ['http://localhost:8000','https://uchidats.github.io']) {
    const preflight = await request('/api/me',{origin,'access-control-request-method':'GET','access-control-request-headers':'authorization'},'OPTIONS');
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(preflight.headers.get('access-control-allow-headers'),'Authorization');
  }
  const before=received.length;
  for (const origin of ['https://evil.example','null','https://uchidats.github.io.evil.example','http://localhost:8001']) {
    const denied = await request('/api/me',{origin,authorization:'Bearer valid-fixture'});
    assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  }
  assert.equal(received.length,before,'disallowed origins do not invoke verification');
  assert.equal((await request('/api/me',{origin:'http://localhost:8000','access-control-request-method':'POST'},'OPTIONS')).status,403);
  assert.equal((await request('/api/me',{origin:'http://localhost:8000','access-control-request-method':'GET','access-control-request-headers':'X-Unsafe'},'OPTIONS')).status,403);
  assert.equal((await request('/api/me',{authorization:'Bearer valid-fixture'},'POST')).status,405);
  assert.equal((await request('/api/other')).status,404);
  assert.equal((await request('/api/me',{authorization:'Bearer outage'})).status,503);
});

test('real Admin SDK rejects malformed tokens; configuration fails closed', async () => {
  assert.throws(()=>createVerifier({}),/FIREBASE_PROJECT_ID/);
  assert.throws(()=>createVerifier({FIREBASE_PROJECT_ID:'ophthalconf',FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099'}),/emulator/);
  const verify = createVerifier({FIREBASE_PROJECT_ID:'ophthalconf'});
  await assert.rejects(verify('not-a-jwt'), error => ['auth/argument-error','auth/invalid-id-token'].includes(error.code));
});
