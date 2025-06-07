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
  const q = `'root' in parents and title='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const res = Drive.Files.list({ q, orderBy: 'createdDate desc', maxResults: 1 });
    const items = res.items || [];
    return items.length ? DriveApp.getFolderById(items[0].id) : null;
  } catch (e) {
    logError_('findLatestFolderByName_', e);
    return null;
  }
}

/**
 * detectTeacherFolderOnDrive_():
 * My Drive 直下から StudyQuest_<CODE> 形式のフォルダを検索
 * 最も新しいものの教師コードとIDを返す
 */
function detectTeacherFolderOnDrive_() {
  const q = `'root' in parents and mimeType='application/vnd.google-apps.folder' and title contains '${FOLDER_NAME_PREFIX}' and trashed=false`;
  try {
    const res = Drive.Files.list({ q, orderBy: 'createdDate desc' });
    const items = res.items || [];
    for (let i = 0; i < items.length; i++) {
      const name = items[i].title || items[i].name || '';
      const m = name.match(new RegExp('^' + FOLDER_NAME_PREFIX + '([A-Z0-9]{6})$'));
      if (m) {
        return { code: m[1], id: items[i].id };
      }
    }
  } catch (e) {
    logError_('detectTeacherFolderOnDrive_', e);
  }
  return null;
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
  const info = detectTeacherFolderOnDrive_();
  if (info) {
    props.setProperty(info.code, info.id);
    return { status: 'ok', teacherCode: info.code };
  }
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
  const newCode    = generateTeacherCode();
  const folderName = FOLDER_NAME_PREFIX + newCode;
  const folderInstance = DriveApp.createFolder(folderName);
  props.setProperty(newCode, folderInstance.getId());
  initializeFolders(newCode, [], folderInstance);

  const ss = SpreadsheetApp.create('StudyQuest_DB');
  DriveApp.getFileById(ss.getId()).moveTo(folderInstance);

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
      header: ['ID', 'ClassID', '問題データ(JSON)', '自己評価許可', '作成日時', 'ペルソナ'],
      description: "作成された課題の一覧です。"
    },
    {
      name: SHEET_STUDENTS,
      color: "4285f4",
      header: ['生徒ID', '学年', '組', '番号', '初回ログイン日時'],
      description: "ログインした生徒の情報が記録されます。"
    },
    {
      name: SHEET_SUBMISSIONS,
      color: "008080",
      header: ['日時', '生徒ID', '課題ID', '回答概要', '付与XP', '累積XP', 'レベル', 'トロフィー', 'AI呼び出し回数', '回答回数'],
      description: "全生徒の回答の概要（ボード表示用）です。"
    },
    {
      name: SHEET_AI_FEEDBACK,
      color: "ff4444",
      header: ['日時', '生徒ID', '課題ID', '回答回数', 'AI呼び出し回数', '回答本文', 'フィードバック内容'],
      description: "Gemini API からのフィードバックログです。"
    },
    {
      name: SHEET_SETTINGS,
      color: "aaaaaa",
      header: ['type', 'value1', 'value2'],
      description: "各種設定 (APIキー・クラス等) を保存します。"
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

  props.setProperty(newCode, folderInstance.getId());
  saveTeacherSettings_(newCode, { persona: '', classes: [] });
  return {
    status: 'new',
    teacherCode: newCode,
    message: `初回ログインありがとうございます。Drive 上に「${folderName}」フォルダとスプレッドシートを作成しました。`
  };
}

/**
 * getSpreadsheetByTeacherCode(teacherCode):
 * スクリプトプロパティからフォルダ ID を取得し、
 * そのフォルダ内の StudyQuest_<teacherCode>_Log を開く
 */
function getSpreadsheetByTeacherCode(teacherCode) {
  if (!teacherCode) return null;
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(teacherCode);
  if (!folderId) return null;
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName('StudyQuest_DB');
    if (files.hasNext()) {
      return SpreadsheetApp.openById(files.next().getId());
    }
    return null;
  } catch (e) {
    console.error(`スプレッドシートが開けません: Code=${teacherCode}, Folder=${folderId}。エラー: ${e.message}`);
    return null;
  }
}
function ensureSettingsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(['type', 'value1', 'value2']);
  }
  return sheet;
}

function saveTeacherSettings_(teacherCode, obj) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  const sheet = ensureSettingsSheet_(ss);
  sheet.clear();
  sheet.appendRow(['type', 'value1', 'value2']);
  if (obj.persona !== undefined) sheet.appendRow(['persona', obj.persona, '']);
  if (Array.isArray(obj.classes)) {
    obj.classes.forEach(c => sheet.appendRow(['class', c[0], c[1]]));
  }
}

function loadTeacherSettings_(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  const data = { persona: '', classes: [] };
  if (ss) {
    const sheet = ss.getSheetByName(SHEET_SETTINGS);
    if (sheet) {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[0] === 'persona') data.persona = row[1] || '';
        else if (row[0] === 'class') data.classes.push([row[1], row[2]]);
      }
    }
  }
  return data;
}

/**
 * getTeacherRootFolder(teacherCode):
 * 同名フォルダが複数存在する場合は最古の1件を残し、
 * その他はゴミ箱へ移動してからフォルダを返す。
 * フォルダ ID は教師コードをキーとしてスクリプトプロパティに保存される。
 */
function getTeacherRootFolder(teacherCode) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(teacherCode);
  if (stored) {
    try {
      return DriveApp.getFolderById(stored);
    } catch (e) {
      logError_('getTeacherRootFolder-open', e);
    }
  }

  const name = FOLDER_NAME_PREFIX + teacherCode;
  const q = `title='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  let items = [];
  try {
    const res = Drive.Files.list({ q, orderBy: 'createdDate asc' });
    items = res.items || [];
  } catch (e) {
    logError_('getTeacherRootFolder', e);
  }
  if (items.length) {
    const keep = items[0];
    for (let i = 1; i < items.length; i++) {
      try { Drive.Files.trash(items[i].id); } catch (err) { logError_('trashDup', err); }
    }
    props.setProperty(teacherCode, keep.id);
    return DriveApp.getFolderById(keep.id);
  }
  const folder = DriveApp.createFolder(name);
  props.setProperty(teacherCode, folder.getId());
  return folder;
}

