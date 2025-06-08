/**
* findStudentSheet_(ss, studentId):
* 学年・組・番号の組み合わせから既存シートを柔軟に探索し、
* 必要に応じて正規化した名前へリネームして返す
*/
if (typeof getCacheValue_ !== 'function') {
  function getCacheValue_() { return null; }
  function putCacheValue_() {}
  function removeCacheValue_() {}
}

function bulkAppend_(sheet, rows) {
  if (!sheet || !rows || rows.length === 0) return;
  if (typeof sheet.getRange === 'function' && typeof sheet.getLastRow === 'function') {
    const start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  } else if (typeof sheet.appendRow === 'function') {
    rows.forEach(r => sheet.appendRow(r));
  }
}
function getStudentRowMap_(teacherCode, sheet) {
  const cacheKey = 'studentRowMap_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;
  if (!sheet) {
    const ss = getSpreadsheetByTeacherCode(teacherCode);
    if (!ss) return {};
    sheet = ss.getSheetByName(SHEET_STUDENTS);
    if (!sheet) return {};
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const map = {};
  for (let i = 0; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    if (id) map[id] = i + 2;
  }
  putCacheValue_(cacheKey, map, 300);
  return map;
}

function findStudentSheet_(ss, studentId) {
  studentId = String(studentId || '').trim();
  if (!ss || !studentId) return null;

  const prefix = (ss && typeof ss.getId === 'function') ? ss.getId() : '';
  const cacheKey = 'studentSheet_' + prefix + '_' + studentId;
  const cached = getCacheValue_(cacheKey);
  if (cached) {
    const sh = ss.getSheetByName(cached);
    if (sh) return sh;
  }

  const normalize = (id) => {
    return String(id || '')
      .replace(/[\u2010-\u2015\uff0d]/g, '-') // various hyphen chars
      .replace(/[\uff10-\uff19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48)) // full-width digits
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  const target = normalize(studentId);
  const direct = ss.getSheetByName(STUDENT_SHEET_PREFIX + target);
  if (direct) return direct;

  const parts = target.split('-');
  if (parts.length !== 3) return null;
  const [grade, classroom, number] = parts;

  let candidate = null;
  let maxRows = -1;
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (!name.startsWith(STUDENT_SHEET_PREFIX)) return;
    let idPart = name.substring(STUDENT_SHEET_PREFIX.length);
    idPart = normalize(idPart);
    const ps = idPart.split('-');
    if (ps.length !== 3) return;
    if (ps[0] === grade && ps[1] === classroom && ps[2] === number) {
      const rows = sh.getLastRow();
      if (rows > maxRows) {
        candidate = sh;
        maxRows = rows;
      }
    }
  });

  if (candidate) {
    const newName = STUDENT_SHEET_PREFIX + target;
    if (candidate.getName() !== newName) {
      const existing = ss.getSheetByName(newName);
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('教師コードが正しくありません。');
  }
  const studentListSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!studentListSheet) {
    throw new Error(`システムエラー: 「${SHEET_STUDENTS}」シートが見つかりません。`);
  }

  const studentId = `${grade}-${classroom}-${number}`; // e.g. "6-1-1"
  
  // 生徒一覧に未登録なら追加 / 旧ID のままなら更新
  const rowMap = getStudentRowMap_(teacherCode, studentListSheet);
  let studentRowIndex = rowMap[studentId] || -1;
  const now = new Date();
  if (studentRowIndex === -1) {
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
      ''        // 最終獲得トロフィーID
    ]);
    studentRowIndex = studentListSheet.getLastRow();
    removeCacheValue_('stats_' + teacherCode);
    removeCacheValue_('studentRowMap_' + teacherCode);
  } else {
    if (String(studentListSheet.getRange(studentRowIndex, 1).getValue()) !== studentId) {
      studentListSheet.getRange(studentRowIndex, 1).setValue(studentId);
    }
    const current = studentListSheet.getRange(studentRowIndex, 7).getValue();
    recordStudentLogin_(studentListSheet, studentRowIndex, current);
  }

  const studentSheetName = STUDENT_SHEET_PREFIX + studentId; // e.g. "生徒_6-1-1"
  let studentSheet = null;
  let maxRows = -1;
  const allSheets = ss.getSheets();
  for (const sh of allSheets) {
    const name = sh.getName();
    if (!name.startsWith(STUDENT_SHEET_PREFIX)) continue;
    const idPart = name.substring(STUDENT_SHEET_PREFIX.length);
    const parts = idPart.split('-');
    if (parts.length !== 3) continue;
    if (parts[0].trim() === grade && parts[1].trim() === classroom && parts[2].trim() === number) {
      const rows = sh.getLastRow();
      if (rows > maxRows) {
        studentSheet = sh;
        maxRows = rows;
      }
    }
  }

  if (studentSheet) {
    if (studentSheet.getName() !== studentSheetName) {
      const existing = ss.getSheetByName(studentSheetName);
      if (existing && existing !== studentSheet) {
        // keep the sheet with more rows
        if (existing.getLastRow() > studentSheet.getLastRow()) {
          studentSheet = existing;
        } else {
          ss.deleteSheet(existing);
        }
      }
      studentSheet.setName(studentSheetName);
    }
  }

  if (!studentSheet) {
    // 個別シートを作成
    studentSheet = ss.insertSheet(studentSheetName);
    studentSheet.appendRow(['Timestamp', 'TaskID', 'Question', 'Answer', 'EarnedXP', 'TotalXP', 'Level', 'Trophy', 'Attempts']);
    studentSheet.setTabColor("f4b400");
    const pre = (ss && typeof ss.getId === 'function') ? ss.getId() : '';
    putCacheValue_('studentSheet_' + pre + '_' + studentId, studentSheetName, 3600);

  // 既存タスクを Submissions シートにも空行として登録
  const subsSheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  const tasksSheet = ss.getSheetByName(SHEET_TASKS);
  if (subsSheet && tasksSheet) {
    const last = tasksSheet.getLastRow();
    if (last >= 2) {
      const rows = tasksSheet.getRange(2, 1, last - 1, 8).getValues();
      const appendRows = [];
      rows.forEach(r => {
        if (String(r[6] || '').toLowerCase() === 'closed') return;
        if (String(r[7] || '') === '1') return;
        const taskId     = r[0];
        const payload    = r[2];
        const startTime  = r[4];
        let questionText = '';
        try {
          const parsed = JSON.parse(payload);
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
          0
        ]);
      });
      bulkAppend_(subsSheet, appendRows);
    }
  }

    // 目次シートにリンクを追加
    const tocSheet = ss.getSheetByName(SHEET_TOC);
    if (tocSheet) {
      const spreadsheetUrl = ss.getUrl();
      const linkFormula   = `=HYPERLINK("${spreadsheetUrl}#gid=${studentSheet.getSheetId()}","${studentSheetName}")`;
      const lastRowToc    = tocSheet.getLastRow();
      tocSheet.insertRowAfter(lastRowToc);
      tocSheet.getRange(lastRowToc + 1, 1).setFormula(linkFormula);
      tocSheet.getRange(lastRowToc + 1, 2).setValue(`${grade}年${classroom}組${number}番の詳細ログ`);
      tocSheet.autoResizeColumn(1);
    }

    // 課題一覧シートから全タスクをインポート（作成日時含む）
    const taskSheet = ss.getSheetByName(SHEET_TASKS);
    if (taskSheet) {
      const lastRow = taskSheet.getLastRow();
      if (lastRow >= 2) {
        const map = getClassIdMap(teacherCode);
        let classId = null;
        Object.keys(map).forEach(id => {
          if (map[id] === `${grade}-${classroom}`) classId = id;
        });
        const taskData = taskSheet.getRange(2, 1, lastRow - 1, 8).getValues();
        const appendRows2 = [];
        taskData.forEach(row => {
          if (String(row[6] || '').toLowerCase() === 'closed') return;
          if (String(row[7] || '') === '1') return;
          if (classId && String(row[1]) !== String(classId)) return;
          const taskId        = row[0];
          const payloadAsJson = row[2];
          const createdAt     = row[4]; // 作成日時
          let questionText    = '';
          try {
            const parsed = JSON.parse(payloadAsJson);
            questionText = parsed.question || payloadAsJson;
          } catch (e) {
            questionText = payloadAsJson;
          }
          appendRows2.push([createdAt, taskId, questionText, '', 0, 0, 0, '', 0]);
        });
        bulkAppend_(studentSheet, appendRows2);
      }
    }
  }

  console.timeEnd('initStudent');
  return { status: 'ok' };
}

