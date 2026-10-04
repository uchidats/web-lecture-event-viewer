const { compact, normalizeDate, normalizeVenue } = require('./extract');
const { trustedUrl } = require('./fetch');
const fields = new Set(['title', 'date', 'endDate', 'venue', 'city', 'country', 'officialUrl',
  'abstractSubmission.startDate', 'abstractSubmission.deadline', 'abstractSubmission.status', 'abstractSubmission.url']);
const dateFields = new Set(['date', 'endDate', 'abstractSubmission.startDate', 'abstractSubmission.deadline']);
const countryAliases = { JP: '日本', Japan: '日本', US: '米国', USA: '米国', 'United States': '米国', AT: 'オーストリア', Austria: 'オーストリア', SG: 'シンガポール', Singapore: 'シンガポール', 'シンガポール共和国': 'シンガポール' };
function location(event) {
  const [city = '', country = ''] = (event.cityCountry || '').split(/[/／]/).map(s => s.trim());
  return { city, country };
}
function oldValue(event, field) {
  if (field === 'city' || field === 'country') return location(event)[field];
  return field.split('.').reduce((value, key) => value?.[key], event) ?? null;
}
function canonical(field, value) {
  if (value == null) return '';
  if (field === 'venue') return compact(normalizeVenue(value));
  if (field === 'city') return compact(value).replace(/[（(].*?[）)]/g, '');
  if (field === 'country') return Object.hasOwn(countryAliases, value) ? countryAliases[value] : String(value).trim();
  if (dateFields.has(field)) return normalizeDate(value) || String(value);
  if (field.endsWith('Url') || field.endsWith('.url')) { try { return new URL(value).href; } catch { return String(value); } }
  return compact(value);
}
function day(value) { return Date.parse(String(value).slice(0, 10) + 'T00:00:00Z'); }
function isPlaceholder(value) { return !value || /未定|不明|要確認|海外|欧州/.test(value); }

