/**
 * createTask(teacherCode, taskObj, selfEval):
 * 新しい課題を課題一覧シートに追加
 */

function createTask(teacherCode, taskObj, selfEval) {
  console.time('createTask');
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error("課題作成失敗: 教師のスプレッドシートが見つかりません。");
  }
  var taskSheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!taskSheet) {
    throw new Error(`システムエラー: 「${CONSTS.SHEET_TASKS}」シートが見つかりません。`);
  }
  var parsed = taskObj || null;

  if (parsed && Array.isArray(parsed.classIds)) {
    var rows = parsed.classIds.map(function(cid) {
      var choices = Array.isArray(parsed.choices) ? JSON.stringify(parsed.choices) : '';
      return [
        Utilities.getUuid(),
        cid,
        parsed.subject || '',
        parsed.question || '',
        parsed.type || 'text',
        choices,
        selfEval,
        new Date(),
        parsed.persona || '',
        parsed.status || '',
        '',
        parsed.difficulty || '',
        parsed.timeLimit || '',
        parsed.xpBase || '',
        parsed.correctAnswer || ''
      ];
    });
    bulkAppend_(taskSheet, rows);
    removeCacheValue_('tasks_' + teacherCode);
    removeCacheValue_('taskmap_' + teacherCode);
    removeCacheValue_('stats_' + teacherCode);
    console.timeEnd('createTask');
    return;
  }

  var taskId = Utilities.getUuid();
  var classId = parsed && parsed.classId ? parsed.classId : '';
  var choices = Array.isArray(parsed && parsed.choices) ?
                JSON.stringify(parsed.choices) : '';
  taskSheet.appendRow([
    taskId,
    classId,
    parsed && parsed.subject || '',
    parsed && parsed.question || '',
    parsed && parsed.type || 'text',
    choices,
    selfEval,
    new Date(),
    parsed && parsed.persona || '',
    parsed && parsed.status || '',
    '',
    parsed && parsed.difficulty || '',
    parsed && parsed.timeLimit || '',
    parsed && parsed.xpBase || '',
    parsed && parsed.correctAnswer || ''
  ]);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  console.timeEnd('createTask');
}

/**
 * listTasks(teacherCode):
 * 課題一覧を最新→過去の順で返す
 */
function listTasks(teacherCode) {
  console.time('listTasks');
  var cacheKey = 'tasks_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('listTasks'); return cached; }

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('listTasks'); return []; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) { console.timeEnd('listTasks'); return []; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.timeEnd('listTasks'); return []; }
  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var result = data.filter(function(r){ return String(r[10] || '') !== '1'; })
                     .reverse()
                     .map(function(row){ return {
    id: row[0],
    classId: row[1],
    q: JSON.stringify({
      subject: row[2],
      question: row[3],
      type: row[4],
      choices: JSON.parse(row[5] || '[]'),
      difficulty: row[11] || '',
      timeLimit: row[12] || '',
      xpBase: row[13] || '',
      correctAnswer: row[14] || ''
    }),
    selfEval: row[6],
    date: Utilities.formatDate(new Date(row[7]), 'JST', 'yyyy/MM/dd HH:mm'),
    persona: row[8] || '',
    closed: String(row[9] || '').toLowerCase() === 'closed'
  }; });
  putCacheValue_(cacheKey, result, 300);
  console.timeEnd('listTasks');
  return result;
}

function getTaskMap_(teacherCode) {
  var cacheKey = 'taskmap_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return {};
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var rows = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var map = {};
  rows.forEach(function(row) {
    if (String(row[10] || '') === '1') return; // skip draft rows
    var qText = row[3] || '';
    var qObj = { subject: row[2], question: row[3], type: row[4], choices: [] };
    try { qObj.choices = JSON.parse(row[5] || '[]'); } catch (_) { qObj.choices = []; }
    qObj.difficulty = row[11] || '';
    qObj.timeLimit = row[12] || '';
    qObj.xpBase = row[13] || '';
    qObj.correctAnswer = row[14] || '';
    var qStr = JSON.stringify(qObj);
    map[row[0]] = {
      classId: row[1],
      q: qStr,
      selfEval: row[6],
      date: row[7],
      persona: row[8] || '',
      closed: String(row[9] || '').toLowerCase() === 'closed',
      questionText: qText
    };
  });
  putCacheValue_(cacheKey, map, 300);
  return map;
}

function listTasksForClass(teacherCode, grade, classroom) {
  grade = String(grade || '').trim();
  classroom = String(classroom || '').trim();
  var map = getClassIdMap(teacherCode);
  var classId = null;
  Object.keys(map).forEach(function(id) {
    if (map[id] === grade + '-' + classroom) classId = id;
  });
  if (!classId) return [];
  return listTasks(teacherCode).filter(function(t){ return String(t.classId) === String(classId); });
}

