/* مكتبة دبلومك علينا — search, preview viewer, small touches. No dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal on scroll ---------- */
  const rvs = $$('.rv');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    rvs.forEach(el => io.observe(el));
  } else rvs.forEach(el => el.classList.add('in'));

  /* ---------- search ---------- */
  const norm = s => (s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')          // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[()«»"'،,.:؛]/g, ' ').replace(/\s+/g, ' ').trim();
  const stripAl = w => (w.length > 3 && w.startsWith('ال')) ? w.slice(2) : w;

  const q = $('#q'), clear = $('#qClear'), count = $('#count'), empty = $('#empty');
  const finder = $('.finder');
  const cards = $$('.guide');
  const index = cards.map(c => {
    const words = norm(c.dataset.k + ' ' + $('h3', c).textContent).split(' ');
    return words.concat(words.map(stripAl)).join(' ');
  });
  const total = cards.length;

  function filter(raw, { updateUrl = true } = {}) {
    const terms = norm(raw).split(' ').filter(Boolean).map(stripAl);
    let shown = 0;
    cards.forEach((c, i) => {
      const ok = !terms.length || terms.every(t => index[i].includes(t));
      c.hidden = !ok; if (ok) shown++;
    });
    finder.classList.toggle('has-q', !!raw.trim());
    empty.classList.toggle('on', shown === 0);
    count.textContent = terms.length
      ? (shown ? `يظهر ${shown} من ${total} دليلًا` : '')
      : `${total} دليلًا تخصصيًا · اضغط «تحميل» للتنزيل المباشر`;
    if (updateUrl && history.replaceState) {
      const u = new URL(location.href);
      raw.trim() ? u.searchParams.set('q', raw.trim()) : u.searchParams.delete('q');
      history.replaceState(history.state, '', u);
    }
  }
  if (q) {
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => filter(q.value), 90); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = cards.find(c => !c.hidden);
        if (first) first.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        q.blur();
      }
      if (e.key === 'Escape' && q.value) { q.value = ''; filter(''); }
    });
    const reset = () => { q.value = ''; filter(''); q.focus(); };
    clear.addEventListener('click', reset);
    $('#emptyClear').addEventListener('click', reset);
    const initial = new URLSearchParams(location.search).get('q') || '';
    q.value = initial; filter(initial, { updateUrl: false });
  }

  /* ---------- deep links (#science) & chips: make sure the card is visible, then flash it ---------- */
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const card = id && document.getElementById(id);
    if (!card || !card.classList.contains('guide')) return;
    if (card.hidden && q) { q.value = ''; filter(''); }
    card.classList.add('in');
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    card.classList.remove('hl'); void card.offsetWidth; card.classList.add('hl');
    setTimeout(() => card.classList.remove('hl'), 2600);
  }
  addEventListener('hashchange', revealHash);
  if (location.hash) setTimeout(revealHash, 60);

  /* ---------- preview viewer ---------- */
  const dlg = $('#viewer'), track = $('#vTrack'), vTitle = $('#vTitle'), vSub = $('#vSub'),
        vCount = $('#vCount'), vPrev = $('#vPrev'), vNext = $('#vNext'), vDl = $('#vDl'), vOpen = $('#vOpen');
  let pages = [], cur = 0, opener = null, pushed = false, pageIO = null;

  function setCur(i) {
    cur = Math.max(0, Math.min(pages.length - 1, i));
    vCount.textContent = `صفحة ${cur + 1} من ${pages.length}`;
    vPrev.disabled = cur === 0; vNext.disabled = cur === pages.length - 1;
  }
  function go(i) {
    const el = track.children[Math.max(0, Math.min(pages.length - 1, i))];
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
  }
  function openViewer(src, btn) {
    if (!dlg || typeof dlg.showModal !== 'function') {          // very old browser: just open the PDF
      window.open(src.dataset.file, '_blank', 'noopener'); return;
    }
    opener = btn;
    const slug = src.dataset.slug, nums = src.dataset.pages.split(',');
    pages = nums;
    vTitle.textContent = src.dataset.title;
    vSub.textContent = `صفحات مختارة من الدليل · ${nums.length} من ${src.dataset.total} صفحة`;
    vDl.href = src.dataset.file; vDl.setAttribute('download', src.dataset.dl);
    vOpen.href = src.dataset.file;
    track.innerHTML = nums.map((n, i) => {
      const p = String(n).padStart(2, '0');
      return `<figure class="v-page"><img src="assets/pages/${slug}/p${p}.webp" width="900" height="1273" ${i > 1 ? 'loading="lazy"' : ''} decoding="async" alt="صفحة ${n} من ${src.dataset.title}"></figure>`;
    }).join('');
    track.scrollLeft = 0;
    if (pageIO) pageIO.disconnect();
    pageIO = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) setCur([...track.children].indexOf(e.target));
    }), { root: track, threshold: 0.6 });
    [...track.children].forEach(c => pageIO.observe(c));
    setCur(0);
    document.documentElement.classList.add('lock');
    dlg.showModal();
    track.focus({ preventScroll: true });
    try { history.pushState({ viewer: 1 }, ''); pushed = true; } catch (_) { pushed = false; }
  }
  function closeViewer(fromPop) {
    if (!dlg.open) return;
    dlg.close();
  }
  if (dlg) {
    dlg.addEventListener('close', () => {
      document.documentElement.classList.remove('lock');
      if (pageIO) pageIO.disconnect();
      if (pushed) { pushed = false; history.back(); }
      if (opener) opener.focus({ preventScroll: true });
    });
    addEventListener('popstate', () => { if (dlg.open) { pushed = false; dlg.close(); } });
    $('#vClose').addEventListener('click', () => closeViewer());
    vPrev.addEventListener('click', () => go(cur - 1));
    vNext.addEventListener('click', () => go(cur + 1));
    dlg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur + 1); }     // RTL: left = next
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur - 1); }
    });
  }
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-preview]');
    if (!btn) return;
    const src = btn.closest('[data-slug]');
    if (src) { e.preventDefault(); openViewer(src, btn); }
  });

  /* ---------- general guide cover: gentle tilt toward the pointer (desktop only) ---------- */
  const book = $('.g-book');
  if (book && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const img = $('img', book), zone = book.parentElement;
    zone.addEventListener('pointermove', e => {
      const r = zone.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      img.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
      img.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    });
    zone.addEventListener('pointerleave', () => { img.style.removeProperty('--ry'); img.style.removeProperty('--rx'); });
  }

  /* ---------- share: native sheet when available, WhatsApp link otherwise ---------- */
  const share = $('#share');
  if (share && navigator.share) {
    share.addEventListener('click', e => {
      e.preventDefault();
      navigator.share({
        title: 'مكتبة دبلومك علينا المجانية',
        text: 'أدلة مجانية لأداة تقييم التطور المهني لكل التخصصات، مع دليل عام يربط مهام الدبلوم ببنود الأداة.',
        url: 'https://diplomakalena-cloud.github.io/library/'
      }).catch(() => {});
    });
  }
})();
