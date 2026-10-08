// URL roles are explicit: a society homepage is never an event URL fallback.
function eventSourceUrl(source) { return source.eventOfficialUrl || source.officialUrl; }

function isSocietyUrl(value, source) {
  try {
    const url = new URL(value);
    const society = new URL(source.societyUrl);
    const host = value => value.hostname.replace(/^www\./, '');
    return host(url) === host(society) &&
      (url.pathname === society.pathname || url.pathname === '/');
  } catch { return false; }
}

function eventUrlReviewReason(candidate, source) {
  if (candidate.eventPageKind === 'society' || isSocietyUrl(candidate.value, source)) return 'event-url-is-society-homepage';
  const years = candidate.eventYears || [];
  let urlYears = [];
  try {
    const url = new URL(candidate.value);
    urlYears = [...(url.hostname + url.pathname).matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map(match => Number(match[1]));
  } catch { return 'untrusted-domain'; }
  if ([...years, ...(candidate.eventTitleYears || []), ...urlYears].some(year => year !== source.year)) return 'event-url-year-mismatch';
  if (candidate.eventIdentityMatched !== true) return 'event-url-edition-mismatch';
  if (years.length !== 1 || years[0] !== source.year) return 'event-url-edition-unverified';
  return null;
}

module.exports = { eventSourceUrl, isSocietyUrl, eventUrlReviewReason };
