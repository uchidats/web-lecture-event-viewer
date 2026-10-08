const crypto = require('node:crypto');

const FIRESTORE_DATABASE_URL = 'https://firestore.googleapis.com/v1/projects/ophthalconf/databases/(default)/documents';

/**
 * Generate an OAuth2 access token from a Google Service Account JSON key
 * using built-in Node.js crypto (zero npm dependencies).
 */
async function getAccessTokenFromServiceAccount(serviceAccountKey) {
  const sa = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Invalid service account key: client_email or private_key missing');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  sign.end();
  const signature = sign.sign(sa.private_key, 'base64url');

  const assertion = `${unsignedToken}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Failed to obtain Google access token: HTTP ${tokenRes.status} ${errorText}`);
  }

  const data = await tokenRes.json();
  return data.access_token;
}

/**
 * Obtain a server-side Bearer authorization token for Firestore in GitHub Actions / CLI.
 * Supports:
 * 1. CLOUD_ACCESS_TOKEN (from Workload Identity Federation / google-github-actions/auth)
 * 2. FIREBASE_SERVICE_ACCOUNT_KEY (JSON key secret)
 * 3. Null (offline / dry-run fallback)
 */
async function getFirestoreAuthToken(options = {}) {
  // 1. Direct access token (e.g. from Workload Identity Federation)
  if (options.token || process.env.CLOUD_ACCESS_TOKEN) {
    return options.token || process.env.CLOUD_ACCESS_TOKEN;
  }

  // 2. Service account key in options or environment variable
  const saKey = options.serviceAccountKey || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saKey) {
    try {
      return await getAccessTokenFromServiceAccount(saKey);
    } catch (err) {
      console.warn(`[FirestoreClient] Service account token generation failed: ${err.message}`);
      return null;
    }
  }

  return null;
}

/**
 * Fetch remote state from Firestore /gemini_monitor_acknowledgements/state
 */
async function fetchRemoteState(authToken) {
  if (!authToken) return null;

  try {
    const url = `${FIRESTORE_DATABASE_URL}/gemini_monitor_acknowledgements/state`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!res.ok) {
      if (res.status === 404) return { version: 1, items: {} };
      console.warn(`[FirestoreClient] HTTP ${res.status} fetching remote state`);
      return null;
    }

    const docData = await res.json();
    const rawJson = docData.fields?.json?.stringValue;
    if (rawJson) {
      return JSON.parse(rawJson);
    }
  } catch (err) {
    console.warn(`[FirestoreClient] Failed to fetch remote state: ${err.message}`);
  }
  return null;
}

/**
 * Save remote state to Firestore /gemini_monitor_acknowledgements/state
 */
async function saveRemoteState(authToken, stateData) {
  if (!authToken || !stateData) return false;

  try {
    const url = `${FIRESTORE_DATABASE_URL}/gemini_monitor_acknowledgements/state`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          json: { stringValue: JSON.stringify(stateData) },
          updatedAt: { stringValue: new Date().toISOString() }
        }
      })
    });
    return res.ok;
  } catch (err) {
    console.warn(`[FirestoreClient] Failed to save remote state: ${err.message}`);
    return false;
  }
}

/**
 * Pull unapplied acknowledged items and rollback requests from Firestore state.
 * (Requirements 11, 12, 16)
 */
async function getPendingActionsFromFirestore(options = {}) {
  const token = await getFirestoreAuthToken(options);
  if (!token) {
    return {
      authenticated: false,
      acknowledgedToApply: [],
      rollbackRequests: [],
      remoteState: null,
      token: null
    };
  }

  const remoteState = await fetchRemoteState(token);
  if (!remoteState || !remoteState.items) {
    return {
      authenticated: true,
      acknowledgedToApply: [],
      rollbackRequests: [],
      remoteState: remoteState || { version: 1, items: {} },
      token
    };
  }

  const acknowledgedToApply = [];
  const rollbackRequests = [];

  for (const [key, item] of Object.entries(remoteState.items)) {
    if (item.status === 'acknowledged') {
      acknowledgedToApply.push({ ...item, key });
    } else if (item.status === 'rollback_requested') {
      rollbackRequests.push({ ...item, key });
    }
  }

  return {
    authenticated: true,
    acknowledgedToApply,
    rollbackRequests,
    remoteState,
    token
  };
}

module.exports = {
  getAccessTokenFromServiceAccount,
  getFirestoreAuthToken,
  fetchRemoteState,
  saveRemoteState,
  getPendingActionsFromFirestore
};
