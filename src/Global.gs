function initGlobalDb() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('GLOBAL_DB_ID');
  if (existing) {
    try {
      SpreadsheetApp.openById(existing);
      return { status: 'exists', id: existing };
    } catch (e) {
      props.deleteProperty('GLOBAL_DB_ID');
    }
  }
  const ss = SpreadsheetApp.create('StudyQuest_Global_Master_DB');
  props.setProperty('GLOBAL_DB_ID', ss.getId());

  const sheets = ss.getSheets();
  if (sheets && sheets[0]) {
    sheets[0].setName('Global_Users');
    sheets[0].appendRow(['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak']);
    sheets[0].setTabColor && sheets[0].setTabColor('4285f4');
  }
  const trophy = ss.insertSheet('Global_Trophies_Log');
  trophy.appendRow(['UserTrophyID','UserEmail','TrophyID','AwardedAt']);
  trophy.setTabColor && trophy.setTabColor('ffcc00');
  const inv = ss.insertSheet('Global_Items_Inventory');
  inv.appendRow(['UserItemID','UserEmail','ItemID','Quantity','AcquiredAt']);
  inv.setTabColor && inv.setTabColor('00c851');

  return { status: 'created', id: ss.getId() };
}
