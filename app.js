(() => {
  const DRAFT_KEY = 'bookshelf-ratings-draft';
  const EDIT = new URLSearchParams(location.search).has('edit');

  const FLAG_LABELS = {
    returned: 'returnerad',
    duplicate: 'köpt flera gånger',
    manual: 'handifylld info',
    noauthor: 'saknar författare',
  };

  const state = { books: [], saved: {}, q: '', view: 'date', dir: 'desc', minRating: '0', genres: new Set() };
  let draft = loadDraft();

  const $ = (id) => document.getElementById(id);
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; }
  }
  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
  }

  const ratingOf = (b) => (b.asin in draft ? draft[b.asin] : state.saved[b.asin] ?? null);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });

  const fmtMonth = (iso) => new Date(iso).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' });

  function hue(s) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

  function starsHtml(b) {
    const r = ratingOf(b);
    const label = r ? `Betyg ${r} av 5` : 'Inget betyg än';
    if (!EDIT) {
      const s = [1, 2, 3, 4, 5].map((n) => `<span class="s${n <= r ? ' on' : ''}" aria-hidden="true">★</span>`).join('');
      return `<span class="stars${r ? '' : ' norating'}" role="img" aria-label="${label}">${s}</span>`;
    }
    const s = [1, 2, 3, 4, 5]
      .map((n) => `<button class="s${n <= r ? ' on' : ''}" data-asin="${b.asin}" data-n="${n}" aria-label="${n} stjärnor">★</button>`)
      .join('');
    return `<span class="stars editable${r ? '' : ' norating'}" title="Klicka på samma stjärna igen för att ta bort betyget">${s}</span>`;
  }

  function bookHtml(b, showSeries = true) {
    const cover = b.cover
      ? `<img src="${b.cover}" alt="" loading="lazy">`
      : `<span>${esc(b.title)}</span>`;
    const bg = b.cover ? '' : ` style="background:linear-gradient(145deg,hsl(${hue(b.title)} 45% 38%),hsl(${(hue(b.title) + 40) % 360} 50% 26%))"`;
    const series = b.series && showSeries
      ? `<span class="series">${esc(b.series)}${b.seriesPart != null ? ` #${b.seriesPart}` : ''}</span>`
      : b.series && b.seriesPart ? `<span class="series">Del ${b.seriesPart}</span>` : '';
    const url = b.url;
    return `
      <article class="book">
        ${url ? `<a class="cover"${bg} href="${url}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${cover}</a>` : `<div class="cover"${bg}>${cover}</div>`}
        <h3>${url ? `<a href="${url}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</h3>
        <span class="by">${esc(b.author || 'Okänd författare')}</span>
        ${series}
        ${starsHtml(b)}
        <span class="date">Läst ${b.dateApprox ? fmtMonth(b.purchased) : fmtDate(b.purchased)}</span>
        ${EDIT && b.flags.length ? `<span class="flags">Granska: ${b.flags.map((f) => FLAG_LABELS[f] || f).join(', ')}</span>` : ''}
      </article>`;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  function filtered(withGenre = false) {
    const q = norm(state.q).trim();
    const min = Number(state.minRating);
    return state.books.filter((b) => {
      if (q && !norm([b.title, b.author, b.narrator, b.series, b.genre].join(' ')).includes(q)) return false;
      if (withGenre && state.genres.size && !state.genres.has(b.genre)) return false;
      const r = ratingOf(b);
      if (min === -1) return !r;
      if (min > 0) return r >= min;
      return true;
    });
  }

  const byDate = (dir) => (a, b) =>
    (a.purchased < b.purchased ? -1 : a.purchased > b.purchased ? 1 : 0) * (dir === 'asc' ? 1 : -1);

  function avg(list) {
    const rated = list.map(ratingOf).filter(Boolean);
    return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  }

  function groupMeta(list) {
    const a = avg(list);
    const n = `${list.length} ${list.length === 1 ? 'bok' : 'böcker'}`;
    return a ? `${n}, snittbetyg ${a.toFixed(1).replace('.', ',')}` : n;
  }

  function groupHtml(title, list, showSeries) {
    return `
      <section class="group">
        <div class="group-head"><h2>${esc(title)}</h2><span class="meta">${groupMeta(list)}</span></div>
        <div class="grid">${list.map((b) => bookHtml(b, showSeries)).join('')}</div>
      </section>`;
  }

  function render() {
    const list = filtered(state.view === 'genre');
    renderGenreChips();
    $('count').textContent = `Visar ${list.length} av ${state.books.length} böcker`;
    $('dir').textContent = state.dir === 'desc' ? 'Nyast först ↓' : 'Äldst först ↑';
    $('dir').hidden = state.view !== 'date';

    if (!list.length) {
      $('list').innerHTML = '<p class="empty">Inga böcker matchar sökningen.</p>';
      return;
    }

    let html;
    if (state.view === 'date') {
      html = `<div class="grid">${list.sort(byDate(state.dir)).map((b) => bookHtml(b)).join('')}</div>`;
    } else if (state.view === 'genre') {
      const groups = groupBy(list, (b) => b.genre || 'Okänd genre');
      html = [...groups]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'sv'))
        .map(([g, items]) => groupHtml(g, items.sort(byDate('asc')), true))
        .join('');
    } else {
      const groups = groupBy(list.filter((b) => b.series), (b) => b.series);
      const solo = list.filter((b) => !b.series);
      html = [...groups]
        .sort((a, b) => a[0].localeCompare(b[0], 'sv'))
        .map(([s, items]) => groupHtml(s, items.sort((a, b) => (a.seriesPart ?? 99) - (b.seriesPart ?? 99)), false))
        .join('');
      if (solo.length) html += groupHtml('Fristående böcker', solo.sort(byDate('asc')), false);
    }
    $('list').innerHTML = html;
  }

  function renderGenreChips() {
    const box = $('genreFilter');
    box.hidden = state.view !== 'genre';
    if (box.hidden) return;
    const counts = new Map();
    for (const b of filtered(false)) counts.set(b.genre, (counts.get(b.genre) || 0) + 1);
    const genres = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'));
    box.innerHTML =
      `<button class="chip${state.genres.size ? '' : ' on'}" data-genre="">Alla</button>` +
      genres
        .map(([g, n]) => `<button class="chip${state.genres.has(g) ? ' on' : ''}" data-genre="${esc(g)}">${esc(g)} <span>${n}</span></button>`)
        .join('');
  }

  function groupBy(list, key) {
    const m = new Map();
    for (const b of list) {
      const k = key(b);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(b);
    }
    return m;
  }

  function renderStats() {
    const dates = state.books.map((b) => b.purchased).sort();
    const a = avg(state.books);
    const ratedCount = state.books.filter(ratingOf).length;
    const items = [
      ['Böcker', state.books.length],
      ['Serier', new Set(state.books.map((b) => b.series).filter(Boolean)).size],
      ['Snittbetyg', a ? a.toFixed(1).replace('.', ',') + ' ★' : '-'],
      ['Betygsatta', `${ratedCount} av ${state.books.length}`],
      ['Timmar', state.totalHours ? 'ca ' + (Math.round(state.totalHours / 100) * 100).toLocaleString('sv-SE') : '-'],
      ['Sedan', dates.length ? dates[0].slice(0, 4) : '-'],
    ];
    $('stats').innerHTML = items.map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');
  }

  function exportRatings() {
    const out = {};
    for (const b of state.books) { const r = ratingOf(b); if (r) out[b.asin] = r; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1) + '\n'], { type: 'application/json' }));
    a.download = 'ratings.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    $('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
    $('minRating').addEventListener('change', (e) => { state.minRating = e.target.value; render(); });
    $('dir').addEventListener('click', () => { state.dir = state.dir === 'desc' ? 'asc' : 'desc'; render(); });
    document.querySelectorAll('[data-view]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.view = btn.dataset.view;
        document.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === btn));
        render();
      }));

    $('genreFilter').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const g = chip.dataset.genre;
      if (!g) state.genres.clear();
      else if (state.genres.has(g)) state.genres.delete(g);
      else state.genres.add(g);
      render();
    });

    if (EDIT) {
      $('editbar').hidden = false;
      $('list').addEventListener('click', (e) => {
        const s = e.target.closest('.s[data-asin]');
        if (!s) return;
        const book = state.books.find((b) => b.asin === s.dataset.asin);
        const n = Number(s.dataset.n);
        draft[book.asin] = ratingOf(book) === n ? null : n;
        saveDraft();
        renderStats();
        render();
      });
      $('export').addEventListener('click', exportRatings);
      $('reset').addEventListener('click', () => {
        if (!confirm('Kasta alla osparade betygsändringar?')) return;
        draft = {};
        saveDraft();
        renderStats();
        render();
      });
    }
  }

  Promise.all([
    fetch('data/books.json', { cache: 'no-cache' }).then((r) => r.json()),
    fetch('data/ratings.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({})),
  ])
    .then(([data, ratings]) => {
      state.books = data.books;
      state.totalHours = data.totalHours;
      state.saved = ratings;
      bind();
      renderStats();
      render();
    })
    .catch(() => {
      $('list').innerHTML = '<p class="empty">Kunde inte läsa data/books.json. Kör sidan via en webbserver, inte som fil.</p>';
    });
})();
