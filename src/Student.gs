/**
* findStudentSheet_(ss, studentId):
* 学年・組・番号の組み合わせから既存シートを柔軟に探索し、
* 必要に応じて正規化した名前へリネームして返す
*/

function bulkAppend_(sheet, rows) {
  if (!sheet || !rows || rows.length === 0) return;
  if (typeof sheet.getRange === 'function' && typeof sheet.getLastRow === 'function') {
    var start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  } else if (typeof sheet.appendRow === 'function') {
    rows.forEach(function(r){ sheet.appendRow(r); });
  }
}
function getStudentRowMap_(teacherCode, sheet) {
  var cacheKey = 'studentRowMap_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;
  if (!sheet) {
    var ss = getSpreadsheetByTeacherCode(teacherCode);
    if (!ss) return {};
    sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
    if (!sheet) return {};
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var map = {};
  for (var i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    if (id) map[id] = i + 2;
  }
  putCacheValue_(cacheKey, map, 300);
  return map;
}

function findStudentSheet_(ss, studentId) {
  studentId = String(studentId || '').trim();
  if (!ss || !studentId) return null;

  var prefix = (ss && typeof ss.getId === 'function') ? ss.getId() : '';
  var cacheKey = 'studentSheet_' + prefix + '_' + studentId;
  var cached = getCacheValue_(cacheKey);
  if (cached) {
    var sh = ss.getSheetByName(cached);
    if (sh) return sh;
  }

  var normalize = function(id) {
    return String(id || '')
      .replace(/[\u2010-\u2015\uff0d]/g, '-') // various hyphen chars
      .replace(/[\uff10-\uff19]/g, function(c){ return String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48); }) // full-width digits
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  var target = normalize(studentId);
  var direct = ss.getSheetByName(CONSTS.STUDENT_SHEET_PREFIX + target);
  if (direct) return direct;

  var parts = target.split('-');
  if (parts.length !== 3) return null;
  var [grade, classroom, number] = parts;

  var candidate = null;
  var maxRows = -1;
  ss.getSheets().forEach(function(sh) {
    var name = sh.getName();
    if (!name.startsWith(CONSTS.STUDENT_SHEET_PREFIX)) return;
    var idPart = name.substring(CONSTS.STUDENT_SHEET_PREFIX.length);
    idPart = normalize(idPart);
    var ps = idPart.split('-');
    if (ps.length !== 3) return;
    if (ps[0] === grade && ps[1] === classroom && ps[2] === number) {
      var rows = sh.getLastRow();
      if (rows > maxRows) {
        candidate = sh;
        maxRows = rows;
      }
    }
  });

  if (candidate) {
    var newName = CONSTS.STUDENT_SHEET_PREFIX + target;
    if (candidate.getName() !== newName) {
      var existing = ss.getSheetByName(newName);
      if (existing && existing !== candidate) {
        if (existing.getLastRow() > candidate.getLastRow()) {
          candidate = existing;
        } else {
          ss.deleteSheet(existing);
        }
      }
      candidate.setName(newName);
    }
    putCacheValue_(cacheKey, candidate.getName(), 3600);
  }
  return candidate;
}

/**
 * initStudent(teacherCode, grade, classroom, number):
 * 生徒の初回ログイン処理
 * ・生徒一覧シートに登録（なければ）
 * ・「生徒_<ID>」シートを作成（なければ）
 * ・課題一覧からすべてのタスクをインポート
 */
function initStudent(teacherCode, grade, classroom, number) {
  console.time('initStudent');
  grade      = String(grade).trim();
  classroom  = String(classroom).trim();
  number     = String(number).trim();
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('教師コードが正しくありません。');
  }
  var studentListSheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!studentListSheet) {
    throw new Error(`システムエラー: 「${CONSTS.SHEET_STUDENTS}」シートが見つかりません。`);
  }

  var studentId = `${grade}-${classroom}-${number}`; // e.g. "6-1-1"
  
  // 生徒一覧に未登録なら追加 / 旧ID のままなら更新
  var rowMap = getStudentRowMap_(teacherCode, studentListSheet);
  var studentRowIndex = rowMap[studentId] || -1;
  var isNew = (studentRowIndex === -1);
  var now = new Date();
  if (isNew) {
    studentListSheet.appendRow([
      studentId,
      grade,
      classroom,
      number,
      now,      // 初回ログイン日時
      now,      // 最終ログイン日時
      1,        // 累計ログイン回数
      0,        // 累積XP
      1,        // 現在レベル
      '',       // 最終獲得トロフィーID
      0         // TotalLikes
    ]);
    studentRowIndex = studentListSheet.getLastRow();
    removeCacheValue_('stats_' + teacherCode);
    removeCacheValue_('studentRowMap_' + teacherCode);
  } else {
    if (String(studentListSheet.getRange(studentRowIndex, 1).getValue()) !== studentId) {
      studentListSheet.getRange(studentRowIndex, 1).setValue(studentId);
    }
    var current = studentListSheet.getRange(studentRowIndex, 7).getValue();
    recordStudentLogin_(studentListSheet, studentRowIndex, current);
  }

  if (isNew) {
    // 既存タスクを Submissions シートにも空行として登録
    var subsSheet  = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
    var tasksSheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
    if (subsSheet && tasksSheet) {
      var last = tasksSheet.getLastRow();
      if (last >= 2) {
        var rows = tasksSheet.getRange(2, 1, last - 1, 8).getValues();
        var appendRows = [];
        rows.forEach(function(r) {
          if (String(r[6] || '').toLowerCase() === 'closed') return;
          if (String(r[7] || '') === '1') return;
          var taskId     = r[0];
          var payload    = r[2];
          var startTime  = r[4];
          var questionText = '';
          try {
            var parsed = JSON.parse(payload);
            questionText = parsed.question || payload;
          } catch (e) {
            questionText = payload;
          }
          appendRows.push([
            studentId,
            taskId,
            questionText,
            startTime || '',
            '', '', '', '',
            0, 0, 0,
            '',
            0,
            0
          ]);
        });
        bulkAppend_(subsSheet, appendRows);
      }
    }
  }

  console.timeEnd('initStudent');
  return { status: 'ok' };
}

