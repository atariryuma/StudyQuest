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

function processLoginBonus(userEmail, teacherCode, studentId) {
  userEmail   = String(userEmail || '').trim();
  teacherCode = String(teacherCode || '').trim();
  studentId   = String(studentId || '').trim();
  if (!userEmail) return { added: 0, already: false };
  var diffDays = 0;
  var added = 0;
  const lock = LockService.getScriptLock();
  try {
    if (lock.waitLock) lock.waitLock(5000);
    const db = getGlobalDb_();
    if (!db) return;
    const sheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
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
    diffDays = Math.floor((now - lastLogin) / 86400000);
    if (diffDays === 1) {
      streak += 1;
    } else if (diffDays > 1) {
      streak = 1;
    }
    sheet.getRange(row, 9, 1, 2).setValues([[now, streak]]);
    if (diffDays !== 0) {
      added = 50;
      var totalXp = Number(sheet.getRange(row, 4).getValue()) || 0;
      totalXp += added;
      var lvl = calcLevelFromXp_(totalXp);
      sheet.getRange(row, 4, 1, 2).setValues([[totalXp, lvl]]);
    }
  } finally {
    if (lock.releaseLock) lock.releaseLock();
  }
  if (added && teacherCode && studentId) {
    try { if (typeof updateStudentLogin === 'function') updateStudentLogin(teacherCode, studentId); } catch (_) {}
    try { if (typeof addStudentXp === 'function') addStudentXp(teacherCode, studentId, added); } catch (_) {}
  }
  return { added: added, already: diffDays === 0 };
}

function checkAndAwardTrophies(userEmail, context) {
  userEmail = String(userEmail || '').trim();
  if (!userEmail) return [];

  context = context || {};
  const teacherCode = context.teacherCode;

  const teacherDb = getSpreadsheetByTeacherCode(teacherCode);
  const globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return [];

  const trophySheet = teacherDb.getSheetByName(CONSTS.SHEET_TROPHIES);
  const logSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_TROPHIES_LOG);
  const userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!trophySheet || !logSheet || !userSheet) return [];

  const userEmails = userSheet.getRange(2, 1, Math.max(0, userSheet.getLastRow() - 1), 1)
                               .getValues().flat();
  const uIdx = userEmails.indexOf(userEmail);
  if (uIdx === -1) return [];

  const userRow = userSheet.getRange(uIdx + 2, 1, 1, userSheet.getLastColumn()).getValues()[0];
  const userData = {
    Global_TotalXP: Number(userRow[3]) || 0,
    Global_Level: Number(userRow[4]) || 0,
    Global_Coins: Number(userRow[5]) || 0,
    LoginStreak: Number(userRow[9]) || 0
  };

  let logs = [];
  if (logSheet.getLastRow() > 1) {
    logs = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 3).getValues();
  }
  const earned = new Set();
  logs.forEach(r => {
    if (r[1] === userEmail) earned.add(r[2]);
  });

  let trophies = [];
  if (trophySheet.getLastRow() > 1) {
    trophies = trophySheet.getRange(2, 1, trophySheet.getLastRow() - 1, 5).getValues();
  }
  const awarded = [];

  trophies.forEach(row => {
    const id = row[0];
    if (!id || earned.has(id)) return;
    let cond;
    try {
      cond = JSON.parse(row[4]);
    } catch (e) {
      cond = null;
    }
    if (!cond) return;
    if (evaluateTrophyCondition_(cond, userData, context)) {
      logSheet.appendRow([Utilities.getUuid(), userEmail, id, new Date()]);
      awarded.push(id);
    }
  });
  return awarded;
}

function evaluateTrophyCondition_(cond, userData, context) {
  if (typeof cond !== 'object' || cond === null) return false;
  for (var key in cond) {
    var expected = cond[key];
    var actual = userData[key];
    if (actual === undefined) actual = context[key];
    if (actual === undefined) return false;
    if (typeof expected === 'number') {
      if (Number(actual) < expected) return false;
    } else if (typeof expected === 'object') {
      if ('gte' in expected || '$gte' in expected) {
        var g = expected.gte !== undefined ? expected.gte : expected.$gte;
        if (Number(actual) < Number(g)) return false;
      } else if ('eq' in expected || '$eq' in expected) {
        var eq = expected.eq !== undefined ? expected.eq : expected.$eq;
        if (actual != eq) return false;
      } else {
        if (actual !== expected) return false;
      }
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
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
    const userSheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
    const invSheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_ITEMS);
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
  const userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!enrollSheet || !lbSheet || !userSheet) return;
  const emails = enrollSheet.getRange(2,1,enrollSheet.getLastRow()-1,1).getValues().flat();
  var userRows = userSheet.getRange(2,1,userSheet.getLastRow()-1,6).getValues();
  var map = {};
  userRows.forEach(function(r) {
    if (String(r[2]) === 'student') {
      map[r[0]] = { name: r[1], level: r[4], xp: r[3] };
    }
  });
  var data = [];
  emails.forEach(function(e) {
    if (map[e]) {
      data.push({ email: e, name: map[e].name, level: map[e].level, xp: map[e].xp });
    }
  });
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

function getGlobalLeaderboard(limit) {
  const db = getGlobalDb_();
  if (!db) return [];
  const sheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!sheet) return [];
  const rows = sheet.getRange(2,1,Math.max(0, sheet.getLastRow()-1),6).getValues();
  var data = [];
  rows.forEach(function(r) {
    if (String(r[2]) === 'student') {
      data.push({ handleName: r[1], level: r[4], totalXp: r[3] });
    }
  });
  data.sort(function(a,b){ return b.totalXp - a.totalXp; });
  if (limit) data = data.slice(0, limit);
  return data.map(function(d,i){ return { rank:i+1, handleName:d.handleName, level:d.level, totalXp:d.totalXp }; });
}

// no exports needed; functions run in GAS context
