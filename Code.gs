// ================================================
// StudyQuest – バックエンド一式（ログ保存・ボード対応版）
// ================================================

// シート名定数
const SHEET_TOC             = '📜 目次';
const SHEET_TASKS           = '課題一覧';
const SHEET_STUDENTS        = '児童一覧';
const SHEET_GLOBAL_ANSWERS  = '回答ログ（全体ボード用）';
const STUDENT_SHEET_PREFIX  = '児童_';

const FOLDER_NAME_PREFIX    = 'StudyQuest_';

/**
 * doGet: テンプレートに exec URL と teacher を渡す
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'login';
  const template = HtmlService.createTemplateFromFile(page);
  template.scriptUrl = ScriptApp.getService().getUrl();
  template.teacher   = (e && e.parameter && e.parameter.teacher) ? e.parameter.teacher : '';
  return template
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('StudyQuest');
}

/**
 * generateTeacherCode: 6桁英数字のユニーク教師コードを生成
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

function findLatestFolderByName_(name) {
  var iter = DriveApp.getFoldersByName(name);
  if (!iter.hasNext()) return null;
  var latest = null;
  var date = null;
  while (iter.hasNext()) {
    var f = iter.next();
    var d = f.getDateCreated();
    if (!date || d > date) {
      date = d;
      latest = f;
    }
  }
  return latest;
}

function initTeacher(passcode) {
  if (passcode !== 'kyoushi') {
    return { status: 'error', message: 'パスコードが違います。' };
  }

  const props = PropertiesService.getScriptProperties();
  // Drive上に既存フォルダがあれば最新コードを取得
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

  const tocSheet = ss.getSheets()[0];
  tocSheet.setName(SHEET_TOC);
  tocSheet.clear();
  tocSheet.appendRow(['StudyQuest データシート']);
  tocSheet.getRange('A1').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  tocSheet.setColumnWidth(1, 200);
  tocSheet.setColumnWidth(2, 400);

  const sheetInfos = [
    { name: SHEET_TASKS, color: "ff9900", header: ['ID', '問題データ(JSON)', '自己評価許可', '作成日時'], description: "作成された課題の一覧です。" },
    { name: SHEET_STUDENTS, color: "4285f4", header: ['児童ID', '学年', '組', '番号', '初回ログイン日時'], description: "ログインした児童の情報が記録されます。" },
    { name: SHEET_GLOBAL_ANSWERS, color: "008080", header: ['日時', '児童ID', '課題ID', '回答概要', '自己評価'], description: "全児童の回答の概要（ボード表示用）です。" }
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
  tocSheet.appendRow(['児童の個別回答ログ']);
  tocSheet.getRange(tocSheet.getLastRow(), 1).setFontWeight('bold');
  tocSheet.appendRow(['各児童の回答は、ログイン時に自動作成される「' + STUDENT_SHEET_PREFIX + '（児童ID）」という名前の個別シートに記録されます。', '']);

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
 * スクリプトプロパティから取得した SS ID を基にスプレッドシートを開く
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
 * initStudent(teacherCode, grade, classroom, number):
 * 児童の初回ログイン処理。
 * - 児童シートを作成し
 * - 「課題一覧」から全タスクをインポート（作成日時も含めて）しておく
 */
function initStudent(teacherCode, grade, classroom, number) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('教師コードが正しくありません。');
  }

  const studentListSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!studentListSheet) {
    throw new Error(`システムエラー: 「${SHEET_STUDENTS}」シートが見つかりません。`);
  }

  // 児童ID を grade-class-number 形式で作成
  const studentId = `${grade}-${classroom}-${number}`;

  // 児童一覧シートに未登録なら登録
  const studentListData = studentListSheet.getDataRange().getValues();
  const exists = studentListData.some(row => row[0] === studentId);
  if (!exists) {
    studentListSheet.appendRow([studentId, grade, classroom, number, new Date()]);
  }

  const studentSheetName = STUDENT_SHEET_PREFIX + studentId;
  let studentSheet = ss.getSheetByName(studentSheetName);

  if (!studentSheet) {
    // 見出し行を追加
    studentSheet = ss.insertSheet(studentSheetName);
    studentSheet.appendRow(['日時', '課題ID', '課題内容(参照用)', '回答本文', '自己評価']);
    studentSheet.setTabColor("f4b400");

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

    // 「課題一覧」シートから全タスクをインポート（作成日時も）
    const taskSheet = ss.getSheetByName(SHEET_TASKS);
    if (taskSheet) {
      const lastRow   = taskSheet.getLastRow();
      if (lastRow >= 2) {
        const taskData = taskSheet.getRange(2, 1, lastRow - 1, 4).getValues();
        taskData.forEach(row => {
          const taskId        = row[0];
          const payloadAsJson = row[1];
          const createdAt     = row[3]; // 作成日時を取り込む
          let questionText    = '';
          try {
            const parsed = JSON.parse(payloadAsJson);
            questionText = parsed.question || payloadAsJson;
          } catch (e) {
            questionText = payloadAsJson;
          }
          // [作成日時, taskId, questionText, '', '']
          studentSheet.appendRow([createdAt, taskId, questionText, '', '']);
        });
      }
    }
  }

  return { status: 'ok' };
}

