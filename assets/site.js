/* دبلومك علينا — الصفحة الرئيسية
   الأسعار والباقات ورسائل الواتساب كلها من assets/plans.js */
(function () {
  'use strict';

  const DK = window.DK || { plans: {}, messages: {}, months: 10 };
  const WA = 'https://wa.me/' + (DK.whatsapp || '962779283635');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const ico = (id, cls) => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const waLink = msg => (msg ? `${WA}?text=${encodeURIComponent(msg)}` : WA);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Config → page: prices and WhatsApp messages ---------- */
  function fill(root) {
    $$('[data-v]', root).forEach(el => {
      const v = el.dataset.v.split('.').reduce((o, k) => (o == null ? o : o[k]), DK);
      if (v != null) el.textContent = v;
    });
    $$('[data-wa]', root).forEach(a => { a.href = waLink((DK.messages || {})[a.dataset.wa]); });
  }
  fill(document);

  /* ---------- Modals share one history entry, so the phone's Back button closes them ---------- */
  let closeModal = null;
  function modalOpened(closeFn, container) {
    closeModal = closeFn;
    document.body.style.overflow = 'hidden';
    // going back to this entry must not yank the scroll position (a menu link scrolls right after closing)
    try { history.scrollRestoration = 'manual'; history.pushState({ dkModal: 1 }, ''); } catch (e) {}
    trap = container;
  }
  function modalClosed(fromPop) {
    closeModal = null; trap = null;
    document.body.style.overflow = '';
    if (!fromPop && history.state && history.state.dkModal) history.back();
    setTimeout(() => { if (!closeModal) { try { history.scrollRestoration = 'auto'; } catch (e) {} } }, 1500);
  }
  addEventListener('popstate', () => { if (closeModal) closeModal(true); });
  let trap = null;
  addEventListener('keydown', e => {
    if (!closeModal) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab' || !trap) return;
    const f = $$('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])', trap).filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Sheet ---------- */
  const sheet = $('#sheet'), box = $('#sheetBox'), sBody = $('#sBody');
  let lastFocus = null;
  function openSheet(o) {
    lastFocus = document.activeElement;
    $('#sIco').innerHTML = ico(o.icon || 'i-check');
    $('#sTitle').textContent = o.title || '';
    $('#sSub').textContent = o.sub || '';
    const holder = document.createElement('div');
    if (o.node) holder.append(o.node); else holder.innerHTML = o.html || '';
    fill(holder);
    sBody.replaceChildren(holder);
    box.scrollTop = 0;
    sheet.classList.toggle('light', !!o.light);
    sheet.classList.add('open');
    modalOpened(closeSheet, box);
    $('#sClose').focus({ preventScroll: true });
    initCoins(holder);
    setTimeout(() => holder.classList.add('in'), 120); // chart bars grow once the sheet is up
    return holder;
  }
  function closeSheet(fromPop) {
    if (!sheet.classList.contains('open')) return;
    sheet.classList.remove('open');
    modalClosed(fromPop === true);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#sClose').onclick = () => closeSheet();
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  // links inside a sheet (menu, "see the packages"): close first, then go
  sBody.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const target = $(a.getAttribute('href'));
    closeSheet();
    if (target) setTimeout(() => target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 90);
  });
  // swipe down to close on phones
  let sy = null;
  box.addEventListener('touchstart', e => { sy = box.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  box.addEventListener('touchmove', e => { if (sy === null) return; const dy = e.touches[0].clientY - sy; if (dy > 0) box.style.transform = `translateY(${dy}px)`; }, { passive: true });
  box.addEventListener('touchend', e => { if (sy === null) return; const dy = e.changedTouches[0].clientY - sy; box.style.transform = ''; if (dy > 110) closeSheet(); sy = null; });

  // any element with data-tpl opens a sheet filled from that <template>
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    const tpl = document.getElementById(b.dataset.tpl);
    if (!tpl) return;
    openSheet({ icon: b.dataset.ico, title: b.dataset.title, sub: b.dataset.sub, node: tpl.content.cloneNode(true), light: !!b.closest('section.light') });
  });

  // «علينا / عليك» tiles: the short description lives in the tile itself
  $$('.tiles').forEach(list => list.addEventListener('click', e => {
    const t = e.target.closest('button.tile');
    if (!t) return;
    const use = $('.ico use', t);
    const desc = ($('small', t) || {}).textContent || '';
    const prep = t.dataset.prep;
    const pts = (t.dataset.points || '').split('|').filter(Boolean);
    const html = `<p class="sheet-p">${desc}</p>` +
      (pts.length ? `<ul class="ticks">${pts.map(p => `<li>${ico('i-check')}<span>${p}</span></li>`).join('')}</ul>` : '') +
      (prep ? `<div class="we-prep">${ico('i-check')}<span>${prep}</span></div>` : '') +
      `<a class="btn btn-gold" href="#packages" style="margin-top:8px">شوف الباقات</a>`;
    openSheet({ icon: use ? use.getAttribute('href').slice(1) : 'i-hand', title: $('b', t).textContent, sub: list.dataset.sub, html, light: !!t.closest('section.light') });
  }));

  /* ---------- Payment sheet: installment coins for either package ---------- */
  function initCoins(root) {
    const wrap = $('[data-coins]', root);
    if (!wrap) return;
    const coins = () => $$('.coin', wrap);
    const flip = (first) => coins().forEach((c, i) => setTimeout(() => c.classList.add('on'), reduce ? 0 : (first ? 320 : 140) + i * 80));
    const set = plan => {
      const m = (DK.plans[plan] || {}).monthly;
      $('[data-coin-amt]', root).textContent = m;
      $$('.coin .f', wrap).forEach(f => { f.textContent = m; });
      $$('[data-coin]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.coin === plan)));
    };
    wrap.innerHTML = Array.from({ length: DK.months || 10 }, (_, i) => `<div class="coin"><div class="f"></div><div class="b">${i + 1}</div></div>`).join('');
    set('basic'); flip(true);
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-coin]');
      if (!b || b.getAttribute('aria-pressed') === 'true') return;
      coins().forEach(c => c.classList.remove('on'));
      setTimeout(() => { set(b.dataset.coin); flip(false); }, reduce ? 0 : 260);
    });
  }

  /* ---------- Separate services ---------- */
  const services = [
    {ico:'i-tasks', t:'المهام الأسبوعية', d:'أي مهمة أسبوعية أو منتدى نقاشي، على القالب المطلوب.', p:'2', u:'دينار للمهمة', note:'3 مهام بـ5 دنانير',
     s:'خلّص مهامك بدون ما تسهر',
     f:['خطط دروس، تحليل محتوى، دراسات حالة، وغيرها — كل مهمة على قالبها','المنتديات النقاشية: المشاركة الأساسية والتعليقات على الزملاء','عرض: 3 مهام بـ5 دنانير','تسليم قبل الموعد بوقت كافي','تعديل مجاني إذا طلب المرشد'],
     msg:'مرحبا، بدي مساعدة بالمهام الأسبوعية'},
    {ico:'i-pen', t:'كتابة مقال أكاديمي', d:'مقال مكتوب إلك إنت، على تخصصك.', p:'15', u:'دينار',
     s:'مقال يليق باسمك',
     f:['مكتوب إلك بالتحديد وعلى تخصصك','ما بينعطى لأي معلم ثاني','نسبة استلال مضمونة','توثيق مراجع صحيح','تعديل حسب ملاحظات المرشد'],
     msg:'مرحبا، محتاج كتابة مقال أكاديمي للدبلوم'},
    {ico:'i-search', t:'البحث الاستقصائي', d:'كامل، من صياغة السؤال الاستقصائي والمخطط لحد العرض التقديمي.', p:'45', u:'دينار', hl:true,
     s:'بحثك جاهز من أوله لآخره',
     f:['صياغة السؤال الاستقصائي والمخطط','أدوات جمع البيانات، التحليل، النتائج والتوصيات','العرض التقديمي للبحث','مكتوب إلك لحالك ونسبة الاستلال مضمونة','تعديلات حسب ملاحظات المرشد بكل مرحلة'],
     msg:'مرحبا، محتاج البحث الاستقصائي كامل'},
    {ico:'i-folder', t:'ملف الإنجاز', d:'شامل خطة النمو المهني وبوستر البحث الاستقصائي.', p:'10', u:'دنانير',
     s:'كل شغلك بملف واحد مرتّب',
     f:['ملف الإنجاز كامل ومنظّم حسب المطلوب','خطة النمو المهني','بوستر البحث الاستقصائي','جاهز للتسليم'],
     msg:'مرحبا، محتاج ملف الإنجاز (مع خطة النمو المهني وبوستر البحث)'},
    {ico:'i-star', t:'أداة التقييم بلس', d:'الأداة كاملة مع تجهيز شامل للجلسة الإرشادية.', p:'15', u:'دينار', hl:true,
     s:'ادخل الجلسة الإرشادية وإنت جاهز',
     f:['أداة تقييم التطور المهني: دليل لكل معيار + تظليل المستوى المناسب','شرح سبب اختيار كل دليل وكل مستوى','سؤال متوقع لكل معيار مع إجابته','أكثر الأسئلة تكراراً من المرشدين مع إجاباتها','تعبئة تقرير الجلسة الإرشادية'],
     msg:'مرحبا، محتاج أداة التقييم بلس للجلسة الإرشادية'},
    {ico:'i-gauge', t:'أداة التقييم', d:'أداة تقييم التطور المهني مع تقرير الجلسة.', p:'12', u:'دينار',
     s:'الأداة الأساسية جاهزة',
     f:['أداة تقييم التطور المهني مبنية على المعايير المطلوبة','أدلة منظمة لكل معيار','تعبئة تقرير الجلسة الإرشادية','شرح مبسّط لطريقة استخدامها'],
     msg:'مرحبا، محتاج أداة تقييم التطور المهني'},
    {ico:'i-board', t:'تدريس مصغّر', d:'العرض والشرح وسيناريو الدرس خطوة بخطوة.', p:'5', u:'دنانير',
     s:'إنت بس بتقدّم',
     f:['العرض التقديمي للدرس','شرح الدرس','سيناريو الدرس خطوة بخطوة'],
     msg:'مرحبا، محتاج تجهيز تدريس مصغّر'},
    {ico:'i-screen', t:'عرض تقديمي', d:'للبحث الاستقصائي أو التدريس المصغّر أو الحصص النموذجية.', p:'5', u:'دنانير',
     s:'عرض مرتّب ومريح للشرح',
     f:['تصميم احترافي يناسب السياق الأكاديمي','محتوى منظّم بيسهّل عليك الشرح','تعديلات لحد ما ترضى'],
     msg:'مرحبا، محتاج عرض تقديمي'}
  ];
  const svcList = $('#svcList');
  svcList.innerHTML = services.map((x, i) => `
    <button type="button" class="card svc-row${x.hl ? ' hl' : ''}" data-i="${i}" data-say="${x.s}.">
      <span class="ico">${ico(x.ico)}</span>
      <span class="tx"><strong>${x.t}</strong><small>${x.d}${x.note ? ` · ${x.note}` : ''}</small></span>
      <span class="pr"><b class="foil">${x.p}</b><span>${x.u}</span></span>
      <span class="go" aria-hidden="true">${ico('i-arrow')}</span>
    </button>`).join('');
  svcList.addEventListener('click', e => {
    const c = e.target.closest('.svc-row');
    if (!c) return;
    const x = services[c.dataset.i];
    openSheet({ icon: x.ico, title: x.t, sub: x.s, html:
      `<div class="sheet-price"><b class="foil">${x.p}</b><span>${x.u}</span>${x.note ? `<em>${x.note}</em>` : ''}</div>
       <ul class="ticks">${x.f.map(f => `<li>${ico('i-check')}<span>${f}</span></li>`).join('')}</ul>
       <a class="btn btn-gold" href="${waLink(x.msg)}" target="_blank" rel="noopener">${ico('i-wa', 'fill')}اطلبها عبر واتساب</a>` });
  });

  /* ---------- Lightbox (proof screenshots + slides) ---------- */
  const lb = $('#lb'), lbImg = $('#lbImg'), lbBody = $('#lbBody');
  let lbList = [], lbI = 0, lbFocus = null;
  function lbShow() {
    const it = lbList[lbI];
    lbImg.src = it.src; lbImg.alt = it.alt || ''; lbImg.width = it.w; lbImg.height = it.h;
    $('#lbCount').textContent = lbList.length > 1 ? `${lbI + 1} من ${lbList.length}` : '';
    $('#lbPrev').style.visibility = $('#lbNext').style.visibility = lbList.length > 1 ? '' : 'hidden';
    lbBody.scrollTop = 0;
  }
  function openLB(list, i, wide) {
    lbFocus = document.activeElement;
    lbList = list; lbI = i; lb.classList.toggle('wide', !!wide); lbShow();
    lb.classList.add('open');
    modalOpened(closeLB, lb);
    $('#lbClose').focus({ preventScroll: true });
  }
  function closeLB(fromPop) {
    if (!lb.classList.contains('open')) return;
    lb.classList.remove('open');
    modalClosed(fromPop === true);
    if (lbFocus && lbFocus.focus) lbFocus.focus({ preventScroll: true });
  }
  const lbStep = d => { lbI = (lbI + d + lbList.length) % lbList.length; lbShow(); };
  $('#lbClose').onclick = () => closeLB();
  $('#lbNext').onclick = () => lbStep(1);
  $('#lbPrev').onclick = () => lbStep(-1);
  lbBody.addEventListener('click', e => { if (e.target === lbBody) closeLB(); });
  addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') lbStep(1);
    if (e.key === 'ArrowRight') lbStep(-1);
  });
  let lbX = null;
  lbBody.addEventListener('touchstart', e => { lbX = e.touches[0].clientX; }, { passive: true });
  lbBody.addEventListener('touchend', e => { if (lbX === null) return; const dx = e.changedTouches[0].clientX - lbX; lbX = null; if (Math.abs(dx) > 60 && lbList.length > 1) lbStep(dx > 0 ? 1 : -1); });

  /* ---------- Proof rail ---------- */
  const P = 'assets/proof/';
  const proof = {
    msgs: [
      {img:'t-only-you', pos:'50% 75%', w:662, h:594, q:'مستحيل أروح على غيرك… إنتَ متكتك وشغلك متكتك', ctx:'زبون لما حكيناله عن حدا ثاني بيشتغل بهالمجال'},
      {img:'t-nobody', pos:'50% 0%', w:720, h:331, q:'الصراحة شغلك بسم الله ما شاء الله، فيش حدا بقدر يحكي عليهن', ctx:'رسالة زبون بعد ما استلم شغله'},
      {img:'t-referral', pos:'50% 40%', w:720, h:531, q:'وكل واحد بوقع تحت إيدي بعطيه رقمك فورًا', ctx:'زبون بيرشّحنا لزملائه'},
      {img:'t-artist', pos:'50% 100%', w:642, h:1280, q:'فنان وشغل مرتب يا غالي', ctx:'بعد ما شاف عرض جلسة التدريس المصغّر'},
      {img:'t-fullmark', pos:'50% 50%', w:500, h:252, q:'إنت الصراحة بتجيب فل مارك ما شاء الله', ctx:'زبون قبل ما نسلّمه مهمة جديدة'},
      {img:'t-similarity', pos:'50% 100%', w:720, h:1050, q:'11 عندي', ctx:'نسبة الاستلال بمقاله، لما معلمين كثير بالمجموعات طلعت نسبتهم فوق الـ50%'},
      {img:'t-thanks', pos:'50% 30%', w:720, h:727, q:'ربي يعطيك ألف عافية، ما قصّرت معي', ctx:'رسالة زبون بعد تسليم مقال'}
    ],
    mentors: [
      {img:'m-research', pos:'50% 100%', w:500, h:370, q:'بصراحة من أفضل الأبحاث التي تم تقديمها', ctx:'رسالة من المرشد للمعلم عن البحث الاستقصائي اللي جهزناه'},
      {img:'m-article', pos:'50% 0%', w:720, h:921, q:'المقال متميز جدًا؛ لأنه تجاوز وصف الموقف إلى تحليل عميق', ctx:'تعليق المرشد على مقال كتبناه لزبون'}
    ],
    grades: [
      {img:'g-course', pos:'50% 100%', w:720, h:777, stat:'40/40', ctx:'Distinction بكل مهام مساق «أساسيات التعلم والتعليم»'},
      {img:'g-transcript', pos:'50% 0%', w:720, h:315, stat:'ناجح بتميز', ctx:'بكل المساقات اللي إلها علامة، والمساق الرابع نتيجته ناجح أو راسب بس'},
      {img:'g-task-16', pos:'50% 45%', w:500, h:828, stat:'16/16', ctx:'علامة مهمة المجمع، ونسبة التشابه فيها 6%'}
    ]
  };
  const proofRail = $('#proofRail'), proofTabs = $$('#proofTabs .tab');
  let proofTab = 'msgs';
  function renderProof(tab) {
    proofTab = tab;
    proofRail.innerHTML = proof[tab].map((x, i) => `
      <button type="button" class="card pcard" data-i="${i}" aria-label="شوف الصورة كاملة: ${x.q || x.stat}">
        ${x.stat ? `<div class="stat foil">${x.stat}</div>` : `<div class="q">${x.q}</div>`}
        <div class="ctx">${x.ctx}</div>
        <div class="shot"><img src="${P}${x.img}.webp" width="${x.w}" height="${x.h}" alt="" loading="lazy" decoding="async" style="object-position:${x.pos}">
          <span class="see">${ico('i-plus')}شوف الصورة كاملة</span></div>
      </button>`).join('');
    proofRail.scrollTo({ left: 0 });
    proofTabs.forEach(t => { const on = t.dataset.tab === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  }
  proofTabs.forEach((t, i) => {
    t.onclick = () => renderProof(t.dataset.tab);
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
      if (!d) return;
      const n = proofTabs[(i + d + proofTabs.length) % proofTabs.length];
      n.focus(); renderProof(n.dataset.tab);
    });
  });
  proofRail.addEventListener('click', e => {
    const c = e.target.closest('.pcard'); if (!c) return;
    openLB(proof[proofTab].map(x => ({ src: P + x.img + '.webp', w: x.w, h: x.h, alt: x.q || x.stat })), +c.dataset.i, false);
  });
  const railBy = d => proofRail.scrollBy({ left: d * 334, behavior: reduce ? 'auto' : 'smooth' });
  $('#proofNext').onclick = () => railBy(-1); // RTL: the next card is to the left
  $('#proofPrev').onclick = () => railBy(1);
  renderProof('msgs');

  /* ---------- Work samples: draggable slide deck ---------- */
  const W = 'assets/work/';
  const decks = [
    {id:'d3', t:'القدس بعدسة ابن بطوطة', m:'الصف الثامن · لغة عربية · 31 شريحة', s:['s01','s02','s04','s16']},
    {id:'d4', t:'كيف أكتب قصة قصيرة؟', m:'الصف الثامن · لغة عربية · 33 شريحة', s:['s01','s02','s06','s11']},
    {id:'d6', t:'لعبة الإعراب: الحصة الأولى', m:'الصف الثامن · لغة عربية · 26 شريحة', s:['s01','s02','s08','s17']},
    {id:'d1', t:'مأدبا… فسيفساء الشرق', m:'درس استماع · الصف الثامن · 23 شريحة', s:['s01','s02','s10','s14']},
    {id:'d2', t:'التقرير الصحفي', m:'الصف الثامن · لغة عربية · 23 شريحة', s:['s01','s04','s06','s17']},
    {id:'d5', t:'لعبة الإعراب: الحصة الثانية', m:'الصف الثامن · لغة عربية · 25 شريحة', s:['s01','s03','s05','s16']}
  ];
  const deckTabs = $('#deckTabs'), stageEl = $('#deckStage');
  const src = (d, s, w) => `${W}${d.id}-${s}-${w}.webp`;
  deckTabs.innerHTML = decks.map((d, i) => `<button class="dtab" type="button" role="tab" data-d="${i}" aria-selected="${i === 0}"><img src="${src(d, 's01', 320)}" width="320" height="180" alt="" loading="lazy" decoding="async"><span>${d.t}</span></button>`).join('');
  let deck = 0, cur = 0, slidesEls = [];
  function layoutDeck() {
    const n = slidesEls.length;
    slidesEls.forEach((el, k) => {
      const p = (k - cur + n) % n;
      el.style.zIndex = n - p;
      el.style.transform = reduce ? (p ? 'scale(.98)' : 'none') : `translate3d(0, ${-p * 16}px, ${-p * 40}px) scale(${1 - p * .05})`;
      el.style.opacity = p ? (1 - p * .22).toFixed(2) : 1;
      el.style.filter = p ? `brightness(${1 - p * .18})` : 'none';
      el.setAttribute('aria-hidden', p ? 'true' : 'false');
    });
    $('#deckCount').textContent = `${cur + 1} من ${n}`;
  }
  function renderDeck(i) {
    deck = i; cur = 0;
    const d = decks[i];
    stageEl.innerHTML = d.s.map((s, k) => `<div class="slide"><img src="${src(d, s, 640)}" srcset="${src(d, s, 640)} 640w, ${src(d, s, 1280)} 1280w"
      sizes="(min-width: 800px) 760px, 92vw" width="1280" height="720" alt="${d.t}: شريحة ${k + 1}" loading="lazy" decoding="async"></div>`).join('');
    slidesEls = [...stageEl.children];
    $('#deckTitle').textContent = d.t; $('#deckMeta').textContent = d.m;
    $$('.dtab', deckTabs).forEach(t => t.setAttribute('aria-selected', String(+t.dataset.d === i)));
    layoutDeck();
  }
  deckTabs.addEventListener('click', e => { const t = e.target.closest('.dtab'); if (t) renderDeck(+t.dataset.d); });
  // throw the top slide off to one side; it then tucks in at the back of the stack
  function flick(dir) {
    const n = slidesEls.length, top = slidesEls[cur];
    top.classList.remove('drag');
    top.style.transform = `translate3d(${dir * 115}%, -4%, 0) rotate(${dir * 9}deg)`;
    top.style.opacity = '0';
    setTimeout(() => { cur = (cur + 1) % n; layoutDeck(); }, reduce ? 0 : 230);
  }
  const back = () => { cur = (cur - 1 + slidesEls.length) % slidesEls.length; layoutDeck(); };
  const openDeckLB = () => { const d = decks[deck]; openLB(d.s.map((s, k) => ({ src: src(d, s, 1280), w: 1280, h: 720, alt: `${d.t}: شريحة ${k + 1}` })), cur, true); };
  $('#deckNext').onclick = () => flick(-1);
  $('#deckPrev').onclick = back;
  stageEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); flick(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); back(); }
    if (e.key === 'Enter') openDeckLB();
  });
  let dg = null;
  stageEl.addEventListener('pointerdown', e => { dg = { x: e.clientX, y: e.clientY, dx: 0, moved: false }; });
  stageEl.addEventListener('pointermove', e => {
    if (!dg) return;
    dg.dx = e.clientX - dg.x;
    const dy = e.clientY - dg.y;
    if (!dg.moved && Math.abs(dg.dx) > 8 && Math.abs(dg.dx) > Math.abs(dy)) { dg.moved = true; stageEl.setPointerCapture(e.pointerId); }
    if (!dg.moved) return;
    const top = slidesEls[cur]; top.classList.add('drag');
    top.style.transform = `translate3d(${dg.dx}px, 0, 0) rotate(${dg.dx / 28}deg)`;
  });
  stageEl.addEventListener('pointerup', () => {
    if (!dg) return;
    const { dx, moved } = dg; dg = null;
    if (!moved) { openDeckLB(); return; }
    if (Math.abs(dx) > 70) flick(Math.sign(dx));
    else { slidesEls[cur].classList.remove('drag'); layoutDeck(); }
  });
  stageEl.addEventListener('pointercancel', () => { if (dg) { dg = null; slidesEls[cur].classList.remove('drag'); layoutDeck(); } });
  renderDeck(0);

  /* ---------- "Show more" toggles ---------- */
  function toggler(btnId, panelId, openText, closeText, wrapSel) {
    const btn = document.getElementById(btnId), panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    btn.onclick = () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      $('span', btn).textContent = open ? closeText : openText;
      if (wrapSel) $(wrapSel).classList.toggle('open', open);
      if (!open) btn.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
  }
  toggler('cmpToggle', 'cmpMore', 'شوف المقارنة كاملة', 'اختصر المقارنة', '#compare');
  toggler('faqToggle', 'faqRest', 'شوف باقي الأسئلة', 'اختصر الأسئلة');

  /* ---------- Plans rail (phones): the switcher follows the card in view ---------- */
  const plansEl = $('#plans'), planBtns = $$('#planSeg button');
  if (plansEl && planBtns.length) {
    const mark = id => planBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plan === id)));
    planBtns.forEach(b => { b.onclick = () => {
      const card = document.getElementById(b.dataset.plan);
      plansEl.scrollTo({ left: card.offsetLeft - (plansEl.clientWidth - card.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      mark(b.dataset.plan);
    }; });
    if ('IntersectionObserver' in window) {
      const po = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) mark(e.target.id); }), { root: plansEl, threshold: .6 });
      $$('.plan', plansEl).forEach(c => po.observe(c));
    }
  }

  /* ---------- Reveal on scroll ---------- */
  const rv = $$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(el => io.observe(el));
  } else rv.forEach(el => el.classList.add('in'));

  /* ---------- Nav + sticky subscribe bar ---------- */
  const nav = $('#nav'), bar = $('#bar');
  let lastY = 0, ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, vh = innerHeight;
      nav.classList.toggle('solid', y > 40);
      nav.classList.toggle('hide', y > lastY && y > vh * .8 && !closeModal);
      bar.classList.toggle('on', y > vh * .55);
      lastY = y; ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Hero card: ticks this week's work off, tilts with the pointer ---------- */
  const hv = $('#hv');
  if (hv) {
    const card = $('#hvCard'), items = $$('#hvList li'), count = $('#hvCount'), hint = $('#hvHint'), n = items.length;
    let step = 0, timer = 0, running = false;
    const setCount = k => { count.textContent = `${k} من ${n}`; card.style.setProperty('--p', (k / n).toFixed(3)); };
    const reset = () => { hv.classList.remove('all'); items.forEach(li => li.classList.remove('now', 'done')); step = 0; setCount(0); };
    function tick() {
      if (!running) return;
      if (step < n) {
        const li = items[step];
        li.classList.add('now');
        timer = setTimeout(() => {
          li.classList.remove('now'); li.classList.add('done');
          step++; setCount(step);
          timer = setTimeout(tick, 420);
        }, 820);
      } else {
        hv.classList.add('all');
        timer = setTimeout(() => { reset(); timer = setTimeout(tick, 800); }, 4600);
      }
    }
    const start = () => { if (running || reduce) return; running = true; timer = setTimeout(tick, 500); };
    const stop = () => { running = false; clearTimeout(timer); items.forEach(li => li.classList.remove('now')); };
    if (reduce) { items.forEach(li => li.classList.add('done')); setCount(n); hv.classList.add('all'); }
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => (e.isIntersecting && !document.hidden ? start() : stop())), { threshold: .2 }).observe(hv);
      document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (hv.getBoundingClientRect().bottom > 0) start(); });
    } else start();

    const BASE = { rx: 7, ry: -13 };
    const tilt = (rx, ry) => { card.style.setProperty('--rx', rx.toFixed(2) + 'deg'); card.style.setProperty('--ry', ry.toFixed(2) + 'deg'); };
    const rest = () => { card.classList.remove('live'); tilt(BASE.rx, BASE.ry); };
    if (!reduce) {
      // mouse: the card follows the pointer anywhere over the hero
      if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
        const hero = $('#hero');
        hero.addEventListener('pointermove', e => {
          if (e.pointerType !== 'mouse') return;
          const r = hv.getBoundingClientRect();
          const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
          card.classList.add('live');
          tilt(BASE.rx - clamp(y * 30, -16, 16), BASE.ry + clamp(x * 44, -30, 30));
          hint.classList.add('gone');
        });
        hero.addEventListener('pointerleave', rest);
      }
      // touch: drag sideways to turn it; it springs back on release
      let d = null;
      hv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') d = { x: e.clientX, y: e.clientY, on: false }; });
      hv.addEventListener('pointermove', e => {
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.on) {
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
          d.on = true; hv.setPointerCapture(e.pointerId); card.classList.add('live'); hint.classList.add('gone');
        }
        tilt(BASE.rx - clamp(dy * .12, -12, 12), BASE.ry + clamp(dx * .32, -40, 40));
      });
      const end = () => { if (d) { d = null; rest(); } };
      hv.addEventListener('pointerup', end);
      hv.addEventListener('pointercancel', end);
    } else hint.style.display = 'none';
  }

  /* ---------- The guide firefly ----------
     It flies from card to card and says each card's own line (the card's data-say attribute).
     Its position is kept relative to the card it is on, so scrolling carries it along with no lag;
     trips between cards follow a weaving, bee-like path. Tapping its bubble opens the card. */
  (function () {
    const ff = $('#ff'), say = $('#ffSay'), bodyEl = $('.ff-body', ff || document);
    if (!ff || !say || reduce) return;
    const items = $$('[data-say]').map((el, i) => ({
      el, text: el.dataset.say,
      side: el.dataset.saySide || (i % 2 ? 'l' : 'r'),   // which top corner it lands on: alternates, so it isn't always on one side
      act: el.matches('button,a')
    }));
    if (!items.length) return;

    const DWELL = 4300;                     // how long it stays at a card
    const seen = new Set();
    let cur = null, flight = null, roamPt = null, roamSide = 1, litEl = null;
    let nextAt = Infinity, sayAt = Infinity, hideAt = Infinity, dirty = true, lastPick = 0;
    let x = innerWidth * .5, y = -40, tilt = 0, last = performance.now(), bubbleMax = 0;

    const point = it => {
      const r = it.el.getBoundingClientRect();
      return { x: it.side === 'r' ? r.right - 22 : r.left + 22, y: r.top - 18 };
    };
    const visible = it => {
      const r = it.el.getBoundingClientRect(), cx = (r.left + r.right) / 2;
      return r.width > 0 && r.top > 84 && r.top < innerHeight - 150 && cx > 0 && cx < innerWidth;
    };

    function goTo(it, now) {
      if (!it) { roamSide = -roamSide; roamPt = { x: roamSide > 0 ? innerWidth - 46 : 46, y: innerHeight * .34 }; }
      const tp = it ? point(it) : roamPt;
      const ox = x - tp.x, oy = y - tp.y, d = Math.hypot(ox, oy);
      flight = {
        ox, oy, t0: now, dur: clamp(d / 460, .7, 1.7) * 1000,
        bend: (Math.random() < .5 ? -1 : 1) * Math.min(d * .22, 120),   // one big sideways arc
        amp: Math.min(d * .14, 46), waves: 2 + Math.floor(Math.random() * 2)   // plus a weave that dies out on arrival
      };
      cur = it;
      say.classList.remove('on');
      if (litEl) { litEl.classList.remove('lit'); litEl = null; }
      if (it) {
        seen.add(it);
        sayAt = now + flight.dur * .75; hideAt = sayAt + DWELL - 500; nextAt = now + flight.dur + DWELL;
        if (it.act && it.el.classList.contains('card')) { litEl = it.el; litEl.classList.add('lit'); }
      } else { sayAt = hideAt = nextAt = Infinity; }
    }
    // after a scroll: stay if the card is still on screen, otherwise move to a card that is
    function pick(now) {
      const vis = items.filter(visible);
      if (!vis.length) { if (cur || !roamPt) goTo(null, now); return; }
      const fresh = vis.find(it => !seen.has(it));
      if (cur && vis.includes(cur)) { if (fresh && nextAt === Infinity) goTo(fresh, now); return; }
      if (fresh) { goTo(fresh, now); return; }
      const line = innerHeight * .4;
      const near = vis.reduce((a, b) => (Math.abs(point(a).y - line) < Math.abs(point(b).y - line) ? a : b));
      if (near !== cur) goTo(near, now);
    }
    // time's up at this card: on to the next one that hasn't spoken, or rest here until the next scroll
    function advance(now) {
      const next = items.filter(visible).find(it => !seen.has(it));
      if (next) goTo(next, now); else nextAt = Infinity;
    }
    addEventListener('scroll', () => { dirty = true; }, { passive: true });
    addEventListener('resize', () => { dirty = true; });
    say.addEventListener('click', () => { if (cur && cur.act) cur.el.click(); });

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.max(now - last, 1); last = now;
      const open = !!closeModal;
      ff.classList.toggle('on', !open);
      if (open) { if (nextAt !== Infinity) nextAt = Math.max(nextAt, now + 1500); return; }
      if (dirty && now - lastPick > 110) { dirty = false; lastPick = now; pick(now); }
      if (now > nextAt) advance(now);
      if (now > sayAt && cur) { say.textContent = cur.text; say.classList.toggle('act', cur.act); say.classList.add('on'); sayAt = Infinity; }
      if (now > hideAt) { say.classList.remove('on'); hideAt = Infinity; }

      const tp = cur ? point(cur) : (roamPt || { x, y }), t = now / 1000;
      let ox = 0, oy = 0;
      if (flight) {
        const p = (now - flight.t0) / flight.dur;
        if (p >= 1) flight = null;
        else {
          const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, k = 1 - e;
          const d = Math.hypot(flight.ox, flight.oy) || 1, nx = -flight.oy / d, ny = flight.ox / d;
          const sway = Math.sin(p * Math.PI) * flight.bend + Math.sin(p * Math.PI * 2 * flight.waves) * flight.amp * (1 - p);
          ox = flight.ox * k + nx * sway; oy = flight.oy * k + ny * sway;
        }
      }
      // hovering: it never hangs still
      const hx = Math.sin(t * 1.9) * 7 + Math.sin(t * 4.3 + 1) * 2.5, hy = Math.cos(t * 2.3) * 5 + Math.sin(t * 5.1) * 2;
      const vw = innerWidth, vh = innerHeight;
      const nx2 = clamp(tp.x + ox + hx, 20, vw - 20), ny2 = clamp(tp.y + oy + hy, 78, vh - (vw < 760 ? 128 : 60));
      tilt += (clamp((nx2 - x) / dt * 40, -26, 26) - tilt) * .18;
      x = nx2; y = ny2;
      ff.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      bodyEl.style.transform = `rotate(${tilt.toFixed(1)}deg)`;
      // the bubble opens toward the roomier side and never runs off the screen
      const onLeft = x < vw / 2;
      ff.classList.toggle('r', onLeft);
      const room = Math.round(clamp((onLeft ? vw - x : x) - 38, 120, 236) / 6) * 6;
      if (room !== bubbleMax) { bubbleMax = room; say.style.maxWidth = room + 'px'; }
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- After load: FAQ structured data + the serif used for quotes ---------- */
  function afterLoad() {
    const qa = $$('#faqList details').map(d => ({
      '@type': 'Question',
      name: $('summary', d).textContent.trim(),
      acceptedAnswer: { '@type': 'Answer', text: $('p', d).textContent.trim() }
    }));
    if (qa.length) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa });
      document.head.append(s);
    }
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Amiri:wght@700&display=swap';
    document.head.append(l);
  }
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad);
})();
