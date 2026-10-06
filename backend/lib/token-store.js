'use strict';
// Local-only implementation of the async TokenStore interface. Never serialize tokens.
class MemoryTokenStore {
  #tokens = new Map();
  async saveRefreshToken(uid, token) {
    if (typeof uid !== 'string' || !uid || typeof token !== 'string' || !token) throw new Error('Invalid token store input');
    this.#tokens.set(uid, token);
  }
  async getRefreshToken(uid) {return this.#tokens.get(uid) || null;}
  async hasRefreshToken(uid) {return !!(await this.getRefreshToken(uid));}
  async deleteRefreshToken(uid) {this.#tokens.delete(uid);}
}
module.exports = {MemoryTokenStore};
