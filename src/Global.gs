function initGlobalDb() {
  var props = PropertiesService.getScriptProperties();
  var propName = (typeof PROP_GLOBAL_MASTER_DB !== 'undefined') ? PROP_GLOBAL_MASTER_DB : 'Global_Master_DB';
  var existing = props.getProperty(propName);
  if (existing) {
    try {
      SpreadsheetApp.openById(existing);
      return { status: 'exists', id: existing };
    } catch (e) {
      props.deleteProperty(propName);
    }
  }
  var ss = SpreadsheetApp.create('StudyQuest_Global_Master_DB');
  if (typeof props.setProperty === 'function') {
    props.setProperty(propName, ss.getId());
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

  return { status: 'created', id: ss.getId() };
}
