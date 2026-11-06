/* دبلومك علينا — رفع أدلة المشتركين.
 * الرمز الخاص يُقرأ من جزء الرابط بعد # (لا يُرسل لخوادم الموقع)، ويتحقق منه الخادم مع كل طلب.
 * الملفات تُرسل كما هي (بدون ضغط) على أجزاء، ولكل جزء بصمة SHA-256 يتحقق منها الخادم،
 * ولا تظهر رسالة النجاح إلا بعد أن يؤكد الخادم حفظ كل ملف في درايف ومطابقته. */
(() => {
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw8sBK2Lu8k2luR0GJD6IJlW6gaUFbmP7H1quw-jcOke-UfLnjn2v6q5gp5DopMP4cu/exec'; // Web app (Google Apps Script) — رابط عام لا يحمل أي صلاحية بذاته
  const FULL_HASH_LIMIT = 150 * 1024 * 1024;   // فوق هذا الحجم (فيديو كبير) نكتفي ببصمة كل جزء + الحجم
  const MAX_TRIES = 7;

  const $ = s => document.querySelector(s);
  const show = id => { document.querySelectorAll('.state').forEach(s => s.hidden = s.id !== id); scrollTo(0, 0); };
  const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const ext = n => (n.split('.').pop() || '').toLowerCase();
  const kindOf = e => ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(e) ? 'img' : ['mp4', 'mov', 'm4v'].includes(e) ? 'vid' : 'doc';
  const icon = k => ({ img: 'i-img', vid: 'i-vid', doc: 'i-doc' })[k];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const token = (new URLSearchParams(location.hash.slice(1))).get('k') || '';
  let limits = null, files = [], kind = '', busy = false, job = null, wake = null;

  // ---------- الاتصال بالخادم ----------
  async function call(body, timeoutMs = 120000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', body: JSON.stringify(Object.assign({ k: token }, body)),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) return { ok: false, code: 'http', retry: true };
      return await r.json();
    } catch (e) {
      return { ok: false, code: 'network', retry: true };
    } finally { clearTimeout(t); }
  }

  // ---------- البداية: التحقق من الرابط ----------
  async function init() {
    if (!ENDPOINT) return bad('الخدمة قيد التجهيز', 'رابط الرفع لسا ما اشتغل. جرّب بعد شوي، أو تواصل معنا.');
    if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) return bad('الرابط ناقص', 'افتح الرابط الخاص اللي وصلك منا على واتساب كما هو، بدون ما ينقص منه شي.');
    let r;
    for (let i = 0; i < 3; i++) { r = await call({ a: 'ping' }, 30000); if (r.ok || !r.retry) break; await sleep(1500); }
    if (!r.ok) {
      if (r.code === 'bad_link') return bad('الرابط مش فعّال', 'هاد الرابط ملغي أو غير صحيح. تواصل معنا على واتساب ونبعتلك رابطك الخاص.');
      return bad('ما قدرنا نتصل', 'تأكد إنك متصل بالإنترنت وحدّث الصفحة.');
    }
    limits = r.limits;
    $('#hello').textContent = r.name ? `أهلًا أ. ${r.name} 👋` : 'أهلًا 👋';
    show('s-form');
  }
  function bad(title, text) { $('#badTitle').textContent = title; $('#badText').textContent = text; show('s-bad'); }

  // ---------- النموذج ----------
  document.querySelectorAll('.kind').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-checked') !== 'true';
    document.querySelectorAll('.kind').forEach(x => x.setAttribute('aria-checked', 'false'));
    b.setAttribute('aria-checked', String(on));
    kind = on ? b.dataset.kind : '';
  }));

  const input = $('#files'), drop = $('#drop');
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));

  function check(f) {
    const e = ext(f.name), max = limits && limits.types[e];
    if (!max) return 'نوع غير مدعوم (المسموح: صور، PDF، Word، فيديو mp4/mov)';
    if (f.size === 0) return 'الملف فاضي';
    if (f.size > max) return `أكبر من الحد (${fmtSize(max)})`;
    return '';
  }
  function addFiles(list) {
    for (const f of list) {
      if (files.some(x => x.file.name === f.name && x.file.size === f.size && x.file.lastModified === f.lastModified)) continue;
      files.push({ file: f, err: check(f), url: kindOf(ext(f.name)) === 'img' ? URL.createObjectURL(f) : '' });
    }
    renderList();
  }
  function renderList() {
    const max = (limits && limits.maxFiles) || 30;
    $('#flist').innerHTML = files.map((x, i) => `
      <li class="fi ${x.err ? 'bad' : ''}">
        <span class="th"><svg class="i"><use href="#${icon(kindOf(ext(x.file.name)))}"/></svg>${x.url ? `<img src="${x.url}" alt="" onerror="this.remove()">` : ''}</span>
        <span class="tx"><span class="nm">${esc(x.file.name)}</span><span class="sz">${x.err ? esc(x.err) : fmtSize(x.file.size)}</span></span>
        <button type="button" class="rm" data-i="${i}" aria-label="احذف ${esc(x.file.name)}"><svg class="i"><use href="#i-x"/></svg></button>
      </li>`).join('');
    const fe = $('#filesErr');
    fe.hidden = files.length <= max;
    fe.textContent = files.length > max ? `الحد ${max} ملف بالنشاط الواحد. احذف ${files.length - max} أو ارفعها كنشاط ثاني.` : '';
  }
  $('#flist').addEventListener('click', e => {
    const b = e.target.closest('.rm'); if (!b) return;
    const x = files.splice(Number(b.dataset.i), 1)[0];
    if (x && x.url) URL.revokeObjectURL(x.url);
    renderList();
  });

  $('#s-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const title = $('#title').value.trim();
    const okTitle = title.length >= 3;
    $('#title').classList.toggle('invalid', !okTitle); $('#titleErr').hidden = okTitle;
    const good = files.filter(x => !x.err);
    const fe = $('#filesErr');
    if (!good.length) { fe.hidden = false; fe.textContent = 'اختر ملف واحد على الأقل.'; }
    else if (files.some(x => x.err)) { fe.hidden = false; fe.textContent = 'في ملفات ما رح تنرفع (معلّمة بالأحمر). احذفها أو بدّلها، وبعدين ارفع.'; }
    if (!okTitle) { $('#title').focus(); return; }
    if (!good.length || files.some(x => x.err) || files.length > ((limits && limits.maxFiles) || 30)) return;
    await start({ title, desc: $('#desc').value.trim(), kind, items: good.map(x => ({ file: x.file, name: x.file.name, size: x.file.size })) });
  });

  // ---------- الرفع ----------
  async function sha256(buf) {
    const d = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function b64(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  }

  async function start(j) {
    busy = true; job = j;
    show('s-up');
    $('#upSub').textContent = 'بنجهز الملفات…';
    renderUp();
    lockScreen(true);
    try {
      for (const it of j.items) {
        it.sent = 0; it.state = 'wait';
        it.sha = it.size <= FULL_HASH_LIMIT ? await sha256(await it.file.arrayBuffer()) : '';
      }
      let r;
      for (let t = 0; t < 4; t++) {
        r = await call({ a: 'begin', title: j.title, desc: j.desc, kind: j.kind, files: j.items.map(it => ({ name: it.name, size: it.size, sha256: it.sha })) }, 90000);
        if (r.ok || !r.retry) break;
        await sleep(2000 * (t + 1));
      }
      if (!r.ok) return fail(beginError(r));
      j.act = r.act; j.chunk = r.chunk;
      await runUploads();
    } finally { busy = false; lockScreen(false); }
  }

  async function runUploads() {
    const j = job;
    $('#upSub').textContent = 'لا تسكّر الصفحة لحد ما يخلص.';
    for (let i = 0; i < j.items.length; i++) {
      const it = j.items[i];
      if (it.state === 'ok' || it.state === 'rejected') continue;
      it.state = 'up'; renderUp();
      const res = await uploadOne(i, it);
      it.state = res; renderUp();
      if (res === 'stop') return fail('الرابط صار غير فعّال أثناء الرفع. تواصل معنا.');
    }
    if (j.items.some(it => it.state === 'fail')) return fail('بعض الملفات ما وصلت بسبب الاتصال. اضغط «أكمل الرفع» وبنكمل من وين وقفنا.');
    let r;
    for (let t = 0; t < 4; t++) { r = await call({ a: 'finish', act: j.act }, 60000); if (r.ok || !r.retry) break; await sleep(2000 * (t + 1)); }
    if (!r.ok) {
      if (r.code === 'none_saved') return fail('ولا ملف انحفظ: محتوى الملفات ما بيطابق نوعها (مثلًا ملف اسمه صورة وهو مش صورة). جرّب ترفع الملفات الأصلية مرة ثانية.');
      if (r.code === 'missing') { (r.missing || []).forEach(i => { if (j.items[i] && j.items[i].state !== 'rejected') j.items[i].state = 'fail'; }); }
      return fail('ما قدرنا نتأكد إنه كل الملفات انحفظت. اضغط «أكمل الرفع».');
    }
    const rej = j.items.filter(it => it.state === 'rejected');
    if (rej.length) {
      return fail(`انحفظ ${r.saved} من ${j.items.length} تحت نشاط «${j.title}». الملفات المعلّمة «مرفوض» ما انحفظت لأن محتواها ما بيطابق نوعها (مثلًا ملف اسمه صورة وهو مش صورة). ارفعها من جديد كنشاط ثاني بعد ما تتأكد إنها الملفات الأصلية.`, 'ما انحفظت كل الملفات');
    }
    $('#doneText').innerHTML = `انحفظ ${r.saved} ${r.saved === 1 ? 'ملف' : (r.saved <= 10 ? 'ملفات' : 'ملفًا')} تحت نشاط «${esc(j.title)}». يعطيك العافية 🌿`;
    show('s-done');
    job = null;
  }

  async function uploadOne(i, it) {
    const j = job;
    let off = it.sent || 0, tries = 0;
    while (true) {
      const end = Math.min(off + j.chunk, it.size);
      const blob = it.file.slice(off, end);
      let r;
      try {
        const [h, data] = await Promise.all([blob.arrayBuffer().then(sha256), b64(blob)]);
        r = await call({ a: 'chunk', act: j.act, i, off, h, data });
      } catch (e) { r = { ok: false, code: 'read', retry: true }; }
      if (r.ok) {
        tries = 0;
        if (r.done) { it.sent = it.size; progress(); return 'ok'; }
        off = Number(r.next) || 0; it.sent = off; progress();
        continue;
      }
      if (r.code === 'bad_link') return 'stop';
      if (r.fatal || r.code === 'content') return 'rejected';
      if (r.code === 'expired') return 'fail';
      if (++tries >= MAX_TRIES) return 'fail';
      $('#upSub').textContent = 'الاتصال ضعيف… بنعيد المحاولة تلقائيًا.';
      await sleep(Math.min(30000, 1500 * 2 ** tries));
      $('#upSub').textContent = 'لا تسكّر الصفحة لحد ما يخلص.';
    }
  }

  function progress() {
    const tot = job.items.reduce((a, it) => a + it.size, 0), sent = job.items.reduce((a, it) => a + (it.sent || 0), 0);
    const p = Math.floor(sent / tot * 100);
    $('#barFill').style.width = p + '%'; $('#bar').setAttribute('aria-valuenow', p); $('#upPct').textContent = p + '%';
    job.items.forEach((it, i) => { const m = document.querySelector(`#ulist [data-i="${i}"] .mini i`); if (m) m.style.width = Math.floor((it.sent || 0) / it.size * 100) + '%'; });
  }
  const stLabel = { wait: 'بالدور', up: 'جاري الرفع', ok: 'وصل ✓', fail: 'ما وصل', rejected: 'مرفوض' };
  function renderUp() {
    const html = job.items.map((it, i) => `
      <li class="fi ${it.state === 'ok' ? 'ok' : (it.state === 'fail' || it.state === 'rejected') ? 'fail' : ''}" data-i="${i}">
        <span class="th"><svg class="i"><use href="#${icon(kindOf(ext(it.name)))}"/></svg></span>
        <span class="tx"><span class="nm">${esc(it.name)}</span><span class="sz">${fmtSize(it.size)}</span><span class="mini"><i style="width:${Math.floor((it.sent || 0) / it.size * 100)}%"></i></span></span>
        <span class="st">${stLabel[it.state] || ''}</span>
      </li>`).join('');
    $('#ulist').innerHTML = html;
    if (!$('#s-fail').hidden) $('#flistFail').innerHTML = html;
    progress();
  }

  function beginError(r) {
    return ({ title: 'عنوان النشاط قصير.', count: 'عدد الملفات أكثر من المسموح.', type: 'في ملف نوعه غير مدعوم.', size: 'في ملف أكبر من الحد المسموح.',
      total: 'حجم النشاط كبير كثير. قسّمه على نشاطين.', quota: 'وصلت الحد اليومي للرفع. كمّل بكرة، أو تواصل معنا.',
      bad_link: 'الرابط مش فعّال. تواصل معنا.' })[r.code] || 'ما قدرنا نبدأ الرفع. تأكد من الإنترنت وجرّب مرة ثانية.';
  }
  function fail(text, title) {
    $('#failTitle').textContent = title || 'ما اكتمل الرفع';
    $('#failText').textContent = text;
    show('s-fail');
    if (job) renderUp();
    $('#retry').hidden = !job || !job.act || !job.items.some(it => it.state === 'fail' || it.state === 'wait' || it.state === 'up');
    $('#again2').hidden = !$('#retry').hidden;
  }

  $('#retry').addEventListener('click', async () => {
    if (busy || !job || !job.act) return;
    busy = true; show('s-up'); lockScreen(true);
    job.items.forEach(it => { if (it.state === 'fail') it.state = 'wait'; });
    renderUp();
    try { await runUploads(); } finally { busy = false; lockScreen(false); }
  });

  $('#again2').addEventListener('click', () => $('#again').click());
  $('#again').addEventListener('click', () => {
    files.forEach(x => x.url && URL.revokeObjectURL(x.url));
    files = []; kind = ''; renderList();
    $('#title').value = ''; $('#desc').value = '';
    document.querySelectorAll('.kind').forEach(x => x.setAttribute('aria-checked', 'false'));
    job = null;
    show('s-form');
  });

  // يمنع إغلاق الصفحة أو إطفاء الشاشة أثناء الرفع
  addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });
  async function lockScreen(on) {
    try {
      if (on && 'wakeLock' in navigator) wake = await navigator.wakeLock.request('screen');
      else if (!on && wake) { await wake.release(); wake = null; }
    } catch (e) { /* غير مدعوم */ }
  }
  document.addEventListener('visibilitychange', () => { if (busy && document.visibilityState === 'visible') lockScreen(true); });

  init();
})();
