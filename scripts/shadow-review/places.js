'use strict';
// Small gazetteer for comparing a Japanese host-city notation ("京都市（京都府） / 日本") with an English one ("Kyoto").
// Covers the cities used by the conference master; an unknown English city is never treated as equivalent.
// Matching is on the city part only: a prefecture alone ("大阪府") does not make "Osaka" the same place as 枚方市.
const n = require('./normalize');

// [English names, Japanese city-level names]
const CITIES = [
  [['Kyoto'], ['京都市', '京都府', '京都']],
  [['Tokyo', 'Chiyoda', 'Chiyoda-ku'], ['東京都', '東京', '千代田区']],
  [['Yokohama'], ['横浜市', '横浜']],
  [['Osaka'], ['大阪市', '大阪府', '大阪']],
  [['Hirakata'], ['枚方市']],
  [['Toyonaka'], ['豊中市']],
  [['Nagoya'], ['名古屋市', '名古屋']],
  [['Kobe'], ['神戸市', '神戸']],
  [['Fukuoka'], ['福岡市', '福岡']],
  [['Sapporo'], ['札幌市', '札幌']],
  [['Hokkaido'], ['北海道']],
  [['Hiroshima'], ['広島市', '広島']],
  [['Niigata'], ['新潟市', '新潟']],
  [['Kanazawa'], ['金沢市', '金沢']],
  [['Toyama'], ['富山市', '富山']],
  [['Gifu'], ['岐阜市', '岐阜']],
  [['Shizuoka'], ['静岡市', '静岡']],
  [['Kochi'], ['高知市', '高知']],
  [['Kumamoto'], ['熊本市', '熊本']],
  [['Miyazaki'], ['宮崎市', '宮崎']],
  [['Yamagata'], ['山形市', '山形']],
  [['Tendo'], ['天童市']],
  [['Aomori'], ['青森市', '青森']],
  [['Yonago'], ['米子市']],
  [['Ginowan'], ['宜野湾市']],
  [['Okinawa'], ['沖縄県', '沖縄']],
  [['Athens'], ['アテネ']],
  [['Vienna'], ['ウィーン']],
  [['Kuala Lumpur'], ['クアラルンプール']],
  [['Copenhagen'], ['コペンハーゲン']],
  [['San Diego'], ['サンディエゴ']],
  [['Chicago'], ['シカゴ']],
  [['Singapore'], ['シンガポール']],
  [['Toronto'], ['トロント']],
  [['New Orleans'], ['ニューオーリンズ']],
  [['Bali'], ['バリ']],
  [['Bangkok'], ['バンコク']],
  [['Pattaya'], ['パタヤ']],
  [['Manila'], ['マニラ']],
  [['Boston'], ['ボストン']],
  [['Las Vegas'], ['ラスベガス']]
];
// [English names, Japanese names]
const COUNTRIES = [
  [['Japan'], ['日本']], [['Greece'], ['ギリシャ']], [['Austria'], ['オーストリア']], [['Malaysia'], ['マレーシア']],
  [['Denmark'], ['デンマーク']], [['USA', 'US', 'United States', 'United States of America'], ['米国', 'アメリカ']],
  [['Singapore', 'Republic of Singapore'], ['シンガポール共和国', 'シンガポール']], [['Canada'], ['カナダ']],
  [['Indonesia'], ['インドネシア']], [['Thailand'], ['タイ']], [['Philippines'], ['フィリピン']]
];
const key = value => n.normText(value);
const cityIndex = new Map(), countryIndex = new Map();
CITIES.forEach(([en, ja], i) => { for (const name of [...en, ...ja]) cityIndex.set(key(name), i); });
COUNTRIES.forEach(([en, ja], i) => { for (const name of [...en, ...ja]) countryIndex.set(key(name), i); });

// "京都市（京都府） / 日本" → { city: '京都市', region: '京都府', country: '日本' }; "Kyoto, Japan" → { city: 'Kyoto', country: 'Japan' }
function parsePlace(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const norm = text.normalize('NFKC');
  const parts = norm.split(/\s*[\/,、]\s*/).map(p => p.trim()).filter(Boolean);
  const first = parts[0] || '';
  const paren = /^(.*?)\s*[(（]([^)）]*)[)）]\s*$/.exec(first);
  const city = (paren ? paren[1] : first).trim().replace(/\s+(?:Prefecture|City|Ward)$/i, '');
  return { city, region: paren ? paren[2].trim() : null, rest: parts.slice(1) };
}
// Same host place when the cities map to the same gazetteer entry and no extra part contradicts it.
// Returns null when the comparison is not possible (unknown English city, contradictory country, unrecognized extra part).
function samePlace(current, detected) {
  const a = parsePlace(current), b = parsePlace(detected);
  if (!a || !b) return null;
  const cityA = cityIndex.get(key(a.city)), cityB = cityIndex.get(key(b.city));
  if (cityA === undefined || cityB === undefined || cityA !== cityB) return null;
  const countries = [...new Set([...a.rest, ...b.rest].map(part => countryIndex.get(key(part))).filter(i => i !== undefined))];
  if (countries.length > 1) return null;
  const known = new Set([...CITIES[cityA][0], ...CITIES[cityA][1]].map(key));
  for (const part of [...(b.region ? [b.region] : []), ...b.rest]) {
    const k = key(part);
    if (countryIndex.has(k) || known.has(k) || /^(?:prefecture|city|ward)$/.test(k) || known.has(k.replace(/(?:prefecture|city|ward)$/, ''))) continue;
    return null; // unrecognized extra detail: do not guess
  }
  return { city: CITIES[cityA][0][0] };
}
module.exports = { parsePlace, samePlace };
