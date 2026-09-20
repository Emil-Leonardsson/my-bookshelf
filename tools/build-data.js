// Slår ihop data/raw/*.json till data/books.json.
// Användning: node tools/build-data.js
const fs = require('fs');
const path = require('path');

const rawDir = path.join(__dirname, '..', 'data', 'raw');
const isoReturn = (s) => { const m = /^(\d\d)-(\d\d)-(\d\d)$/.exec(s || ''); return m ? `20${m[3]}-${m[1]}-${m[2]}` : null; };

const seen = new Set();
const books = [];
for (const f of fs.readdirSync(rawDir).filter((n) => n.endsWith('.json')).sort()) {
  for (const b of JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf8'))) {
    const key = `${b.asin}|${b.orderId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    books.push({ ...b, returned: isoReturn(b.returned) });
  }
}
books.sort((a, b) => (a.purchased < b.purchased ? 1 : a.purchased > b.purchased ? -1 : 0));

fs.writeFileSync(
  path.join(__dirname, '..', 'data', 'books.json'),
  JSON.stringify({ generated: new Date().toISOString().slice(0, 10), books }, null, 1) + '\n'
);
console.log(`${books.length} böcker skrivna till data/books.json`);
