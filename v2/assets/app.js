import { services, proof, decks } from './content.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wa = (message = '') => `https://wa.me/962779283635${message ? `?text=${encodeURIComponent(message)}` : ''}`;
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;

// Keep a clear, scoped description in place of unqualified outcome promises.
services.find(s => s.k === 'article').f = ['محتوى مخصص لتخصصك وسياق المطلوب','ما بنعطيه لمعلم ثاني','توثيق المراجع وتنظيم الأفكار','مراجعة ملاحظات المرشد ضمن الاتفاق'];
services.find(s => s.k === 'research').f = ['صياغة السؤال الاستقصائي والمخطط','أدوات جمع البيانات والتحليل والنتائج والتوصيات','العرض التقديمي للبحث','محتوى مخصص مع تنظيم المراجع','مراجعة ملاحظات المرشد في المراحل المتفق عليها'];
services.find(s => s.k === 'pres').f = ['تصميم يناسب الدرس والصف','ترتيب المحتوى ليسهّل الشرح','السعر: 5 دنانير للعرض حسب النطاق المتفق عليه','بنتفق معك على تفاصيل التسليم والتعديلات قبل البدء'];
services.find(s => s.k === 'tasks').f = ['خطط دروس، تحليل محتوى، دراسات حالة وغيرها، على القالب المطلوب','المنتديات النقاشية والمشاركة والتعليقات المطلوبة','المهمة بدينارين، أو 3 مهام بـ5 دنانير','نتفق على موعد التسليم ونطاق المراجعة قبل البدء'];

const detailDialog = $('#detailDialog');
const galleryDialog = $('#galleryDialog');
const dialogs = [detailDialog, galleryDialog];
const openers = new WeakMap();

function openDialog(dialog, opener) {
  openers.set(dialog, opener || document.activeElement);
  document.body.classList.add('dialog-open');
  dialog.showModal();
  $('[data-close]', dialog).focus({ preventScroll: true });
  document.dispatchEvent(new Event('scenevisibility'));
}

