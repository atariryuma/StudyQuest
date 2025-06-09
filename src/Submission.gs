const XP_PER_SUBMISSION = 10;

// Fallbacks for non-GAS environments (tests)
if (typeof getTaskMap_ !== 'function') {
  function getTaskMap_() { return {}; }
}
if (typeof getSpreadsheetByTeacherCode !== 'function') {
  function getSpreadsheetByTeacherCode() { return null; }
}
if (typeof getGlobalDb_ !== 'function') {
  function getGlobalDb_() { return null; }
}
if (typeof submitAnswer !== 'function') {
  function submitAnswer() {}
}
if (typeof calcLevelFromXp_ !== 'function') {
  function calcLevelFromXp_(xp) {
    var lvl = 1; var rest = xp;
    while (rest >= lvl * 100) { rest -= lvl * 100; lvl++; }
    return lvl;
  }
}
if (typeof summarizeStudentAnswer !== 'function') {
  function summarizeStudentAnswer() { return ''; }
}
if (typeof checkAndAwardTrophies !== 'function') {
  function checkAndAwardTrophies() { return []; }
}
if (typeof LockService === 'undefined') {
  var LockService = { getScriptLock: function(){ return { waitLock: function(){}, releaseLock: function(){} }; } };
}

function processSubmission(teacherCode, studentId, taskId, answer) {
  teacherCode = String(teacherCode || '').trim();
  studentId   = String(studentId || '').trim();
  taskId      = String(taskId || '').trim();
  answer      = String(answer || '').trim();
  if (!teacherCode || !studentId || !taskId) {
    return { status: 'error', message: 'invalid_params' };
  }

  var map = getTaskMap_(teacherCode) || {};
  var task = map[taskId];
  if (!task || task.closed) {
    return { status: 'error', message: 'task_closed' };
  }

  var taskObj = {};
  try { taskObj = JSON.parse(task.q || '{}'); } catch (e) {}

  var earnedXp = XP_PER_SUBMISSION;
  var db = getGlobalDb_();
  if (!db) return { status: 'error', message: 'missing_global' };
  var sheet = db.getSheetByName('Global_Users');
  if (!sheet) return { status: 'error', message: 'missing_global' };

  var last = sheet.getLastRow();
  var emails = last >= 2 ? sheet.getRange(2,1,last-1,1).getValues().flat() : [];
  var idx = emails.indexOf(studentId);
  if (idx === -1) {
    sheet.appendRow([studentId, studentId, 'student', earnedXp, 1, 0, '', new Date(), new Date(), 1]);
    idx = emails.length;
    last = sheet.getLastRow();
  }
  var row = idx + 2;
  var totalXp = Number(sheet.getRange(row,4).getValue()) || 0;
  totalXp += earnedXp;
  var level = calcLevelFromXp_(totalXp);
  sheet.getRange(row,4,1,2).setValues([[totalXp, level]]);
  var coins = Number(sheet.getRange(row,6).getValue()) || 0;
  sheet.getRange(row,6).setValue(coins + Math.floor(earnedXp/10));

  var aiSummary = '';
  if (taskObj && taskObj.type === 'free_text') {
    aiSummary = summarizeStudentAnswer(answer);
  }

  var trophies = checkAndAwardTrophies(studentId, { teacherCode: teacherCode });

  submitAnswer(teacherCode, studentId, taskId, answer,
               earnedXp, totalXp, level, trophies.join(','),
               0, 1, null, new Date(), '', taskObj.question, aiSummary);

  return {
    status: 'ok',
    correctAnswer: taskObj.correctAnswer || '',
    explanation: taskObj.explanation || '',
    earnedXp: earnedXp,
    totalXp: totalXp,
    level: level,
    trophies: trophies
  };
}
