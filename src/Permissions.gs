// Drive permission helpers

function grantTeacherAccess(email) {
  var fileId = PropertiesService.getScriptProperties()
    .getProperty(CONSTS.PROP_GLOBAL_MASTER_DB);
  if (!fileId || !email) {
    return { status: 'error', message: 'missing_params' };
  }
  var resource = {
    role: 'writer',
    type: 'user',
    emailAddress: email
  };
  Drive.Permissions.create(resource, fileId, { sendNotificationEmails: false });
  return { status: 'ok' };
}

function grantStudentAccess(teacherCode, email) {
  teacherCode = String(teacherCode || '').trim();
  if (!teacherCode || !email) {
    return { status: 'error', message: 'missing_params' };
  }
  var props = PropertiesService.getScriptProperties();
  var teacherDbId = props.getProperty(CONSTS.PROP_TEACHER_SSID_PREFIX + teacherCode);
  var globalDbId  = props.getProperty(CONSTS.PROP_GLOBAL_MASTER_DB);
  if (!teacherDbId || !globalDbId) {
    return { status: 'error', message: 'missing_db' };
  }
  var writer = {
    role: 'writer',
    type: 'user',
    emailAddress: email
  };
  Drive.Permissions.create(writer, teacherDbId, { sendNotificationEmails: false });
  var reader = {
    role: 'reader',
    type: 'user',
    emailAddress: email
  };
  Drive.Permissions.create(reader, globalDbId, { sendNotificationEmails: false });
  return { status: 'ok' };
}
