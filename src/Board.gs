const BOARD_FETCH_LIMIT = 30;

// Fallbacks when running in a non-GAS environment (e.g. tests)
if (typeof getCacheValue_ !== 'function') {
  function getCacheValue_() { return null; }
  function putCacheValue_() {}
}

function listBoard(teacherCode) {
  console.time('listBoard');
  const cacheKey = 'board_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (!sheet) {
    return [{ name: "お知らせ", answer: `「${SHEET_SUBMISSIONS}」シートが見つかりません。` }];
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.min(sheet.getLastColumn(), 13);
  const numRows = Math.min(BOARD_FETCH_LIMIT, lastRow - 1);
  const startRow = lastRow - numRows + 1;
  const data = sheet.getRange(startRow, 1, numRows, lastCol).getValues().reverse();
  const result = data.map(row => ({
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11]
  }));
  putCacheValue_(cacheKey, result, 30);
  console.timeEnd('listBoard');
  return result;
}

/**
 * listTaskBoard(teacherCode, taskId):
 * 指定課題の回答ログを新しい順に返す
 */
function listTaskBoard(teacherCode, taskId) {
  console.time('listTaskBoard');
  const cacheKey = 'taskBoard_' + teacherCode + '_' + taskId;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.min(sheet.getLastColumn(), 13);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const filtered = data.filter(r => String(r[1]) === String(taskId));
  filtered.sort((a, b) => new Date(b[4]) - new Date(a[4]));

  const uniq = new Set();
  const rows = [];
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i];
    if (!uniq.has(r[0])) {
      uniq.add(r[0]);
      rows.push(r);
      if (rows.length >= BOARD_FETCH_LIMIT) break;
    }
  }

  const result = rows.map(row => ({
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11]
  }));

  putCacheValue_(cacheKey, result, 30);
  console.timeEnd('listTaskBoard');
  return result;
}

/**
 * getStatistics(teacherCode):
 * 課題数・生徒数を取得
 */
function getStatistics(teacherCode) {
  console.time('getStatistics');
  const cacheKey = 'stats_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;
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

  const result = { taskCount, studentCount };
  putCacheValue_(cacheKey, result, 60);
  console.timeEnd('getStatistics');
  return result;
}
