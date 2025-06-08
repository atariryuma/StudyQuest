/**
 * Authentication helper functions using Google Identity Services.
 */

/**
 * Verify ID token issued by Google Identity Services and return basic user info.
 * @param {string} idToken
 * @return {{email:string,name:string,sub:string}}
 */
function verifyGoogleToken(idToken) {
  if (!idToken) throw new Error('Invalid ID token');
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const res = UrlFetchApp.fetch(url);
  const data = JSON.parse(res.getContentText());
  return { email: data.email, name: data.name || '', sub: data.sub };
}

/**
 * Handle teacher authentication and registration.json management.
 * @param {string} idToken
 * @param {string} passcode
 */
function handleTeacherAuth(idToken, passcode) {
  const user = verifyGoogleToken(idToken);
  const files = Drive.Files.list({
    q: "name='registration.json' and 'appDataFolder' in parents and trashed=false",
    spaces: 'appDataFolder'
  }).items || [];

  if (files.length > 0) {
    const blob = DriveApp.getFileById(files[0].id).getBlob().getDataAsString();
    return JSON.parse(blob);
  }

  if (passcode !== 'kyoushi') {
    return { status: 'error', message: 'パスコードが違います。' };
  }

  const result = initTeacher(passcode);
  const folderId = PropertiesService.getScriptProperties().getProperty(result.teacherCode);
  const registration = { role: 'teacher', teacherCode: result.teacherCode, folderId: folderId };
  const blob = Utilities.newBlob(JSON.stringify(registration), 'application/json', 'registration.json');
  Drive.Files.insert({ title: 'registration.json', parents: [{ id: 'appDataFolder' }] }, blob);
  return registration;
}

/**
 * Get student registration info from appDataFolder.
 * @param {string} idToken
 */
function getStudentInfo(idToken) {
  verifyGoogleToken(idToken); // ensure token is valid
  const files = Drive.Files.list({
    q: "name='registration.json' and 'appDataFolder' in parents and trashed=false",
    spaces: 'appDataFolder'
  }).items || [];
  if (files.length === 0) return { status: 'new' };
  const blob = DriveApp.getFileById(files[0].id).getBlob().getDataAsString();
  return JSON.parse(blob);
}

/**
 * Register student to class and update registration.json.
 * @param {string} idToken
 * @param {{teacherCode:string,grade:string,classroom:string,number:string,studentId:string}} info
 */
function registerStudentToClass(idToken, info) {
  verifyGoogleToken(idToken);
  const files = Drive.Files.list({
    q: "name='registration.json' and 'appDataFolder' in parents and trashed=false",
    spaces: 'appDataFolder'
  }).items || [];

  let registration = { role: 'student', totalXP: 0, level: 1, trophies: [], registrations: [] };
  let fileId = null;
  if (files.length > 0) {
    fileId = files[0].id;
    const blob = DriveApp.getFileById(fileId).getBlob().getDataAsString();
    registration = JSON.parse(blob);
  }
  registration.registrations = registration.registrations || [];
  registration.registrations.push({ teacherCode: info.teacherCode, studentId: info.studentId });

  const blob = Utilities.newBlob(JSON.stringify(registration), 'application/json', 'registration.json');
  if (fileId) {
    Drive.Files.update({}, fileId, blob);
  } else {
    Drive.Files.insert({ title: 'registration.json', parents: [{ id: 'appDataFolder' }] }, blob);
  }

  initStudent(info.teacherCode, info.grade, info.classroom, info.number);
  return { status: 'ok' };
}

// Export for Jest tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyGoogleToken, handleTeacherAuth, getStudentInfo, registerStudentToClass };
}
