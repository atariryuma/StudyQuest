function initGlobalDb() {
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
    sheets[0].appendRow(['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak']);
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
    exists = emails.some(e => String(e).trim().toLowerCase() === email.toLowerCase());
  }
  if (!exists) {
    const handle = String(email).split('@')[0];
    const now = new Date();
    sheet.getRange(last + 1, 1, 1, 10).setValues([[
      email,
      handle,
      'admin',
      0,
      0,
      0,
      '',
      now,
      now,
      1
    ]]);
  }
}
