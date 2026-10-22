/* =====================================================================
   دبلومك علينا — الكود المشترك بين صفحة المعلم وصفحة التحكم.
   - بيانات كل معلم بتنحفظ مشفّرة (AES-GCM) بمفتاح مشتق من هاتفه ورقمه الوزاري ورقمه السري،
     واسم ملفه كمان مشتق منهم، فما حدا بيعرف أي ملف لمين ولا بيقدر يقرأه بدونهم.
   - قاعدة بيانات صفحة التحكم مشفّرة بكلمة السر الرئيسية.
   ===================================================================== */
(function () {
  const TEACHER_SALT = 'diplomakalena/payments/v1';
  const TEACHER_ITER = 250000;
  const ADMIN_ITER = 600000;
  const PASS_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const latin = s => String(s == null ? '' : s)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const digits = s => latin(s).replace(/\D/g, '');
  function normPhone(v) {
    const m = latin(v).replace(/[\s\-()]/g, '').match(/^(?:\+?962|00962|0)?(7[789]\d{7})$/);
    return m ? '0' + m[1] : '';
  }
  // Case, spaces and dashes don't matter, so «K7M3-P9X2» and «k7m3p9x2» are the same password.
  const normPass = v => latin(v).toLowerCase().replace(/[\s\-_.]/g, '');
  const material = (phone, ministry, pass) => [normPhone(phone).slice(1), digits(ministry), normPass(pass)].join('|');

  /* ---------- Bytes ---------- */
  const b64 = bytes => { let s = ''; new Uint8Array(bytes).forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  const sha256 = async text => hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

  async function pbkdf2(secret, salt, iterations, bits) {
    const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: typeof salt === 'string' ? enc.encode(salt) : salt, iterations }, base, bits));
  }
  const aesKey = raw => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

  async function encryptJSON(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, iv: b64(iv), ct: b64(ct) };
  }
  async function decryptJSON(key, box) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  }

  // One derivation gives both the teacher's file name and their encryption key.
  async function teacherKey(phone, ministry, pass) {
    const bits = await pbkdf2(material(phone, ministry, pass), TEACHER_SALT, TEACHER_ITER, 512);
    return { id: hex(bits.slice(32, 48)), key: await aesKey(bits.slice(0, 32)) };
  }
  async function adminKey(master, saltB64) {
    return aesKey(await pbkdf2(String(master), unb64(saltB64), ADMIN_ITER, 256));
  }
  const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

  function genPassword() {
    const r = crypto.getRandomValues(new Uint8Array(8));
    const s = Array.from(r, x => PASS_ALPHABET[x % PASS_ALPHABET.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4);
  }

  /* ---------- Dates ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  function addMonths(d, k) {
    const y = d.getFullYear(), m = d.getMonth() + k;
    return new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate()));
  }
  const num = v => { const n = parseFloat(latin(v).replace(/٫/g, '.').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const round = n => Math.round(n * 100) / 100;

  /* ---------- What the teacher sees ----------
     Each full installment paid after the down payment moves the due date one month on;
     an unpaid month stays as the due date until its payment is recorded. */
  function account(r) {
    const payments = (r.payments || [])
      .filter(p => num(p.amount) !== 0)
      .map(p => ({ date: p.date || '', amount: num(p.amount), note: String(p.note || '').trim() }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const total = num(r.total), down = num(r.down), installment = num(r.installment);
    const paid = round(payments.reduce((s, p) => s + p.amount, 0));
    const remaining = round(Math.max(total - paid, 0));
    let nextDue = '', nextAmount = 0;
    if (remaining > 0) {
      const manual = parseISO(r.manualDue), first = parseISO(r.firstDue);
      if (manual) {
        nextDue = iso(manual);
        nextAmount = installment ? Math.min(installment, remaining) : remaining;
      } else if (first && installment > 0) {
        const covered = Math.max(Math.floor((paid - down) / installment + 1e-9), 0);
        nextDue = iso(addMonths(first, covered));
        nextAmount = round(Math.min(down + installment * (covered + 1) - paid, remaining));
      }
    }
    return { name: String(r.name || '').trim(), total, paid, remaining, installment, nextDue, nextAmount, notes: String(r.notes || '').trim(), payments };
  }

  window.DK = { latin, digits, normPhone, normPass, material, sha256, encryptJSON, decryptJSON, teacherKey, adminKey, newSalt, genPassword, iso, parseISO, today, addMonths, num, account, b64, unb64 };
})();
