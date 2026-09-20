// Hämtar omslag (300 px) till covers/<asin>.jpg för böcker som saknar fil. Kör sedan build-data.js igen.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'covers');
const { books } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'books.json'), 'utf8'));
const todo = books.filter((b) => b.coverId && !fs.existsSync(path.join(dir, `${b.asin}.jpg`)));

(async () => {
  let ok = 0, fail = [];
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(async (b) => {
      try {
        const r = await fetch(`https://m.media-amazon.com/images/I/${encodeURIComponent(b.coverId)}._SL300_.jpg`);
        if (!r.ok) throw new Error(r.status);
        fs.writeFileSync(path.join(dir, `${b.asin}.jpg`), Buffer.from(await r.arrayBuffer()));
        ok++;
      } catch (e) { fail.push(`${b.title} (${e.message})`); }
    }));
  }
  console.log(`Hämtade ${ok} av ${todo.length}.`, fail.length ? 'Misslyckades: ' + fail.join('; ') : '');
})();
