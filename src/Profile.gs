function loadProfileData(teacherCode) {
  var email = Session.getEffectiveUser().getEmail();
  var db = getGlobalDb_();
  if (!db) return null;
  var userSheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!userSheet) return null;
  var last = userSheet.getLastRow();
  if (last < 2) return null;
  var rows = userSheet.getRange(2, 1, last - 1, userSheet.getLastColumn()).getValues();
  var row = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email.toLowerCase()) {
      row = rows[i];
      break;
    }
  }
  if (!row) return null;
  var trophySheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_TROPHIES_LOG);
  var itemSheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_ITEMS);
  var trophies = [];
  if (trophySheet && trophySheet.getLastRow() > 1) {
    var tRows = trophySheet.getRange(2, 1, trophySheet.getLastRow() - 1, 3).getValues();
    trophies = tRows.filter(function(r){ return String(r[1]).toLowerCase() === email.toLowerCase(); }).map(function(r){ return r[2]; });
  }
  var items = [];
  if (itemSheet && itemSheet.getLastRow() > 1) {
    var iRows = itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 4).getValues();
    items = iRows
      .filter(function(r){ return String(r[1]).toLowerCase() === email.toLowerCase(); })
      .map(function(r){ return { itemId: r[2], quantity: r[3] }; });
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
