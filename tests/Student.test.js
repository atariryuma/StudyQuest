const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadStudent(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Student.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('updateStudentLogin increments count and sets timestamp', () => {
  const sheetData = [
    ['生徒ID','学年','組','番号','初回ログイン日時','最終ログイン日時','累計ログイン回数','累積XP','現在レベル','最終獲得トロフィーID'],
    ['1-1-1',1,'A',1,new Date('2021-01-01'),new Date('2021-01-01'),1,0,1,'']
  ];
  const sheetStub = {
    getDataRange: jest.fn(() => ({ getValues: () => sheetData })),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValue: () => sheetData[r-1][c-1],
      setValues: values => {
        sheetData[r-1][c-1] = values[0][0];
        sheetData[r-1][c] = values[0][1];
      }
    }))
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_STUDENTS: 'Students',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadStudent(context);
  const before = sheetData[1][6];
  const beforeDate = sheetData[1][5];
  const result = context.updateStudentLogin('ABC','1-1-1');
  expect(result).toBe(true);
  expect(sheetData[1][6]).toBe(before + 1);
  expect(sheetData[1][5]).not.toBe(beforeDate);
  expect(typeof sheetData[1][5].getTime).toBe('function');
});

test('initStudent adds placeholder rows to Submissions', () => {
  const students = [
    ['生徒ID','学年','組','番号','初回ログイン日時','最終ログイン日時','累計ログイン回数','累積XP','現在レベル','最終獲得トロフィーID']
  ];
  const studentSheetStub = {
    appendRow: jest.fn(),
    setTabColor: jest.fn(),
    getSheetId: jest.fn(() => 2),
    getLastRow: jest.fn(() => 1)
  };
  const studentListSheet = {
    getDataRange: jest.fn(() => ({ getValues: () => students })),
    appendRow: jest.fn(row => { students.push(row); }),
    getLastRow: jest.fn(() => students.length),
    getRange: jest.fn(() => ({ setValue: jest.fn() }))
  };
  const subsSheet = { appendRow: jest.fn() };
  const taskRows = [[
    't1', '1', '{"question":"Q1"}', '', new Date('2024-01-01'), '', '', ''
  ]];
  const tasksSheet = {
    getLastRow: jest.fn(() => taskRows.length + 1),
    getRange: jest.fn(() => ({ getValues: () => taskRows }))
  };
  const ssStub = {
    getSheetByName: jest.fn(name => {
      if (name === 'Students') return studentListSheet;
      if (name === 'Submissions') return subsSheet;
      if (name === 'Tasks') return tasksSheet;
      return null;
    }),
    getSheets: jest.fn(() => []),
    insertSheet: jest.fn(() => studentSheetStub),
    getUrl: jest.fn(() => 'url')
  };
  const context = {
    SHEET_STUDENTS: 'Students',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_TASKS: 'Tasks',
    SHEET_TOC: 'TOC',
    STUDENT_SHEET_PREFIX: 'stu_',
    getSpreadsheetByTeacherCode: () => ssStub,
    getClassIdMap: jest.fn(() => ({}))
  };
  loadStudent(context);
  context.initStudent('ABC', 1, 1, 1);
  expect(subsSheet.appendRow).toHaveBeenCalled();
  const row = subsSheet.appendRow.mock.calls[0][0];
  expect(row.length).toBe(12);
  expect(row).toEqual([
    '1-1-1',
    't1',
    'Q1',
    taskRows[0][4],
    '', '', '', '',
    0, 0, 0,
    ''
  ]);
});
