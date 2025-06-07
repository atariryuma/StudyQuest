// ================================================
// StudyQuest – バックエンド全コード（最終版）
// ================================================

// シート名定数
const SHEET_TOC             = '📜 目次';
const SHEET_TASKS           = '課題一覧';
const SHEET_STUDENTS        = '生徒一覧';
const SHEET_GLOBAL_ANSWERS  = '回答ログ（全体ボード用）';
const SHEET_AI_FEEDBACK     = 'AIフィードバックログ';
const STUDENT_SHEET_PREFIX  = '生徒_'; // 生徒_<ID> 形式の個別シートを想定
const FOLDER_NAME_PREFIX    = 'StudyQuest_';
const TEACHER_DATA_FOLDER   = 'teacher_data';
const STUDENT_DATA_FOLDER   = 'student_data';
const SQ_VERSION           = 'v1.0.5';

/**
 * doGet(e): テンプレートにパラメータを埋め込んで返す
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  template.scriptUrl   = ScriptApp.getService().getUrl();
  template.teacher     = (e && e.parameter && e.parameter.teacher)   ? e.parameter.teacher   : '';
  template.grade       = (e && e.parameter && e.parameter.grade)     ? e.parameter.grade     : '';
  template.classroom   = (e && e.parameter && e.parameter['class'])  ? e.parameter['class']  : '';
  template.number      = (e && e.parameter && e.parameter.number)    ? e.parameter.number    : '';
  template.version     = getSqVersion();
  return template
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('StudyQuest');
}

/**
 * generateTeacherCode(): 6桁英数字のユニークな教師コードを生成
 */
function generateTeacherCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(code)) {
    return generateTeacherCode();
  }
  return code;
}

/**
 * findLatestFolderByName_(name):
 * 同名フォルダが複数ある場合、作成日が最新のものを返す
 */
function findLatestFolderByName_(name) {
  const iter = DriveApp.getFoldersByName(name);
  if (!iter.hasNext()) return null;
  let latest = null;
  let date   = null;
  while (iter.hasNext()) {
    const f = iter.next();
    const d = f.getDateCreated();
    if (!date || d > date) {
      date = d;
      latest = f;
    }
  }
  return latest;
}

/**
 * initTeacher(passcode):
 * 教師用初回ログイン or 2回目以降の判定 → スプレッドシートを生成 or 取得
 */
