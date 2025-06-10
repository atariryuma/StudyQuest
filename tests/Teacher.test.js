const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
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
  const insertedNames = [];
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(name => {
      insertedNames.push(name);
      return { appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2), getLastRow: jest.fn(() => 1) };
    }),
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
    SHEET_TROPHIES: 'Trophies',
    SHEET_ITEMS: 'Items',
    STUDENT_SHEET_PREFIX: 'stu_',
    DriveApp: {
      createFolder: jest.fn(() => ({ getId: ()=>'fid' })),
      getFileById: jest.fn(() => ({ moveTo: jest.fn() })),
      searchFolders: jest.fn()
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub) },
    logError_: () => {},
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    SHEET_SETTINGS: 'Settings',
    SHEET_ITEMS: 'Items',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  const result = context.initTeacher();
  expect(result.status).toBe('new');
  expect(result.teacherCode).toBe('ABC123');
  expect(context.SpreadsheetApp.create).toHaveBeenCalledWith('StudyQuest_DB_ABC123');
  expect(insertedNames).toEqual(expect.arrayContaining(['Trophies', 'Items']));
  const tocCalls = sheetStub.appendRow.mock.calls.map(c => c[0][0] || '');
  expect(tocCalls.some(v => v.includes('Trophies'))).toBe(true);
  expect(tocCalls.some(v => v.includes('Items'))).toBe(true);
});

test('initTeacher tasks sheet header includes draft column', () => {
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
  const inserted = {};
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(name => { const s = { appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2), getLastRow: jest.fn(() => 1) }; inserted[name] = s; return s; }),
    getSheetByName: jest.fn(() => sheetStub)
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ setProperty: (k,v)=>{ props[k]=v; }, getKeys: () => Object.keys(props), getProperty: k=>props[k] })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TOC: '📜 目次',
    SHEET_TASKS: 'Tasks',
    SHEET_STUDENTS: 'Students',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_AI_FEEDBACK: 'AI',
    SHEET_TROPHIES: 'Trophies',
    SHEET_ITEMS: 'Items',
    STUDENT_SHEET_PREFIX: 'stu_',
    DriveApp: {
      createFolder: jest.fn(() => ({ getId: ()=>'fid' })),
      getFileById: jest.fn(() => ({ moveTo: jest.fn() })),
      searchFolders: jest.fn()
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub) },
    logError_: () => {},
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    SHEET_SETTINGS: 'Settings',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  context.initTeacher();
  const header = inserted['Tasks'].appendRow.mock.calls[0][0];
  expect(header[header.length-1]).toBe('draft');
});

test('initTeacher creates Items sheet with correct header', () => {
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
  const inserted = {};
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(name => { const s = { appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2), getLastRow: jest.fn(() => 1) }; inserted[name] = s; return s; }),
    getSheetByName: jest.fn(() => sheetStub)
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ setProperty: (k,v)=>{ props[k]=v; }, getKeys: () => Object.keys(props), getProperty: k=>props[k] })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TOC: '📜 目次',
    SHEET_TASKS: 'Tasks',
    SHEET_STUDENTS: 'Students',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_AI_FEEDBACK: 'AI',
    SHEET_TROPHIES: 'Trophies',
    SHEET_ITEMS: 'Items',
    STUDENT_SHEET_PREFIX: 'stu_',
    DriveApp: {
      createFolder: jest.fn(() => ({ getId: ()=>'fid' })),
      getFileById: jest.fn(() => ({ moveTo: jest.fn() })),
      searchFolders: jest.fn()
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub) },
    logError_: () => {},
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    SHEET_SETTINGS: 'Settings',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  context.initTeacher();
  const header = inserted['Items'].appendRow.mock.calls[0][0];
  expect(header).toEqual(['ItemID','Name','Type','Price','Effect']);
});

test('initTeacher submissions sheet header matches README order', () => {
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
  const inserted = {};
  const ssStub = {
    getId: jest.fn(() => 'sid'),
    getSheets: jest.fn(() => [sheetStub]),
    getUrl: jest.fn(() => 'url'),
    insertSheet: jest.fn(name => { const s = { appendRow: jest.fn(), setTabColor: jest.fn(), getSheetId: jest.fn(() => 2), getLastRow: jest.fn(() => 1) }; inserted[name] = s; return s; }),
    getSheetByName: jest.fn(() => sheetStub)
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ setProperty: (k,v)=>{ props[k]=v; }, getKeys: () => Object.keys(props), getProperty: k=>props[k] })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TOC: '📜 目次',
    SHEET_TASKS: 'Tasks',
    SHEET_STUDENTS: 'Students',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_AI_FEEDBACK: 'AI',
    SHEET_TROPHIES: 'Trophies',
    SHEET_ITEMS: 'Items',
    STUDENT_SHEET_PREFIX: 'stu_',
    DriveApp: {
      createFolder: jest.fn(() => ({ getId: ()=>'fid' })),
      getFileById: jest.fn(() => ({ moveTo: jest.fn() })),
      searchFolders: jest.fn()
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub) },
    logError_: () => {},
    Utilities: {
      base64Encode: str => Buffer.from(str).toString('base64'),
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() })
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    SHEET_SETTINGS: 'Settings',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => null);
  loadTeacher(context);
  context.getSpreadsheetByTeacherCode = () => ssStub;
  context.generateTeacherCode = jest.fn(() => 'ABC123');
  context.initTeacher();
  const header = inserted['Submissions'].appendRow.mock.calls[0][0];
  const expected = ['StudentID','TaskID','Question','StartedAt','SubmittedAt','ProductURL','QuestionSummary','AnswerSummary','EarnedXP','TotalXP','Level','Trophy','Status'];
  expect(header).toEqual(expected);
});

test('saveTeacherSettings persists values correctly and global key handling', () => {
  const props = {};
  const sheetData = [['type', 'value1', 'value2']];
  const sheetStub = {
    clear: jest.fn(() => { sheetData.length = 1; }),
    appendRow: jest.fn(row => sheetData.push(row)),
    getDataRange: jest.fn(() => ({ getValues: () => sheetData })),
    getLastRow: jest.fn(() => sheetData.length),
    getRange: jest.fn((r, c, nr, nc) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < nr; i++) {
          out.push(sheetData[r - 1 + i].slice(c - 1, c - 1 + nc));
        }
        return out;
      }
    }))
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
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
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
  context.setGlobalGeminiApiKey('xyz');
  expect(props['geminiApiKey']).toBe(Buffer.from('xyz').toString('base64'));
  expect(sheetStub.appendRow).toHaveBeenCalledWith(['persona', 'P1', '']);
  expect(sheetStub.appendRow).toHaveBeenCalledWith(['class', 1, 'A']);
  expect(sheetData[0]).toEqual(['type', 'value1', 'value2']);
});

test('getGlobalGeminiApiKey handles invalid value gracefully', () => {
  const props = { geminiApiKey: 'invalid' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => props[k]
      })
    },
    Utilities: {
      base64Decode: jest.fn(() => { throw new Error('bad base64'); }),
      newBlob: () => ({ getDataAsString: () => 'x' })
    },
    console: { warn: jest.fn() }
  };
  loadTeacher(context);
  expect(() => context.getGlobalGeminiApiKey()).not.toThrow();
  expect(context.getGlobalGeminiApiKey()).toBe('');
  expect(context.Utilities.base64Decode).toHaveBeenCalled();
});
