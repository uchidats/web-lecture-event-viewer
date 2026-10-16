#!/usr/bin/env node
'use strict';
// Shadow review: classifies existing review candidates with the new normalization rules.
// Read-only with respect to production data. The only file written is reports/shadow-review/latest.json,
// a path no GitHub Actions workflow stages (see docs/shadow-review.md).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const n = require('./normalize');
const { CLASS, classifyChange, classifyLegacyItem } = require('./classify');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join('reports', 'shadow-review', 'latest.json');
const todayJst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const reviewable = item => item.status === 'needs-review' || !item.status;

function loadEvents(root = ROOT) {
  const context = {};
  vm.runInNewContext(`${fs.readFileSync(path.join(root, 'events.js'), 'utf8')}\nthis.events = sampleEvents;`, context, { timeout: 5000 });
  return context.events;
}
function latestGeminiReport(root, today) {
  const dir = path.join(root, 'reports', 'gemini-monitor');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) <= today).sort() : [];
  return files.length ? path.join(dir, files.at(-1)) : null;
}

const fieldKey = (field, value, reason) => {
  const key = n.valueKey(value);
  return `${field}|${key || `withheld:${reason || ''}`}`;
};
function buildCandidates({ legacyItems, geminiReport, events, today }) {
  const byId = new Map(events.map(e => [e.id, e]));
  const auditByEvent = new Map(legacyItems.filter(i => i.audit).map(i => [i.eventId, i]));
  const ctxFor = eventId => ({ today, event: byId.get(eventId) || null, auditSibling: auditByEvent.get(eventId) || null });
  const evidenceIndex = new Map(legacyItems.filter(i => i.field && i.evidence).map(i => [`${i.eventId}|${i.field}|${i.reason}`, i.evidence]));
  const candidates = [];

  for (const item of legacyItems) {
    const verdict = classifyLegacyItem(item, ctxFor(item.eventId));
    const differing = item.audit ? verdict.details || [] : [];
    const findings = item.audit
      ? differing.map(d => `${item.eventId}|${fieldKey(d.field, d.detected)}`)
      : item.field ? [`${item.eventId}|${fieldKey(item.field, item.value, item.reason)}`] : [`${item.eventId}|discovery|${item.reason}`];
    candidates.push({ source: 'legacy-review', eventId: item.eventId, field: item.audit ? 'eventMetadata' : item.field || null, sourceReason: item.reason,
      current: item.audit ? Object.fromEntries(differing.map(d => [d.field, d.current])) : item.oldValue ?? null,
      detected: item.audit ? Object.fromEntries(differing.map(d => [d.field, d.detected])) : item.value ?? null,
      ...verdict, findings });
  }

  if (geminiReport) {
    const seen = new Set();
    for (const [pool, items] of [['gemini-admin', geminiReport.adminVisibleItems || []], ['gemini-deferred', geminiReport.deferredReviewItems || []]]) {
      for (const item of items) {
        const itemKey = `${item.eventId}|${item.reason}`;
        if (seen.has(itemKey)) continue; // same item listed in both pools
        seen.add(itemKey);
        const massChange = typeof item.reason === 'string' && item.reason.startsWith('[Mass Change Escalated]');
        for (const fc of item.fieldChanges || []) {
          const reason = fc.validationReason || item.reason;
          const evidence = fc.evidence || evidenceIndex.get(`${item.eventId}|${fc.field}|${fc.validationReason}`) || null;
          const verdict = classifyChange({ field: fc.field, current: fc.before, detected: fc.after, reason: fc.validationReason || null, evidence,
            confidence: item.confidence, url: fc.sourceUrl || item.sourceUrl, massChange }, ctxFor(item.eventId));
          candidates.push({ source: pool, eventId: item.eventId, field: fc.field, sourceReason: reason, current: fc.before ?? null, detected: fc.after ?? null,
            massChangeEscalated: massChange, ...verdict, findings: [`${item.eventId}|${fieldKey(fc.field, fc.after, fc.validationReason)}`] });
        }
      }
    }
  }
  return candidates.map((c, i) => ({ candidateId: `${c.source}#${i + 1}`, eventName: byId.get(c.eventId)?.title || null, ...c }));
}

