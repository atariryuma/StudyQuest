function addLike(teacherCode, taskId, targetStudentId) {
  teacherCode = String(teacherCode || '').trim();
  taskId = String(taskId || '').trim();
  targetStudentId = String(targetStudentId || '').trim();
  if (!teacherCode || !taskId || !targetStudentId) return { status: 'error', message: 'invalid_params' };

  var role = (typeof getCurrentUserRole === 'function') ? getCurrentUserRole() : '';
  if (!role) return { status: 'error', message: 'unauthenticated' };

  var value = role === 'teacher' ? 5 : 1;
  var email = (typeof Session !== 'undefined' && Session.getEffectiveUser) ? Session.getEffectiveUser().getEmail() : '';

  var ss = getSpreadsheetByTeacherCode(teacherCode);
  if (!ss) return { status: 'error', message: 'invalid_teacher' };
  var likesSheet = ss.getSheetByName(CONSTS.SHEET_LIKES || 'Likes');
  var subsSheet = ss.getSheetByName(CONSTS.SHEET_SUBMISSIONS);
  var studentsSheet = ss.getSheetByName(CONSTS.SHEET_STUDENTS);
  var enrollSheet = ss.getSheetByName('Enrollments');
  if (!likesSheet || !subsSheet || !studentsSheet || !enrollSheet) return { status: 'error', message: 'missing_sheet' };
  var globalDb = getGlobalDb_();
  if (!globalDb) return { status: 'error', message: 'missing_global' };
  var userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!userSheet) return { status: 'error', message: 'missing_global' };

  // check duplicate
  var last = likesSheet.getLastRow();
  if (last >= 2) {
    var vals = likesSheet.getRange(2,1,last-1,6).getValues();
    for (var i=0;i<vals.length;i++) {
      if (String(vals[i][1])===taskId && String(vals[i][2])===targetStudentId && String(vals[i][3])===email) {
        return { status: 'ignored' };
      }
    }
  }

  var parts = targetStudentId.split('-');
  var targetEmail = '';
  if (parts.length === 3) {
    var eLast = enrollSheet.getLastRow();
    if (eLast >= 2) {
      var eVals = enrollSheet.getRange(2,1,eLast-1,enrollSheet.getLastColumn()).getValues();
      for (var j=0;j<eVals.length;j++) {
        if (String(eVals[j][2])===parts[0] && String(eVals[j][3])===parts[1] && String(eVals[j][4])===parts[2]) {
          targetEmail = eVals[j][0];
          break;
        }
      }
    }
  }

  var likeScoreCol = 14;
  var subsLast = subsSheet.getLastRow();
  var score = 0;
  if (subsLast >= 2) {
    var subsVals = subsSheet.getRange(2,1,subsLast-1,likeScoreCol).getValues();
    for (var s=0;s<subsVals.length;s++) {
      if (String(subsVals[s][0])===targetStudentId && String(subsVals[s][1])===taskId) {
        var rowIdx = s+2;
        score = Number(subsVals[s][13]) || 0;
        subsSheet.getRange(rowIdx, likeScoreCol).setValue(score + value);
        score += value;
        break;
      }
    }
  }

  var map = {};
  var uLast = userSheet.getLastRow();
  if (uLast >= 2) {
    var uVals = userSheet.getRange(2,1,uLast-1,12).getValues();
    for (var u=0;u<uVals.length;u++) {
      map[String(uVals[u][0]).toLowerCase()] = u+2;
    }
  }
  var likerRow = map[email.toLowerCase()];
  var targetRow = map[String(targetEmail).toLowerCase()];
  if (likerRow) {
    var given = Number(userSheet.getRange(likerRow,11).getValue()) || 0;
    userSheet.getRange(likerRow,11).setValue(given + value);
  }
  if (targetRow) {
    var rec = Number(userSheet.getRange(targetRow,12).getValue()) || 0;
    userSheet.getRange(targetRow,12).setValue(rec + value);
  }

  var sMap = getStudentRowMap_ ? getStudentRowMap_(teacherCode, studentsSheet) : {};
  var sRow = sMap[targetStudentId];
  if (sRow) {
    var tot = Number(studentsSheet.getRange(sRow,11).getValue()) || 0;
    studentsSheet.getRange(sRow,11).setValue(tot + value);
  }

  likesSheet.appendRow([Utilities.getUuid(), taskId, targetStudentId, email, value, new Date()]);
  removeCacheValue_('board_' + teacherCode);
  removeCacheValue_('taskBoard_' + teacherCode + '_' + taskId);
  return { status: 'ok', newScore: score };
}
