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

  /* ---------- Personal link ----------
     The teacher's details ride in the part of the link after «#», which browsers never send to any server.
     Opening the link is the same as typing the details, so it is shared exactly like the password. */
  const b64url = s => b64(enc.encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  function linkToken(phone, ministry, pass) {
    return b64url([normPhone(phone), digits(ministry), String(pass || '').trim()].join('|'));
  }
  function readLinkToken(tok) {
    try {
      const parts = dec.decode(unb64(String(tok).replace(/-/g, '+').replace(/_/g, '/'))).split('|');
      if (parts.length !== 3 || !normPhone(parts[0]) || !digits(parts[1]) || !parts[2]) return null;
      return { phone: parts[0], ministry: parts[1], pass: parts[2] };
    } catch (e) { return null; }
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
  // «25/10/2026» as it's written in Arabic: the day on the right and the year on the left. The marks between the
  // numbers keep the browser from reading the whole date as one left-to-right number.
  const numDate = s => { const d = typeof s === 'string' ? parseISO(s) : s; return d ? [d.getDate(), d.getMonth() + 1, d.getFullYear()].join('\u200F/') : ''; };
  const num = v => { const n = parseFloat(latin(v).replace(/٫/g, '.').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const round = n => Math.round(n * 100) / 100;

  /* ---------- What the teacher sees ----------
     Each full installment paid after the down payment moves the due date one month on;
     an unpaid month stays as the due date until its payment is recorded.
     With `carry` on, a month that was partly paid isn't late: what's left of it joins next month's installment. */
  function account(r) {
    const payments = (r.payments || [])
      .filter(p => num(p.amount) !== 0)
      .map(p => ({ date: p.date || '', amount: num(p.amount), note: String(p.note || '').trim() }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const total = num(r.total), down = num(r.down), installment = num(r.installment);
    const paid = round(payments.reduce((s, p) => s + p.amount, 0));
    const remaining = round(Math.max(total - paid, 0));
    let nextDue = '', nextAmount = 0, carried = 0, carriedFrom = '';
    if (remaining > 0) {
      const manual = parseISO(r.manualDue), first = parseISO(r.firstDue);
      if (manual) {
        nextDue = iso(manual);
        nextAmount = installment ? Math.min(installment, remaining) : remaining;
      } else if (first && installment > 0) {
        const net = paid - down;
        let k = Math.max(Math.floor(net / installment + 1e-9), 0);
        const part = round(net - k * installment);
        if (r.carry && net > 0 && part > 0) {
          carried = round(installment - part);
          carriedFrom = iso(addMonths(first, k));
          k++;
        }
        nextDue = iso(addMonths(first, k));
        nextAmount = round(Math.min(down + installment * (k + 1) - paid, remaining));
        carried = Math.min(carried, nextAmount);
      }
    }
    return { name: String(r.name || '').trim(), title: String(r.title || '').trim(), total, paid, remaining, installment, nextDue, nextAmount, carried, carriedFrom, notes: String(r.notes || '').trim(), payments, tasks: taskList(r.tasks) };
  }

  /* ---------- Weeks ----------
     The diploma runs in weeks: tasks come out on Sunday and are due by 11:59 at night on Saturday.
     A week goes by its Sunday's date. The admin panel numbers it (holidays skipped, and back to 1 with each main
     course) and names the main course it counts in. */
  const weekOf = s => { const d = parseISO(s); return d ? iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())) : ''; };
  const weekEnd = w => { const d = parseISO(w); return d ? iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)) : ''; };
  const weekRange = w => `${numDate(w)} – ${numDate(weekEnd(w))}`;
  // A task of a week still to come, or without a due date, counts once work on it starts,
  // so a list entered in advance doesn't read as «3 من 60».
  const inPlay = (week, status, now) => status !== 'todo' || (!!week && week <= weekOf(iso(now || today())));
  /* The way both pages lay a list out: this week, the next one with tasks, the earlier weeks (latest first),
     the weeks after that, and the tasks without a date yet. weekOfItem gives an item's week. */
  function weekPlan(items, weekOfItem, now) {
    const thisWeek = weekOf(iso(now || today())), byWeek = new Map(), undated = [];
    items.forEach(x => {
      const w = weekOfItem(x);
      if (!w) return undated.push(x);
      if (!byWeek.has(w)) byWeek.set(w, []);
      byWeek.get(w).push(x);
    });
    const weeks = [...byWeek.keys()].sort().map(week => ({ week, items: byWeek.get(week) }));
    const ahead = weeks.filter(w => w.week > thisWeek);
    return {
      thisWeek, weeks, undated,
      now: weeks.find(w => w.week === thisWeek) || null,
      next: ahead[0] || null,
      past: weeks.filter(w => w.week < thisWeek).reverse(),
      later: ahead.slice(1)
    };
  }

  /* ---------- Tasks ----------
     The diploma's task list lives in the admin database. A teacher's file carries only their own tasks, in order,
     each with its status, its week, the week's number and main course; tasks marked «مش مطلوبة» aren't published at all.
     Statements from before tasks have none, and statements from before weeks get them from the due date. */
  const TASK_STATES = ['todo', 'doing', 'ready', 'done', 'fix'];
  // What the teacher reads for each status (the admin panel has its own, plainer names).
  const TASK_SHOWN = { todo: 'قيد الانتظار', doing: 'قيد التجهيز', ready: 'جاهزة', done: 'تم التسليم', fix: 'قيد التعديل' };
  function taskList(list) {
    const out = (Array.isArray(list) ? list : []).map(x => {
      const due = parseISO(x.due) ? x.due : '';
      return {
        group: String(x.group || '').trim(), title: String(x.title || '').trim(), due,
        week: parseISO(x.week) ? weekOf(x.week) : weekOf(due), weekNo: Math.max(Math.floor(+x.weekNo) || 0, 0), phase: String(x.phase || '').trim(),
        status: TASK_STATES.includes(x.status) ? x.status : 'todo', at: parseISO(x.at) ? x.at : '',
        grade: String(x.grade || '').trim(), note: String(x.note || '').trim()
      };
    }).filter(x => x.title);
    if (!out.some(x => x.weekNo)) {
      const weeks = [...new Set(out.map(x => x.week).filter(Boolean))].sort();
      out.forEach(x => { if (x.week) x.weekNo = weeks.indexOf(x.week) + 1; });
    }
    return out;
  }
  function taskCounts(list) {
    const c = { total: list.length, todo: 0, doing: 0, ready: 0, done: 0, fix: 0 };
    list.forEach(x => { c[x.status]++; });
    return c;
  }

  window.DK = { linkToken, readLinkToken, latin, digits, normPhone, normPass, material, sha256, encryptJSON, decryptJSON, teacherKey, adminKey, newSalt, genPassword, iso, parseISO, today, addMonths, numDate, num, account, b64, unb64, TASK_STATES, TASK_SHOWN, taskList, taskCounts, weekOf, weekEnd, weekRange, inPlay, weekPlan };
})();
