'use strict';

// Only call with claims returned by Firebase Admin verifyIdToken, never request JSON.
// Replace this predicate with an admins/{uid} lookup when roles move to Firestore.
function isAdminClaims(claims) {
  return typeof claims?.uid === 'string' && !!claims.uid &&
    claims.email === 'uchidats@gmail.com' && claims.email_verified === true;
}
function accessError(status, code) { return Object.assign(new Error(code), { status, code }); }
function createRequireAdmin(verifyIdToken, authorizeClaims = isAdminClaims) {
  if (typeof verifyIdToken !== 'function') throw new Error('Firebase ID token verifier required');
  return async function requireAdmin(authorization) {
    const match = typeof authorization === 'string' && authorization.match(/^Bearer ([^\s,]+)$/i);
    if (!match) throw accessError(401, 'unauthorized');
    // Signature/issuer/audience/expiry verification must finish before checking roles.
    // Verification failures propagate; the HTTP layer must fail closed, never execute a write.
    const claims = await verifyIdToken(match[1]);
    if (typeof claims?.uid !== 'string' || !claims.uid) throw accessError(401, 'unauthorized');
    if (await authorizeClaims(claims) !== true) throw accessError(403, 'admin_required');
    return { uid: claims.uid };
  };
}
module.exports = { isAdminClaims, createRequireAdmin };
