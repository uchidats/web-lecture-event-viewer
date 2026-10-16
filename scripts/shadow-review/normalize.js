'use strict';
// Pure normalization helpers for shadow review. Nothing here reads or writes production data.
const { normalizeConferenceTitle } = require('../auto-updater/titles');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const ZONE_RE = /\s*[(（]?\s*(CEST|CET|JST|UTC\s*[+-]\s*\d{1,2}(?::\d{2})?|GMT\s*[+-]\s*\d{1,2})\s*[)）]?\s*$/i;

const pad = n => String(n).padStart(2, '0');
// Text comparison that ignores width, case, whitespace, punctuation and symbols only.
function normText(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\p{White_Space}\p{Punctuation}\p{Symbol}]/gu, '');
}
function isEmptyValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === 'object') {
    // An abstract block that only says "unknown" carries no information.
    return Object.entries(value).every(([key, v]) => (key === 'status' && v === 'unknown') || isEmptyValue(v));
  }
  return false;
}
// Parses a whole string that is a date (optionally with a time and zone label). Returns null otherwise.
function parseDateTime(raw) {
  if (typeof raw !== 'string') return null;
  let text = raw.normalize('NFKC').trim(), zone = null;
  const zoneMatch = ZONE_RE.exec(text);
  if (zoneMatch) { zone = zoneMatch[1].replace(/\s+/g, '').toUpperCase(); text = text.slice(0, zoneMatch.index).trim(); }
  let m, y, mo, d, time = null;
  const takeTime = rest => {
    rest = (rest || '').trim();
    if (!rest) return true;
    if (/^正午$/.test(rest)) { time = '12:00'; return true; }
    const t = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(rest) || /^(\d{1,2})時(?:(\d{1,2})分)?$/.exec(rest);
    if (!t) return false;
    time = `${pad(t[1])}:${pad(t[2] || 0)}`; return true;
  };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(.+))?$/.exec(text))) { [, y, mo, d] = m; if (!takeTime(m[4])) return null; }
  else if ((m = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*[（(][^）)]*[）)])?\s*(.*)$/.exec(text))) { [, y, mo, d] = m; if (!takeTime(m[4])) return null; }
  else if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:[,\s]+(?:at\s+)?(.+))?$/.exec(text)) && MONTHS[m[1].toLowerCase()]) { y = m[3]; mo = MONTHS[m[1].toLowerCase()]; d = m[2]; if (!takeTime(m[4])) return null; }
  else if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?:[,\s]+(?:at\s+)?(.+))?$/.exec(text)) && MONTHS[m[2].toLowerCase()]) { y = m[3]; mo = MONTHS[m[2].toLowerCase()]; d = m[1]; if (!takeTime(m[4])) return null; }
  else return null;
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  if (Number.isNaN(Date.parse(date)) || Number(mo) > 12 || Number(d) > 31) return null;
  return { date, time, zone };
}
// kind: identical | format-only | time-added | time-dropped | time-differs | date-differs | null (not dates)
function compareDates(a, b) {
  const x = parseDateTime(a), y = parseDateTime(b);
  if (!x || !y) return null;
  if (x.date !== y.date) return 'date-differs';
  if (x.time === y.time) return a === b ? 'identical' : 'format-only';
  if (!x.time) return 'time-added';
  if (!y.time) return 'time-dropped';
  return 'time-differs';
}
// Key order, array order and date notation do not change the canonical form.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).map(v => JSON.stringify(v)).sort();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().filter(k => !isEmptyValue(value[k]) || value[k] === false).map(k => [k, canonical(value[k])]));
  }
  if (typeof value === 'string') { const p = parseDateTime(value); return p ? `${p.date}${p.time ? ' ' + p.time : ''}` : value.trim(); }
  return value;
}
const canonicalKey = value => JSON.stringify(canonical(value));
// Stable identity of a value's meaning, used to detect duplicate findings.
function valueKey(value) {
  if (isEmptyValue(value)) return '';
  if (typeof value === 'string') { const p = parseDateTime(value); return p ? `${p.date}${p.time ? ' ' + p.time : ''}` : normText(value); }
  return canonicalKey(value);
}
function sameTitleAlias(a, b) {
  return typeof a === 'string' && typeof b === 'string' && normalizeConferenceTitle(a) === normalizeConferenceTitle(b);
}
module.exports = { normText, isEmptyValue, parseDateTime, compareDates, canonical, canonicalKey, valueKey, sameTitleAlias };
