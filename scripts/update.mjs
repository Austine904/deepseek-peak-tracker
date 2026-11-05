// Daily updater: DeepSeek pricing + peak rules, USD->KES rate, Chinese public holidays.
// Node 20+, no dependencies. On any parse failure it throws, so the last good data/schedule.json stays.
import { readFile, writeFile } from 'node:fs/promises';
const OUT = 'data/schedule.json';
const SRC = 'https://api-docs.deepseek.com/quick_start/pricing.md';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, type = 'text') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'deepseek-peak-tracker' } });
      if (r.ok) return type === 'json' ? await r.json() : await r.text();
      if (r.status === 404) return null;
    } catch {}
    await sleep(2000 * (i + 1));
  }
  return null;
}
const prev = JSON.parse(await readFile(OUT, 'utf8').catch(() => '{}') || '{}');
const md = process.env.PRICING_FILE ? await readFile(process.env.PRICING_FILE, 'utf8') : await get(SRC);
if (!md) throw new Error('Could not fetch the DeepSeek pricing page');

// 1) Model table
const rows = md.split('\n').filter(l => l.startsWith('|')).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
const head = rows.find(r => r[0] === 'MODEL');
const verRow = rows.find(r => r[0] === 'MODEL VERSION');
if (!head || !verRow) throw new Error('Model table not recognised');
const models = head.slice(3).map((raw, i) => {
  const id = raw.replace(/\(\d+\)/g, '').trim();
  return { id, label: id.replace(/^deepseek-/, '').replace(/^v\d+-/, '').replace(/^./, c => c.toUpperCase()), version: verRow[3 + i], usdPerM: {} };
});
const items = { '1M INPUT TOKENS / (CACHE HIT)': 'cacheHit', '1M INPUT TOKENS / (CACHE MISS)': 'cacheMiss', '1M OUTPUT TOKENS': 'output' };
for (const r of rows.filter(r => r[0].startsWith('PRICING'))) {
  const k = items[r[1]]; if (!k) continue;
  const tier = r[2] === 'PEAK' ? 'peak' : 'offPeak';
  r.slice(3).forEach((v, i) => {
    const n = parseFloat(v.replace('$', ''));
    if (!(n > 0)) throw new Error('Bad price: ' + v);
    ((models[i].usdPerM[k] ??= {})[tier] = n);
  });
}
for (const m of models) for (const k of ['cacheHit', 'cacheMiss', 'output']) for (const t of ['peak', 'offPeak'])
  if (!(m.usdPerM[k]?.[t] > 0)) throw new Error(`Missing ${m.id} ${k} ${t}`);

// 2) Peak rules from the footnote
const m = md.match(/Peak hours are (\d\d):00\s*-\s*(\d\d):00 and (\d\d):00\s*-\s*(\d\d):00 UTC,?\s*(\w+) through (\w+)/i);
if (!m) throw new Error('Peak-hours footnote not recognised');
const D = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const a = D.indexOf(m[5].toLowerCase()), b = D.indexOf(m[6].toLowerCase());
if (a < 0 || b < 0) throw new Error('Weekday range not recognised');
const weekdays = []; for (let d = a; ; d = (d + 1) % 7) { weekdays.push(d); if (d === b) break; }
const peak = {
  weekdays, windowsUtc: [[+m[1], +m[2]], [+m[3], +m[4]]],
  excludeChineseHolidays: /excluding Chinese public holidays/i.test(md),
};

// 3) Chinese public holidays (only matter when the page says they are excluded)
const holidays = new Set(prev.holidays || []);
const yr = new Date().getUTCFullYear();
for (const y of [yr, yr + 1]) {
  const j = await get(`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${y}.json`, 'json');
  if (j?.days) {
    for (const d of [...holidays]) if (d.startsWith(String(y))) holidays.delete(d);
    j.days.filter(d => d.isOffDay).forEach(d => holidays.add(d.date));
  }
}

// 4) USD -> KES
const today = new Date().toISOString().slice(0, 10);
let fx = prev.fx || { base: 'USD', quote: 'KES', rate: null };
let rate = (await get('https://open.er-api.com/v6/latest/USD', 'json'))?.rates?.KES, src = 'open.er-api.com';
if (!(rate > 0)) { rate = (await get('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', 'json'))?.usd?.kes; src = 'currency-api via jsDelivr'; }
if (rate > 0) fx = { base: 'USD', quote: 'KES', rate: +(+rate).toFixed(4), asOf: today, source: src };
else console.warn('FX unavailable, keeping previous rate');

const out = { schemaVersion: 1, checkedAt: new Date().toISOString(), source: SRC, peak, holidays: [...holidays].sort(), fx, models };
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`OK: ${models.map(x => x.id).join(', ')} | windows ${JSON.stringify(peak.windowsUtc)} days ${weekdays} | holidays ${holidays.size} | KES ${fx.rate}`);