function initTeacher(passcode) {
  if (passcode !== 'kyoushi') {
    return { status: 'error', message: 'パスコードが違います。' };
  }
  const props = PropertiesService.getScriptProperties();
  const existingCodes = props.getKeys().filter(key => key.match(/^[A-Z0-9]{6}$/));
  let foundCode = null;
  let foundDate = null;
  existingCodes.forEach(code => {
    const folder = findLatestFolderByName_(FOLDER_NAME_PREFIX + code);
    if (folder) {
      const d = folder.getDateCreated();
      if (!foundDate || d > foundDate) {
        foundDate = d;
        foundCode = code;
      }
    }
  });
  if (foundCode) {
    return { status: 'ok', teacherCode: foundCode };
  }
  // 新規作成
  const newCode        = generateTeacherCode();
  const folderName     = FOLDER_NAME_PREFIX + newCode;
  const folderInstance = DriveApp.createFolder(folderName);

  const ss     = SpreadsheetApp.create(`StudyQuest_${newCode}_Log`);
  const ssFile = DriveApp.getFileById(ss.getId());
  folderInstance.addFile(ssFile);
  DriveApp.getRootFolder().removeFile(ssFile);

  // 目次シート作成
  const tocSheet = ss.getSheets()[0];
  tocSheet.setName(SHEET_TOC);
  tocSheet.clear();
  tocSheet.appendRow(['StudyQuest データシート']);
  tocSheet.getRange('A1').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  tocSheet.setColumnWidth(1, 200);
  tocSheet.setColumnWidth(2, 400);

  // 各シートの初期化
  const sheetInfos = [
    {
      name: SHEET_TASKS,
      color: "ff9900",
      header: ['ID', '問題データ(JSON)', '自己評価許可', '作成日時', 'ペルソナ'],
      description: "作成された課題の一覧です。"
    },
    {
      name: SHEET_STUDENTS,
      color: "4285f4",
      header: ['生徒ID', '学年', '組', '番号', '初回ログイン日時'],
      description: "ログインした生徒の情報が記録されます。"
    },
    {
      name: SHEET_GLOBAL_ANSWERS,
      color: "008080",
      header: ['日時', '生徒ID', '課題ID', '回答概要', '付与XP', '累積XP', 'レベル', 'トロフィー', 'AI呼び出し回数', '回答回数'],
      description: "全生徒の回答の概要（ボード表示用）です。"
    },
    {
      name: SHEET_AI_FEEDBACK,
      color: "ff4444",
      header: ['日時', '生徒ID', '課題ID', '回答回数', 'AI呼び出し回数', '回答本文', 'フィードバック内容'],
      description: "Gemini API からのフィードバックログです。"
    }
  ];
  tocSheet.appendRow(['']);
  tocSheet.appendRow(['主要シート一覧']);
  tocSheet.getRange('A3').setFontWeight('bold');
  const spreadsheetUrl = ss.getUrl();
  sheetInfos.forEach(info => {
    const sheet = ss.insertSheet(info.name);
    sheet.appendRow(info.header);
    sheet.setTabColor(info.color);
    const linkFormula = `=HYPERLINK("${spreadsheetUrl}#gid=${sheet.getSheetId()}","${info.name}")`;
    tocSheet.appendRow([linkFormula, info.description]);
  });
  tocSheet.appendRow(['']);
  tocSheet.appendRow(['生徒の個別回答ログ']);
  tocSheet.getRange(tocSheet.getLastRow(), 1).setFontWeight('bold');
  tocSheet.appendRow([
    `各生徒の回答は、ログイン時に自動作成される「${STUDENT_SHEET_PREFIX}（生徒ID）」という名前の個別シートに記録されます。`,
    ''
  ]);
  tocSheet.getRange("A1").mergeAcross();
  tocSheet.autoResizeColumn(1);
  tocSheet.autoResizeColumn(2);

  props.setProperty(newCode, ss.getId());
  return {
    status: 'new',
    teacherCode: newCode,
    message: `初回ログインありがとうございます。Drive 上に「${folderName}」フォルダとスプレッドシートを作成しました。`
  };
}

/**
 * getSpreadsheetByTeacherCode(teacherCode):
 * スクリプトプロパティから SS ID を取得し、Spreadsheet を開く
 */
function getSpreadsheetByTeacherCode(teacherCode) {
  if (!teacherCode) return null;
  const props = PropertiesService.getScriptProperties();
  const ssId  = props.getProperty(teacherCode);
  if (!ssId) return null;
  try {
    return SpreadsheetApp.openById(ssId);
  } catch (e) {
    console.error(`スプレッドシートが開けません: Code=${teacherCode}, ID=${ssId}。エラー: ${e.message}`);
    return null;
  }
}

/**
 * findStudentSheet_(ss, studentId):
 * 学年・組・番号の組み合わせから既存シートを柔軟に探索し、
 * 必要に応じて正規化した名前へリネームして返す
 */
