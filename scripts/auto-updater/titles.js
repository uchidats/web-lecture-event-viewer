// Edition abbreviations are supplemental metadata, not part of the official name.
// Deliberately scoped to the Japanese Clinical Ophthalmology Congress.
function normalizeConferenceTitle(title) {
  if (typeof title !== 'string') return title;
  const match = title.match(/^\s*第\s*([0-9０-９]+)\s*回\s*日本臨床眼科学会(?:\s*[（(]\s*臨眼\s*[0-9０-９]{4}\s*[）)])?\s*$/u);
  return match ? `第${match[1].normalize('NFKC')}回 日本臨床眼科学会` : title;
}
// Compare textual content without changing its word order, edition or year.
// Bracket contents are retained; only punctuation/spacing and width are ignored.
function isFormatOnlyTitleChange(before, after) {
  if (typeof before !== 'string' || typeof after !== 'string' || before === after) return false;
  const key = value => value.normalize('NFKC').replace(/[\p{White_Space}\p{Punctuation}]/gu, '');
  const original = key(before);
  return !!original && original === key(after);
}
module.exports = { normalizeConferenceTitle, isFormatOnlyTitleChange };