dialogs.forEach(dialog => {
  $('[data-close]', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (!dialogs.some(d => d.open)) document.body.classList.remove('dialog-open');
    const opener = openers.get(dialog);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    document.dispatchEvent(new Event('scenevisibility'));
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});

function showService(key, opener) {
  const service = services.find(s => s.k === key);
  if (!service) return;
  $('#detailLabel').textContent = 'على قد احتياجك';
  $('#detailTitle').textContent = service.t;
  $('#detailSubtitle').textContent = service.d;
  $('#detailPrice').hidden = false;
  $('#detailPrice').innerHTML = `<strong>${escape(service.p)}</strong><span>${escape(service.u)}</span>${service.note ? `<small>${escape(service.note)}</small>` : ''}`;
  $('#detailList').innerHTML = service.f.map(text => `<li>${icon('i-check')}<span>${escape(text)}</span></li>`).join('');
  $('#detailCta').href = wa(service.msg);
  $('#detailCta').hidden = false;
  openDialog(detailDialog, opener);
}

$$('[data-service]').forEach(button => button.addEventListener('click', () => showService(button.dataset.service, button)));

const information = {
  terms: {
    title: 'شروط الخدمة', subtitle: 'تفاصيل واضحة، قبل ما نبلّش.',
    lines: ['نتفق قبل البدء على الخدمة المطلوبة، نطاق العمل، السعر، موعد التسليم والتعديلات.','الخدمة للمساعدة الأكاديمية والتجهيز وتقديم النماذج، وعلى العميل مراجعة العمل والتأكد من ملاءمته لمتطلبات برنامجه.','حضور المحاضرات والجلسات والتطبيق الصفي مسؤولية العميل. وفي الخدمات المنفصلة، فتح المنصة والتسليم على العميل.','المدفوعات نهائية وغير مستردة بعد بدء العمل، بحسب سياسة الخدمة الحالية.','التقييم والعلامة من اختصاص المرشد، ولا نضمن علامة محددة.','الأسعار بالدينار الأردني. الباقة 200 دينار على 10 أقساط شهرية قيمة كل منها 20 دينار.']
  },
  privacy: {
    title: 'الخصوصية', subtitle: 'بنحافظ على خصوصية شغلك.',
    lines: ['ما بنشارك اسمك أو معلوماتك مع أي طرف.','بيانات الدخول، إذا كانت مطلوبة ضمن اتفاق الخدمة، تُستخدم لإنجاز العمل المتفق عليه فقط.','الأسماء والأرقام مخفية في شهادات العملاء المعروضة.','المقالات والأبحاث المخصصة إلك ما بتنعطى لمعلم ثاني.','للاستفسار عن بياناتك أو طلب حذفها، تواصل معنا عبر واتساب.','زر التواصل ينقلك إلى واتساب؛ إرسال الرسالة بيتم بإيدك من داخل التطبيق.']
  }
};
$$('[data-info]').forEach(button => button.addEventListener('click', () => {
  const info = information[button.dataset.info];
  $('#detailLabel').textContent = 'دبلومك علينا';
  $('#detailTitle').textContent = info.title;
  $('#detailSubtitle').textContent = info.subtitle;
  $('#detailPrice').hidden = true;
  $('#detailCta').hidden = true;
  $('#detailList').innerHTML = info.lines.map(text => `<li>${icon('i-check')}<span>${escape(text)}</span></li>`).join('');
  openDialog(detailDialog, button);
}));

let galleryItems = [], galleryIndex = 0, galleryMode = 'work';
const galleryImage = $('#galleryImage');
const gallerySurface = $('#gallerySurface');
function resetZoom() {
  gallerySurface.classList.remove('zoomed');
  $('#galleryZoom').setAttribute('aria-pressed', 'false');
  $('#galleryZoom').innerHTML = `تكبير${icon('i-plus')}`;
  gallerySurface.scrollTop = 0;
  gallerySurface.scrollLeft = 0;
}
function renderGallery() {
  resetZoom();
  const item = galleryItems[galleryIndex];
  galleryImage.src = item.src;
  galleryImage.alt = item.alt;
  galleryImage.width = item.w;
  galleryImage.height = item.h;
  $('#galleryCount').textContent = galleryMode === 'work' ? `عينة ${galleryIndex + 1} من ${galleryItems.length}` : `شهادة ${galleryIndex + 1} من ${galleryItems.length}`;
  $('#galleryPrev').disabled = galleryItems.length < 2;
  $('#galleryNext').disabled = galleryItems.length < 2;
}
function changeSlide(delta) {
  galleryIndex = (galleryIndex + delta + galleryItems.length) % galleryItems.length;
  renderGallery();
}
function showDeck(index, opener) {
  const deck = decks[index];
  if (!deck) return;
  galleryMode = 'work'; galleryIndex = 0;
  galleryItems = deck.s.map((slide, i) => ({src:`assets/work/${deck.id}-${slide}-1280.webp`,alt:`${deck.t} — العينة ${i + 1}`,w:1280,h:720}));
  galleryDialog.classList.remove('proof-view');
  $('#galleryLabel').textContent = 'شرائح مختارة من العمل';
  $('#galleryTitle').textContent = deck.t;
  $('#galleryMeta').textContent = `المعروض 4 عينات · ${deck.m}`;
  $('#galleryCta').href = wa(`مرحبا، شفت عرض «${deck.t}» وبدي عرض تقديمي لدرسي. التخصص والصف: `);
  renderGallery();
  openDialog(galleryDialog, opener);
}
$$('[data-deck]').forEach(button => button.addEventListener('click', () => showDeck(Number(button.dataset.deck), button)));
$('#galleryNext').addEventListener('click', () => changeSlide(1));
$('#galleryPrev').addEventListener('click', () => changeSlide(-1));
$('#galleryZoom').addEventListener('click', () => {
  const zoomed = gallerySurface.classList.toggle('zoomed');
  $('#galleryZoom').setAttribute('aria-pressed', String(zoomed));
  $('#galleryZoom').innerHTML = `${zoomed ? 'تصغير' : 'تكبير'}${icon(zoomed ? 'i-x' : 'i-plus')}`;
  if (zoomed) gallerySurface.scrollLeft = (gallerySurface.scrollWidth - gallerySurface.clientWidth) / 2;
});
galleryDialog.addEventListener('keydown', event => {
  if (gallerySurface.classList.contains('zoomed')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    changeSlide(event.key === 'ArrowLeft' ? 1 : -1);
  }
});
let swipeStart = null;
gallerySurface.addEventListener('pointerdown', event => {
  swipeStart = gallerySurface.classList.contains('zoomed') ? null : {x:event.clientX,y:event.clientY};
});
gallerySurface.addEventListener('pointerup', event => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) changeSlide(dx < 0 ? 1 : -1);
  swipeStart = null;
});
gallerySurface.addEventListener('pointercancel', () => { swipeStart = null; });

