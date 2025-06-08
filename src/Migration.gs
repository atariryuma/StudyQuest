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
 * upgradeStudentsSheet(teacherCode):
 * 旧バージョンの Students シートに追加列を付与
 */
function upgradeStudentsSheet(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return false;
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return false;
  const required = ['生徒ID','学年','組','番号','初回ログイン日時','最終ログイン日時','累計ログイン回数','累積XP','現在レベル','最終獲得トロフィーID'];
  const lastCol = sheet.getLastColumn();
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.length < required.length) {
    for (let i = headers.length; i < required.length; i++) {
      sheet.insertColumnAfter(i);
    }
    headers = sheet.getRange(1, 1, 1, required.length).getValues()[0];
  }
  sheet.getRange(1, 1, 1, required.length).setValues([required]);
  return true;
}
