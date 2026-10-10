// Published identities, not a linear edition/year prediction. Sources:
// https://www.jasa-web.jp/event/programs/society-history
// https://www.jasa-web.jp/event/programs
// https://www.congre.co.jp/japo2026/html/outline/
const identities = {
  2010: { pediatric: 35, strabismus: 66, joint: true },
  2023: { pediatric: 48, strabismus: 79, joint: true },
  2024: { pediatric: 49, strabismus: 80, joint: true },
  2026: { pediatric: 51, strabismus: 82, joint: false },
  2027: { pediatric: 52, strabismus: 83, joint: true },
  2028: { pediatric: 53, strabismus: 84, joint: true }
};
const societies = { pediatric: '日本小児眼科学会', strabismus: '日本弱視斜視学会' };

function auditConferenceIdentities(events) {
  const issues = [];
  for (const event of events) {
    if (!event.isConference) continue;
    const year = Number(event.date?.slice(0, 4));
    const title = String(event.title || '').normalize('NFKC');
    const present = Object.entries(societies).filter(([, name]) => title.includes(name));
    for (const [key, name] of present) {
      const edition = Number(title.match(new RegExp(`第\\s*(\\d+)\\s*回\\s*${name}`))?.[1]);
      const expected = identities[year]?.[key];
      const historical = Object.entries(identities).find(([sourceYear, identity]) => Number(sourceYear) !== year && identity[key] === edition);
      if ((expected && edition !== expected) || (!expected && historical)) {
        issues.push({ eventId: event.id, code: 'conference-edition-year-conflict', society: name, year, edition: edition || null, expectedEdition: expected || null, historicalYear: historical ? Number(historical[0]) : null });
      }
    }
    if (present.length === 2 && identities[year]?.joint === false) {
      issues.push({ eventId: event.id, code: 'unsupported-joint-conference', year });
    }
  }
  return issues;
}
module.exports = { auditConferenceIdentities };
