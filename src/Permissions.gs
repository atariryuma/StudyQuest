// Drive permission helpers

function grantTeacherAccess(email) {
  const fileId = PropertiesService.getScriptProperties()
    .getProperty(CONSTS.PROP_GLOBAL_MASTER_DB);
  if (!fileId || !email) {
    return { status: 'error', message: 'missing_params' };
  }
  const resource = {
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
  const props = PropertiesService.getScriptProperties();
  const teacherDbId = props.getProperty(CONSTS.PROP_TEACHER_SSID_PREFIX + teacherCode);
  const globalDbId  = props.getProperty(CONSTS.PROP_GLOBAL_MASTER_DB);
  if (!teacherDbId || !globalDbId) {
    return { status: 'error', message: 'missing_db' };
  }
  const writer = {
    role: 'writer',
    type: 'user',
    emailAddress: email
  };
  Drive.Permissions.create(writer, teacherDbId, { sendNotificationEmails: false });
  const reader = {
    role: 'reader',
    type: 'user',
    emailAddress: email
  };
  Drive.Permissions.create(reader, globalDbId, { sendNotificationEmails: false });
  return { status: 'ok' };
}
