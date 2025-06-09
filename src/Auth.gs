var INITIAL_TEACHER_SECRET = "changeme";
function setupInitialTeacher(secretKey) {
  if (secretKey !== INITIAL_TEACHER_SECRET) {
    return { status: "error", message: "invalid_key" };
  }
  const email = Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("teacherCode_" + email)) {
    return { status: "error", message: "already_exists" };
  }
  const teacherCode = Utilities.getUuid().substring(0,6).toUpperCase();
  const folder = DriveApp.createFolder("StudyQuest_" + teacherCode);
  const ss = SpreadsheetApp.create("StudyQuest_DB_" + teacherCode);
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  const settings = ss.insertSheet("Settings");
  settings.appendRow(["ownerEmail", email]);
  props.setProperty("teacherCode_" + email, teacherCode);
  props.setProperty("ssId_" + teacherCode, ss.getId());
  props.setProperty(teacherCode, folder.getId());
  return { status: "ok", teacherCode: teacherCode };
}

// Authentication and user login helpers per StudyQuest spec v4.3

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
  const teacherDb = getTeacherDb_(teacherCode);
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

