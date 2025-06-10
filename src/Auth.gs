function setupInitialTeacher(secretKey) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty(CONSTS.PROP_TEACHER_PASSCODE);
  if (!stored || secretKey !== stored) {
    return { status: "error", message: "invalid_key" };
  }

  const email = Session.getEffectiveUser().getEmail();
  if (props.getProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email)) {
    return { status: "error", message: "already_exists" };
  }

  // Step2: register user in Global_Users if missing
  if (typeof getGlobalDb_ === 'function') {
    const globalDb = getGlobalDb_();
    if (globalDb) {
      const userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
      if (userSheet) {
        const last = userSheet.getLastRow();
        let exists = false;
        if (last >= 2) {
          const emails = userSheet.getRange(2, 1, last - 1, 1).getValues().flat();
          exists = emails.some(e => String(e).trim().toLowerCase() === email.toLowerCase());
        }
        if (!exists) {
          const handle = String(email).split('@')[0];
          const now = new Date();
          userSheet.getRange(last + 1, 1, 1, 10).setValues([[
            email,
            handle,
            'teacher',
            0,
            0,
            0,
            '',
            now,
            now,
            1
          ]]);
        }
      }
    }
  }

  const teacherCode = Utilities.getUuid().substring(0, 6).toUpperCase();
  const folder = DriveApp.createFolder(CONSTS.FOLDER_NAME_PREFIX + teacherCode);
  const ss = SpreadsheetApp.create('StudyQuest_DB_' + teacherCode);
  DriveApp.getFileById(ss.getId()).moveTo(folder);

  // create student CSV template in the teacher folder
  try {
    if (typeof createStudentTemplateFile_ === 'function') {
      createStudentTemplateFile_(folder, teacherCode);
    }
  } catch (_) {}

  // Step4: create sheets with headers
  const sheetDefs = [
    { name: 'Enrollments', headers: ['UserEmail','ClassRole','Grade','Class','Number','EnrolledAt'] },
    { name: CONSTS.SHEET_STUDENTS, headers: ['StudentID','Grade','Class','Number','FirstLogin','LastLogin','LoginCount','TotalXP','Level','LastTrophyID'] },
    { name: 'Tasks', headers: ['TaskID','ClassID','Subject','Question','Type','Choices','AllowSelfEval','CreatedAt','Persona','Status','draft','Difficulty','TimeLimit','XPBase','CorrectAnswer'] },
    { name: 'Submissions', headers: ['StudentID','TaskID','Question','StartedAt','SubmittedAt','ProductURL','QuestionSummary','AnswerSummary','EarnedXP','TotalXP','Level','Trophy','Status'] },
    { name: 'Trophies', headers: ['TrophyID','Name','Description','IconURL','Condition'] },
    { name: 'Items', headers: ['ItemID','Name','Type','Price','Effect'] },
    { name: 'Leaderboard', headers: ['Rank','UserEmail','HandleName','Level','TotalXP','UpdatedAt'] },
    { name: 'Settings', headers: ['type','value1','value2'] },
    { name: 'TOC', headers: ['Sheet','Description'] }
  ];
  sheetDefs.forEach(def => {
    const sh = ss.insertSheet(def.name);
    sh.appendRow(def.headers);
  });

  // record owner email in Settings sheet
  const settings = ss.getSheetByName(CONSTS.SHEET_SETTINGS);
  if (settings) settings.appendRow(['ownerEmail', email]);

  props.setProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email, teacherCode);
  props.setProperty(CONSTS.PROP_TEACHER_SSID_PREFIX + teacherCode, ss.getId());
  props.setProperty(teacherCode, folder.getId());
  return { status: "ok", teacherCode: teacherCode };
}

// Authentication and user login helpers per StudyQuest spec v4.3

function handleTeacherLogin() {
  const email = Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  const code = props.getProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email);
  if (code) {
    return { status: 'ok', teacherCode: code };
  }
  return { status: 'new_teacher_prompt_key' };
}

function loginAsTeacher() {
  const email = Session.getEffectiveUser().getEmail();
  const props = PropertiesService.getScriptProperties();
  const teacherCode = props.getProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email);
  if (teacherCode) {
    return { status: 'ok', teacherCode: teacherCode };
  }
  return { status: 'not_found' };
}

