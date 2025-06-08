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
