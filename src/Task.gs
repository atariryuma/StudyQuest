/**
 * createTask(teacherCode, taskObj, selfEval):
 * 新しい課題を課題一覧シートに追加
 */

function createTask(teacherCode, taskObj, selfEval) {
  console.time('createTask');
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error("課題作成失敗: 教師のスプレッドシートが見つかりません。");
  }
  const taskSheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!taskSheet) {
    throw new Error(`システムエラー: 「${CONSTS.SHEET_TASKS}」シートが見つかりません。`);
  }
  var parsed = taskObj || null;

  if (parsed && Array.isArray(parsed.classIds)) {
    const rows = parsed.classIds.map(function(cid) {
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
        '',
        ''
      ];
    });
    bulkAppend_(taskSheet, rows);
    removeCacheValue_('tasks_' + teacherCode);
    removeCacheValue_('taskmap_' + teacherCode);
    removeCacheValue_('stats_' + teacherCode);
    console.timeEnd('createTask');
    return;
  }

  const taskId = Utilities.getUuid();
  const classId = parsed && parsed.classId ? parsed.classId : '';
  taskSheet.appendRow([taskId, classId, payloadAsJson, selfEval, new Date(), '', '', '']);
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
  const cacheKey = 'tasks_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) { console.timeEnd('listTasks'); return cached; }

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('listTasks'); return []; }
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) { console.timeEnd('listTasks'); return []; }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.timeEnd('listTasks'); return []; }
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const result = data.filter(function(r){ return String(r[10] || '') !== '1'; })
                     .reverse()
                     .map(row => ({
    id: row[0],
    classId: row[1],
    q: JSON.stringify({ subject: row[2], question: row[3], type: row[4], choices: JSON.parse(row[5] || '[]') }),
    selfEval: row[6],
    date: Utilities.formatDate(new Date(row[7]), 'JST', 'yyyy/MM/dd HH:mm'),
    persona: row[8] || '',
    closed: String(row[9] || '').toLowerCase() === 'closed'
  }));
  putCacheValue_(cacheKey, result, 300);
  console.timeEnd('listTasks');
  return result;
}

function getTaskMap_(teacherCode) {
  const cacheKey = 'taskmap_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return {};
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const map = {};
  rows.forEach(row => {
    if (String(row[10] || '') === '1') return; // skip draft rows
    var qText = row[3] || '';
    var qObj = { subject: row[2], question: row[3], type: row[4], choices: [] };
    try { qObj.choices = JSON.parse(row[5] || '[]'); } catch (_) { qObj.choices = []; }
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
  const map = getClassIdMap(teacherCode);
  let classId = null;
  Object.keys(map).forEach(id => {
    if (map[id] === `${grade}-${classroom}`) classId = id;
  });
  if (!classId) return [];
  return listTasks(teacherCode).filter(t => String(t.classId) === String(classId));
}

/**
 * deleteTask(teacherCode, taskId):
 * 課題一覧シートから指定の行を削除
 */
function deleteTask(teacherCode, taskId) {
  const ss   = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const idx  = data.indexOf(taskId);
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const data = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === taskId) {
      const newId = Utilities.getUuid();
      const classId = data[i][1];
      const subject = data[i][2];
      const question = data[i][3];
      const type = data[i][4];
      const choices = data[i][5];
      const selfEval = data[i][6];
      const persona = data[i][8] || '';
      sheet.appendRow([newId, classId, subject, question, type, choices, selfEval, new Date(), persona, '', '']);
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
  const map = getTaskMap_(teacherCode);
  const data = map[taskId];
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) { console.timeEnd('closeTask'); return; }
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) { console.timeEnd('closeTask'); return; }
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const idx = ids.indexOf(taskId);
  if (idx >= 0) {
    sheet.getRange(idx + 2, 10).setValue('closed');
  }
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  const subs = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (subs && subs.getLastRow() > 1) {
    const range = subs.getRange(2, 1, subs.getLastRow() - 1, 13);
    const data = range.getValues();
    const bonusMap = {};
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
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
  const sheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  if (!sheet) return;

  const lastRow = (typeof sheet.getLastRow === 'function') ?
                   sheet.getLastRow() :
                   (sheet.getDataRange().getValues().length);
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 1, lastRow - 1, 9);
  const data = range.getValues();
  const rowMap = {};
  for (let i = 0; i < data.length; i++) {
    const id = String(data[i][0] || '').trim();
    if (id) rowMap[id] = i;
  }

  ids.forEach(id => {
    const idx = rowMap[id];
    if (idx !== undefined) {
      const row = data[idx];
      const total = Number(row[7] || 0) + amount;
      row[7] = total;
      row[8] = calcLevelFromXp_(total);
    }
  });

  range.setValues(data);
}

