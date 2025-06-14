function quickStudyQuestSetup(passcode) {
  var props = PropertiesService.getScriptProperties();
  var storedPass = props.getProperty(CONSTS.PROP_TEACHER_PASSCODE);
  if (!storedPass) {
    passcode = String(passcode || '').trim();
    if (!passcode || !passcode.match(/^[0-9A-Za-z]+$/)) {
      return { status: 'error', message: 'invalid_passcode' };
    }
    props.setProperty(CONSTS.PROP_TEACHER_PASSCODE, passcode);
  } else {
    passcode = storedPass;
  }
  var driveId = props.getProperty(CONSTS.PROP_GLOBAL_DRIVE_ID);
  if (!driveId) {
    driveId = createSharedDrive_('StudyQuest');
    if (driveId && typeof props.setProperty === 'function') {
      props.setProperty(CONSTS.PROP_GLOBAL_DRIVE_ID, driveId);
    }
  }
  var root = null;
  try {
    root = DriveApp.getFolderById(driveId);
  } catch (e) {
    root = DriveApp.getRootFolder();
  }

  try {
    DriveApp.getFileById(ScriptApp.getScriptId()).moveTo(root);
  } catch (e) {}

  var res = initGlobalDb(driveId);

  var doc = DocumentApp.create('StudyQuest_Setup_Guide');
  var body = doc.getBody();
  body.appendParagraph('StudyQuest セットアップガイド').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('このドライブにはアプリのスクリプトとグローバルデータベースが保存されます。');
  body.appendParagraph('教師は初回ログイン時に自動で教師用データベースが作成されます。');
  body.appendParagraph('グローバルデータベースは全教師で共有し、生徒は読み取り専用で利用します。');

  try {
    DriveApp.getFileById(doc.getId()).moveTo(root);
  } catch (e) {}

  res.passcode = passcode;
  return res;
}

function initGlobalDb(driveId) {
  var props = PropertiesService.getScriptProperties();
  var propName = (typeof PROP_GLOBAL_MASTER_DB !== 'undefined') ? PROP_GLOBAL_MASTER_DB : 'Global_Master_DB';
  var existing = props.getProperty(propName);
  if (existing) {
    try {
      const existingSs = SpreadsheetApp.openById(existing);
      ensureAdminUser_(existingSs);
      return { status: 'exists', id: existing };
    } catch (e) {
      props.deleteProperty(propName);
    }
  }
  var ss = SpreadsheetApp.create('StudyQuest_Global_Master_DB');
  if (driveId) {
    try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(driveId)); } catch (e) {}
  }
  if (typeof props.setProperty === 'function') {
    props.setProperty(propName, ss.getId());
  }
  if (typeof ss.addEditor === 'function') {
    const email = Session.getEffectiveUser().getEmail();
    ss.addEditor(email);
  }

  var sheets = ss.getSheets();
  if (sheets && sheets[0]) {
    sheets[0].setName(CONSTS.SHEET_GLOBAL_USERS);
    sheets[0].appendRow(['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak','TotalLikesGiven','TotalLikesReceived']);
    sheets[0].setTabColor && sheets[0].setTabColor('4285f4');
  }
  var trophy = ss.insertSheet(CONSTS.SHEET_GLOBAL_TROPHIES_LOG);
  trophy.appendRow(['UserTrophyID','UserEmail','TrophyID','AwardedAt']);
  trophy.setTabColor && trophy.setTabColor('ffcc00');
  var inv = ss.insertSheet(CONSTS.SHEET_GLOBAL_ITEMS);
  inv.appendRow(['UserItemID','UserEmail','ItemID','Quantity','AcquiredAt']);
  inv.setTabColor && inv.setTabColor('00c851');

  ensureAdminUser_(ss);

  return { status: 'created', id: ss.getId() };
}

function ensureAdminUser_(ss) {
  const email = Session.getEffectiveUser().getEmail();
  const sheet = ss.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!sheet) return;
  const last = sheet.getLastRow();
  let exists = false;
  if (last >= 2) {
    const emails = sheet.getRange(2, 1, last - 1, 1).getValues().flat();
    exists = emails.some(function(e) { return String(e).trim().toLowerCase() === email.toLowerCase(); });
  }
  if (!exists) {
    const handle = String(email).split('@')[0];
    const now = new Date();
    sheet.getRange(last + 1, 1, 1, 12).setValues([[
      email,
      handle,
      'admin',
      0,
      0,
      0,
      '',
      now,
      now,
      1,
      0,
      0
    ]]);
  }
}

function createSharedDrive_(name) {
  var requestId = Utilities.getUuid();
  var drive = Drive.Drives.create({ name: name }, requestId);
  var domain = Session.getEffectiveUser().getEmail().split('@')[1];
  try {
    var perm = { type: 'domain', role: 'fileOrganizer', domain: domain };
    Drive.Permissions.create(perm, drive.id, { sendNotificationEmails: false, supportsAllDrives: true });
  } catch (e) {}
  return drive.id;
}
