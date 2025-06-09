const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadAuth(context) {
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
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
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'stud@example.com' }) },
    processLoginBonus: jest.fn()
  };
  loadAuth(context);
  context.getTeacherDb_ = jest.fn(() => teacherDb);
  context.getGlobalDb_ = jest.fn(() => globalDb);
  const res = context.loginAsStudent('TC');
  expect(res.status).toBe('ok');
  expect(res.userInfo.classData.userEmail).toBe('stud@example.com');
  expect(res.userInfo.globalData.globalXp).toBe(10);
});
