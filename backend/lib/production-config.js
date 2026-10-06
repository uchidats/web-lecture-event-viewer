'use strict';
function assertProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const [name, expected] of Object.entries({TOKEN_STORE:'firestore', OAUTH_SESSION_STORE:'firestore', SECRET_PROVIDER:'secret-manager'})) {
    if (env[name] !== expected) {
      const error = new Error(`Production configuration is unsafe: ${name} must be ${expected}`);
      error.code = 'UNSAFE_PRODUCTION_CONFIGURATION';
      throw error;
    }
  }
}
module.exports = {assertProductionConfig};
