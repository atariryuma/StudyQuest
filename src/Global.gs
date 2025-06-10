function initGlobalDb() {
  const props = PropertiesService.getScriptProperties();
  const propName = (typeof CONSTS !== 'undefined' && CONSTS.PROP_GLOBAL_MASTER_DB) ? CONSTS.PROP_GLOBAL_MASTER_DB : 'Global_Master_DB';
  const existing = props.getProperty(CONSTS.PROP_GLOBAL_DB_ID);
  if (existing) {
    try {
      SpreadsheetApp.openById(existing);
      if (typeof props.setProperty === 'function') props.setProperty(propName, existing);
      return { status: 'exists', id: existing };
    } catch (e) {
      props.deleteProperty(CONSTS.PROP_GLOBAL_DB_ID);
    }
  }
  const ss = SpreadsheetApp.create('StudyQuest_Global_Master_DB');
  if (typeof props.setProperty === 'function') {
    props.setProperty(CONSTS.PROP_GLOBAL_DB_ID, ss.getId());
    props.setProperty(propName, ss.getId());
  }

  const sheets = ss.getSheets();
  if (sheets && sheets[0]) {
    sheets[0].setName(CONSTS.SHEET_GLOBAL_USERS);
    sheets[0].appendRow(['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak']);
    sheets[0].setTabColor && sheets[0].setTabColor('4285f4');
  }
  const trophy = ss.insertSheet(CONSTS.SHEET_GLOBAL_TROPHIES_LOG);
  trophy.appendRow(['UserTrophyID','UserEmail','TrophyID','AwardedAt']);
  trophy.setTabColor && trophy.setTabColor('ffcc00');
  const inv = ss.insertSheet(CONSTS.SHEET_GLOBAL_ITEMS);
  inv.appendRow(['UserItemID','UserEmail','ItemID','Quantity','AcquiredAt']);
  inv.setTabColor && inv.setTabColor('00c851');

  return { status: 'created', id: ss.getId() };
}
