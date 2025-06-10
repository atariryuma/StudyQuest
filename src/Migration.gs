/**
 * deleteLegacyApiKeys:
 * `${teacherCode}_apiKey` 形式の旧スクリプトプロパティを削除します。
 */
function deleteLegacyApiKeys() {
  const props = PropertiesService.getScriptProperties();
  const keys = props.getKeys() || [];
  keys.forEach(k => {
    if (/\_apiKey$/.test(k) && k !== 'geminiApiKey') {
      props.deleteProperty(k);
    }
  });
}

/**
 * addDraftColumn(teacherCode):
 * 課題シートに draft 列が無ければ追加
 */
function addDraftColumn(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return false;
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return false;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.includes('draft')) return true;
  sheet.insertColumnAfter(Math.max(7, lastCol));
  sheet.getRange(1, Math.max(8, lastCol + 1)).setValue('draft');
  return true;
}

/**
 * migrateOwnerNames():
 * Settings シートに ownerName が無い教師DB へ追加します。
 */
function migrateOwnerNames() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys() || [];
  var codes = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k.indexOf(CONSTS.PROP_TEACHER_SSID_PREFIX) === 0) {
      codes.push(k.substring(CONSTS.PROP_TEACHER_SSID_PREFIX.length));
    }
  }
  var gdb = getGlobalDb_();
  if (!gdb) return { migrated: 0 };
  var us = gdb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!us) return { migrated: 0 };
  var uLast = us.getLastRow();
  var map = {};
  if (uLast >= 2) {
    var rows = us.getRange(2, 1, uLast - 1, 2).getValues();
    for (var j = 0; j < rows.length; j++) {
      map[String(rows[j][0]).trim().toLowerCase()] = rows[j][1];
    }
  }
  var count = 0;
  for (var c = 0; c < codes.length; c++) {
    var code = codes[c];
    var ss = getSpreadsheetByTeacherCode(code);
    if (!ss) continue;
    var sheet = ensureSettingsSheet_(ss);
    var last = sheet.getLastRow();
    var ownerName = '';
    var ownerEmail = '';
    if (last >= 2) {
      var vals = sheet.getRange(2, 1, last - 1, 2).getValues();
      for (var r = 0; r < vals.length; r++) {
        if (String(vals[r][0]) === 'ownerName') ownerName = vals[r][1];
        else if (String(vals[r][0]) === 'ownerEmail') ownerEmail = vals[r][1];
      }
    }
    if (!ownerName && ownerEmail) {
      var n = map[String(ownerEmail).trim().toLowerCase()] || '';
      if (n) {
        sheet.appendRow(['ownerName', n]);
        count++;
      }
    }
  }
  return { migrated: count };
}
