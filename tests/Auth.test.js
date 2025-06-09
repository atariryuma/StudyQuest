const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadAuth(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Auth.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('loginAsTeacher returns ok and calls bonus', () => {
  const props = { 'teacherCode_teacher@example.com': 'TC123' };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    processLoginBonus: jest.fn()
  };
  loadAuth(context);
  const res = context.loginAsTeacher();
  expect(res).toEqual({ status: 'ok', teacherCode: 'TC123' });
  expect(context.processLoginBonus).toHaveBeenCalledWith('teacher@example.com');
});

test('loginAsTeacher returns not_found when missing', () => {
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 't@example.com' }) }
  };
  loadAuth(context);
  const res = context.loginAsTeacher();
  expect(res.status).toBe('not_found');
});

test('loginAsStudent finds enrollment and global data', () => {
  const enrollRows = [
    ['stud@example.com','student',1,'A',1,new Date('2024-01-01')]
  ];
  const globalRows = [
    ['stud@example.com','Alice','student',10,2,5,'']
  ];
  const enrollSheet = {
    getLastRow: jest.fn(() => enrollRows.length + 1),
    getLastColumn: jest.fn(() => 6),
    getRange: jest.fn(() => ({ getValues: () => enrollRows }))
  };
  const userSheet = {
    getLastRow: jest.fn(() => globalRows.length + 1),
    getLastColumn: jest.fn(() => 7),
    getRange: jest.fn(() => ({ getValues: () => globalRows }))
  };
  const teacherDb = { getSheetByName: jest.fn(name => name === 'Enrollments' ? enrollSheet : null) };
  const globalDb = { getSheetByName: jest.fn(() => userSheet) };
  const context = {
    getSpreadsheetByTeacherCode: jest.fn(() => teacherDb),
    getTeacherDb_: jest.fn(() => teacherDb),
    getGlobalDb_: jest.fn(() => globalDb),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'Global_Master_DB' ? 'gid' : null }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'stud@example.com' }) },
    processLoginBonus: jest.fn(),
    getCacheValue_: () => null,
    putCacheValue_: () => {},
    logError_: () => {}
  };
  loadAuth(context);
  const res = context.loginAsStudent('TC');
  expect(res.status).toBe('ok');
  expect(res.userInfo.classData.userEmail).toBe('stud@example.com');
  expect(res.userInfo.globalData.globalXp).toBe(10);
});

test('setupInitialTeacher creates resources and stores ids', () => {
  const props = {};
  const folder = { getId: jest.fn(() => 'fid') };
  const moveTarget = { moveTo: jest.fn() };
  const settingsSheet = { appendRow: jest.fn() };
  const ss = { getId: jest.fn(() => 'sid'), insertSheet: jest.fn(() => settingsSheet) };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k],
      setProperty: (k,v)=>{ props[k]=v; }
    }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    DriveApp: {
      createFolder: jest.fn(() => folder),
      getFileById: jest.fn(() => moveTarget)
    },
    SpreadsheetApp: { create: jest.fn(() => ss) },
    Utilities: { getUuid: jest.fn(() => 'abc123xyz') }
  };
  loadAuth(context);
  const res = context.setupInitialTeacher('changeme');
  expect(res.status).toBe('ok');
  expect(res.teacherCode).toBe('ABC123');
  expect(context.DriveApp.createFolder).toHaveBeenCalledWith('StudyQuest_ABC123');
  expect(props['teacherCode_teacher@example.com']).toBe('ABC123');
  expect(props['ssId_ABC123']).toBe('sid');
  expect(props['ABC123']).toBe('fid');
  expect(settingsSheet.appendRow).toHaveBeenCalledWith(['ownerEmail', 'teacher@example.com']);
  expect(moveTarget.moveTo).toHaveBeenCalledWith(folder);
});

test('setupInitialTeacher validates secret and duplication', () => {
  const props = { 'teacherCode_teacher@example.com': 'EXIST' };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k],
      setProperty: (k,v)=>{ props[k]=v; }
    }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    DriveApp: { createFolder: jest.fn() },
    SpreadsheetApp: { create: jest.fn() },
    Utilities: { getUuid: jest.fn(() => 'abc123') }
  };
  loadAuth(context);
  let res = context.setupInitialTeacher('wrong');
  expect(res).toEqual({ status: 'error', message: 'invalid_key' });
  res = context.setupInitialTeacher('changeme');
  expect(res).toEqual({ status: 'error', message: 'already_exists' });
  expect(context.DriveApp.createFolder).not.toHaveBeenCalled();
});
