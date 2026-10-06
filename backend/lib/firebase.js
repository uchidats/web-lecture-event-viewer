'use strict';
const {initializeApp, applicationDefault, getApps} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');

function getAdminApp(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID must identify the frontend Firebase project');
  const existing = getApps().find(app => app.name === 'ophthalconf-backend');
  if (existing) {
    if (existing.options.projectId !== projectId) throw new Error('Firebase Admin project configuration mismatch');
    return existing;
  }
  return initializeApp({projectId, credential: applicationDefault()}, 'ophthalconf-backend');
}
function getFirestoreClient(env = process.env) {
  const {getFirestore} = require('firebase-admin/firestore');
  // The Admin SDK reads FIRESTORE_EMULATOR_HOST automatically; do not override its endpoint.
  return getFirestore(getAdminApp(env));
}
function createVerifier(env = process.env) {
  // Emulator tokens are unsigned; never allow an emulator override in this server.
  if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Firebase Auth emulator is not supported by this server');
  const app = getAdminApp(env);
  const auth = getAuth(app);
  // Signature, issuer, audience, expiry and subject are checked by the Admin SDK.
  // Revocation checks are not enabled in this initial API.
  return token => auth.verifyIdToken(token);
}
module.exports = {createVerifier, getAdminApp, getFirestoreClient};
