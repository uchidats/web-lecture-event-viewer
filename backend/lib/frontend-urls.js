'use strict';
// Temporary coexistence: retain both existing frontends and both medconf paths.
const ALLOWED_FRONTEND_URLS = new Set(['http://localhost:8000/',
  'https://uchidats.github.io/web-lecture-event-viewer/', 'https://medconf.jp/', 'https://medconf.jp/ophthalconf/']);
module.exports = { ALLOWED_FRONTEND_URLS };
