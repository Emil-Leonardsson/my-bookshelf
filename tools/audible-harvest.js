// Körs i webbläsarens konsol på audible.com/account/purchase-history
// (inloggad, ett år valt). Returnerar JSON-text med en post per bok.
(async () => {
  const iso = (s) => { const m = /(\d\d)-(\d\d)-(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
  const rows = [...document.querySelectorAll('tr.bc-table-row, tr[class*="bc-table-row"]')]
    .filter((r) => r.querySelector('a[href*="/pd/"]'));

  // Rader utan datum tillhör beställningen ovanför (paket, t.ex. 4 krediter för 4 böcker).
  let order = null;
  const items = [];
  for (const r of rows) {
    const tds = [...r.querySelectorAll('td')].map((t) => t.innerText.replace(/\s+/g, ' ').trim());
    const date = iso(tds[2]);
    const orderLink = r.querySelector('a[href*="orderId="]');
    if (date) order = { date, cost: tds[3] || null, orderId: orderLink ? new URL(orderLink.href).searchParams.get('orderId') : null };
    const asin = /\/pd\/[^/]+\/([A-Z0-9]{10})/.exec(r.querySelector('a[href*="/pd/"]').getAttribute('href'))?.[1];
    const returned = /Returned on (\d\d-\d\d-\d\d)/.exec(r.innerText)?.[1] || null;
    items.push({ asin, purchased: order?.date, cost: order?.cost, orderId: order?.orderId, returned, listTitle: tds[1]?.replace(/ By:.*/, '') });
  }

  for (const it of items) {
    const t = await (await fetch('/pd/' + it.asin, { credentials: 'include' })).text();
    const d = new DOMParser().parseFromString(t, 'text/html');
    let ab = null;
    for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
      try { (Array.isArray(JSON.parse(s.textContent)) ? JSON.parse(s.textContent) : [JSON.parse(s.textContent)]).forEach((o) => { if (o['@type'] === 'Audiobook') ab = o; }); } catch {}
    }
    const series = [...new Set([...d.querySelectorAll('a[href*="/series/"]')].map((x) => x.textContent.trim()).filter(Boolean))];
    const part = series.map((x) => /, Book (\d+(\.\d+)?)$/.exec(x)).find(Boolean);
    const genre = /subCategory1 = "([^"]*)"/.exec(t)?.[1] || /primaryCategory = "([^"]*)"/.exec(t)?.[1] || null;
    const dur = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(ab?.duration || '');
    Object.assign(it, {
      title: ab?.name || it.listTitle,
      author: ab?.author?.map((a) => a.name).join(', '),
      narrator: ab?.readBy?.map((a) => a.name).join(', '),
      series: series.find((x) => !/, Book /.test(x)) || null,
      seriesPart: part ? Number(part[1]) : null,
      genre,
      minutes: dur ? Number(dur[1] || 0) * 60 + Number(dur[2] || 0) : null,
      cover: ab?.image || null,
      market: location.hostname.replace(/^www\./, ''),
    });
    delete it.listTitle;
  }
  return JSON.stringify(items);
})()