/**
 * deleteTask(teacherCode, taskId):
 * 課題一覧シートから指定の行を削除
 */
function deleteTask(teacherCode, taskId) {
  var ss   = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  var idx  = data.indexOf(taskId);
  if (idx >= 0) {
    sheet.deleteRow(idx + 2);
  }
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
}

/**
 * duplicateTask(teacherCode, taskId):
 * 指定した課題を複製して新しいIDで追加
 */
function duplicateTask(teacherCode, taskId) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === taskId) {
      var newId = Utilities.getUuid();
      var classId = data[i][1];
      var subject = data[i][2];
      var question = data[i][3];
      var type = data[i][4];
      var choices = data[i][5];
      var selfEval = data[i][6];
      var persona = data[i][8] || '';
      var status = data[i][9] || '';
      var difficulty = data[i][11] || '';
      var timeLimit = data[i][12] || '';
      var xpBase = data[i][13] || '';
      var correctAnswer = data[i][14] || '';
      sheet.appendRow([newId, classId, subject, question, type, choices, selfEval, new Date(), persona, status, '', difficulty, timeLimit, xpBase, correctAnswer]);
      removeCacheValue_('tasks_' + teacherCode);
      removeCacheValue_('taskmap_' + teacherCode);
      removeCacheValue_('stats_' + teacherCode);
      break;
    }
  }
}

/**
 * getTask(teacherCode, taskId):
 * 指定した課題オブジェクトを返す
 */
function getTask(teacherCode, taskId) {
  var map = getTaskMap_(teacherCode);
  var data = map[taskId];
  if (!data) return null;
  return {
    id: taskId,
    classId: data.classId,
    q: data.q,
    selfEval: data.selfEval,
    date: Utilities.formatDate(new Date(data.date), 'JST', 'yyyy/MM/dd HH:mm'),
    persona: data.persona,
    closed: data.closed
  };
}

/**
 * closeTask(teacherCode, taskId):
 * 課題を完了状態としてマーク
 */
function closeTask(teacherCode, taskId) {
  console.time('closeTask');
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('closeTask'); return; }
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) { console.timeEnd('closeTask'); return; }
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  var idx = ids.indexOf(taskId);
  if (idx >= 0) {
    sheet.getRange(idx + 2, 10).setValue('closed');
  }
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  var subs = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (subs && subs.getLastRow() > 1) {
    var range = subs.getRange(2, 1, subs.getLastRow() - 1, 13);
    var data = range.getValues();
    var bonusMap = {};
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[1] === taskId) {
        if (Number(row[12]) === 1) {
          bonusMap[row[0]] = true;
        }
        row[12] = 1;
      }
    }
    range.setValues(data);
    applyBonusXp_(ss, teacherCode, Object.keys(bonusMap), 5);
  }
  console.timeEnd('closeTask');
}

function applyBonusXp_(ss, teacherCode, ids, amount) {
  if (!ids || ids.length === 0) return;
  var sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return;

  var lastRow = (typeof sheet.getLastRow === 'function') ?
                   sheet.getLastRow() :
                   (sheet.getDataRange().getValues().length);
  if (lastRow < 2) return;

  var range = sheet.getRange(2, 1, lastRow - 1, 9);
  var data = range.getValues();
  var rowMap = {};
  for (var i = 0; i < data.length; i++) {
    var id = String(data[i][0] || '').trim();
    if (id) rowMap[id] = i;
  }

  ids.forEach(function(id) {
    var idx = rowMap[id];
    if (idx !== undefined) {
      var row = data[idx];
      var total = Number(row[7] || 0) + amount;
      row[7] = total;
      row[8] = calcLevelFromXp_(total);
    }
  });

  range.setValues(data);
}

function calcLevelFromXp_(totalXp) {
  var level = 1;
  var xp = totalXp;
  while (xp >= level * 100) {
    xp -= level * 100;
    level++;
  }
  return level;
}

/**
 * getRecommendedTask(teacherCode, studentId):
 * その生徒の“未回答”最新タスクを返す
 */
function getRecommendedTask(teacherCode, studentId) {
  studentId = String(studentId || '').trim();
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return null;
  var tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) return null;

  var parts = studentId.split('-');
  var classId = null;
  if (parts.length >= 2) {
    var map = getClassIdMap(teacherCode);
    Object.keys(map).forEach(function(id) {
      if (map[id] === parts[0] + '-' + parts[1]) classId = id;
    });
  }

  var answeredIds = [];
  var subsSheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (subsSheet && subsSheet.getLastRow() > 1) {
    var data = subsSheet.getRange(2, 1, subsSheet.getLastRow() - 1, 13).getValues();
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[0] === studentId && row[4]) {
        answeredIds.push(row[1]);
      }
    }
  }

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (t.closed) continue;
    if (classId && String(t.classId) !== String(classId)) continue;
    if (!answeredIds.includes(t.id)) {
      return { id: t.id, q: t.q, selfEval: t.selfEval };
    }
  }
  return null;
}

