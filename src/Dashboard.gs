function loadDashboardData(teacherCode) {
  return {
    tasks: listTasks(teacherCode),
    students: listStudents(teacherCode)
  };
}

/**
 * getTaskCompletionStatus(teacherCode):
 * 最新課題の提出状況を返す
 */
function getTaskCompletionStatus(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  var result = [];
  var tasks = listTasks(teacherCode) || [];
  if (tasks.length === 0) return result;

  var students = listStudents(teacherCode) || [];
  var classMap = getClassIdMap(teacherCode) || {};
  var classMembers = {};
  for (var i = 0; i < students.length; i++) {
    var st = students[i];
    var key = st.grade + '-' + st.class;
    if (!classMembers[key]) classMembers[key] = [];
    classMembers[key].push(st.id);
  }

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return result;
  var sheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  var submitted = {};
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var r = 0; r < rows.length; r++) {
        var sid = String(rows[r][0] || '').trim();
        var tid = String(rows[r][1] || '').trim();
        if (!sid || !tid) continue;
        if (!submitted[tid]) submitted[tid] = {};
        submitted[tid][sid] = true;
      }
    }
  }

  var limit = 5;
  for (var t = 0; t < tasks.length && t < limit; t++) {
    var task = tasks[t];
    var className = classMap[task.classId] || '';
    var total = classMembers[className] ? classMembers[className].length : 0;
    var count = submitted[task.id] ? Object.keys(submitted[task.id]).length : 0;
    var qText = '';
    try { qText = JSON.parse(task.q).question || task.q; } catch (e) { qText = task.q; }
    result.push({ id: task.id, question: qText, count: count, total: total });
  }

  return result;
}