function findStudentSheet_(ss, studentId) {
  studentId = String(studentId || '').trim();
  if (!ss || !studentId) return null;

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
  const studentListData = studentListSheet.getDataRange().getValues();
  let studentRowIndex = -1;
  for (let i = 1; i < studentListData.length; i++) {
    const idVal = String(studentListData[i][0] || '').trim();
    if (idVal === studentId) {
      studentRowIndex = i;
      break;
    }
  }
  if (studentRowIndex === -1) {
    studentListSheet.appendRow([studentId, grade, classroom, number, new Date()]);
  } else if (studentListData[studentRowIndex][0] !== studentId) {
    studentListSheet.getRange(studentRowIndex + 1, 1).setValue(studentId);
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
    studentSheet.appendRow(['日時', '課題ID', '課題内容', '回答本文', '付与XP', '累積XP', 'レベル', 'トロフィー', '回答回数']);
    studentSheet.setTabColor("f4b400");

    // 生徒用 Drive フォルダ作成
    const stuFolderName = `StudyQuest_Stu_${teacherCode}_${studentId}`;
    let stuFolder = findLatestFolderByName_(stuFolderName);
    if (!stuFolder) {
      stuFolder = DriveApp.createFolder(stuFolderName);
      stuFolder.createFile(`Responses_${studentId}.csv`, 'timestamp,taskId,answer');
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
        const taskData = taskSheet.getRange(2, 1, lastRow - 1, 5).getValues();
        taskData.forEach(row => {
          const taskId        = row[0];
          const payloadAsJson = row[1];
          const createdAt     = row[3]; // 作成日時
          let questionText    = '';
          try {
            const parsed = JSON.parse(payloadAsJson);
            questionText = parsed.question || payloadAsJson;
          } catch (e) {
            questionText = payloadAsJson;
          }
          studentSheet.appendRow([createdAt, taskId, questionText, '', 0, 0, 0, '', 0]);
        });
      }
    }
  }

  return { status: 'ok' };
}

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
  const globalAnswerSheet = ss.getSheetByName(SHEET_GLOBAL_ANSWERS);
  if (globalAnswerSheet) {
    let answerSummary = answer;
    if (typeof answer === 'string' && answer.length > 50) {
      answerSummary = answer.substring(0, 50) + '...';
    }
    globalAnswerSheet.appendRow([new Date(), studentId, taskId, answerSummary, earnedXp, totalXp, level, trophies || '', aiCalls, attemptCount]);
  } else {
    console.warn(`「${SHEET_GLOBAL_ANSWERS}」シートが見つかりません。`);
  }
}

/**
 * getStudentHistory(teacherCode, studentId):
 * 生徒シートからその生徒の提出履歴を取得 → 必ず配列 [] を返す
 */
function getStudentHistory(teacherCode, studentId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  studentId = String(studentId || '').trim();
  const sheet = ss.getSheetByName(STUDENT_SHEET_PREFIX + studentId);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // [日時, 課題ID, 質問, 回答, 付与XP, 累積XP, レベル, トロフィー, 回答回数]
    rows.push([row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]]);
  }
  return rows; // たとえ空でも [] を返す
}

/**
 * listBoard(teacherCode):
 * 全体回答ログを最新30件返す（他ページ用）
 */
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

/**
 * callGeminiAPI_GAS(prompt, persona): Gemini API を呼び出してフィードバックを取得
 */
function callGeminiAPI_GAS(prompt, persona) {
  const personaMap = {
    '小学生向け': 'あなたは小学校高学年以上向けの優しい先生です。',
    '中学生向け': 'あなたは中学生向けの適切な言葉遣いをする先生です。',
    '教師向け':   'あなたは現役教師が使用するプロンプト形式です。'
  };
  const base = personaMap[persona] || '';
  const finalPrompt = base + '\n' + prompt;
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return 'APIキーが設定されていません';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
  const payload = { contents: [{ parts: [{ text: finalPrompt }] }] };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const obj = JSON.parse(res.getContentText());
  if (obj.candidates && obj.candidates[0] && obj.candidates[0].content) {
    return obj.candidates[0].content.parts.map(p => p.text).join('\n');
  }
  return 'No response';
}

/**
 * logToSpreadsheet(logData): AIフィードバックログを記録
 */
function logToSpreadsheet(logData) {
  const ss = getSpreadsheetByTeacherCode(logData.teacherCode);
  if (!ss) return;
  const sheet = ss.getSheetByName(SHEET_AI_FEEDBACK);
  if (!sheet) return;
  sheet.appendRow([
    new Date(),
    logData.studentId,
    logData.taskId,
    logData.attempt,
    logData.aiCalls,
    logData.answer || '',
    logData.feedback || ''
  ]);
}

/**
 * overwriteFile_(folder, name, content, mimeType):
 * 同名ファイルを削除して新規作成するユーティリティ
 */
function overwriteFile_(folder, name, content, mimeType) {
  const iter = folder.getFilesByName(name);
  while (iter.hasNext()) {
    iter.next().setTrashed(true);
  }
  folder.createFile(name, content, mimeType || MimeType.PLAIN_TEXT);
}

