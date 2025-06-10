function registerUsersFromCsv(teacherCode, csvData) {
  teacherCode = String(teacherCode || '').trim();
  if (!csvData) return { status: 'error', message: 'no_data' };
  var teacherDb = getTeacherDb_(teacherCode);
  var globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return { status: 'error', message: 'db_not_found' };
  var userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  var enrollSheet = teacherDb.getSheetByName('Enrollments');
  if (!userSheet || !enrollSheet) return { status: 'error', message: 'missing_sheet' };
  var rows = Utilities.parseCsv(csvData).slice(1); // skip header row
  var now = new Date();
  var existingData = userSheet
    .getRange(2, 1, Math.max(0, userSheet.getLastRow() - 1), 3)
    .getValues();
  var existingMap = {};
  existingData.forEach(function(r) {
    var email = String(r[0] || '').trim().toLowerCase();
    var role = String(r[2] || '').trim().toLowerCase();
    if (email) existingMap[email] = role;
  });
  var userAppend = [];
  var enrollAppend = [];
  var duplicates = [];
  var seen = {};
  var created = 0;
  rows.forEach(function(r, idx) {
    var email = String(r[0] || '').trim();
    if (!email) return;
    var emailLower = email.toLowerCase();
    var isExistingStudent = existingMap[emailLower] === 'student';
    if (isExistingStudent || seen[emailLower]) {
      duplicates.push(email);
      return;
    }
    var name = r[1] || '';
    var grade = r[2] || '';
    var cls = r[3] || '';
    var number = r[4] || '';
    userAppend.push([email, name, 'student', 0, 1, 0, '', now, now, 1]);
    enrollAppend.push([email, 'student', grade, cls, number, now]);
    if (typeof grantStudentAccess === 'function') {
      try { grantStudentAccess(teacherCode, email); } catch (e) {}
    }
    existingMap[emailLower] = 'student';
    seen[emailLower] = true;
    created++;
  });
  if (userAppend.length)
    userSheet.getRange(userSheet.getLastRow()+1,1,userAppend.length,userAppend[0].length).setValues(userAppend);
  if (enrollAppend.length)
    enrollSheet.getRange(enrollSheet.getLastRow()+1,1,enrollAppend.length,enrollAppend[0].length).setValues(enrollAppend);
  if (enrollAppend.length && typeof loadTeacherSettings_ === 'function' && typeof saveTeacherSettings_ === 'function') {
    var classMap = {};
    enrollAppend.forEach(function(r) {
      var g = String(r[2] || '');
      var c = String(r[3] || '');
      if (g && c) classMap[g + '-' + c] = [g, c];
    });
    var settings = loadTeacherSettings_(teacherCode);
    var added = false;
    var existing = settings.classes || [];
    Object.keys(classMap).forEach(function(key) {
      var pair = classMap[key];
      var found = existing.some(function(p) {
        return String(p[0]) === pair[0] && String(p[1]) === pair[1];
      });
      if (!found) {
        existing.push(pair);
        added = true;
      }
    });
    if (added) {
      settings.classes = existing;
      saveTeacherSettings_(teacherCode, settings);
      if (typeof removeCacheValue_ === 'function') removeCacheValue_('classmap_' + teacherCode);
    }
  }
  return { status: 'success', created: created, enrolled: enrollAppend.length, duplicates: duplicates };
}

function registerSingleStudent(teacherCode, studentData) {
  teacherCode = String(teacherCode || '').trim();
  if (!studentData || !studentData.email) return { status: 'error', message: 'invalid' };
  var teacherDb = getTeacherDb_(teacherCode);
  var globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return { status: 'error', message: 'db_not_found' };
  var userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  var enrollSheet = teacherDb.getSheetByName('Enrollments');
  if (!userSheet || !enrollSheet) return { status: 'error', message: 'missing_sheet' };
  var email = String(studentData.email).trim();
  var now = new Date();
  var existingEmails = userSheet.getRange(2,1,Math.max(0,userSheet.getLastRow()-1),1).getValues().flat().map(function(e){return String(e).toLowerCase();});
  if (!existingEmails.includes(email.toLowerCase())) {
    userSheet.getRange(userSheet.getLastRow()+1,1,1,10).setValues([[email, studentData.name || '', 'student', 0, 1, 0, '', now, now, 1]]);
  }
  enrollSheet.getRange(enrollSheet.getLastRow()+1,1,1,6).setValues([[email, 'student', studentData.grade || '', studentData.class || '', studentData.number || '', now]]);
  if (typeof grantStudentAccess === 'function') {
    try { grantStudentAccess(teacherCode, email); } catch (e) {}
  }

  if (typeof loadTeacherSettings_ === 'function' && typeof saveTeacherSettings_ === 'function') {
    var g = String(studentData.grade || '');
    var c = String(studentData.class || '');
    if (g && c) {
      var settings = loadTeacherSettings_(teacherCode);
      var exists = (settings.classes || []).some(function(p) {
        return String(p[0]) === g && String(p[1]) === c;
      });
      if (!exists) {
        settings.classes.push([g, c]);
        saveTeacherSettings_(teacherCode, settings);
        if (typeof removeCacheValue_ === 'function') removeCacheValue_('classmap_' + teacherCode);
      }
    }
  }
  return { status: 'ok' };
}

function deleteStudentsFromClass(teacherCode, emailsToDelete) {
  teacherCode = String(teacherCode || '').trim();
  if (!Array.isArray(emailsToDelete) || emailsToDelete.length === 0) return { status: 'ok', deletedCount: 0 };
  var teacherDb = getTeacherDb_(teacherCode);
  if (!teacherDb) return { status: 'error', message: 'db_not_found', deletedCount: 0 };
  var sheet = teacherDb.getSheetByName('Enrollments');
  if (!sheet) return { status: 'error', message: 'missing_sheet', deletedCount: 0 };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', deletedCount: 0 };
  var data = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  var filtered = data.filter(function(r) { return emailsToDelete.indexOf(String(r[0]).trim()) < 0; });
  sheet.clear();
  sheet.appendRow(['UserEmail','Role','Grade','Class','Number','EnrolledAt']);
  if (filtered.length) sheet.getRange(2,1,filtered.length,filtered[0].length).setValues(filtered);
  return { status: 'ok', deletedCount: data.length - filtered.length };
}
