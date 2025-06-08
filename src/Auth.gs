/**
 * Authentication helper functions using Google Identity Services.
 */

// Expected OAuth client ID used to verify ID tokens
function getOAuthClientId() {
  if (typeof PropertiesService !== 'undefined') {
    const id = PropertiesService.getScriptProperties().getProperty('OAUTH_CLIENT_ID');
    if (id) return id;
  }
  if (typeof process !== 'undefined' && process.env && process.env.OAUTH_CLIENT_ID) {
    return process.env.OAUTH_CLIENT_ID;
  }
  return '';
}

const OAUTH_CLIENT_ID = getOAuthClientId();

/**
 * Verify ID token issued by Google Identity Services and return basic user info.
 * @param {string} idToken
 * @return {{email:string,name:string,sub:string}}
 */
function verifyGoogleToken(idToken) {
  console.time('verifyGoogleToken');
  if (!idToken) {
    console.timeEnd('verifyGoogleToken');
    throw new Error('Invalid ID token');
  }
  const cacheKey = 'gidTok_' + idToken;
  const cached = getCacheValue_(cacheKey);
  if (cached) {
    console.timeEnd('verifyGoogleToken');
    return cached;
  }
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const res = UrlFetchApp.fetch(url);
  const data = JSON.parse(res.getContentText());
  if (data.aud !== OAUTH_CLIENT_ID) {
    console.timeEnd('verifyGoogleToken');
    throw new Error('OAuth client ID mismatch');
  }
  if (data.iss !== 'https://accounts.google.com' && data.iss !== 'accounts.google.com') {
    console.timeEnd('verifyGoogleToken');
    throw new Error('Invalid token issuer');
  }
  if (Number(data.exp) <= Math.floor(Date.now() / 1000)) {
    console.timeEnd('verifyGoogleToken');
    throw new Error('Token expired');
  }
  const info = { email: data.email, name: data.name || '', sub: data.sub };
  putCacheValue_(cacheKey, info, 300);
  console.timeEnd('verifyGoogleToken');
  return info;
}

/**
 * Handle teacher authentication and registration.json management.
 * @param {string} idToken
 * @param {string} passcode
 */
function handleTeacherAuth(idToken, passcode) {
  console.time('handleTeacherAuth');
  const user = verifyGoogleToken(idToken);
  const props = PropertiesService.getScriptProperties();
  const storedPass = props.getProperty('teacherPasscode');
  if (!storedPass) {
    props.setProperty('teacherPasscode', passcode);
  } else if (storedPass !== passcode) {
    console.timeEnd('handleTeacherAuth');
    throw new Error('Invalid passcode');
  }
  const cacheKey = 'reg_' + user.sub;
  let registration = getCacheValue_(cacheKey);
  if (!registration) {
    const files = Drive.Files.list({
      q: "name='registration.json' and 'appDataFolder' in parents and trashed=false",
      spaces: 'appDataFolder'
    }).items || [];
    if (files.length > 0) {
      const blob = DriveApp.getFileById(files[0].id).getBlob().getDataAsString();
      registration = JSON.parse(blob);
      putCacheValue_(cacheKey, registration, 300);
    }
  }

  if (registration) {
    console.timeEnd('handleTeacherAuth');
    return registration;
  }

  const result = initTeacher();
  const folderId = PropertiesService.getScriptProperties().getProperty(result.teacherCode);
  registration = { role: 'teacher', teacherCode: result.teacherCode, folderId: folderId };
  const blob = Utilities.newBlob(JSON.stringify(registration), 'application/json', 'registration.json');
  Drive.Files.insert({ title: 'registration.json', parents: [{ id: 'appDataFolder' }] }, blob);
  putCacheValue_(cacheKey, registration, 300);
  console.timeEnd('handleTeacherAuth');
  return registration;
}

/**
 * Get student registration info from appDataFolder.
 * @param {string} idToken
 */
function getStudentInfo(idToken) {
  console.time('getStudentInfo');
  const user = verifyGoogleToken(idToken); // ensure token is valid
  const cacheKey = 'reg_' + user.sub;
  let info = getCacheValue_(cacheKey);
  if (!info) {
    const files = Drive.Files.list({
      q: "name='registration.json' and 'appDataFolder' in parents and trashed=false",
      spaces: 'appDataFolder'
    }).items || [];
    if (files.length === 0) {
      info = { status: 'new' };
    } else {
      const blob = DriveApp.getFileById(files[0].id).getBlob().getDataAsString();
      info = JSON.parse(blob);
    }
    putCacheValue_(cacheKey, info, 60);
  }
  console.timeEnd('getStudentInfo');
  return info;
}

/**
 * Register student to class and update registration.json.
 * @param {string} idToken
 * @param {{teacherCode:string,grade:string,classroom:string,number:string,studentId:string}} info
 */
function registerStudentToClass(idToken, info) {
  console.time('registerStudentToClass');
  const user = verifyGoogleToken(idToken);
  const cacheKey = 'reg_' + user.sub;
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
  } else {
    const cached = getCacheValue_(cacheKey);
    if (cached) registration = cached;
  }
  registration.registrations = registration.registrations || [];
  const exists = registration.registrations.some(r =>
    r.teacherCode === info.teacherCode && r.studentId === info.studentId);
  if (!exists) {
    registration.registrations.push({ teacherCode: info.teacherCode, studentId: info.studentId });
  }

  const blob = Utilities.newBlob(JSON.stringify(registration), 'application/json', 'registration.json');
  if (fileId) {
    Drive.Files.update({}, fileId, blob);
  } else {
    Drive.Files.insert({ title: 'registration.json', parents: [{ id: 'appDataFolder' }] }, blob);
  }
  putCacheValue_(cacheKey, registration, 300);

  initStudent(info.teacherCode, info.grade, info.classroom, info.number);
  console.timeEnd('registerStudentToClass');
  return { status: 'ok' };
}

// Export for Jest tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    verifyGoogleToken,
    handleTeacherAuth,
    getStudentInfo,
    registerStudentToClass,
    getOAuthClientId
  };
}