let proofType = 'msgs', allProofVisible = false;
const proofTabs = $$('.proof-tabs [role=tab]');
function renderProof(type) {
  proofType = type;
  proofTabs.forEach(tab => {
    const selected = tab.dataset.proof === type;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  $('#proofPanel').setAttribute('aria-labelledby', `tab-${type}`);
  const items = allProofVisible ? proof[type] : proof[type].slice(0, 2);
  $('#proofPanel').innerHTML = items.map((item, index) => `<button class="proof-card" data-proof-index="${index}" aria-haspopup="dialog" aria-label="شوف أصل الشهادة: ${escape(item.q || item.stat)}"><span class="quote-mark" aria-hidden="true">“</span><blockquote class="${item.stat ? 'proof-stat' : ''}">${escape(item.q || item.stat)}</blockquote><p class="proof-context">${escape(item.ctx)}</p><span class="proof-original">شوف الرسالة الأصلية${icon('i-plus')}</span></button>`).join('');
  $('#proofMore').hidden = proof[type].length <= 2;
  $('#proofMore').innerHTML = `${allProofVisible ? 'عرض أقل' : `شوف باقي الشهادات (${proof[type].length - 2})`}${icon(allProofVisible ? 'i-x' : 'i-plus')}`;
  $('#proofMore').setAttribute('aria-expanded', String(allProofVisible));
}
proofTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => { allProofVisible = false; renderProof(tab.dataset.proof); });
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowLeft') next = (index + 1) % proofTabs.length;
    else if (event.key === 'ArrowRight') next = (index - 1 + proofTabs.length) % proofTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = proofTabs.length - 1;
    else return;
    event.preventDefault(); proofTabs[next].focus(); proofTabs[next].click();
  });
});
$('#proofMore').addEventListener('click', () => { allProofVisible = !allProofVisible; renderProof(proofType); });
$('#proofPanel').addEventListener('click', event => {
  const button = event.target.closest('[data-proof-index]');
  if (!button) return;
  galleryMode = 'proof'; galleryIndex = Number(button.dataset.proofIndex);
  galleryItems = proof[proofType].map(item => ({src:`assets/proof/${item.img}.webp`,alt:item.q || item.stat,w:item.w,h:item.h}));
  galleryDialog.classList.add('proof-view');
  $('#galleryLabel').textContent = 'من تجارب العملاء';
  $('#galleryTitle').textContent = 'الشهادة الأصلية';
  renderGallery();
  openDialog(galleryDialog, button);
});
renderProof('msgs');

// The mobile CTA only appears after the opening and gets out of the final contact section's way.
let heroVisible = true, contactVisible = false;
function updateContact() {
  const show = !heroVisible && !contactVisible;
  $('#mobileContact').classList.toggle('visible', show);
  $('#mobileContact').inert = !show;
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target.id === 'top') heroVisible = entry.isIntersecting;
      else contactVisible = entry.isIntersecting;
    }
    updateContact();
  }, {threshold:0}).observe($('#top'));
  new IntersectionObserver(entries => { contactVisible = entries[0].isIntersecting; updateContact(); }, {threshold:0.1}).observe($('#contact'));
}

// Load decoration after useful content. A failed scene leaves a complete, usable page.
const loadScene = () => import('./scene.js').then(({initScene}) => initScene()).catch(() => { $('#sceneControl').hidden = true; });
if ('requestIdleCallback' in window) requestIdleCallback(loadScene, {timeout:1500});
else setTimeout(loadScene, 350);