function loginAsStudent(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  var email = Session.getEffectiveUser().getEmail();

  var globalDb = getGlobalDb_();
  if (!globalDb) return { status: 'error', message: 'missing_global' };
  var userSheet = globalDb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!userSheet) return { status: 'error', message: 'missing_global' };
  var gLast = userSheet.getLastRow();
  var globalData = null;
  if (gLast >= 2) {
    var gRows = userSheet.getRange(2,1,gLast-1,userSheet.getLastColumn()).getValues();
    for (var i=0; i<gRows.length; i++) {
      if (String(gRows[i][0]).trim().toLowerCase() === email.toLowerCase()) {
        globalData = {
          email: gRows[i][0],
          handleName: gRows[i][1],
          name: gRows[i][1],
          role: gRows[i][2],
          globalXp: gRows[i][3],
          globalLevel: gRows[i][4],
          globalCoins: gRows[i][5],
          equippedTitle: gRows[i][6]
        };
        break;
      }
    }
  }
  if (!globalData) {
    return { status: 'error', message: 'not_registered' };
  }

  if (!teacherCode) {
    var props = PropertiesService.getScriptProperties();
    var keys = (typeof props.getKeys === 'function') ? props.getKeys() : [];
    var codes = keys.filter(function(k){ return k.indexOf(CONSTS.PROP_TEACHER_SSID_PREFIX) == 0; }).map(function(k){ return k.substring(CONSTS.PROP_TEACHER_SSID_PREFIX.length); });
    var classes = [];
    for (var c=0; c<codes.length; c++) {
      var code = codes[c];
      var db = getTeacherDb_(code);
      if (!db) continue;
      var sheet = db.getSheetByName('Enrollments');
      if (!sheet) continue;
      var last = sheet.getLastRow();
      if (last < 2) continue;
      var emails = sheet.getRange(2,1,last-1,1).getValues().flat();
      var found = false;
      for (var e=0; e<emails.length; e++) {
        if (String(emails[e]).trim().toLowerCase() === email.toLowerCase()) { found = true; break; }
      }
      if (found) {
        var tName = getTeacherName_(code);
        classes.push({ teacherCode: code, className: tName || code, teacherName: tName || code });
      }
    }
    if (classes.length) {
      try { if (typeof processLoginBonus === 'function') processLoginBonus(email); } catch (_) {}
    }
    return { enrolledClasses: classes };
  }

  var teacherDb = getTeacherDb_(teacherCode);
  if (!teacherDb) return { status: 'error', message: 'invalid_teacher' };
  var enroll = teacherDb.getSheetByName('Enrollments');
  if (!enroll) return { status: 'error', message: 'not_found_in_class' };
  var last = enroll.getLastRow();
  if (last < 2) return { status: 'error', message: 'not_found_in_class' };
  var rows = enroll.getRange(2,1,last-1,enroll.getLastColumn()).getValues();
  var classData = null;
  for (var i2=0; i2<rows.length; i2++) {
    if (String(rows[i2][0]).trim().toLowerCase() === email.toLowerCase()) {
      classData = {
        userEmail: rows[i2][0],
        classRole: rows[i2][1],
        grade: rows[i2][2],
        class: rows[i2][3],
        number: rows[i2][4],
        enrolledAt: rows[i2][5]
      };
      break;
    }
  }
  if (!classData) return { status: 'error', message: 'not_found_in_class' };

  var sid = classData.grade + '-' + classData.class + '-' + classData.number;
  var bonus = null;
  try { if (typeof processLoginBonus === 'function') bonus = processLoginBonus(email, teacherCode, sid); } catch (_) {}
  return { status:'ok', userInfo:{ globalData: globalData, classData: classData }, loginBonus: bonus };
}

function getTeacherName_(teacherCode) {
  teacherCode = String(teacherCode || '').trim();
  if (!teacherCode) return '';
  if (typeof getTeacherDb_ !== 'function' || typeof getGlobalDb_ !== 'function') {
    return '';
  }
  try {
    var db = getTeacherDb_(teacherCode);
    if (!db) return '';
    var set = db.getSheetByName(CONSTS.SHEET_SETTINGS);
    if (!set) return '';
    var last = set.getLastRow();
    var email = '';
    var ownerName = '';
    if (last >= 2) {
      var vals = set.getRange(2, 1, last - 1, 2).getValues();
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][0]) === 'ownerName') ownerName = vals[i][1];
        else if (String(vals[i][0]) === 'ownerEmail') email = vals[i][1];
      }
    }
    if (ownerName) return ownerName;
    if (!email) return '';
    var gdb = getGlobalDb_();
    if (!gdb) return '';
    var us = gdb.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
    if (!us) return '';
    var uLast = us.getLastRow();
    if (uLast < 2) return '';
    var rows = us.getRange(2, 1, uLast - 1, 2).getValues();
    for (var j = 0; j < rows.length; j++) {
      if (String(rows[j][0]).trim().toLowerCase() === String(email).toLowerCase()) {
        return rows[j][1];
      }
    }
  } catch (e) {}
  return '';
}

function getTeacherName(teacherCode) {
  return { name: getTeacherName_(teacherCode) };
}

function updateTeacherName(name) {
  name = String(name || '').trim();
  if (!name) return { status: 'error', message: 'empty' };
  var email = Session.getEffectiveUser().getEmail();
  var db = getGlobalDb_();
  if (!db) return { status: 'error', message: 'missing_global' };
  var sheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!sheet) return { status: 'error', message: 'sheet_not_found' };
  var last = sheet.getLastRow();
  var updated = false;
  if (last >= 2) {
    var vals = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]).trim().toLowerCase() === email.toLowerCase()) {
        sheet.getRange(i + 2, 2).setValue(name);
        updated = true;
        break;
      }
    }
  }
  if (!updated) return { status: 'error', message: 'user_not_found' };

  var props = PropertiesService.getScriptProperties();
  var code = props.getProperty(CONSTS.PROP_TEACHER_CODE_PREFIX + email);
  if (code) {
    var ss = getSpreadsheetByTeacherCode(code);
    if (ss) {
      var setSheet = ensureSettingsSheet_(ss);
      var sLast = setSheet.getLastRow();
      var found = false;
      if (sLast >= 2) {
        var sVals = setSheet.getRange(2, 1, sLast - 1, 2).getValues();
        for (var j = 0; j < sVals.length; j++) {
          if (String(sVals[j][0]) === 'ownerName') {
            setSheet.getRange(j + 2, 2).setValue(name);
            found = true;
            break;
          }
        }
      }
      if (!found) setSheet.appendRow(['ownerName', name]);
    }
  }
  return { status: 'ok' };
}

function getCurrentUserRole() {
  var email = Session.getEffectiveUser().getEmail();
  var db = getGlobalDb_();
  if (!db) return '';
  var sheet = db.getSheetByName(CONSTS.SHEET_GLOBAL_USERS);
  if (!sheet) return '';
  var last = sheet.getLastRow();
  if (last < 2) return '';
  var rows = sheet.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === email.toLowerCase()) {
      return String(rows[i][2]).trim().toLowerCase();
    }
  }
  return '';
}
