var BOARD_FETCH_LIMIT = 30;

function listBoard(teacherCode) {
  console.time('listBoard');
  var cacheKey = 'board_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('listBoard'); return cached; }

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('listBoard'); return []; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (!sheet) {
    console.timeEnd('listBoard');
    return [{ name: "お知らせ", answer: `「${CONSTS.SHEET_SUBMISSIONS}」シートが見つかりません。` }];
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.timeEnd('listBoard'); return []; }
  var lastCol = Math.min(sheet.getLastColumn(), 13);
  var numRows = Math.min(BOARD_FETCH_LIMIT, lastRow - 1);
  var startRow = lastRow - numRows + 1;
  var data = sheet.getRange(startRow, 1, numRows, lastCol).getValues().reverse();
  var result = data.map(function(row){ return {
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11]
  }; });
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
  var cacheKey = 'taskBoard_' + teacherCode + '_' + taskId;
  var cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('listTaskBoard'); return cached; }

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('listTaskBoard'); return []; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (!sheet) { console.timeEnd('listTaskBoard'); return []; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.timeEnd('listTaskBoard'); return []; }
  var lastCol = Math.min(sheet.getLastColumn(), 13);
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var filtered = data.filter(function(r){ return String(r[1]) === String(taskId); });
  filtered.sort(function(a, b){ return new Date(b[4]) - new Date(a[4]); });

  var uniq = new Set();
  var rows = [];
  for (var i = 0; i < filtered.length; i++) {
    var r = filtered[i];
    if (!uniq.has(r[0])) {
      uniq.add(r[0]);
      rows.push(r);
      if (rows.length >= BOARD_FETCH_LIMIT) break;
    }
  }

  var result = rows.map(function(row){ return {
    studentId: row[0],
    answer: row[7],
    earnedXp: row[8],
    totalXp: row[9],
    level: row[10],
    trophies: row[11]
  }; });

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
  var cacheKey = 'stats_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('getStatistics'); return cached; }
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    console.timeEnd('getStatistics');
    return { taskCount: 0, studentCount: 0 };
  }
  var taskSheet    = ss.getSheetByName(CONSTS.SHEET_TASKS);
  var studentSheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  var taskCount    = taskSheet ? Math.max(0, taskSheet.getLastRow() - 1) : 0;

  var studentCount = 0;
  if (studentSheet) {
    var lastRow = studentSheet.getLastRow();
    if (lastRow > 1) {
      var ids = studentSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var unique = new Set(ids.flat().filter(function(v){ return v !== '' && v !== null && v !== undefined; }));
      studentCount = unique.size;
    }
  }

  var result = { taskCount: taskCount, studentCount: studentCount };
  putCacheValue_(cacheKey, result, 60);
  console.timeEnd('getStatistics');
  return result;
}

/**
 * loadBoardData(teacherCode):
 * listBoard wrapper for frontend
 */
function loadBoardData(teacherCode) {
  return listBoard(teacherCode);
}
