// Authentication and user login helpers per StudyQuest spec v4.3

function getGlobalDb_() {
  const cacheKey = 'GLOBAL_DB';
  const cached = typeof getCacheValue_ === 'function' ? getCacheValue_(cacheKey) : null;
  if (cached) return cached;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('GLOBAL_DB_ID');
  if (!id) return null;
  try {
    const ss = SpreadsheetApp.openById(id);
    if (typeof putCacheValue_ === 'function') putCacheValue_(cacheKey, ss, 300);
    return ss;
  } catch (e) {
    if (typeof logError_ === 'function') logError_('getGlobalDb_', e);
    return null;
  }
}

function loginAsTeacher() {
  const email = Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  const teacherCode = props.getProperty('teacherCode_' + email);
  if (teacherCode) {
    try { if (typeof processLoginBonus === 'function') processLoginBonus(email); } catch (_) {}
    return { status: 'ok', teacherCode: teacherCode };
  }
  return { status: 'not_found' };
}

function loginAsStudent(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  const email = Session.getEffectiveUser().getEmail();
  const teacherDb = getSpreadsheetByTeacherCode(teacherCode);
  const globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return { status: 'error', message: 'invalid_teacher' };
  const enroll = teacherDb.getSheetByName('Enrollments');
  if (!enroll) return { status: 'error', message: 'not_found_in_class' };
  const last = enroll.getLastRow();
  if (last < 2) return { status: 'error', message: 'not_found_in_class' };
  const rows = enroll.getRange(2,1,last-1,enroll.getLastColumn()).getValues();
  let classData = null;
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email.toLowerCase()) {
      classData = {
        userEmail: rows[i][0],
        classRole: rows[i][1],
        grade: rows[i][2],
        class: rows[i][3],
        number: rows[i][4],
        enrolledAt: rows[i][5]
      };
      break;
    }
  }
  if (!classData) return { status: 'error', message: 'not_found_in_class' };
  const userSheet = globalDb.getSheetByName('Global_Users');
  if (!userSheet) return { status: 'error', message: 'missing_global' };
  const uLast = userSheet.getLastRow();
  let globalData = null;
  if (uLast >= 2) {
    const uRows = userSheet.getRange(2,1,uLast-1,userSheet.getLastColumn()).getValues();
    for (let i=0;i<uRows.length;i++) {
      if (String(uRows[i][0]).trim().toLowerCase() === email.toLowerCase()) {
        globalData = {
          email: uRows[i][0],
          name: uRows[i][1],
          role: uRows[i][2],
          globalXp: uRows[i][3],
          globalLevel: uRows[i][4],
          globalCoins: uRows[i][5],
          equippedTitle: uRows[i][6]
        };
        break;
      }
    }
  }
  if (!globalData) {
    globalData = { email: email, name: '', role: 'student', globalXp:0, globalLevel:1, globalCoins:0, equippedTitle:'' };
  }
  try { if (typeof processLoginBonus === 'function') processLoginBonus(email); } catch (_) {}
  return { status:'ok', userInfo:{ globalData: globalData, classData: classData } };
}
