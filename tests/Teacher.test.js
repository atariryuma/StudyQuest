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
    getDataRange: jest.fn(() => ({ getValues: jest.fn(() => [['type','value1','value2']]) })),
    setColumnWidth: jest.fn(),
    setTabColor: jest.fn(),
    getSheetId: jest.fn(() => 1),
    getLastRow: jest.fn(() => 1),
    autoResizeColumn: jest.fn()
  };
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(() => ({ appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2), getLastRow: jest.fn(() => 1) })),
    getSheetByName: jest.fn(() => sheetStub)
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
    logError_: () => {},
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    SHEET_SETTINGS: 'Settings',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  const result = context.initTeacher('kyoushi');
  expect(result.status).toBe('new');
  expect(result.teacherCode).toBe('ABC123');
  expect(context.SpreadsheetApp.create).toHaveBeenCalledWith('StudyQuest_DB');
});

test('saveTeacherSettings persists values correctly and global key handling', () => {
  const props = {};
  const sheetData = [['type', 'value1', 'value2']];
  const sheetStub = {
    clear: jest.fn(() => { sheetData.length = 1; }),
    appendRow: jest.fn(row => sheetData.push(row)),
    getDataRange: jest.fn(() => ({ getValues: () => sheetData }))
  };
  const ssStub = {
    getSheetByName: jest.fn(() => sheetStub),
    insertSheet: jest.fn(() => sheetStub)
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k, v) => { props[k] = v; },
        getProperty: k => props[k]
      })
    },
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    SHEET_SETTINGS: 'Settings',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.saveTeacherSettings_('ABC', { persona: 'P1', classes: [[1, 'A']] });
  expect(props['ABC_apiKey']).toBeUndefined();
  const loaded = context.loadTeacherSettings_('ABC');
  expect(loaded.persona).toBe('P1');
  expect(loaded.classes).toEqual([[1, 'A']]);
  // test global key functions
  context.setGeminiSettings('ABC', 'xyz', 'P2');
  expect(props['geminiApiKey']).toBe(Buffer.from('xyz').toString('base64'));
  const settings = context.getGeminiSettings('ABC');
  expect(settings.apiKey).toBe('xyz');
  expect(settings.persona).toBe('P2');
  expect(sheetStub.appendRow).toHaveBeenCalledWith(['persona', 'P1', '']);
  expect(sheetStub.appendRow).toHaveBeenCalledWith(['class', 1, 'A']);
  expect(sheetData[0]).toEqual(['type', 'value1', 'value2']);
});
