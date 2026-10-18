/**
 * دبلومك علينا — استقبال ردود استبانة المشتركين في Google Sheet.
 *
 * طريقة التركيب موجودة في survey/SETUP.md.
 * - كل رد بينزل سطر جديد بورقة «الردود».
 * - نسخة خام من كل رد بتنحفظ بورقة «نسخة احتياطية» قبل أي شي، حتى لو صار خلل بالأعمدة.
 * - إذا انبعث نفس الرد مرتين (بسبب انقطاع النت مثلاً) بينحفظ مرة وحدة بس.
 * - إذا انضاف سؤال جديد للاستبانة، عموده بينضاف لحاله.
 */

const SHEET_NAME = 'الردود';
const BACKUP_NAME = 'نسخة احتياطية';
const TIMEZONE = 'Asia/Amman';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data || !data.id || !Array.isArray(data.fields)) return json_({ ok: false, error: 'bad payload' });
    if (data.hp) return json_({ ok: true }); // honeypot: bots fill the hidden field

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getSheet_(ss, SHEET_NAME, 0);
    const backup = getSheet_(ss, BACKUP_NAME);

    if (isDuplicate_(sheet, data.id)) return json_({ ok: true, duplicate: true });

    const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    backup.appendRow([now, String(data.id), JSON.stringify(data)]);

    let headers = sheet.getLastColumn()
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
      : [];
    if (!headers.length || headers[0] === '') headers = ['وقت الإرسال', 'رقم الرد'];

    const row = new Array(headers.length).fill('');
    row[0] = now;
    row[1] = String(data.id);
    data.fields.forEach(function (f) {
      const label = String(f.label || '').slice(0, 200);
      if (!label) return;
      let col = headers.indexOf(label);
      if (col === -1) { headers.push(label); col = headers.length - 1; row.push(''); }
      row[col] = clean_(f.value);
    });
    while (row.length < headers.length) row.push('');

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    const r = sheet.getLastRow() + 1;
    // Plain-text format keeps leading zeros (07..., ministry numbers) exactly as typed.
    sheet.getRange(r, 1, 1, headers.length).setNumberFormat('@').setValues([row]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web-app link in a browser shows this — handy to check it's live.
function doGet() {
  return ContentService.createTextOutput('استبانة دبلومك علينا: الاستقبال شغّال ✓');
}

function getSheet_(ss, name, index) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = index === undefined ? ss.insertSheet(name) : ss.insertSheet(name, index);
    sh.setRightToLeft(true);
    if (name === BACKUP_NAME) sh.appendRow(['وقت الإرسال', 'رقم الرد', 'الرد كامل (JSON)']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function isDuplicate_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return !!sheet.getRange(2, 2, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
}

// Stop answers that start with "=" from being treated as formulas.
function clean_(v) {
  const s = v == null ? '' : String(v).slice(0, 5000);
  return /^[=]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
