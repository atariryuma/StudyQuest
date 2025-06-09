function loadProfileData(teacherCode) {
  const email = Session.getEffectiveUser().getEmail();
  const db = getGlobalDb_();
  if (!db) return null;
  const userSheet = db.getSheetByName(SHEET_GLOBAL_USERS);
  if (!userSheet) return null;
  const last = userSheet.getLastRow();
  if (last < 2) return null;
  const rows = userSheet.getRange(2, 1, last - 1, userSheet.getLastColumn()).getValues();
  let row = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email.toLowerCase()) {
      row = rows[i];
      break;
    }
  }
  if (!row) return null;
  const trophySheet = db.getSheetByName(SHEET_GLOBAL_TROPHIES_LOG);
  const itemSheet = db.getSheetByName(SHEET_GLOBAL_ITEMS);
  let trophies = [];
  if (trophySheet && trophySheet.getLastRow() > 1) {
    const tRows = trophySheet.getRange(2, 1, trophySheet.getLastRow() - 1, 3).getValues();
    trophies = tRows.filter(r => String(r[1]).toLowerCase() === email.toLowerCase()).map(r => r[2]);
  }
  let items = [];
  if (itemSheet && itemSheet.getLastRow() > 1) {
    const iRows = itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 4).getValues();
    items = iRows
      .filter(r => String(r[1]).toLowerCase() === email.toLowerCase())
      .map(r => ({ itemId: r[2], quantity: r[3] }));
  }
  return {
    handleName: row[1],
    level: row[4],
    totalXp: row[3],
    coins: row[5],
    title: row[6],
    trophies: trophies,
    items: items
  };
}