/**
 * initializeFolders(teacherCode, classList):
 * StudyQuest_<TeacherCode> 配下でクラス設定を初期化し、
 * 作成したクラス番号と学年・組の対応表を settings.csv に保存
*/
function initializeFolders(teacherCode, classList, root) {
  root = root || getTeacherRootFolder(teacherCode);

  const map = {};
  (classList || []).forEach((cls, idx) => {
    const grade = Array.isArray(cls) ? cls[0] : cls.grade;
    const klass = Array.isArray(cls) ? cls[1] : (cls.class || cls.classroom);
    const id = idx + 1;
    if (grade !== undefined && klass !== undefined) {
      map[id] = `${grade}-${klass}`;
    }
  });

  const current = loadTeacherSettings_(teacherCode);
  current.classes = classList;
  saveTeacherSettings_(teacherCode, current);
  return map;
}

/**
 * setClassIdMap(teacherCode, idsString):
 * "6,1;6,2" のような文字列からクラス設定を更新
 * initializeFolders を呼び出してフォルダを作成
 */
function setClassIdMap(teacherCode, idsString) {
  const list = [];
  if (idsString) {
    idsString.split(';').forEach(t => {
      const parts = t.split(',').map(p => p.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        list.push([parts[0], parts[1]]);
      }
    });
  }
  const map = initializeFolders(teacherCode, list);
  return map;
}

function getClassIdMap(teacherCode) {
  const data = loadTeacherSettings_(teacherCode);
  const map = {};
  (data.classes || []).forEach((c, idx) => {
    if (c && c[0] !== undefined && c[1] !== undefined) {
      map[idx + 1] = `${c[0]}-${c[1]}`;
    }
  });
  return map;
}

function setGeminiSettings(teacherCode, apiKey, persona) {
  if (apiKey !== undefined) setGlobalGeminiApiKey(apiKey);
  const data = loadTeacherSettings_(teacherCode);
  if (persona !== undefined) data.persona = persona;
  saveTeacherSettings_(teacherCode, data);
}

/**
 * Gemini 設定を取得
 */
function getGeminiSettings(teacherCode) {
  const data = loadTeacherSettings_(teacherCode);
  return { apiKey: getGlobalGeminiApiKey(), persona: data.persona || '' };
}

function setGlobalGeminiApiKey(apiKey) {
  const props = PropertiesService.getScriptProperties();
  const encoded = Utilities.base64Encode(apiKey || '');
  props.setProperty('geminiApiKey', encoded);
}

function getGlobalGeminiApiKey() {
  const props = PropertiesService.getScriptProperties();
  const encoded = props.getProperty('geminiApiKey') || '';
  return encoded ? Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString() : '';
}