function assess(event, source, candidates, issues, limits, { today, venues = {} }) {
  const accepted = [], review = [];
  let halt = issues.includes('invalid-date') || issues.includes('invalid-json-ld');
  const reject = (candidate, reason) => review.push({ ...candidate, oldValue: candidate.field ? oldValue(event, candidate.field) : null, reason });
  for (const reason of issues) reject({ field: null, url: source.officialUrl, confidence: 0 }, reason);
  if (issues.includes('conference-identity-missing') || issues.includes('invalid-html')) {
    for (const candidate of candidates) reject(candidate, 'source-identity-or-html-invalid');
    return { accepted, review, halt };
  }
  // Existing curated venue geography can supply missing city/country without guessing from the venue name.
  candidates = [...candidates];
  for (const candidate of candidates.filter(c => c.field === 'venue')) {
    const matches = Object.values(venues).filter(v => canonical('venue', v.name) === canonical('venue', candidate.value));
    if (matches.length === 1) for (const field of ['city', 'country']) {
      if (matches[0][field] && !candidates.some(c => c.field === field)) candidates.push({ ...candidate, field,
        value: matches[0][field], confidence: Math.min(candidate.confidence, 0.96), method: 'curated-venue-geography' });
    }
  }
  const groups = new Map();
  for (const candidate of candidates) {
    if (!fields.has(candidate.field)) { reject(candidate, 'protected-or-unknown-field'); continue; }
    if (candidate.value === null || candidate.value === undefined || candidate.value === '') { reject(candidate, 'missing-value-never-deletes'); continue; }
    if (typeof candidate.value !== 'string') { reject(candidate, 'invalid-value-type'); continue; }
    const list = groups.get(candidate.field) || [];
    list.push(candidate); groups.set(candidate.field, list);
  }
  const unique = new Map();
  for (const [field, values] of groups) {
    const distinct = new Set(values.map(c => canonical(field, c.value)));
    if (distinct.size > 1) { for (const candidate of values) reject(candidate, 'multiple-candidates'); continue; }
    const candidate = values.toSorted((a, b) => b.confidence - a.confidence)[0];
    unique.set(field, candidate);
  }
  // A status is derived only from a complete, unambiguous, high-confidence period.
  const start = unique.get('abstractSubmission.startDate'), deadline = unique.get('abstractSubmission.deadline');
  if (!unique.has('abstractSubmission.status') && start?.confidence >= limits.minConfidence && deadline?.confidence >= limits.minConfidence) {
    const date = today.slice(0, 10);
    const status = date > deadline.value.slice(0, 10) ? 'closed' : date < start.value.slice(0, 10) ? 'upcoming' : 'open';
    unique.set('abstractSubmission.status', { ...deadline, field: 'abstractSubmission.status', value: status,
      confidence: Math.min(start.confidence, deadline.confidence), method: 'validated-period-state' });
  }
  for (const candidate of unique.values()) {
    const { field, value, confidence } = candidate;
    const previous = oldValue(event, field);
    if (!trustedUrl(candidate.url, source)) { reject(candidate, 'untrusted-evidence-url'); continue; }
    const methodCaps = { 'official-title': 0.96, 'pinned-official-url': 0.99, 'labeled-html': 0.98,
      'venue-address': 0.96, 'curated-venue-geography': 0.96, 'official-abstract-page': 0.98, 'json-ld': 0.99, 'validated-period-state': 0.98,
      pdf: 0.8, 'surrounding-text': 0.7, ai: 0.4 };
    if (!Object.hasOwn(methodCaps, candidate.method) || confidence > methodCaps[candidate.method]) { reject(candidate, 'unsupported-confidence'); continue; }
    if (dateFields.has(field)) {
      const normalized = normalizeDate(value);
      const year = Number(normalized?.slice(0, 4));
      if (!normalized || year < limits.minYear || year > limits.maxYear ||
          (['date', 'endDate'].includes(field) ? year !== source.year : year < source.year - 1 || year > source.year)) {
        reject(candidate, 'abnormal-date'); halt = true; continue;
      }
      if (previous && normalizeDate(previous)?.includes(' ') && !normalized.includes(' ')) { reject(candidate, 'deadline-time-would-be-lost'); continue; }
      const shift = previous && normalizeDate(previous) ? Math.abs(day(value) - day(previous)) / 86400000 : 0;
      if (shift > (field.startsWith('abstractSubmission') ? limits.maxDeadlineShiftDays : limits.maxDateShiftDays)) { reject(candidate, 'large-date-shift'); continue; }
    }
    if (field.endsWith('Url') || field.endsWith('.url')) {
      if (!trustedUrl(value, source)) { reject(candidate, 'untrusted-domain'); continue; }
      let previousHost;
      try { previousHost = previous && new URL(previous).hostname; } catch { reject(candidate, 'invalid-existing-url'); continue; }
      if (previousHost && previousHost !== new URL(value).hostname) { reject(candidate, 'official-domain-changed'); continue; }
      if (!previous || canonical(field, previous) !== canonical(field, value)) {
        // Other editions on the same organizer host must not replace this edition.
        const root = new URL(source.officialUrl);
        const editionPath = root.pathname.replace(/index\.html$/, '');
        if (!new URL(value).pathname.startsWith(editionPath)) { reject(candidate, 'different-edition-url'); continue; }
      }
    }
    if (field === 'title' && previous && canonical(field, previous) !== canonical(field, value)) { reject(candidate, 'conference-name-change'); continue; }
    if (['city', 'country'].includes(field) && !isPlaceholder(previous) && canonical(field, previous) !== canonical(field, value)) { reject(candidate, 'location-contradiction'); continue; }
    if (field === 'country' && (event.conferenceRegion === 'domestic') !== (canonical(field, value) === '日本')) { reject(candidate, 'region-country-contradiction'); continue; }
    if (field === 'abstractSubmission.status' && !['open', 'upcoming', 'closed', 'unknown'].includes(value)) { reject(candidate, 'invalid-status'); continue; }
    if (field === 'venue' && (String(value).length > 300 || /未定|不明|要確認|〒|運営事務局/.test(value))) { reject(candidate, 'invalid-venue'); continue; }
    if (field === 'venue' && !isPlaceholder(previous) && canonical(field, previous) !== canonical(field, value) &&
        !unique.has('city')) { reject(candidate, 'venue-change-without-location'); continue; }
    if (field === 'venue' && event.venueId && venues[event.venueId] &&
        canonical(field, value) !== canonical(field, previous)) { reject(candidate, 'venue-master-conflict'); continue; }
    if (canonical(field, previous) === canonical(field, value)) continue;
    if (!Number.isFinite(confidence) || confidence < limits.minConfidence) { reject(candidate, 'low-confidence'); continue; }
    if (!source.autoUpdateEnabled) { reject(candidate, 'auto-update-disabled'); continue; }
    accepted.push({ ...candidate, value: field === 'country' ? canonical(field, value) : value, oldValue: previous });
  }
  // Keep related fields consistent: reject the whole date/location/abstract group if part is unsafe.
  const groupFor = field => ['date', 'endDate'].includes(field) ? 'dates' : ['venue', 'city', 'country'].includes(field) ? 'location' : field?.startsWith('abstractSubmission.') && !field.endsWith('.url') ? 'abstract' : field;
  const blocked = new Set(review.filter(r => r.field).map(r => groupFor(r.field)));
  for (let i = accepted.length - 1; i >= 0; i--) if (blocked.has(groupFor(accepted[i].field))) reject(accepted.splice(i, 1)[0], 'related-field-needs-review');
  const projected = { ...event, abstractSubmission: { ...event.abstractSubmission } };
  for (const change of accepted) setField(projected, change.field, change.value);
  if (projected.endDate && day(projected.endDate) < day(projected.date) ||
      projected.endDate && day(projected.endDate) - day(projected.date) > 31 * 86400000 ||
      projected.abstractSubmission.startDate && projected.abstractSubmission.deadline && day(projected.abstractSubmission.startDate) > day(projected.abstractSubmission.deadline) ||
      projected.abstractSubmission.deadline && day(projected.abstractSubmission.deadline) > day(projected.endDate || projected.date)) {
    halt = true;
    for (const change of accepted.splice(0)) reject(change, 'invalid-date-order');
    reject({ field: null, confidence: 0, url: source.officialUrl }, 'invalid-date-order');
  }
  return { accepted, review, halt };
}

function setField(event, field, value) {
  if (!fields.has(field)) throw new Error(`Protected field: ${field}`);
  if (field === 'city' || field === 'country') {
    const loc = location(event); loc[field] = value;
    event.cityCountry = `${loc.city} / ${loc.country}`;
  } else if (field.startsWith('abstractSubmission.')) {
    event.abstractSubmission = { ...event.abstractSubmission, [field.split('.')[1]]: value };
  } else event[field] = value;
}

function applyChanges(events, changes) {
  const result = structuredClone(events);
  for (const change of changes) {
    const event = result.find(e => e.id === change.eventId);
    if (!event?.isConference) throw new Error('Unknown conference ID');
    setField(event, change.field, change.value);
    if (['date', 'endDate'].includes(change.field)) event.period = `${event.date} ～ ${event.endDate || event.date}`;
    if (change.field === 'abstractSubmission.deadline') event.abstractDeadline = change.value;
  }
  return result;
}

module.exports = { assess, fields, canonical, oldValue, location, applyChanges, setField };
