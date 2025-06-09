/**
 * generateTeacherCode(): 6桁英数字のユニークな教師コードを生成
 */
if (typeof getCacheValue_ !== 'function') {
  function getCacheValue_() { return null; }
  function putCacheValue_() {}
  function removeCacheValue_() {}
}

const _ssCache = {};

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
  const cacheKey = 'latestFolder_' + name;
  const cachedId = getCacheValue_(cacheKey);
  if (cachedId) {
    try {
      return DriveApp.getFolderById(cachedId);
    } catch (e) {
      removeCacheValue_(cacheKey);
    }
  }
  const q = "mimeType='application/vnd.google-apps.folder' " +
            `and name='${name}' and 'root' in parents and trashed=false`;
  try {
    const it = DriveApp.searchFolders(q);
    let latest = null;
    while (it.hasNext()) {
      const f = it.next();
      if (!latest || f.getDateCreated() > latest.getDateCreated()) {
        latest = f;
      }
    }
    if (latest) {
      putCacheValue_(cacheKey, latest.getId(), 300);
    }
    return latest;
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
  const cacheKey = 'teacherFolderLatest';
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;
  const q = `mimeType='application/vnd.google-apps.folder' ` +
            `and title contains '${FOLDER_NAME_PREFIX}' and trashed=false`;
  try {
    const res = Drive.Files.list({ q, orderBy: 'createdDate desc' });
    const items = res.items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const m = item.title.match(new RegExp('^' + FOLDER_NAME_PREFIX + '([A-Z0-9]{6})$'));
      if (m) {
        const info = { code: m[1], id: item.id };
        putCacheValue_(cacheKey, info, 300);
        return info;
      }
    }
    return null;
  } catch (e) {
    logError_('detectTeacherFolderOnDrive_', e);
    return null;
  }
}

/**
 * initTeacher():
 * 教師用初回ログイン or 2回目以降の判定 → スプレッドシートを生成 or 取得
 */
