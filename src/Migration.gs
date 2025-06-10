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
