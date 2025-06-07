/**
 * createTask(teacherCode, payloadAsJson, selfEval):
 * 新しい課題を課題一覧シートに追加
 */
function createTask(teacherCode, payloadAsJson, selfEval, persona) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error("課題作成失敗: 教師のスプレッドシートが見つかりません。");
  }
  const taskSheet = ss.getSheetByName(SHEET_TASKS);
  if (!taskSheet) {
    throw new Error(`システムエラー: 「${SHEET_TASKS}」シートが見つかりません。`);
  }
  const taskId = Utilities.getUuid();
  taskSheet.appendRow([taskId, payloadAsJson, selfEval, new Date(), persona || '']);
}

/**
 * listTasks(teacherCode):
 * 課題一覧を最新→過去の順で返す
 */
function listTasks(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  return data.reverse().map(row => ({
    id: row[0],
    q: row[1],
    selfEval: row[2],
    date: Utilities.formatDate(new Date(row[3]), 'JST', 'yyyy/MM/dd HH:mm'),
    persona: row[4] || ''
  }));
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
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === taskId) {
      const newId = Utilities.getUuid();
      const payload = data[i][1];
      const selfEval = data[i][2];
      const persona = data[i][4] || '';
      sheet.appendRow([newId, payload, selfEval, new Date(), persona]);
      break;
    }
  }
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
    if (!answeredIds.includes(t.id)) {
      return { id: t.id, q: t.q, selfEval: t.selfEval };
    }
  }
  return null;
}

/**
 * submitAnswer(teacherCode, studentId, taskId, answer, earnedXp, totalXp, level, trophies, aiCalls, attemptCount):
 * 生徒シートへの回答記録＆全体ログへの追記
 */
function submitAnswer(teacherCode, studentId, taskId, answer, earnedXp, totalXp, level, trophies, aiCalls, attemptCount) {
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
            const parsedQ = JSON.parse(allTasks[j][1]);
            questionText = parsedQ.question || allTasks[j][1];
          } catch (e) {
            questionText = allTasks[j][1];
          }
          break;
        }
      }
    }
  studentSheet.appendRow([new Date(), taskId, questionText, answer, earnedXp, totalXp, level, trophies || '', attemptCount]);

  // 全体ログにも追記
  const globalAnswerSheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (globalAnswerSheet) {
    let answerSummary = answer;
    if (typeof answer === 'string' && answer.length > 50) {
      answerSummary = answer.substring(0, 50) + '...';
    }
    globalAnswerSheet.appendRow([new Date(), studentId, taskId, answerSummary, earnedXp, totalXp, level, trophies || '', aiCalls, attemptCount]);
  } else {
    console.warn(`「${SHEET_SUBMISSIONS}」シートが見つかりません。`);
  }

}
