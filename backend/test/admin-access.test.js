'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isAdminClaims, createRequireAdmin } = require('../lib/admin-access');
const { isAdminUser } = require('../../review-model');
test('frontend and backend exact verified-email policies agree', () => {
  for (const [email, verified, expected] of [
    ['uchidats@gmail.com', true, true], ['uchidats@gmail.com', false, false],
    ['uchidats@gmail.com', undefined, false], ['uchidats@gmail.com', 'true', false],
    ['other@gmail.com', true, false], ['UCHIDATS@gmail.com', true, false], [undefined, true, false]
  ]) {
    assert.equal(isAdminClaims({ uid: 'fixture', email, email_verified: verified }), expected);
    assert.equal(isAdminUser({ uid: 'fixture', email, emailVerified: verified }), expected);
  }
  assert.equal(isAdminClaims(null), false); assert.equal(isAdminUser(null), false);
});
test('admin guard verifies token first and never accepts client claims or a dev bypass', async () => {
  let calls = 0;
  const guard = createRequireAdmin(async token => {
    calls++;
    if (token === 'invalid') throw new Error('invalid-token');
    return { uid: 'verified-uid', email: token === 'admin' ? 'uchidats@gmail.com' : 'other@gmail.com', email_verified: true };
  });
  assert.deepEqual(await guard('Bearer admin'), { uid: 'verified-uid' });
  await assert.rejects(guard('Bearer other'), error => error.status === 403);
  await assert.rejects(guard('Bearer invalid'), /invalid-token/);
  const before = calls;
  for (const value of [undefined, 'adminReview=1', 'Basic admin', { email: 'uchidats@gmail.com', emailVerified: true }]) {
    await assert.rejects(guard(value), error => error.status === 401);
  }
  assert.equal(calls, before);
  await assert.rejects(createRequireAdmin(async () => ({ uid: 'u', email: 'uchidats@gmail.com', email_verified: false }))('Bearer fixture'), error => error.status === 403);
  await assert.rejects(createRequireAdmin(async () => null)('Bearer fixture'), error => error.status === 401);
  const future = createRequireAdmin(async () => ({ uid: 'firestore-admin' }), async claims => claims.uid === 'firestore-admin');
  assert.deepEqual(await future('Bearer fixture'), { uid: 'firestore-admin' });
});
