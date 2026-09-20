# my-bookshelf

Böcker jag har lyssnat på, med betyg. Statisk sida för GitHub Pages, ingen build.

- `data/raw/<år>.json` är rådata från Audible (hämtad med `tools/audible-harvest.js`). `node tools/build-data.js` bygger `data/books.json` av dem.
- Betygen ligger separat i `data/ratings.json`. Öppna sidan med `?edit` för att betygsätta, klicka "Exportera betyg" och lägg den nedladdade filen i `data/`.
- Lokalt: `npx http-server . -p 8090 -c-1`
