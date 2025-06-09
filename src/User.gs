function registerUsersFromCsv(teacherCode, csvData) {
  teacherCode = String(teacherCode || '').trim();
  if (!csvData) return { status: 'error', message: 'no_data' };
  const teacherDb = getTeacherDb_(teacherCode);
  const globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return { status: 'error', message: 'db_not_found' };
  const userSheet = globalDb.getSheetByName('Global_Users');
  const enrollSheet = teacherDb.getSheetByName('Enrollments');
  if (!userSheet || !enrollSheet) return { status: 'error', message: 'missing_sheet' };
  const rows = Utilities.parseCsv(csvData);
  const now = new Date();
  const existingEmails = userSheet.getRange(2,1,Math.max(0,userSheet.getLastRow()-1),1).getValues().flat().map(e=>String(e).toLowerCase());
  const userAppend = [];
  const enrollAppend = [];
  let created = 0;
  rows.forEach(r => {
    const email = String(r[0] || '').trim();
    if (!email) return;
    const name = r[1] || '';
    const grade = r[2] || '';
    const cls = r[3] || '';
    const number = r[4] || '';
    if (!existingEmails.includes(email.toLowerCase())) {
      userAppend.push([email, name, 'student', 0, 1, 0, '', now, now, 1]);
      existingEmails.push(email.toLowerCase());
      created++;
    }
    enrollAppend.push([email, 'student', grade, cls, number, now]);
  });
  if (userAppend.length)
    userSheet.getRange(userSheet.getLastRow()+1,1,userAppend.length,userAppend[0].length).setValues(userAppend);
  if (enrollAppend.length)
    enrollSheet.getRange(enrollSheet.getLastRow()+1,1,enrollAppend.length,enrollAppend[0].length).setValues(enrollAppend);
  return { status: 'success', created: created, enrolled: enrollAppend.length };
}

function registerSingleStudent(teacherCode, studentData) {
  teacherCode = String(teacherCode || '').trim();
  if (!studentData || !studentData.email) return { status: 'error', message: 'invalid' };
  const teacherDb = getTeacherDb_(teacherCode);
  const globalDb = getGlobalDb_();
  if (!teacherDb || !globalDb) return { status: 'error', message: 'db_not_found' };
  const userSheet = globalDb.getSheetByName('Global_Users');
  const enrollSheet = teacherDb.getSheetByName('Enrollments');
  if (!userSheet || !enrollSheet) return { status: 'error', message: 'missing_sheet' };
  const email = String(studentData.email).trim();
  const now = new Date();
  const existingEmails = userSheet.getRange(2,1,Math.max(0,userSheet.getLastRow()-1),1).getValues().flat().map(e=>String(e).toLowerCase());
  if (!existingEmails.includes(email.toLowerCase())) {
    userSheet.getRange(userSheet.getLastRow()+1,1,1,10).setValues([[email, studentData.name || '', 'student', 0, 1, 0, '', now, now, 1]]);
  }
  enrollSheet.getRange(enrollSheet.getLastRow()+1,1,1,6).setValues([[email, 'student', studentData.grade || '', studentData.class || '', studentData.number || '', now]]);
  return { status: 'ok' };
}

function deleteStudentsFromClass(teacherCode, emailsToDelete) {
  teacherCode = String(teacherCode || '').trim();
  if (!Array.isArray(emailsToDelete) || emailsToDelete.length === 0) return { status: 'ok', deletedCount: 0 };
  const teacherDb = getTeacherDb_(teacherCode);
  if (!teacherDb) return { status: 'error', message: 'db_not_found', deletedCount: 0 };
  const sheet = teacherDb.getSheetByName('Enrollments');
  if (!sheet) return { status: 'error', message: 'missing_sheet', deletedCount: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', deletedCount: 0 };
  const data = sheet.getRange(2,1,lastRow-1,sheet.getLastColumn()).getValues();
  const filtered = data.filter(r => emailsToDelete.indexOf(String(r[0]).trim()) < 0);
  sheet.clear();
  sheet.appendRow(['UserEmail','Role','Grade','Class','Number','EnrolledAt']);
  if (filtered.length) sheet.getRange(2,1,filtered.length,filtered[0].length).setValues(filtered);
  return { status: 'ok', deletedCount: data.length - filtered.length };
}
