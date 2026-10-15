const {validRegistration}=require('../auto-updater/registration');

function registrationProblem(value) {
  if (validRegistration(value)) return null;
  if (!value || typeof value!=='object') return 'registration must be an object';
  if (!['domestic','international'].includes(value.type)) return 'registration.type is missing or invalid';
  if (!Array.isArray(value.periods)) return 'registration.periods is missing or not an array';
  if (!value.periods.length) return 'registration.periods is empty';
  for (const [index,period] of value.periods.entries()) {
    const name=`registration.periods[${index}]`;
    if (!period || typeof period.label!=='string' || !period.label.trim()) return `${name}.label is missing`;
    if (period.category!=null&&!['early','regular','onsite'].includes(period.category)) return `${name}.category is invalid`;
    if (period.advanceEligible!=null&&typeof period.advanceEligible!=='boolean') return `${name}.advanceEligible must be boolean`;
    if (!period.start&&!period.deadline) return `${name} has neither start nor deadline`;
    for (const field of ['start','deadline']) if (period[field]&&!validRegistration({type:value.type,periods:[{label:'validation', [field]:period[field]}]})) return `${name}.${field} has invalid date/time format or value`;
    if (period.start&&period.deadline&&period.start>(period.deadline.includes('T')?period.deadline:period.deadline+'T23:59')) return `${name}.deadline is before start`;
    if (!validRegistration({type:value.type,periods:[period]})) return `${name} contains invalid sourceUrl or metadata`;
  }
  return 'registration has invalid version or timeZone';
}

function checkRegistrationChange(event, change) {
  if (change.field!=='registration'&&!change.field.startsWith('registration.')) return null;
  let value;
  if (change.field==='registration') value=structuredClone(change.after);
  else {
    // A scalar deadline cannot identify an official early/regular/onsite phase.
    if (!/^registration\.(?:type|timeZone|version|periods(?:\.\d+\.(?:label|start|deadline|category|advanceEligible|sourceUrl))?)$/.test(change.field)) return {reason:`Unsupported ${change.field}; a verified registration.periods phase is required`};
    if (!event.registration) return {reason:'Cannot update registration subfield without a valid structured registration'};
    value=structuredClone(event.registration);
    const parts=change.field.split('.').slice(1);let parent=value;
    for (const part of parts.slice(0,-1)) { if (!parent || !Object.hasOwn(parent,part)) return {reason:'Registration phase does not exist'};parent=parent[part]; }
    parent[parts.at(-1)]=structuredClone(change.after);
  }
  const reason=registrationProblem(value);
  return reason?{reason}:{value};
}
module.exports={registrationProblem,checkRegistrationChange};