/**
 * registerStudentToClass(info):
 * 生徒をクラスに登録して初期化します
 */
function registerStudentToClass(info) {
  console.time('registerStudentToClass');
  initStudent(info.teacherCode, info.grade, info.classroom, info.number);
  console.timeEnd('registerStudentToClass');
  return { status: 'ok' };
}

/**
 * recordStudentLogin_(sheet, row):
 * 指定行の最終ログイン日時と累計ログイン回数を更新します
 */
function recordStudentLogin_(sheet, row, current) {
  if (!sheet || row <= 1) return;
  var now   = new Date();
  var count = Number(current || 0) + 1;
  sheet.getRange(row, 6, 1, 2).setValues([[now, count]]); // F列, G列
}

/**
 * updateStudentLogin(teacherCode, studentId):
 * 生徒一覧のログイン回数を増やし、最終ログイン日時を更新
 */
function updateStudentLogin(teacherCode, studentId) {
  studentId = String(studentId || '').trim();
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return false;
  var rowMap = getStudentRowMap_(teacherCode, sheet);
  var row = rowMap[studentId];
  if (!row) return false;
  var current = sheet.getRange(row, 7).getValue();
  recordStudentLogin_(sheet, row, current);
  return true;
}

function addStudentXp(teacherCode, studentId, amount) {
  amount = Number(amount) || 0;
  if (!amount) return false;
  studentId = String(studentId || '').trim();
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return false;
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return false;
  var rowMap = getStudentRowMap_(teacherCode, sheet);
  var row = rowMap[studentId];
  if (!row) return false;
  var total = Number(sheet.getRange(row, 8).getValue()) || 0;
  var newTotal = total + amount;
  var level = calcLevelFromXp_(newTotal);
  sheet.getRange(row, 8, 1, 2).setValues([[newTotal, level]]);
  return true;
}

