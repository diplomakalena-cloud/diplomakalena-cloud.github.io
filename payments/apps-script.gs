/**
 * دبلومك علينا — كشف حساب المعلم (الدفعات).
 *
 * طريقة التركيب موجودة في payments/SETUP.md.
 * - ورقة «المعلمين»: سطر لكل معلم (المبلغ المتفق عليه، القسط، الرقم السري، الملاحظات…).
 * - ورقة «الدفعات»: سطر لكل دفعة، مربوطة بالمعلم عن طريق الرقم الوزاري.
 * - المعلم بيدخل هاتفه ورقمه الوزاري ورقمه السري، والسكربت بيرجّعله بياناته هو بس.
 * - موعد القسط القادم بينحسب لحاله من الدفعات: ما بيتقدّم للشهر اللي بعده إلا لما تنسجل الدفعة.
 * - بعد 5 محاولات غلط على نفس الرقم الوزاري، الدخول بيتسكّر 15 دقيقة.
 */

const TEACHERS = 'المعلمين';
const PAYMENTS = 'الدفعات';
const TIMEZONE = 'Asia/Amman';
const MAX_FAILS = 5;
const LOCK_SECONDS = 15 * 60;

const T_COLS = {
  name: 'الاسم',
  phone: 'رقم الهاتف',
  ministry: 'الرقم الوزاري',
  pass: 'الرقم السري',
  total: 'المبلغ المتفق عليه',
  down: 'الدفعة المقدّمة (إن وجدت)',
  installment: 'قيمة القسط الشهري',
  firstDue: 'تاريخ أول قسط',
  manualDue: 'موعد القسط القادم (يدوي، اختياري)',
  notes: 'ملاحظات للمعلم'
};
const P_COLS = {
  ministry: 'الرقم الوزاري',
  date: 'التاريخ',
  amount: 'المبلغ',
  note: 'ملاحظة',
  name: 'اسم المعلم (لك أنت، اختياري)'
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ministry = digits_(data.ministry);
    const phone = phoneKey_(data.phone);
    const pass = latin_(data.pass).trim();
    if (!ministry || !phone || !pass) return json_({ ok: false, error: 'invalid' });

    const cache = CacheService.getScriptCache();
    const failKey = 'fail:' + ministry;
    const fails = Number(cache.get(failKey) || 0);
    if (fails >= MAX_FAILS) return json_({ ok: false, error: 'locked' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const teacher = findTeacher_(ss, ministry, phone, pass);
    if (!teacher) {
      cache.put(failKey, String(fails + 1), LOCK_SECONDS);
      return json_({ ok: false, error: fails + 1 >= MAX_FAILS ? 'locked' : 'invalid' });
    }
    cache.remove(failKey);
    return json_({ ok: true, account: buildAccount_(ss, teacher) });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  }
}

// Opening the web-app link in a browser shows this — handy to check it's live.
function doGet() {
  return ContentService.createTextOutput('كشف حساب المعلم — دبلومك علينا: شغّال ✓');
}

/* ---------------- Lookup ---------------- */

function findTeacher_(ss, ministry, phone, pass) {
  const rows = readSheet_(ss, TEACHERS, T_COLS);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowPass = latin_(r.pass).trim();
    if (digits_(r.ministry) === ministry && phoneKey_(r.phone) === phone && rowPass && rowPass === pass) return r;
  }
  return null;
}

function buildAccount_(ss, t) {
  const ministry = digits_(t.ministry);
  const payments = readSheet_(ss, PAYMENTS, P_COLS)
    .filter(function (p) { return digits_(p.ministry) === ministry && num_(p.amount) !== 0; })
    .map(function (p) { const d = parseDate_(p.date); return { date: d ? fmt_(d) : '', amount: num_(p.amount), note: String(p.note || '').trim() }; })
    .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

  const total = num_(t.total);
  const paid = round_(payments.reduce(function (s, p) { return s + p.amount; }, 0));
  const remaining = round_(Math.max(total - paid, 0));
  const installment = num_(t.installment);
  const down = num_(t.down);

  let nextDue = '';
  let nextAmount = 0;
  if (remaining > 0) {
    const manual = parseDate_(t.manualDue);
    const first = parseDate_(t.firstDue);
    if (manual) {
      nextDue = fmt_(manual);
      nextAmount = installment ? Math.min(installment, remaining) : remaining;
    } else if (first && installment > 0) {
      // Each full installment paid (after the down payment) moves the due date one month on;
      // an unpaid month stays as the due date until its payment is recorded.
      const covered = Math.max(Math.floor((paid - down) / installment + 1e-9), 0);
      nextDue = fmt_(addMonths_(first, covered));
      nextAmount = round_(Math.min(down + installment * (covered + 1) - paid, remaining));
    }
  }

  return {
    name: String(t.name || '').trim(),
    total: total,
    paid: paid,
    remaining: remaining,
    installment: installment,
    nextDue: nextDue,
    nextAmount: nextAmount,
    notes: String(t.notes || '').trim(),
    payments: payments,
    today: fmt_(new Date())
  };
}

