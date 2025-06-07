function listBoard(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_GLOBAL_ANSWERS);
  if (!sheet) {
    return [{ name: "お知らせ", answer: `「${SHEET_GLOBAL_ANSWERS}」シートが見つかりません。` }];
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  // 10列目まで取得
  const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const sliceStart = Math.max(0, data.length - 30);
  const slice = data.slice(sliceStart).reverse();
  return slice.map(row => ({
    studentId: row[1],
    answer: row[3],
    earnedXp: row[4],
    totalXp: row[5],
    level: row[6],
    trophies: row[7],
    aiCalls: row[8],
    attempts: row[9]
  }));
}

/**
 * listTaskBoard(teacherCode, taskId):
 * 指定課題の回答ログを新しい順に返す
 */
function listTaskBoard(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_GLOBAL_ANSWERS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  const filtered = data.filter(r => r[2] === taskId).reverse();
  return filtered.map(row => ({
    studentId: row[1],
    answer: row[3],
    earnedXp: row[4],
    totalXp: row[5],
    level: row[6],
    trophies: row[7],
    aiCalls: row[8],
    attempts: row[9]
  }));
}

/**
 * getStatistics(teacherCode):
 * 課題数・生徒数を取得
 */
function getStatistics(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    return { taskCount: 0, studentCount: 0 };
  }
  const taskSheet    = ss.getSheetByName(SHEET_TASKS);
  const studentSheet = ss.getSheetByName(SHEET_STUDENTS);
  const taskCount    = taskSheet ? Math.max(0, taskSheet.getLastRow() - 1) : 0;
  const studentCount = studentSheet ? Math.max(0, studentSheet.getLastRow() - 1) : 0;
  return { taskCount, studentCount };
}