/**
 * recordStudentLogin_(sheet, row):
 * 指定行の最終ログイン日時と累計ログイン回数を更新します
 */
function recordStudentLogin_(sheet, row, current) {
  if (!sheet || row <= 1) return;
  const now   = new Date();
  const count = Number(current || 0) + 1;
  sheet.getRange(row, 6, 1, 2).setValues([[now, count]]); // F列, G列
}

/**
 * updateStudentLogin(teacherCode, studentId):
 * 生徒一覧のログイン回数を増やし、最終ログイン日時を更新
 */
function updateStudentLogin(teacherCode, studentId) {
  studentId = String(studentId || '').trim();
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return false;
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return false;
  const rowMap = getStudentRowMap_(teacherCode, sheet);
  const row = rowMap[studentId];
  if (!row) return false;
  const current = sheet.getRange(row, 7).getValue();
  recordStudentLogin_(sheet, row, current);
  return true;
}

function getStudentHistory(teacherCode, studentId) {
  console.time('getStudentHistory');
  studentId = String(studentId || '').trim();
  const cacheKey = 'history_' + teacherCode + '_' + studentId;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = findStudentSheet_(ss, studentId);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  putCacheValue_(cacheKey, rows, 30);
  console.timeEnd('getStudentHistory');
  return rows;
}