/**
 * submitAnswer(teacherCode, studentId, taskId, answer, earnedXp, totalXp,
 *              level, trophies, aiCalls, attemptCount,
 *              startAt, submitAt, productUrl, qSummary, aSummary):
 * 生徒シートへの回答記録＆全体ログへの追記
 */
function submitAnswer(teacherCode, studentId, taskId, answer,
                      earnedXp, totalXp, level, trophies,
                      aiCalls, attemptCount,
                      startAt, submitAt, productUrl, qSummary, aSummary) {
  console.time('submitAnswer');
  studentId = String(studentId || '').trim();
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('回答送信エラー: 教師の設定ファイルが見つかりません。');
  }
  var taskMap = getTaskMap_(teacherCode);
  var info = taskMap[taskId];
  var questionText = info ? info.questionText : '';
  var startTime  = startAt ? new Date(startAt) : new Date();
  var submitTime = submitAt ? new Date(submitAt) : new Date();
  removeCacheValue_('history_' + teacherCode + '_' + studentId);

  var globalAnswerSheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (globalAnswerSheet) {
    var questionSummary = qSummary || questionText;
    if (typeof questionSummary === 'string' && questionSummary.length > 50) {
      questionSummary = questionSummary.substring(0, 50) + '...';
    }
    var answerSummary = aSummary || answer;
    if (typeof answerSummary === 'string' && answerSummary.length > 50) {
      answerSummary = answerSummary.substring(0, 50) + '...';
    }
    globalAnswerSheet.appendRow([
      studentId,
      taskId,
      questionText,
      startTime,
      submitTime,
      productUrl || '',
      questionSummary,
      answerSummary,
      earnedXp,
      totalXp,
      level,
      trophies || '',
      1
      ]);
  } else {
    console.warn(`「${CONSTS.SHEET_SUBMISSIONS}」シートが見つかりません。`);
  }
  console.timeEnd('submitAnswer');
}

/**
 * saveDraftTask(teacherCode, payloadJson):
 * 下書きとして課題を保存
 */
function saveDraftTask(teacherCode, taskObj) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('ドラフト保存失敗: 教師のスプレッドシートが見つかりません。');
  }
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) {
    throw new Error(`システムエラー: 「${CONSTS.SHEET_TASKS}」シートが見つかりません。`);
  }
  var id = Utilities.getUuid();
  var obj = taskObj || {};
  var classId = obj.classId || '';
  var choices = Array.isArray(obj.choices) ? JSON.stringify(obj.choices) : '';
  sheet.appendRow([id, classId, obj.subject || '', obj.question || '', obj.type || '', choices, '', new Date(), '', obj.status || '', 1, obj.difficulty || '', obj.timeLimit || '', obj.xpBase || '', obj.correctAnswer || '']);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  return id;
}

/**
 * deleteDraftTask(teacherCode, taskId):
 * draft=1 の行のみ削除
 */
function deleteDraftTask(teacherCode, taskId) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  var last = sheet.getLastRow();
  if (last < 2) return;
  var data = sheet.getRange(2, 1, last - 1, 15).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === taskId && String(data[i][10] || '') === '1') {
      sheet.deleteRow(i + 2);
      removeCacheValue_('tasks_' + teacherCode);
      removeCacheValue_('taskmap_' + teacherCode);
      break;
    }
  }
}

/**
 * getLatestActiveTaskId(teacherCode):
 * 現在公開中の最新課題IDを返す
 */
function getLatestActiveTaskId(teacherCode) {
  var cacheKey = 'latestActiveTask_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  var tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) return null;
  for (var i = 0; i < tasks.length; i++) {
    if (!tasks[i].closed) {
      putCacheValue_(cacheKey, tasks[i].id, 30);
      return tasks[i].id;
    }
  }
  return null;
}

/**
 * updateTask(teacherCode, taskId, updateData):
 * 指定タスクの情報を更新する
 */
function updateTask(teacherCode, taskId, updateData) {
  taskId = String(taskId || '').trim();
  if (!taskId) return { status: 'error', message: 'invalid_id' };
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return { status: 'error', message: 'no_sheet' };
  var sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return { status: 'error', message: 'no_sheet' };
  var ids = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow()-1), 1).getValues().flat();
  var idx = ids.indexOf(taskId);
  if (idx < 0) return { status: 'error', message: 'not_found' };
  var row = sheet.getRange(idx+2, 1, 1, 11).getValues()[0];
  if (updateData && typeof updateData.status !== 'undefined') {
    row[9] = updateData.status;
  }
  sheet.getRange(idx+2, 1, 1, 11).setValues([row]);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  return { status: 'ok' };
}
