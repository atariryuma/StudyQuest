function listBoard(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (!sheet) {
    return [{ name: "お知らせ", answer: `「${SHEET_SUBMISSIONS}」シートが見つかりません。` }];
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.min(sheet.getLastColumn(), 14);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const sliceStart = Math.max(0, data.length - 30);
  const slice = data.slice(sliceStart).reverse();
  return slice.map(row => ({
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11],
    aiCalls: row[12] || 0,
    attempts: row[13] || 0
  }));
}

/**
 * listTaskBoard(teacherCode, taskId):
 * 指定課題の回答ログを新しい順に返す
 */
function listTaskBoard(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.min(sheet.getLastColumn(), 14);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const filtered = data.filter(r => r[1] === taskId).reverse();
  return filtered.map(row => ({
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11],
    aiCalls: row[12] || 0,
    attempts: row[13] || 0
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

  let studentCount = 0;
  if (studentSheet) {
    const lastRow = studentSheet.getLastRow();
    if (lastRow > 1) {
      const ids = studentSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      const unique = new Set(ids.flat().filter(v => v !== '' && v !== null && v !== undefined));
      studentCount = unique.size;
    }
  }

  return { taskCount, studentCount };
}
