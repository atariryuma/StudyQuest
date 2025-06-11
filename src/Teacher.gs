/**
 * generateTeacherCode(): 6桁英数字のユニークな教師コードを生成
 */

var _ssCache = {};

function generateTeacherCode() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  var props = PropertiesService.getScriptProperties();
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
  var cacheKey = 'latestFolder_' + name;
  var cachedId = getCacheValue_(cacheKey);
  if (cachedId) {
    try {
      return DriveApp.getFolderById(cachedId);
    } catch (e) {
      removeCacheValue_(cacheKey);
    }
  }
  var q = "mimeType='application/vnd.google-apps.folder' " +
            `and name='${name}' and 'root' in parents and trashed=false`;
  try {
    var it = DriveApp.searchFolders(q);
    var latest = null;
    while (it.hasNext()) {
      var f = it.next();
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
  var cacheKey = 'teacherFolderLatest';
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;
  var q = `mimeType='application/vnd.google-apps.folder' ` +
            `and title contains '${CONSTS.FOLDER_NAME_PREFIX}' and trashed=false`;
  try {
    var res = Drive.Files.list({ q, orderBy: 'createdDate desc' });
    var items = res.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var m = item.title.match(new RegExp('^' + CONSTS.FOLDER_NAME_PREFIX + '([A-Z0-9]{6})$'));
      if (m) {
        var info = { code: m[1], id: item.id };
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
  var email = Session.getEffectiveUser().getEmail();
  var prefix = email.split('@')[0];
  var props = PropertiesService.getScriptProperties();
  var storedPass = props.getProperty(CONSTS.PROP_TEACHER_PASSCODE);
  if (!storedPass || storedPass !== passcode) {
    return { status: 'error', message: 'パスコードが違います。' };
  }

  var stored = props.getProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email);
  if (stored) {
    if (typeof grantTeacherAccess === 'function') {
      try { grantTeacherAccess(email); } catch (e) {}
    }
    return { status: 'ok', teacherCode: stored };
  }

  var info = detectTeacherFolderOnDrive_();
  if (info) {
    props.setProperty(info.code, info.id);
    props.setProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email, info.code);
    if (typeof grantTeacherAccess === 'function') {
      try { grantTeacherAccess(email); } catch (e) {}
    }
    return { status: 'ok', teacherCode: info.code };
  }
  var existingCodes = props.getKeys().filter(function(key){ return key.match(/^[A-Z0-9]{6}$/); });
  var foundCode = null;
  var foundDate = null;
  existingCodes.forEach(function(code) {
    var folder = findLatestFolderByName_(CONSTS.FOLDER_NAME_PREFIX + code);
    if (folder) {
      var d = folder.getDateCreated();
      if (!foundDate || d > foundDate) {
        foundDate = d;
        foundCode = code;
      }
    }
  });
  if (foundCode) {
    props.setProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email, foundCode);
    if (typeof grantTeacherAccess === 'function') {
      try { grantTeacherAccess(email); } catch (e) {}
    }
    return { status: 'ok', teacherCode: foundCode };
  }
  // 新規作成
  var newCode    = generateTeacherCode();
  var folderName = CONSTS.FOLDER_NAME_PREFIX + newCode;
  var folderInstance = DriveApp.createFolder(folderName);
  props.setProperty(newCode, folderInstance.getId());
  props.setProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email, newCode);
  initializeFolders(newCode, [], folderInstance);

  var ss = SpreadsheetApp.create('StudyQuest_DB_' + prefix + '_' + newCode);
  props.setProperty(CONSTS.PROP_TEACHER_SSID_PREFIX + newCode, ss.getId());
  DriveApp.getFileById(ss.getId()).moveTo(folderInstance);

  // 目次シート作成
  var tocSheet = ss.getSheets()[0];
  tocSheet.setName(CONSTS.SHEET_TOC);
  tocSheet.clear();
  tocSheet.appendRow(['StudyQuest データシート']);
  tocSheet.getRange('A1').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  tocSheet.setColumnWidth(1, 200);
  tocSheet.setColumnWidth(2, 400);

  // 各シートの初期化
  var sheetInfos = [
    {
      name: CONSTS.SHEET_TASKS,
      color: "ff9900",
      header: ['TaskID', 'ClassID', 'Subject', 'Question', 'Type', 'Choices', 'AllowSelfEval', 'CreatedAt', 'Persona', 'Status', 'draft', 'Difficulty', 'TimeLimit', 'XPBase', 'CorrectAnswer'],
      description: "作成された課題の一覧です。",
      columnsJa: ['課題ID','クラスID','教科','問題文','形式','選択肢(JSON)','自己評価許可','作成日時','ペルソナ','状態','下書きフラグ','難易度','制限時間','基本XP','正答']
    },
    {
      name: CONSTS.SHEET_STUDENTS,
      color: "4285f4",
      header: ['StudentID', 'Grade', 'Class', 'Number', 'FirstLogin', 'LastLogin', 'LoginCount', 'TotalXP', 'Level', 'LastTrophyID', 'TotalLikes'],
      description: "ログインした生徒の情報が記録されます。",
      columnsJa: ['生徒ID','学年','組','番号','初回ログイン','最終ログイン','ログイン回数','累積XP','レベル','最終トロフィーID','累計いいね数']
    },
    {
      name: CONSTS.SHEET_SUBMISSIONS,
      color: "008080",
      header: ['StudentID', 'TaskID', 'Question', 'StartedAt', 'SubmittedAt', 'ProductURL',
               'QuestionSummary', 'AnswerSummary', 'EarnedXP', 'TotalXP', 'Level', 'Trophy', 'Status', 'LikeScore'],
      description: "全生徒の回答の概要（ボード表示用）です。",
      columnsJa: ['生徒ID','課題ID','問題文','開始日時','提出日時','成果物URL','問題概要','回答概要','付与XP','累積XP','レベル','トロフィー','ステータス','いいねポイント']
    },
    {
      name: CONSTS.SHEET_AI_FEEDBACK,
      color: "ff4444",
      header: ['LogID', 'SubmissionID', 'Content', 'CreatedAt'],
      description: "Gemini API からのフィードバックログです。",
      columnsJa: ['ログID','提出ID','フィード内容','生成日時']
    },
    {

      name: CONSTS.SHEET_TROPHIES,
      color: "ffcc00",
      header: ['TrophyID', 'Name', 'Description', 'IconURL', 'Condition'],
      description: "獲得可能なトロフィーを定義します。",
      columnsJa: ['トロフィーID','名称','説明','アイコンURL','条件(JSON)']
    },
    {
      name: CONSTS.SHEET_ITEMS,
      color: "00c851",
      header: ['ItemID', 'Name', 'Type', 'Price', 'Effect'],
      description: "購入可能なアイテムを定義します。",
      columnsJa: ['アイテムID','名称','種別','価格','効果(JSON)']
    },
    {
      name: CONSTS.SHEET_SETTINGS,
      color: "aaaaaa",
      header: ['type', 'value1', 'value2'],
      description: "各種設定 (APIキー・クラス等) を保存します。",
      columnsJa: ['種別','値1','値2']
    }
  ];
  tocSheet.appendRow(['']);
  tocSheet.appendRow(['主要シート一覧']);
  tocSheet.getRange('A3').setFontWeight('bold');
  var spreadsheetUrl = ss.getUrl();
  sheetInfos.forEach(function(info) {
    var sheet = ss.insertSheet(info.name);
    sheet.appendRow(info.header);
    sheet.setTabColor(info.color);
    var linkFormula = `=HYPERLINK("${spreadsheetUrl}#gid=${sheet.getSheetId()}","${info.name}")`;
    tocSheet.appendRow([linkFormula, info.description]);
    if (Array.isArray(info.columnsJa)) {
      var detail = info.header.map(function(h,i){ return h + '=' + (info.columnsJa[i] || ''); }).join(', ');
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
  if (typeof grantTeacherAccess === 'function') {
    try { grantTeacherAccess(email); } catch (e) {}
  }
  return {
    status: 'new',
    teacherCode: newCode,
    message: `初回ログインありがとうございます。Drive 上に「${folderName}」フォルダとスプレッドシートを作成しました。`
  };
}

/**
 * getSpreadsheetByTeacherCode(teacherCode):
 * スクリプトプロパティからフォルダ ID を取得し、
 * そのフォルダ内の StudyQuest_DB_<prefix>_<teacherCode> を開く
 */
function getSpreadsheetByTeacherCode(teacherCode) {
  console.time('getSpreadsheetByTeacherCode');
  if (!teacherCode) { console.timeEnd('getSpreadsheetByTeacherCode'); return null; }
  if (_ssCache[teacherCode]) { console.timeEnd('getSpreadsheetByTeacherCode'); return _ssCache[teacherCode]; }

  var props = PropertiesService.getScriptProperties();
  var idKey = CONSTS.PROP_TEACHER_SSID_PREFIX + teacherCode;

  var cachedId = getCacheValue_('ssid_' + teacherCode);
  if (!cachedId) {
    cachedId = props.getProperty(idKey);
    if (cachedId) putCacheValue_('ssid_' + teacherCode, cachedId, 3600);
  }

  if (cachedId) {
    try {
      var ss = SpreadsheetApp.openById(cachedId);
      _ssCache[teacherCode] = ss;
      console.timeEnd('getSpreadsheetByTeacherCode');
      return ss;
    } catch (e) {
      props.deleteProperty(idKey);
      removeCacheValue_('ssid_' + teacherCode);
    }
  }

  var folderId = props.getProperty(teacherCode);
  if (!folderId) { console.timeEnd('getSpreadsheetByTeacherCode'); return null; }
  try {
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var id = null;
    while (files.hasNext()) {
      var f = files.next();
      var name = f.getName();
      if (name === 'StudyQuest_DB_' + teacherCode || name.match(new RegExp('^StudyQuest_DB_.+_' + teacherCode + '$'))) {
        id = f.getId();
        break;
      }
    }
    if (id) {
      props.setProperty(idKey, id);
      var ss = SpreadsheetApp.openById(id);
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
  var sheet = ss.getSheetByName(CONSTS.SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(CONSTS.SHEET_SETTINGS);
    sheet.appendRow(['type', 'value1', 'value2']);
  }
  return sheet;
}

function saveTeacherSettings_(teacherCode, obj) {
  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return;
  var sheet = ensureSettingsSheet_(ss);

  var ownerEmail = '';
  var ownerName  = '';
  var last = sheet.getLastRow();
  if (last >= 2) {
    var rows = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === 'ownerEmail') ownerEmail = rows[i][1];
      if (String(rows[i][0]) === 'ownerName') ownerName = rows[i][1];
    }
  }

  sheet.clear();
  sheet.appendRow(['type', 'value1', 'value2']);
  if (ownerEmail) sheet.appendRow(['ownerEmail', ownerEmail]);
  if (ownerName)  sheet.appendRow(['ownerName', ownerName]);
  if (obj.persona !== undefined) sheet.appendRow(['persona', obj.persona, '']);
  if (Array.isArray(obj.classes)) {
    for (var j = 0; j < obj.classes.length; j++) {
      var c = obj.classes[j];
      sheet.appendRow(['class', c[0], c[1]]);
    }
  }
  removeCacheValue_('settings_' + teacherCode);
}

function loadTeacherSettings_(teacherCode) {
  var cacheKey = 'settings_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  var data = { persona: '', classes: [] };
  if (ss) {
    var sheet = ss.getSheetByName(CONSTS.SHEET_SETTINGS);
    if (sheet) {
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
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
  var cacheKey = 'rootId_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) {
    try {
      return DriveApp.getFolderById(cached);
    } catch (e) {
      removeCacheValue_(cacheKey);
    }
  }

  var props = PropertiesService.getScriptProperties();
  var stored = props.getProperty(teacherCode);
  if (stored) {
    try {
      var f = DriveApp.getFolderById(stored);
      putCacheValue_(cacheKey, stored, 3600);
      return f;
    } catch (e) {
      logError_('getTeacherRootFolder-open', e);
    }
  }

  var name = CONSTS.FOLDER_NAME_PREFIX + teacherCode;
  var q = `title='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  var items = [];
  try {
    var res = Drive.Files.list({ q, orderBy: 'createdDate asc' });
    items = res.items || [];
  } catch (e) {
    logError_('getTeacherRootFolder', e);
  }
  if (items.length) {
    var keep = items[0];
    for (var i = 1; i < items.length; i++) {
      try { Drive.Files.trash(items[i].id); } catch (err) { logError_('trashDup', err); }
    }
    props.setProperty(teacherCode, keep.id);
    putCacheValue_(cacheKey, keep.id, 3600);
    return DriveApp.getFolderById(keep.id);
  }
  var folder = DriveApp.createFolder(name);
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

  var map = {};
  (classList || []).forEach(function(cls, idx) {
    var grade = Array.isArray(cls) ? cls[0] : cls.grade;
    var klass = Array.isArray(cls) ? cls[1] : (cls.class || cls.classroom);
    var id = idx + 1;
    if (grade !== undefined && klass !== undefined) {
      map[id] = `${grade}-${klass}`;
    }
  });

  var current = loadTeacherSettings_(teacherCode);
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
  var list = [];
  if (idsString) {
    idsString.split(';').forEach(function(t) {
      var parts = t.split(',').map(function(p){ return p.trim(); });
      if (parts.length === 2 && parts[0] && parts[1]) {
        list.push([parts[0], parts[1]]);
      }
    });
  }
  var map = initializeFolders(teacherCode, list);
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
  var cacheKey = 'classmap_' + teacherCode;
  var cached = getCacheValue_(cacheKey);
  if (cached) return cached;

  var data = loadTeacherSettings_(teacherCode);
  var map = {};
  (data.classes || []).forEach(function(c, idx) {
    if (c && c[0] !== undefined && c[1] !== undefined) {
      map[idx + 1] = `${c[0]}-${c[1]}`;
    }
  });
  putCacheValue_(cacheKey, map, 3600);
  return map;
}


function setGlobalGeminiApiKey(apiKey) {
  var props = PropertiesService.getScriptProperties();
  var encoded = Utilities.base64Encode(apiKey || '');
  props.setProperty('geminiApiKey', encoded);
}

function getGlobalGeminiApiKey() {
  var props = PropertiesService.getScriptProperties();
  var encoded = props.getProperty('geminiApiKey') || '';
  if (!encoded) return '';
  try {
    return Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString();
  } catch (e) {
    console.warn('Failed to decode Gemini API key: ' + e.message);
    return '';
  }
}