/**
 * convertRangeToCsv_(range): Range を CSV 文字列に変換
 */
function convertRangeToCsv_(range) {
  const values = range.getValues();
  return values
    .map(row =>
      row
        .map(val => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (/[,"\n]/.test(str)) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}

/**
 * convertRangeToJson_(sheet): シートのデータを配列オブジェクト化
 */
function convertRangeToJson_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const result = [];
  for (let i = 1; i < values.length; i++) {
    const rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[i][j];
    }
    result.push(rowObj);
  }
  return result;
}

/**
 * getTeacherRootFolder(teacherCode): 教師用ルートフォルダを取得
 */
function getTeacherRootFolder(teacherCode) {
  const name = FOLDER_NAME_PREFIX + teacherCode;
  const folder = findLatestFolderByName_(name);
  return folder || DriveApp.createFolder(name);
}

/**
 * getClassFolder(teacherCode, classId): クラス用フォルダ取得/作成
 */
function getClassFolder(teacherCode, classId) {
  const root = getTeacherRootFolder(teacherCode);
  const tIter = root.getFoldersByName(TEACHER_DATA_FOLDER);
  const teacherData = tIter.hasNext() ? tIter.next() : root.createFolder(TEACHER_DATA_FOLDER);
  const cName = 'class_' + classId;
  const cIter = teacherData.getFoldersByName(cName);
  return cIter.hasNext() ? cIter.next() : teacherData.createFolder(cName);
}

/**
 * exportClassCache(teacherCode, classId, spreadsheetId): シートを CSV/JSON で保存
 */
function exportClassCache(teacherCode, classId, spreadsheetId) {
  const folder = getClassFolder(teacherCode, classId);
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('データシート');
  if (!sheet) return;
  const csv = convertRangeToCsv_(sheet.getDataRange());
  const json = convertRangeToJson_(sheet);
  overwriteFile_(folder, 'data.csv', csv, MimeType.CSV);
  overwriteFile_(folder, 'data.json', JSON.stringify(json));
}

/**
 * exportSummary(teacherCode): 全クラス統合 CSV 作成
 */
function exportSummary(teacherCode) {
  const root = getTeacherRootFolder(teacherCode);
  const tIter = root.getFoldersByName(TEACHER_DATA_FOLDER);
  if (!tIter.hasNext()) return;
  const teacherData = tIter.next();
  const allData = [];
  const classFolders = teacherData.getFolders();
  while (classFolders.hasNext()) {
    const f = classFolders.next();
    const csvFileIter = f.getFilesByName('data.csv');
    if (!csvFileIter.hasNext()) continue;
    const rows = Utilities.parseCsv(csvFileIter.next().getBlob().getDataAsString());
    const classId = f.getName();
    rows.slice(1).forEach(r => allData.push([classId, ...r]));
  }
  if (allData.length === 0) return;
  const header = ['classId'].concat(Utilities.parseCsv(teacherData.getFolders().next().getFilesByName('data.csv').next().getBlob().getDataAsString())[0]);
  const summaryCsv = [header, ...allData].map(r => r.join(',')).join('\n');
  overwriteFile_(teacherData, 'summary.csv', summaryCsv, MimeType.CSV);
}

/**
 * include(filename):
 * HTML テンプレートを埋め込むためのヘルパー
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gemini 設定を保存
 */
function setGeminiSettings(apiKey, persona) {
  const props = PropertiesService.getScriptProperties();
  if (apiKey !== undefined) props.setProperty('GEMINI_API_KEY', apiKey);
  if (persona !== undefined) props.setProperty('GEMINI_PERSONA', persona);
}

/**
 * Gemini 設定を取得
 */
function getGeminiSettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    apiKey: props.getProperty('GEMINI_API_KEY') || '',
    persona: props.getProperty('GEMINI_PERSONA') || ''
  };
}

/**
 * 現在の バージョンを返す
 */
function getSqVersion() {
  return SQ_VERSION;
}

// Export for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getSqVersion };
}