function calcLevelFromXp_(totalXp) {
  let level = 1;
  let xp = totalXp;
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return null;
  const tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) return null;

  const parts = studentId.split('-');
  let classId = null;
  if (parts.length >= 2) {
    const map = getClassIdMap(teacherCode);
    Object.keys(map).forEach(id => {
      if (map[id] === `${parts[0]}-${parts[1]}`) classId = id;
    });
  }

  const answeredIds = [];
  const subsSheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (subsSheet && subsSheet.getLastRow() > 1) {
    const data = subsSheet.getRange(2, 1, subsSheet.getLastRow() - 1, 13).getValues();
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (row[0] === studentId && row[4]) {
        answeredIds.push(row[1]);
      }
    }
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('回答送信エラー: 教師の設定ファイルが見つかりません。');
  }
  const taskMap = getTaskMap_(teacherCode);
  const info = taskMap[taskId];
  const questionText = info ? info.questionText : '';
  const startTime  = startAt ? new Date(startAt) : new Date();
  const submitTime = submitAt ? new Date(submitAt) : new Date();
  removeCacheValue_('history_' + teacherCode + '_' + studentId);

  const globalAnswerSheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  if (globalAnswerSheet) {
    let questionSummary = qSummary || questionText;
    if (typeof questionSummary === 'string' && questionSummary.length > 50) {
      questionSummary = questionSummary.substring(0, 50) + '...';
    }
    let answerSummary = aSummary || answer;
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('ドラフト保存失敗: 教師のスプレッドシートが見つかりません。');
  }
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) {
    throw new Error(`システムエラー: 「${CONSTS.SHEET_TASKS}」シートが見つかりません。`);
  }
  const id = Utilities.getUuid();
  var obj = taskObj || {};
  var classId = obj.classId || '';
  var choices = Array.isArray(obj.choices) ? JSON.stringify(obj.choices) : '';
  sheet.appendRow([id, classId, obj.subject || '', obj.question || '', obj.type || '', choices, '', new Date(), '', '', 1]);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  return id;
}

/**
 * deleteDraftTask(teacherCode, taskId):
 * draft=1 の行のみ削除
 */
function deleteDraftTask(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return;
  const last = sheet.getLastRow();
  if (last < 2) return;
  const data = sheet.getRange(2, 1, last - 1, 11).getValues();
  for (let i = 0; i < data.length; i++) {
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
  const cacheKey = 'latestActiveTask_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) return null;
  for (let i = 0; i < tasks.length; i++) {
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return { status: 'error', message: 'no_sheet' };
  const sheet = ss.getSheetByName(CONSTS.SHEET_TASKS);
  if (!sheet) return { status: 'error', message: 'no_sheet' };
  const ids = sheet.getRange(2, 1, Math.max(0, sheet.getLastRow()-1), 1).getValues().flat();
  const idx = ids.indexOf(taskId);
  if (idx < 0) return { status: 'error', message: 'not_found' };
  const row = sheet.getRange(idx+2, 1, 1, 11).getValues()[0];
  if (updateData && typeof updateData.status !== 'undefined') {
    row[9] = updateData.status;
  }
  sheet.getRange(idx+2, 1, 1, 11).setValues([row]);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('taskmap_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  return { status: 'ok' };
}
