// Körs i webbläsarens konsol på en audible.com-sida där du är inloggad.
// Anrop: await harvest([2012, 2013])  (klistra in hela filen först).
// Hämtar köphistorik per år (med sidbläddring) och metadata per bok, och
// returnerar JSON-text: { items: [...], skipped: [...] }.
// Spara items som data/raw/<år>.json och kör sedan: node tools/build-data.js
async function harvest(years) {
  const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const iso = (s) => { const m = /(\d\d)-(\d\d)-(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
  const items = [];
  const skipped = [];
  const seen = new Set();

  for (const year of years) {
    let order = null; // rader utan datum tillhör beställningen ovanför (paket)
    for (let pn = 1; pn <= 30; pn++) {
      const html = await (await fetch(`/account/purchase-history?tf=orders&df=${year}&ps=40&pn=${pn}`, { credentials: 'include' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      let added = 0;
      for (const r of doc.querySelectorAll('tr')) {
        const tds = [...r.querySelectorAll(':scope > td')].map(text);
        const pd = r.querySelector('a[href*="/pd/"]');
        const orderLink = r.querySelector('a[href*="orderId="]');
        if (!pd && !orderLink) continue;
        const date = iso(tds[2]);
        if (date) order = { date, cost: tds[3] || null, orderId: orderLink ? new URL(orderLink.href, location.origin).searchParams.get('orderId') : null };
        if (!pd) { skipped.push({ year, purchased: date, cost: tds[3], row: tds.slice(1, 4).join(' | ') }); continue; }
        const asin = /\/pd\/[^/]+\/([A-Z0-9]{10})/.exec(pd.getAttribute('href'))?.[1];
        const key = `${asin}|${order?.orderId}`;
        if (seen.has(key)) continue;
        seen.add(key); added++;
        items.push({
          asin, purchased: order?.date, cost: order?.cost, orderId: order?.orderId,
          returned: /Returned on (\d\d-\d\d-\d\d)/.exec(text(r))?.[1] || null,
          listTitle: tds[1]?.replace(/ By:.*/, ''),
        });
      }
      if (!added) break;
    }
  }

  const meta = {};
  const asins = [...new Set(items.map((i) => i.asin))];
  for (let i = 0; i < asins.length; i += 5) {
    await Promise.all(asins.slice(i, i + 5).map(async (asin) => {
      const t = await (await fetch('/pd/' + asin, { credentials: 'include' })).text();
      const d = new DOMParser().parseFromString(t, 'text/html');
      let ab = null;
      for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
        try { const j = JSON.parse(s.textContent); (Array.isArray(j) ? j : [j]).forEach((o) => { if (o['@type'] === 'Audiobook') ab = o; }); } catch {}
      }
      const series = [...new Set([...d.querySelectorAll('a[href*="/series/"]')].map(text).filter(Boolean))];
      const part = series.map((x) => /, Book (\d+(\.\d+)?)$/.exec(x)).find(Boolean);
      const dur = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(ab?.duration || '');
      meta[asin] = {
        title: ab?.name || null,
        author: ab?.author?.map((a) => a.name).join(', '),
        narrator: ab?.readBy?.map((a) => a.name).join(', '),
        series: series.find((x) => !/, Book /.test(x)) || null,
        seriesPart: part ? Number(part[1]) : null,
        genre: /subCategory1 = "([^"]*)"/.exec(t)?.[1] || /primaryCategory = "([^"]*)"/.exec(t)?.[1] || null,
        minutes: dur ? Number(dur[1] || 0) * 60 + Number(dur[2] || 0) : null,
        cover: ab?.image || null,
        market: location.hostname.replace(/^www\./, ''),
      };
    }));
  }
  for (const it of items) { Object.assign(it, meta[it.asin]); it.title = it.title || it.listTitle; delete it.listTitle; }
  return JSON.stringify({ items, skipped });
}
