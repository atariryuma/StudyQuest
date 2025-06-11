/**
 * archiveOldSubmissions(teacherCode, year):
 * Move submissions before given year into a separate sheet.
 */
function archiveOldSubmissions(teacherCode, year) {
  teacherCode = String(teacherCode || '').trim();
  year = Number(year) || (new Date().getFullYear() - 1);
  var ss = getTeacherDb_(teacherCode);
  if (!ss) return 0;
  var sheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var rows = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var keep = [];
  var archive = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var ts = r[4];
    var d = ts ? new Date(ts) : null;
    if (d && d.getFullYear() < year) archive.push(r); else keep.push(r);
  }
  if (archive.length) {
    var name = CONSTS.SHEET_SUBMISSIONS + '_' + year;
    var ar = ss.getSheetByName(name) || ss.insertSheet(name);
    if (ar.getLastRow() === 0) ar.appendRow(headers);
    ar.getRange(ar.getLastRow()+1,1,archive.length,archive[0].length).setValues(archive);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
  if (keep.length) sheet.getRange(2,1,keep.length,keep[0].length).setValues(keep);
  return archive.length;
}