function getStudentHistory(teacherCode, studentId) {
  console.time('getStudentHistory');
  studentId = String(studentId || '').trim();
  var cacheKey = 'history_' + teacherCode + '_' + studentId;
  var cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('getStudentHistory'); return cached; }

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('getStudentHistory'); return []; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (!sheet) { console.timeEnd('getStudentHistory'); return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.timeEnd('getStudentHistory'); return []; }
  var data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (String(r[0]) !== studentId) continue;
    rows.push([r[4], r[1], r[2], r[7], r[8], r[9], r[10], r[11], r[12]]);
  }
  putCacheValue_(cacheKey, rows, 30);
  console.timeEnd('getStudentHistory');
  return rows;
}
function listStudents(teacherCode) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  return rows.map(function(r){ return {
    id: r[0],
    grade: r[1],
    class: r[2],
    number: r[3],
    firstLogin: r[4],
    lastLogin: r[5],
    loginCount: r[6],
    totalXp: r[7],
    level: r[8]
  }; });
}

function getClassStatistics(teacherCode) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return {};
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
  var stats = {};
  rows.forEach(function(r){
    var key = `${r[1]}-${r[2]}`;
    if (!stats[key]) stats[key] = { count: 0, totalXp: 0, avgLevel: 0 };
    stats[key].count++;
    stats[key].totalXp += Number(r[7] || 0);
    stats[key].avgLevel += Number(r[8] || 0);
  });
  Object.keys(stats).forEach(function(k){
    var s = stats[k];
    s.avgLevel = s.count > 0 ? s.avgLevel / s.count : 0;
  });
  return stats;
}

/**
 * registerStudentsFromCsv(teacherCode, csvText):
 * CSV(text) -> [email, grade, class, name] rows to append to Students sheet
 */
function registerStudentsFromCsv(teacherCode, csvText) {
  console.time('registerStudentsFromCsv');
  if (!csvText) { console.timeEnd('registerStudentsFromCsv'); return { status: 'error', message: 'no data' }; }
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('registerStudentsFromCsv'); return { status: 'error', message: 'no sheet' }; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) { console.timeEnd('registerStudentsFromCsv'); return { status: 'error', message: 'missing sheet' }; }

  var rows = Utilities.parseCsv(csvText);
  var map = getStudentRowMap_(teacherCode, sheet);
  var now = new Date();
  var append = [];
  rows.forEach(function(r){
    if (r.length < 4) return;
    var id = String(r[0] || '').trim();
    if (!id || map[id]) return;
    append.push([id, r[1], r[2], r[3], now, now, 1, 0, 1, '']);
    map[id] = true;
  });
  bulkAppend_(sheet, append);
  if (append.length > 0) {
    removeCacheValue_('stats_' + teacherCode);
    removeCacheValue_('studentRowMap_' + teacherCode);
  }
  console.timeEnd('registerStudentsFromCsv');
  return { status: 'ok', added: append.length };
}

function loadStudentData(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  var login = (typeof loginAsStudent === 'function') ? loginAsStudent(teacherCode) : null;
  if (!login || login.status !== 'ok') return login;

  var info = login.userInfo || {};
  var cls = info.classData || {};
  var grade = cls.grade;
  var classroom = cls.class;
  var sid = grade + '-' + classroom + '-' + cls.number;

  var tasks = [];
  if (typeof listTasksForClass === 'function') {
    tasks = listTasksForClass(teacherCode, grade, classroom) || [];
  }
  var history = [];
  if (typeof getStudentHistory === 'function') {
    history = getStudentHistory(teacherCode, sid) || [];
  }

  return { userInfo: info, tasks: { uncompleted: tasks }, chatHistory: history };
}
