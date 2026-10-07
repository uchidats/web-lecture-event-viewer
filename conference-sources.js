// Node-only source registry. URLs are pinned to a particular conference edition.
// Hosts here are explicitly trusted; redirects never extend this allowlist.
module.exports = {
  version: 1,
  enabled: true,
  defaults: {
    dryRun: true,
    minConfidence: 0.95,
    maxAutoChanges: 10, // Risk budget: official null abstract completions cost 0.25; others cost 1.
    maxChangedConferences: 5,
    maxTotalAutoChanges: 20,
    maxFieldsPerEvent: 6,
    maxDateShiftDays: 14,
    maxDeadlineShiftDays: 90,
    timeoutMs: 15000,
    maxResponseBytes: 2000000,
    minYear: 2020,
    maxYear: 2035
  },
  sources: [
    {
      id: 'oph-011', name: '第131回日本眼科学会総会', year: 2027,
      officialUrl: 'https://convention.jtbcom.co.jp/131jos/index.html',
      allowedHosts: ['convention.jtbcom.co.jp'], autoUpdateEnabled: true,
      identity: ['第131回', '日本眼科学会総会'], adapter: 'official-html',
      pages: [
        { role: 'overview', url: 'https://convention.jtbcom.co.jp/131jos/summary/index.html' },
        { role: 'abstract', url: 'https://convention.jtbcom.co.jp/131jos/abstract/index.html' }
      ]
    },
    {
      id: 'oph-001', name: '第80回日本臨床眼科学会', year: 2026,
      officialUrl: 'https://convention.jtbcom.co.jp/80ringan/index.html',
      allowedHosts: ['convention.jtbcom.co.jp'], autoUpdateEnabled: true,
      identity: ['第80回', '日本臨床眼科学会'], adapter: 'official-html',
      pages: [
        { role: 'overview', url: 'https://convention.jtbcom.co.jp/80ringan/summary/index.html' },
        { role: 'abstract', url: 'https://convention.jtbcom.co.jp/80ringan/abstract/index.html' }
      ]
    },
    {
      id: 'conf-jp-surgery-2027', name: '第50回日本眼科手術学会学術総会', year: 2027,
      officialUrl: 'https://50.jsos.jp/', allowedHosts: ['50.jsos.jp'],
      autoUpdateEnabled: true, identity: ['第50回', '日本眼科手術学会'], adapter: 'official-html',
      pages: [
        { role: 'overview', url: 'https://50.jsos.jp/' },
        { role: 'abstract', url: 'https://50.jsos.jp/abstract' }
      ]
    },
    {
      id: 'conf-jp-glaucoma-2026', name: '第37回日本緑内障学会', year: 2026,
      officialUrl: 'https://www.congre.co.jp/jgs2026/', allowedHosts: ['www.congre.co.jp'],
      autoUpdateEnabled: true, identity: ['第37回', '日本緑内障学会'], adapter: 'official-html',
      pages: [
        { role: 'overview', url: 'https://www.congre.co.jp/jgs2026/contents/outline.html' },
        { role: 'abstract', url: 'https://www.congre.co.jp/jgs2026/contents/cfa.html' }
      ]
    },
    {
      id: 'conf-jp-jrvs-2026', name: '第65回日本網膜硝子体学会総会', year: 2026,
      officialUrl: 'https://convention.jtbcom.co.jp/65moumaku/index.html',
      allowedHosts: ['convention.jtbcom.co.jp'], autoUpdateEnabled: true,
      identity: ['第65回', '日本網膜硝子体学会'], adapter: 'official-html',
      pages: [
        { role: 'overview', url: 'https://convention.jtbcom.co.jp/65moumaku/summary/index.html' },
        { role: 'abstract', url: 'https://convention.jtbcom.co.jp/65moumaku/abstract/index.html' }
      ]
    }
  ]
};
