/**
 * Gamification utilities (login bonus, trophies, shop, leaderboard)
 * Implementation follows StudyQuest specification v4.3
 */

// Provide fallbacks when running outside GAS (e.g. tests)
if (typeof getSpreadsheetByTeacherCode !== 'function') {
  function getSpreadsheetByTeacherCode() { return null; }
}
if (typeof getGlobalDb_ !== 'function') {
  function getGlobalDb_() { return null; }
}
if (typeof LockService === 'undefined') {
  var LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
}

function processLoginBonus(userEmail) {
  userEmail = String(userEmail || '').trim();
  if (!userEmail) return;
  const lock = LockService.getScriptLock();
  try {
    if (lock.waitLock) lock.waitLock(5000);
    const db = getGlobalDb_();
    if (!db) return;
    const sheet = db.getSheetByName('Global_Users');
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const emails = sheet.getRange(2,1,lastRow-1,1).getValues().flat();
    const idx = emails.indexOf(userEmail);
    if (idx === -1) return;
    const row = idx + 2;
    const now = new Date();
    const lastLogin = new Date(sheet.getRange(row, 9).getValue());
    let streak = Number(sheet.getRange(row, 10).getValue()) || 1;
    const diffDays = Math.floor((now - lastLogin) / 86400000);
    if (diffDays === 1) {
      streak += 1;
    } else if (diffDays > 1) {
      streak = 1;
    }
    sheet.getRange(row, 9, 1, 2).setValues([[now, streak]]);
    if (diffDays !== 0) {
      const bonus = 5 + (streak % 7);
      const coins = Number(sheet.getRange(row, 6).getValue()) || 0;
      sheet.getRange(row, 6).setValue(coins + bonus);
    }
  } finally {
    if (lock.releaseLock) lock.releaseLock();
  }
}

function checkAndAwardTrophies(userEmail, context) {
  // Trophy logic not implemented yet
  return [];
}

function purchaseItem(userEmail, itemId, quantity) {
  userEmail = String(userEmail || '').trim();
  itemId = String(itemId || '').trim();
  quantity = Number(quantity) || 1;
  if (!userEmail || !itemId || quantity <= 0) return { status: 'error' };
  const lock = LockService.getScriptLock();
  try {
    if (lock.waitLock) lock.waitLock(5000);
    const db = getGlobalDb_();
    if (!db) return { status: 'error' };
    const userSheet = db.getSheetByName('Global_Users');
    const invSheet = db.getSheetByName('Global_Items_Inventory');
    const itemsSheet = db.getSheetByName('Items');
    if (!userSheet || !invSheet || !itemsSheet) return { status: 'error' };
    const rows = itemsSheet.getRange(2,1,itemsSheet.getLastRow()-1,5).getValues();
    let price = null;
    for (let i=0;i<rows.length;i++) {
      if (String(rows[i][0]).trim() === itemId) {
        price = Number(rows[i][3]) || 0;
        break;
      }
    }
    if (price === null) return { status: 'error' };
    const emails = userSheet.getRange(2,1,userSheet.getLastRow()-1,1).getValues().flat();
    const idx = emails.indexOf(userEmail);
    if (idx === -1) return { status: 'error' };
    const row = idx + 2;
    const coins = Number(userSheet.getRange(row,6).getValue()) || 0;
    const total = price * quantity;
    if (coins < total) return { status: 'error' };
    userSheet.getRange(row,6).setValue(coins - total);
    invSheet.appendRow([Utilities.getUuid(), userEmail, itemId, quantity, new Date()]);
    return { status: 'ok' };
  } finally {
    if (lock.releaseLock) lock.releaseLock();
  }
}

function generateLeaderboard(teacherCode) {
  const teacherDb = getSpreadsheetByTeacherCode(teacherCode);
  const globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return;
  const enrollSheet = teacherDb.getSheetByName('Enrollments');
  const lbSheet = teacherDb.getSheetByName('Leaderboard') || teacherDb.insertSheet('Leaderboard');
  const userSheet = globalDb.getSheetByName('Global_Users');
  if (!enrollSheet || !lbSheet || !userSheet) return;
  const emails = enrollSheet.getRange(2,1,enrollSheet.getLastRow()-1,1).getValues().flat();
  const userRows = userSheet.getRange(2,1,userSheet.getLastRow()-1,6).getValues();
  const map = {};
  userRows.forEach(r => { map[r[0]] = { name: r[1], level: r[4], xp: r[3] }; });
  const data = emails.map(e => Object.assign({ email: e }, map[e] || { name:'', level:0, xp:0 }));
  data.sort((a,b) => b.xp - a.xp);
  lbSheet.clearContents();
  lbSheet.appendRow(['Rank','UserEmail','HandleName','Level','TotalXP','UpdatedAt']);
  data.forEach((d,i)=>{
    lbSheet.appendRow([i+1,d.email,d.name,d.level,d.xp,new Date()]);
  });
}

function getLeaderboard(teacherCode) {
  const ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return [];
  const sheet = ss.getSheetByName('Leaderboard');
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2,1,last-1,6).getValues();
  return rows.map(r => ({ rank: r[0], userEmail: r[1], handleName: r[2], level: r[3], totalXp: r[4] }));
}

// no exports needed; functions run in GAS context