function summarize(candidates) {
  const classes = Object.values(CLASS);
  const count = list => Object.fromEntries(classes.map(k => [k, list.filter(c => c.classification === k).length]));
  const findingSources = new Map();
  for (const c of candidates) for (const f of c.findings) findingSources.set(f, [...(findingSources.get(f) || []), c.candidateId]);
  const groups = [...findingSources.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, count: ids.length, candidateIds: ids }));
  const totalFindings = [...findingSources.values()].reduce((a, ids) => a + ids.length, 0);
  const escalated = candidates.filter(c => c.massChangeEscalated);
  const byRule = {};
  for (const c of candidates) byRule[c.ruleId] = { classification: c.classification, count: (byRule[c.ruleId]?.count || 0) + 1 };
  return {
    total: candidates.length, ...count(candidates),
    bySource: Object.fromEntries([...new Set(candidates.map(c => c.source))].map(s => [s, { total: candidates.filter(c => c.source === s).length, ...count(candidates.filter(c => c.source === s)) }])),
    duplicates: { findings: totalFindings, uniqueFindings: findingSources.size, duplicateCount: totalFindings - findingSources.size, groups: groups.sort((a, b) => b.count - a.count) },
    // The live monitor sends every item of an over-limit batch to humans; shadow evaluates each item on its own.
    massChange: { escalatedItems: escalated.length, wouldHaveBeenAutoProcessable: escalated.filter(c => [CLASS.EQUIVALENT, CLASS.LOW_RISK].includes(c.classification)).length,
      trulyNeedHuman: escalated.filter(c => c.classification === CLASS.HUMAN).length, sourceProblem: escalated.filter(c => c.classification === CLASS.SOURCE).length },
    byRule
  };
}
function buildShadowReport({ legacyData, geminiReport = null, events, today }) {
  const legacyItems = (legacyData.items || []).filter(reviewable);
  const candidates = buildCandidates({ legacyItems, geminiReport, events, today });
  return { version: 1, kind: 'shadow-review', mode: 'shadow-no-effect', referenceDate: today, summary: summarize(candidates), candidates };
}

function main(argv = process.argv.slice(2)) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const today = arg('--today') || todayJst();
  const legacyFile = arg('--legacy') || path.join(ROOT, 'reports', 'auto-update-review.json');
  const geminiFile = arg('--gemini') || latestGeminiReport(ROOT, today);
  const report = buildShadowReport({ legacyData: JSON.parse(fs.readFileSync(legacyFile, 'utf8')), events: loadEvents(),
    geminiReport: geminiFile ? JSON.parse(fs.readFileSync(geminiFile, 'utf8')) : null, today });
  report.inputs = { legacy: path.relative(ROOT, legacyFile), gemini: geminiFile ? path.relative(ROOT, geminiFile) : null };
  if (!argv.includes('--no-write')) {
    const out = path.join(ROOT, arg('--out') || OUTPUT);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  }
  const s = report.summary;
  console.log(`シャドー判定（${today}）入力: ${report.inputs.legacy} / ${report.inputs.gemini || 'Geminiレポートなし'}`);
  console.log(`総候補数: ${s.total}`);
  console.log(`  equivalent:             ${s.equivalent}`);
  console.log(`  low_risk_auto_candidate: ${s.low_risk_auto_candidate}`);
  console.log(`  source_problem:         ${s.source_problem}`);
  console.log(`  human_review:           ${s.human_review}`);
  console.log(`重複候補数: ${s.duplicates.duplicateCount}（${s.duplicates.findings}件の指摘 → ${s.duplicates.uniqueFindings}種類）`);
  console.log(`大量変更で人間確認に回された${s.massChange.escalatedItems}件のうち 自動処理可能 ${s.massChange.wouldHaveBeenAutoProcessable}件 / 人間確認が必要 ${s.massChange.trulyNeedHuman}件 / 取得問題 ${s.massChange.sourceProblem}件`);
  return report;
}
if (require.main === module) main();
module.exports = { buildShadowReport, buildCandidates, summarize, loadEvents, latestGeminiReport, main };
