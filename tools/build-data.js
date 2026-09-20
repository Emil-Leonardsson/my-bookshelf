// Slår ihop data/raw/*.json till data/books.json.
// Användning: node tools/build-data.js
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
const genres = readJson('genres.json');
const overrides = readJson('overrides.json');
const reviewed = new Set(readJson('reviewed.json')); // asin som jag har granskat, får inga flaggor
const coverDir = path.join(__dirname, '..', 'covers');

const isoReturn = (s) => { const m = /^(\d\d)-(\d\d)-(\d\d)$/.exec(s || ''); return m ? `20${m[3]}-${m[1]}-${m[2]}` : null; };

// 1. Läs all rådata, en rad per köp.
const purchases = [];
for (const f of fs.readdirSync(path.join(dataDir, 'raw')).filter((n) => n.endsWith('.json')).sort()) {
  purchases.push(...JSON.parse(fs.readFileSync(path.join(dataDir, 'raw', f), 'utf8')));
}

// 2. En post per bok (asin). Första köpet som inte returnerats vinner, övriga blir extraPurchases.
const byAsin = new Map();
for (const p of purchases) {
  const key = overrides[p.asin]?.sameAs || p.asin; // sameAs: samma bok med nytt asin
  (byAsin.get(key) ?? byAsin.set(key, []).get(key)).push(p);
}

// 3. Serie: välj den mest specifika (den som har färst böcker hos mig), t.ex. Stormlight före Cosmere.
const seriesCount = {};
for (const [, list] of byAsin) for (const [n] of list[0].series || []) seriesCount[n] = (seriesCount[n] || 0) + 1;
const pickSeries = (pairs) =>
  (pairs || []).slice().sort((a, b) => seriesCount[a[0]] - seriesCount[b[0]] || /\[/.test(a[0]) - /\[/.test(b[0]))[0] || [null, null];

const genreOf = (asin, series, audible) => {
  if (genres.asin[asin]) return genres.asin[asin];
  if (series) {
    for (const [g, names] of Object.entries(genres.series)) if (names.includes(series)) return g;
    return genres.seriesDefault;
  }
  return genres.audible[audible] || genres.fallback;
};

const books = [];
for (const [asin, list] of byAsin) {
  list.sort((a, b) => (!!a.returned - !!b.returned) || (a.purchased < b.purchased ? -1 : 1));
  const [main, ...extra] = list;
  const rich = list.find((x) => x.author) || main; // metadata från den post som har sådan
  const ov = overrides[asin] || {};
  const merged = { ...rich, purchased: main.purchased, returned: main.returned, ...ov };
  merged.cover = (merged.cover || '').replace('https://m.media-amazon.com/images/I/', '').replace('._SL500_.jpg', '') || null;
  const [series, seriesPart] = pickSeries(merged.series);
  const flags = [];
  if (merged.returned) flags.push('returned');
  if (extra.length) flags.push('duplicate');
  if (overrides[asin] && !overrides[asin].sameAs) flags.push('manual');
  if (!merged.author) flags.push('noauthor');
  if (reviewed.has(asin)) flags.length = 0;
  const cover = merged.cover && fs.existsSync(path.join(coverDir, `${asin}.jpg`)) ? `covers/${asin}.jpg` : null;
  books.push({
    asin,
    source: merged.source || 'audible',
    url: merged.url || `https://www.audible.com/pd/${encodeURIComponent(asin)}`,
    title: merged.title,
    author: merged.author || null,
    narrator: merged.narrator || null,
    purchased: merged.purchased,
    genre: genreOf(asin, series, merged.genre),
    audibleGenre: merged.genre || null,
    series,
    seriesPart: Number.isFinite(seriesPart) ? seriesPart : null,
    minutes: merged.minutes || null,
    cover,
    coverId: merged.cover || null,
    returned: isoReturn(merged.returned),
    extraPurchases: extra.map((e) => ({ purchased: e.purchased, returned: isoReturn(e.returned) })),
    flags,
  });
}
books.sort((a, b) => (a.purchased < b.purchased ? 1 : a.purchased > b.purchased ? -1 : 0));

fs.writeFileSync(path.join(dataDir, 'books.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), books }, null, 1) + '\n');
console.log(`${purchases.length} köp -> ${books.length} böcker. Flaggade: ${books.filter((b) => b.flags.length).length}`);
