const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('initTeacher returns stored teacher code if folder exists', () => {
  const props = { ABCDEF: 'id123' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k, v) => { props[k] = v; },
        getKeys: () => Object.keys(props),
        getProperty: (k) => props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    Drive: {
      Files: {
        list: () => ({ items: [] })
      }
    },
    logError_: () => {}
  };
  loadTeacher(context);
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  const fakeFolder = { getDateCreated: () => new Date('2024-01-01') };
  context.findLatestFolderByName_ = jest.fn(() => fakeFolder);

  const result = context.initTeacher('kyoushi');
  expect(result).toEqual({ status: 'ok', teacherCode: 'ABCDEF' });
});

test('initTeacher generates new code when no folder exists', () => {
  const props = {};
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k, v) => { props[k] = v; },
        getKeys: () => Object.keys(props),
        getProperty: (k) => props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TOC: 'toc',
    SHEET_TASKS: 'tasks',
    SHEET_STUDENTS: 'students',
    SHEET_GLOBAL_ANSWERS: 'answers',
    SHEET_AI_FEEDBACK: 'feedback',
    STUDENT_SHEET_PREFIX: 'stud_',
    Drive: {
      Files: {
        list: () => ({ items: [] }),
        update: jest.fn()
      }
    },
    logError_: () => {}
  };
  loadTeacher(context);
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  context.generateTeacherCode = jest.fn(() => 'ZZZZZZ');
  const fakeFolder = { getId: () => 'folder123' };
  context.createFolder_ = jest.fn(() => fakeFolder);
  context.initializeFolders = jest.fn();
  const dummyRange = {
    setFontWeight: jest.fn().mockReturnThis(),
    setFontSize: jest.fn().mockReturnThis(),
    setHorizontalAlignment: jest.fn().mockReturnThis(),
    mergeAcross: jest.fn()
  };
  const dummySheet = {
    setName: jest.fn(),
    clear: jest.fn(),
    appendRow: jest.fn(),
    getRange: jest.fn(() => dummyRange),
    setColumnWidth: jest.fn(),
    getLastRow: jest.fn(() => 1),
    autoResizeColumn: jest.fn(),
    getSheetId: jest.fn(() => 1),
    setTabColor: jest.fn()
  };
  const ssObj = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [dummySheet]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(() => ({
      appendRow: jest.fn(),
      setTabColor: jest.fn(),
      getSheetId: jest.fn(() => 2)
    }))
  };
  context.SpreadsheetApp = {
    create: jest.fn(() => ssObj)
  };
  context.saveTeacherSettings_ = jest.fn();

  const result = context.initTeacher('kyoushi');
  expect(result.status).toBe('new');
  expect(result.teacherCode).toBe('ZZZZZZ');
  expect(props['ZZZZZZ']).toBe('folder123');
  expect(context.generateTeacherCode).toHaveBeenCalled();
});