/**
 * createTask(teacherCode, payloadAsJson, selfEval)
 */
function createTask(teacherCode, payloadAsJson, selfEval) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error("課題作成失敗: 教師のスプレッドシートが見つかりません。");
  }
  const taskSheet = ss.getSheetByName(SHEET_TASKS);
  if (!taskSheet) {
    throw new Error(`システムエラー: 「${SHEET_TASKS}」シートが見つかりません。`);
  }
  const taskId = Utilities.getUuid();
  taskSheet.appendRow([taskId, payloadAsJson, selfEval, new Date()]);
}

/**
 * listTasks(teacherCode)
 */
function listTasks(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName(SHEET_TASKS);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  return data.reverse().map(row => ({
    id: row[0],
    q: row[1],
    selfEval: row[2],
    date: Utilities.formatDate(new Date(row[3]), 'JST', 'yyyy/MM/dd HH:mm')
  }));
}

/**
 * deleteTask(teacherCode, taskId)
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
 * getRecommendedTask(teacherCode, studentId):
 * 児童専用シートから既回答タスクIDを抜き取り、
 * 課題一覧から未回答の最新タスクを返す
 */
function getRecommendedTask(teacherCode, studentId) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return null;

  // 全課題を逆順(最新→過去)で取得
  const tasks = listTasks(teacherCode);
  if (!tasks || tasks.length === 0) {
    return null;
  }

  // 児童専用シートを開いて回答済みIDを集める
  const studentSheetName = STUDENT_SHEET_PREFIX + studentId;
  const studentSheet     = ss.getSheetByName(studentSheetName);
  const answeredIds      = [];
  if (studentSheet) {
    const data = studentSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row        = data[i];
      const rowTaskId  = row[1]; // 2列目が課題ID
      const answerText = row[3]; // 4列目が回答本文
      if (rowTaskId && answerText && answerText.toString().trim() !== '') {
        answeredIds.push(rowTaskId);
      }
    }
  }

  // 未回答タスクを最新順に探す
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!answeredIds.includes(t.id)) {
      return { id: t.id, q: t.q, selfEval: t.selfEval };
    }
  }

  return null;
}

/**
 * submitAnswer(teacherCode, studentQuery, taskId, answer, evaluation)
 * 児童専用シートの該当行に「日時」「回答」「評価」を上書きし、
 * 全体回答ログにも概要を追加する
 */
function submitAnswer(teacherCode, studentQuery, taskId, answer, evaluation) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) {
    throw new Error('回答送信エラー: 教師の設定ファイルが見つかりません。');
  }
  const params    = new URLSearchParams(studentQuery);
  const studentId = `${params.get('grade')}-${params.get('class')}-${params.get('number')}`;
  const studentSheetName = STUDENT_SHEET_PREFIX + studentId;
  const studentSheet     = ss.getSheetByName(studentSheetName);

  if (!studentSheet) {
    throw new Error(`回答送信エラー: 児童「${studentId}」の専用シートが見つかりません。`);
  }

  // 児童シート内で taskId が一致する行を検索
  const data     = studentSheet.getDataRange().getValues();
  let foundRow   = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === taskId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    // 該当行に「日時」「回答本文」「自己評価」を上書き
    studentSheet.getRange(foundRow, 1).setValue(new Date());    // 1列目: 日時
    studentSheet.getRange(foundRow, 4).setValue(answer);        // 4列目: 回答本文
    studentSheet.getRange(foundRow, 5).setValue(evaluation);    // 5列目: 自己評価
  } else {
    // 見つからない場合は appendRow
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
    studentSheet.appendRow([new Date(), taskId, questionText, answer, evaluation]);
  }

  // 全体回答ログにも「概要」を追記
  const globalAnswerSheet = ss.getSheetByName(SHEET_GLOBAL_ANSWERS);
  if (globalAnswerSheet) {
    let answerSummary = answer;
    if (typeof answer === 'string' && answer.length > 50) {
      answerSummary = answer.substring(0, 50) + '...';
    }
    globalAnswerSheet.appendRow([new Date(), studentId, taskId, answerSummary, evaluation]);
  } else {
    console.warn(`「${SHEET_GLOBAL_ANSWERS}」シートが見つかりません。`);
  }
}

/**
 * listBoard(teacherCode)
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

  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const sliceStart = Math.max(0, data.length - 30);
  const slice = data.slice(sliceStart).reverse();
  return slice.map(row => ({
    name: `児童 ${row[1]}`,
    answer: row[3]
  }));
}

/**
 * getStatistics(teacherCode)
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
 * include(filename):
 * HTMLファイルをテンプレートに埋め込むためのヘルパー
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
