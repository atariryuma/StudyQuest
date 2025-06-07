const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('initTeacher creates StudyQuest_DB when none exists', () => {
  const props = {};
  const dummyRange = {
    setFontWeight: jest.fn().mockReturnThis(),
    setFontSize: jest.fn().mockReturnThis(),
    setHorizontalAlignment: jest.fn().mockReturnThis(),
    mergeAcross: jest.fn()
  };
  const sheetStub = {
    setName: jest.fn(),
    clear: jest.fn(),
    appendRow: jest.fn(),
    getRange: jest.fn(() => dummyRange),
    setColumnWidth: jest.fn(),
    setTabColor: jest.fn(),
    getSheetId: jest.fn(() => 1)
  };
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(() => ({ appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2) }))
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k,v)=>{ props[k]=v; },
        getKeys: () => Object.keys(props),
        getProperty: (k)=> props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TOC: '📜 目次',
    SHEET_TASKS: 'Tasks',
    SHEET_STUDENTS: 'Students',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_AI_FEEDBACK: 'AI',
    STUDENT_SHEET_PREFIX: 'stu_',
    DriveApp: {
      createFolder: jest.fn(() => ({ getId: ()=>'fid' })),
      getFileById: jest.fn(() => ({ moveTo: jest.fn() }))
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub) },
    logError_: () => {}
  };
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  const result = context.initTeacher('kyoushi');
  expect(result.status).toBe('new');
  expect(result.teacherCode).toBe('ABC123');
  expect(context.SpreadsheetApp.create).toHaveBeenCalledWith('StudyQuest_DB');
});
