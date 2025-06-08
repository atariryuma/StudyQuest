/**
 * createTask(teacherCode, payloadAsJson, selfEval):
 * 新しい課題を課題一覧シートに追加
 */
if (typeof removeCacheValue_ !== 'function') {
  function getCacheValue_() { return null; }
  function putCacheValue_() {}
  function removeCacheValue_() {}
}

function createTask(teacherCode, payloadAsJson, selfEval, persona) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error("課題作成失敗: 教師のスプレッドシートが見つかりません。");
  }
  const taskSheet = ss.getSheetByName(SHEET_TASKS);
  if (!taskSheet) {
    throw new Error(`システムエラー: 「${SHEET_TASKS}」シートが見つかりません。`);
  }
  let parsed;
  try {
    parsed = JSON.parse(payloadAsJson);
  } catch (e) {
    parsed = null;
  }

  if (parsed && Array.isArray(parsed.classIds)) {
    parsed.classIds.forEach(cid => {
      const rowPayload = JSON.stringify(Object.assign({}, parsed, { classId: cid }));
      taskSheet.appendRow([Utilities.getUuid(), cid, rowPayload, selfEval, new Date(), persona || '', '', '']);
    });
    removeCacheValue_('tasks_' + teacherCode);
    removeCacheValue_('stats_' + teacherCode);
    return;
  }

  const taskId = Utilities.getUuid();
  const classId = parsed && parsed.classId ? parsed.classId : '';
  taskSheet.appendRow([taskId, classId, payloadAsJson, selfEval, new Date(), persona || '', '', '']);
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
}

/**
 * listTasks(teacherCode):
 * 課題一覧を最新→過去の順で返す
 */
function listTasks(teacherCode) {
  const cacheKey = 'tasks_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const result = data.filter(r => String(r[7] || '') !== '1')
                     .reverse()
                     .map(row => ({
    id: row[0],
    classId: row[1],
    q: row[2],
    selfEval: row[3],
    date: Utilities.formatDate(new Date(row[4]), 'JST', 'yyyy/MM/dd HH:mm'),
    persona: row[5] || '',
    closed: String(row[6] || '').toLowerCase() === 'closed'
  }));
  putCacheValue_(cacheKey, result, 300);
  return result;
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
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return;
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const idx  = data.indexOf(taskId);
  if (idx >= 0) {
    sheet.deleteRow(idx + 2);
  }
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
}

/**
 * duplicateTask(teacherCode, taskId):
 * 指定した課題を複製して新しいIDで追加
 */
function duplicateTask(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === taskId) {
      const newId = Utilities.getUuid();
      const classId = data[i][1];
      const payload = data[i][2];
      const selfEval = data[i][3];
      const persona = data[i][5] || '';
      sheet.appendRow([newId, classId, payload, selfEval, new Date(), persona, '', '']);
      removeCacheValue_('tasks_' + teacherCode);
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
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return null;
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === taskId && String(data[i][7] || '') !== '1') {
      return {
        id: data[i][0],
        classId: data[i][1],
        q: data[i][2],
        selfEval: data[i][3],
        date: Utilities.formatDate(new Date(data[i][4]), 'JST', 'yyyy/MM/dd HH:mm'),
        persona: data[i][5] || '',
        closed: String(data[i][6] || '').toLowerCase() === 'closed'
      };
    }
  }
  return null;
}

/**
 * closeTask(teacherCode, taskId):
 * 課題を完了状態としてマーク
 */
function closeTask(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const idx = ids.indexOf(taskId);
  if (idx >= 0) {
    sheet.getRange(idx + 2, 7).setValue('closed');
  }
  removeCacheValue_('tasks_' + teacherCode);
  removeCacheValue_('stats_' + teacherCode);
  const subs = ss.getSheetByName(SHEET_SUBMISSIONS);
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
    Object.keys(bonusMap).forEach(id => giveBonusXp_(ss, id, 5));
  }
}

function giveBonusXp_(ss, studentId, amount) {
  const sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === studentId) {
      const total = Number(data[i][7] || 0) + amount;
      sheet.getRange(i + 1, 8, 1, 2)
           .setValues([[total, calcLevelFromXp_(total)]]);
      break;
    }
  }
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

  const studentSheet = findStudentSheet_(ss, studentId);
  const answeredIds      = [];
  if (studentSheet) {
    const data = studentSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowTaskId  = data[i][1]; // 2列目: 課題ID
      const answerText = data[i][3]; // 4列目: 回答
      if (rowTaskId && answerText && answerText.toString().trim() !== '') {
        answeredIds.push(rowTaskId);
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
  studentId = String(studentId || '').trim();
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('回答送信エラー: 教師の設定ファイルが見つかりません。');
  }
  const studentSheet = findStudentSheet_(ss, studentId);
  if (!studentSheet) {
    throw new Error(`回答送信エラー: 生徒「${studentId}」の専用シートが見つかりません。`);
  }

  // 常に新規行追加
  let questionText = '';
  const taskSheet = ss.getSheetByName(SHEET_TASKS);
  if (taskSheet) {
    const allTasks = taskSheet.getDataRange().getValues();
    for (let j = 1; j < allTasks.length; j++) {
      if (allTasks[j][0] === taskId) {
        try {
          const parsedQ = JSON.parse(allTasks[j][2]);
          questionText = parsedQ.question || allTasks[j][2];
        } catch (e) {
          questionText = allTasks[j][2];
        }
        break;
      }
    }
  }
  const startTime  = startAt ? new Date(startAt) : new Date();
  const submitTime = submitAt ? new Date(submitAt) : new Date();
  studentSheet.appendRow([submitTime, taskId, questionText, answer,
                          earnedXp, totalXp, level, trophies || '', attemptCount]);
  removeCacheValue_('history_' + teacherCode + '_' + studentId);

  // 全体ログにも追記
  const globalAnswerSheet = ss.getSheetByName(SHEET_SUBMISSIONS);
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
    console.warn(`「${SHEET_SUBMISSIONS}」シートが見つかりません。`);
  }

}

/**
 * saveDraftTask(teacherCode, payloadJson):
 * 下書きとして課題を保存
 */
function saveDraftTask(teacherCode, payloadJson) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('ドラフト保存失敗: 教師のスプレッドシートが見つかりません。');
  }
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) {
    throw new Error(`システムエラー: 「${SHEET_TASKS}」シートが見つかりません。`);
  }
  const id = Utilities.getUuid();
  let classId = '';
  try {
    const obj = JSON.parse(payloadJson);
    classId = obj.classId || '';
  } catch (e) {}
  sheet.appendRow([id, classId, payloadJson, '', new Date(), '', '', 1]);
  removeCacheValue_('tasks_' + teacherCode);
  return id;
}

/**
 * deleteDraftTask(teacherCode, taskId):
 * draft=1 の行のみ削除
 */
function deleteDraftTask(teacherCode, taskId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return;
  const last = sheet.getLastRow();
  if (last < 2) return;
  const data = sheet.getRange(2, 1, last - 1, 8).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === taskId && String(data[i][7] || '') === '1') {
      sheet.deleteRow(i + 2);
      removeCacheValue_('tasks_' + teacherCode);
      break;
    }
  }
}

/**
 * getLatestActiveTaskId(teacherCode):
 * 現在公開中の最新課題IDを返す
 */
function getLatestActiveTaskId(teacherCode) {
  const tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) return null;
  for (let i = 0; i < tasks.length; i++) {
    if (!tasks[i].closed) return tasks[i].id;
  }
  return null;
}