function initTeacher(passcode) {
  // Development mode shortcut
  if (passcode === 'dev_teacher') {
    return {
      status: 'ok',
      teacherCode: 'DEV001'
    };
  }
  const email = Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  const storedPass = props.getProperty('teacherPasscode');
  if (storedPass) {
    if (storedPass !== passcode) {
      return { status: 'error', message: 'パスコードが違います。' };
    }
  } else {
    props.setProperty('teacherPasscode', passcode);
  }

  const stored = props.getProperty('teacherCode_' + email);
  if (stored) {
    return { status: 'ok', teacherCode: stored };
  }

  const info = detectTeacherFolderOnDrive_();
  if (info) {
    props.setProperty(info.code, info.id);
    props.setProperty('teacherCode_' + email, info.code);
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
    props.setProperty('teacherCode_' + email, foundCode);
    return { status: 'ok', teacherCode: foundCode };
  }
  // 新規作成
  const newCode    = generateTeacherCode();
  const folderName = FOLDER_NAME_PREFIX + newCode;
  const folderInstance = DriveApp.createFolder(folderName);
  props.setProperty(newCode, folderInstance.getId());
  props.setProperty('teacherCode_' + email, newCode);
  initializeFolders(newCode, [], folderInstance);

  const ss = SpreadsheetApp.create('StudyQuest_DB_' + newCode);
  props.setProperty('ssId_' + newCode, ss.getId());
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
      header: ['TaskID', 'ClassID', 'Payload(JSON)', 'AllowSelfEval', 'CreatedAt', 'Persona', 'Status', 'draft'],
      description: "作成された課題の一覧です。",
      columnsJa: ['課題ID','クラスID','課題内容(JSON)','自己評価許可','作成日時','ペルソナ','状態','下書きフラグ']
    },
    {
      name: SHEET_STUDENTS,
      color: "4285f4",
      header: ['StudentID', 'Grade', 'Class', 'Number', 'FirstLogin', 'LastLogin', 'LoginCount', 'TotalXP', 'Level', 'LastTrophyID'],
      description: "ログインした生徒の情報が記録されます。",
      columnsJa: ['生徒ID','学年','組','番号','初回ログイン','最終ログイン','ログイン回数','累積XP','レベル','最終トロフィーID']
    },
    {
      name: SHEET_SUBMISSIONS,
      color: "008080",
      header: ['StudentID', 'TaskID', 'Question', 'StartedAt', 'SubmittedAt', 'ProductURL',
               'QuestionSummary', 'AnswerSummary', 'EarnedXP', 'TotalXP', 'Level', 'Trophy', 'Status'],
      description: "全生徒の回答の概要（ボード表示用）です。",
      columnsJa: ['生徒ID','課題ID','問題文','開始日時','提出日時','成果物URL','問題概要','回答概要','付与XP','累積XP','レベル','トロフィー','ステータス']
    },
    {
      name: SHEET_AI_FEEDBACK,
      color: "ff4444",
      header: ['LogID', 'SubmissionID', 'Content', 'CreatedAt'],
      description: "Gemini API からのフィードバックログです。",
      columnsJa: ['ログID','提出ID','フィード内容','生成日時']
    },
    {
      name: SHEET_TROPHIES,
      color: "ffcc00",
      header: ['TrophyID', 'Name', 'Description', 'IconURL', 'Condition'],
      description: "獲得可能なトロフィーを定義します。",
      columnsJa: ['トロフィーID','名称','説明','アイコンURL','条件(JSON)']
    },
    {
      name: SHEET_ITEMS,
      color: "00c851",
      header: ['ItemID', 'Name', 'Type', 'Price', 'Effect'],
      description: "購入可能なアイテムを定義します。",
      columnsJa: ['アイテムID','名称','種別','価格','効果(JSON)']
    },
    {
      name: SHEET_SETTINGS,
      color: "aaaaaa",
      header: ['type', 'value1', 'value2'],
      description: "各種設定 (APIキー・クラス等) を保存します。",
      columnsJa: ['種別','値1','値2']
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
    if (Array.isArray(info.columnsJa)) {
      const detail = info.header.map((h,i)=> `${h}=${info.columnsJa[i] || ''}`).join(', ');
      tocSheet.appendRow(['', detail]);
    }
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
 * そのフォルダ内の StudyQuest_DB_<teacherCode> を開く
 */
function getSpreadsheetByTeacherCode(teacherCode) {
  console.time('getSpreadsheetByTeacherCode');
  if (!teacherCode) { console.timeEnd('getSpreadsheetByTeacherCode'); return null; }
  if (_ssCache[teacherCode]) { console.timeEnd('getSpreadsheetByTeacherCode'); return _ssCache[teacherCode]; }

  const props = PropertiesService.getScriptProperties();
  const idKey = 'ssId_' + teacherCode;

  let cachedId = getCacheValue_('ssid_' + teacherCode);
  if (!cachedId) {
    cachedId = props.getProperty(idKey);
    if (cachedId) putCacheValue_('ssid_' + teacherCode, cachedId, 3600);
  }

  if (cachedId) {
    try {
      const ss = SpreadsheetApp.openById(cachedId);
      _ssCache[teacherCode] = ss;
      console.timeEnd('getSpreadsheetByTeacherCode');
      return ss;
    } catch (e) {
      props.deleteProperty(idKey);
      removeCacheValue_('ssid_' + teacherCode);
    }
  }

  const folderId = props.getProperty(teacherCode);
  if (!folderId) { console.timeEnd('getSpreadsheetByTeacherCode'); return null; }
  try {
    const folder = DriveApp.getFolderById(folderId);
    const targetName = 'StudyQuest_DB_' + teacherCode;
    const files = folder.getFilesByName(targetName);
    if (files.hasNext()) {
      const id = files.next().getId();
      props.setProperty(idKey, id);
      const ss = SpreadsheetApp.openById(id);
      _ssCache[teacherCode] = ss;
      console.timeEnd('getSpreadsheetByTeacherCode');
      return ss;
    }
    console.timeEnd('getSpreadsheetByTeacherCode');
    return null;
  } catch (e) {
    console.error(`スプレッドシートが開けません: Code=${teacherCode}, Folder=${folderId}。エラー: ${e.message}`);
    console.timeEnd('getSpreadsheetByTeacherCode');
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
  removeCacheValue_('settings_' + teacherCode);
}

function loadTeacherSettings_(teacherCode) {
  const cacheKey = 'settings_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

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
  putCacheValue_(cacheKey, data, 21600);
  return data;
}

/**
 * getTeacherRootFolder(teacherCode):
 * 同名フォルダが複数存在する場合は最古の1件を残し、
 * その他はゴミ箱へ移動してからフォルダを返す。
 * フォルダ ID は教師コードをキーとしてスクリプトプロパティに保存される。
 */
function getTeacherRootFolder(teacherCode) {
  const cacheKey = 'rootId_' + teacherCode;
  let cached = getCacheValue_(cacheKey);
  if (cached) {
    try {
      return DriveApp.getFolderById(cached);
    } catch (e) {
      removeCacheValue_(cacheKey);
    }
  }

  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(teacherCode);
  if (stored) {
    try {
      const f = DriveApp.getFolderById(stored);
      putCacheValue_(cacheKey, stored, 3600);
      return f;
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
    putCacheValue_(cacheKey, keep.id, 3600);
    return DriveApp.getFolderById(keep.id);
  }
  const folder = DriveApp.createFolder(name);
  props.setProperty(teacherCode, folder.getId());
  putCacheValue_(cacheKey, folder.getId(), 3600);
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
  removeCacheValue_('classmap_' + teacherCode);
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
  removeCacheValue_('classmap_' + teacherCode);
  return map;
}

/**
 * updateClassIdMap(teacherCode, idsString):
 * wrapper for setClassIdMap used by manage.html
 */
function updateClassIdMap(teacherCode, idsString) {
  return setClassIdMap(teacherCode, idsString);
}

function getClassIdMap(teacherCode) {
  const cacheKey = 'classmap_' + teacherCode;
  const cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  const data = loadTeacherSettings_(teacherCode);
  const map = {};
  (data.classes || []).forEach((c, idx) => {
    if (c && c[0] !== undefined && c[1] !== undefined) {
      map[idx + 1] = `${c[0]}-${c[1]}`;
    }
  });
  putCacheValue_(cacheKey, map, 3600);
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
  if (!encoded) return '';
  try {
    return Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString();
  } catch (e) {
    console.warn('Failed to decode Gemini API key: ' + e.message);
    return '';
  }
}

function setGeminiPersona(teacherCode, persona) {
  const data = loadTeacherSettings_(teacherCode);
  data.persona = persona;
  saveTeacherSettings_(teacherCode, data);
}

function getGeminiPersona(teacherCode) {
  const data = loadTeacherSettings_(teacherCode);
  return data.persona || '';
}
