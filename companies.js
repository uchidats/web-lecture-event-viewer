/** Pharmaceutical company master shared by the browser and future Updater extraction. */
const COMPANY_MASTER = [
  { id: "santen", name: "参天製薬株式会社", shortName: "参天製薬", type: "pharma", aliases: ["参天製薬（株）", "参天製薬"] },
  { id: "senju", name: "千寿製薬株式会社", shortName: "千寿製薬", type: "pharma", aliases: ["千寿製薬（株）", "千寿製薬"] },
  { id: "bayer", name: "バイエル薬品株式会社", shortName: "バイエル薬品", type: "pharma", aliases: ["バイエル薬品（株）", "バイエル薬品"] },
  { id: "chugai", name: "中外製薬株式会社", shortName: "中外製薬", type: "pharma", aliases: ["中外製薬（株）", "中外製薬"] },
  { id: "novartis", name: "ノバルティス ファーマ株式会社", shortName: "ノバルティス ファーマ", type: "pharma", aliases: ["ノバルティス ファーマ（株）", "ノバルティス ファーマ", "ノバルティスファーマ"] },
  { id: "wakamoto", name: "わかもと製薬株式会社", shortName: "わかもと製薬", type: "pharma", aliases: ["わかもと製薬（株）", "わかもと製薬"] },
  { id: "otsuka", name: "大塚製薬株式会社", shortName: "大塚製薬", type: "pharma", aliases: ["大塚製薬（株）", "大塚製薬"] },
  { id: "viatris", name: "ヴィアトリス製薬合同会社", shortName: "ヴィアトリス製薬", type: "pharma", aliases: ["ヴィアトリス製薬"] },
  { id: "nitto-medic", name: "日東メディック株式会社", shortName: "日東メディック", type: "pharma", aliases: ["日東メディック（株）", "日東メディック"] },
  { id: "astellas", name: "アステラス製薬株式会社", shortName: "アステラス製薬", type: "pharma", aliases: ["アステラス製薬（株）", "アステラス製薬"] },
  { id: "daiichi-sankyo", name: "第一三共株式会社", shortName: "第一三共", type: "pharma", aliases: ["第一三共（株）", "第一三共"] },
  { id: "takeda", name: "武田薬品工業株式会社", shortName: "武田薬品工業", type: "pharma", aliases: ["武田薬品工業（株）", "武田薬品工業"] }
];

function normalizeCompanyName(value) {
  return String(value || "").normalize("NFKC").toLowerCase()
    .replace(/\s+/g, "").replace(/株式会社|合同会社|\(株\)|㈱/g, "");
}

function resolveCompanyId(name) {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return null;
  return COMPANY_MASTER.find(company => [company.name, company.shortName, ...company.aliases]
    .some(alias => normalizeCompanyName(alias) === normalized))?.id || null;
}

// Explicit roles are required: a legacy organizer string alone is not evidence of co-sponsorship.
function getCoSponsorCompanyIds(event) {
  return [...new Set((event.sponsors || [])
    .filter(sponsor => sponsor.role === "co-sponsor" && COMPANY_MASTER.some(company =>
      company.id === sponsor.companyId && company.type === "pharma"))
    .map(sponsor => sponsor.companyId))];
}

function getCoSponsorCompanyOptions(events) {
  const counts = new Map();
  events.forEach(event => getCoSponsorCompanyIds(event).forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
  return COMPANY_MASTER.filter(company => company.type === "pharma" && counts.has(company.id))
    .map(company => ({ ...company, count: counts.get(company.id) }));
}

// Parent matching enables discovery; the UI still applies attendance and all other filters separately.
function matchesCoSponsorCompanies(event, selectedIds, events) {
  if (!selectedIds.size) return true;
  const matches = candidate => getCoSponsorCompanyIds(candidate).some(id => selectedIds.has(id));
  return matches(event) || (event.isConference && events.some(child =>
    child.parentConferenceId === event.id && matches(child)));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { COMPANY_MASTER, normalizeCompanyName, resolveCompanyId,
    getCoSponsorCompanyIds, getCoSponsorCompanyOptions, matchesCoSponsorCompanies };
}