/* ---------------- Sheet helpers ---------------- */

// Reads a sheet into objects keyed like `cols`, matching columns by header text so they can be reordered.
function readSheet_(ss, name, cols) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  Object.keys(cols).forEach(function (k) { idx[k] = headers.indexOf(cols[k]); });
  return values.slice(1).map(function (row) {
    const o = {};
    Object.keys(cols).forEach(function (k) { o[k] = idx[k] === -1 ? '' : row[idx[k]]; });
    return o;
  });
}

function latin_(v) {
  return String(v == null ? '' : v)
    .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
    .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
}

function digits_(v) { return latin_(v).replace(/\D/g, ''); }

// Last 9 digits, so 0791234567, 791234567 (leading zero dropped by Sheets) and +962791234567 all match.
function phoneKey_(v) {
  const d = digits_(v);
  return d.length >= 9 ? d.slice(-9) : '';
}

function num_(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(latin_(v).replace(/٫/g, '.').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function round_(n) { return Math.round(n * 100) / 100; }

function parseDate_(v) {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = latin_(v).trim();
  let m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function addMonths_(d, k) {
  const y = d.getFullYear(), m = d.getMonth() + k;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}

function fmt_(d) { return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd'); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- Admin menu (inside the Google Sheet) ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('دبلومك علينا')
    .addItem('تجهيز الأوراق (مرة وحدة)', 'setup')
    .addItem('رقم سري جديد للمعلم المحدد', 'newPassword')
    .addToUi();
}

// Creates the two sheets with their headers (safe to run again; it never deletes data).
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = ensureSheet_(ss, TEACHERS, T_COLS);
  const p = ensureSheet_(ss, PAYMENTS, P_COLS);
  // Plain text keeps leading zeros in phone numbers, ministry numbers and passwords.
  [T_COLS.phone, T_COLS.ministry, T_COLS.pass].forEach(function (h) { textColumn_(t, h); });
  textColumn_(p, P_COLS.ministry);
  [[t, T_COLS.firstDue], [t, T_COLS.manualDue], [p, P_COLS.date]].forEach(function (x) { dateColumn_(x[0], x[1]); });
  SpreadsheetApp.getUi().alert('تمام ✓ الورقتين «' + TEACHERS + '» و«' + PAYMENTS + '» جاهزات.');
}

function newPassword() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== TEACHERS) { ui.alert('روح لورقة «' + TEACHERS + '» واختار أي خلية بسطر المعلم.'); return; }
  const row = sh.getActiveRange().getRow();
  if (row < 2) { ui.alert('اختار خلية بسطر المعلم (مش سطر العناوين).'); return; }
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const col = headers.indexOf(T_COLS.pass) + 1;
  if (!col) { ui.alert('ما لقيت عمود «' + T_COLS.pass + '». شغّل «تجهيز الأوراق» أول.'); return; }
  const cell = sh.getRange(row, col);
  if (String(cell.getValue()).trim() &&
      ui.alert('هاد المعلم إله رقم سري. بدك تغيّره؟', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  let code = '';
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10);
  cell.setNumberFormat('@').setValue(code);
  ui.alert('الرقم السري الجديد: ' + code);
}

function ensureSheet_(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.setRightToLeft(true); }
  const want = Object.keys(cols).map(function (k) { return cols[k]; });
  const have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  const missing = want.filter(function (h) { return have.indexOf(h) === -1; });
  if (missing.length) {
    const start = have.filter(String).length + 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing]);
  }
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

function colOf_(sh, header) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String).indexOf(header) + 1;
}
function textColumn_(sh, header) {
  const c = colOf_(sh, header);
  if (c) sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@');
}
function dateColumn_(sh, header) {
  const c = colOf_(sh, header);
  if (c) sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
}
