const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const companies = require('../companies');
const { COMPANY_MASTER, normalizeCompanyName, resolveCompanyId, getCoSponsorCompanyIds,
  getCoSponsorCompanyOptions, matchesCoSponsorCompanies } = companies;
assert.equal(COMPANY_MASTER.length, 12);
assert.equal(new Set(COMPANY_MASTER.map(c => c.id)).size, 12);
for (const company of COMPANY_MASTER) {
  assert.equal(company.type, 'pharma');
  for (const alias of [company.name, company.shortName, ...company.aliases]) {
    assert.equal(resolveCompanyId(alias), company.id);
  }
}
for (const name of ['参天製薬株式会社', '参天製薬（株）', '参天製薬', ' 参天 製薬 (株) ', '㈱参天製薬']) {
  assert.equal(resolveCompanyId(name), 'santen');
}
assert.equal(normalizeCompanyName('ノバルティス　ファーマ（株）'), normalizeCompanyName('ノバルティスファーマ株式会社'));
for (const name of ['', null, '未知製薬株式会社', '参天製薬株式会社の講演会', '参天']) assert.equal(resolveCompanyId(name), null);
// Exercise an alias that cannot be inferred from the canonical name.
COMPANY_MASTER[0].aliases.push('Santen Pharmaceutical');
assert.equal(resolveCompanyId('Santen Pharmaceutical'), 'santen');
COMPANY_MASTER[0].aliases.pop();
const sponsor = id => ({ companyId: id, role: 'co-sponsor' });
assert.deepEqual(getCoSponsorCompanyIds({ sponsors: [sponsor('santen'), sponsor('bayer'), sponsor('santen'),
  sponsor('unknown'), { companyId: 'takeda', role: 'organizer' }] }), ['santen', 'bayer']);
assert.deepEqual(getCoSponsorCompanyIds({ sponsor: '参天製薬株式会社' }), []);
assert.equal(matchesCoSponsorCompanies({}, new Set(), []), true);

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ assert, console, document: { getElementById: () => null, addEventListener: () => {} } });
for (const file of ['venues.js', 'companies.js', 'events.js', 'script.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
vm.runInContext(`
  getTodayString = () => '2026-10-05';
  const template = sampleEvents.find(e => e.id === 'oph-001');
  const co = id => ({companyId: id, role: 'co-sponsor'});
  const make = (id, sponsors = [], extra = {}) => ({ ...template, id, sponsors,
    date: '2026-10-30', endDate: '2026-11-01', region: '関西', specialty: '網膜・硝子体',
    abstractSubmission: {status: 'open', deadline: '2026-10-10'}, ...extra });
  state.events = [make('single', [co('santen')]), make('joint', [co('santen'), co('bayer'), co('santen')]),
    make('bayer', [co('bayer')]), make('none'), make('parent'),
    make('child', [co('santen')], {isConference: false, parentConferenceId: 'parent'}),
    make('wrong-region', [co('santen')], {region: '海外'}),
    make('wrong-year', [co('santen')], {date: '2027-10-30', endDate: '2027-11-01'}),
    make('wrong-specialty', [co('santen')], {specialty: '緑内障'}),
    make('closed', [co('santen')], {abstractSubmission: {status: 'closed', deadline: '2026-10-01'}})];
  const ids = () => getFilteredEvents().map(e => e.id).sort().join(',');
  state.filters.company.add('santen');
  assert.equal(ids(), 'closed,joint,parent,single,wrong-region,wrong-specialty,wrong-year');
  state.filters.company.add('bayer');
  assert.ok(ids().split(',').includes('bayer'));
  assert.ok(!ids().split(',').includes('none'));
  state.attendingConferences.add('parent');
  assert.ok(ids().split(',').includes('child'));
  state.filters.region.add('関西'); state.filters.year.add('2026');
  state.filters.specialty.add('網膜・硝子体'); state.filters.abstractStatus.add('open');
  assert.equal(ids(), 'bayer,joint,parent,single');
  state.filters.company.delete('bayer');
  assert.equal(ids(), 'joint,parent,single');
  state.filters.abstractStatus.clear();
  assert.equal(ids(), 'child,closed,joint,parent,single');
  state.events = state.events.filter(e => e.id !== 'closed');
  state.hiddenConferences.add('parent');
  assert.ok(!ids().split(',').includes('parent'));
  state.hiddenConferences.clear();
  state.attendingConferences.clear();
  assert.equal(ids(), 'joint,parent,single');
  state.events.find(e => e.id === 'parent').endDate = '2026-10-01';
  state.attendingConferences.add('parent');
  assert.equal(ids(), 'joint,single');
  state.filters.includeEndedConferences = true;
  assert.equal(ids(), 'child,joint,parent,single');
  const options = getCoSponsorCompanyOptions(state.events);
  assert.equal(options.find(c => c.id === 'santen').count, 6);
  assert.equal(options.find(c => c.id === 'bayer').count, 2);
  assert.ok(!options.some(c => c.id === 'novartis'));
  assert.ok(COMPANY_MASTER.some(c => c.id === 'novartis'));
  const actualOptions = getCoSponsorCompanyOptions(sampleEvents);
  assert.equal(actualOptions.map(c => c.id + ':' + c.count).join(','), 'santen:1,novartis:1');
`, context);
assert.deepEqual(getCoSponsorCompanyOptions([]), []);
console.log('PASS: master, normalization, aliases, explicit roles, joint sponsors, counts, OR/AND, parent discovery and attendance/ended/hidden gates');
