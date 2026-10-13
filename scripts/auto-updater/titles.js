// Edition abbreviations are supplemental metadata, not part of the official name.
// Deliberately scoped to the Japanese Clinical Ophthalmology Congress.
function normalizeConferenceTitle(title) {
  if (typeof title !== 'string') return title;
  const match = title.match(/^\s*第\s*([0-9０-９]+)\s*回\s*日本臨床眼科学会(?:\s*[（(]\s*臨眼\s*[0-9０-９]{4}\s*[）)])?\s*$/u);
  return match ? `第${match[1].normalize('NFKC')}回 日本臨床眼科学会` : title;
}
module.exports = { normalizeConferenceTitle };
