const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadBoard(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Board.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('getStatistics counts unique student IDs', () => {
  const studentSheet = {
    getLastRow: jest.fn(() => 4),
    getRange: jest.fn(() => ({
      getValues: () => [['1-1-1'], ['1-1-1'], ['1-1-2']]
    }))
  };
  const taskSheet = { getLastRow: jest.fn(() => 3) };
  const ssStub = {
    getSheetByName: jest.fn(name => {
      if (name === 'Students') return studentSheet;
      if (name === 'Tasks') return taskSheet;
      return null;
    })
  };
  const context = {
    SHEET_TASKS: 'Tasks',
    SHEET_STUDENTS: 'Students',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadBoard(context);
  const stats = context.getStatistics('ABC');
  expect(stats).toEqual({ taskCount: 2, studentCount: 2 });
});

test('listBoard reads new submission columns', () => {
  const subsData = [
    ['s1','t1','Q1',new Date('2024-01-01'),new Date('2024-01-02'),'','qs1','as1',5,10,1,'T1'],
    ['s2','t2','Q2',new Date('2024-01-03'),new Date('2024-01-04'),'','qs2','as2',3,13,2,'']
  ];
  const sheetStub = {
    getLastRow: jest.fn(() => subsData.length + 1),
    getLastColumn: jest.fn(() => 12),
    getRange: jest.fn(() => ({ getValues: () => subsData }))
  };
  const ssStub = { getSheetByName: jest.fn(name => name === 'Submissions' ? sheetStub : null) };
  const context = {
    SHEET_SUBMISSIONS: 'Submissions',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadBoard(context);
  const rows = context.listBoard('ABC');
  expect(rows[0]).toEqual({
    studentId: 's2',
    answer: 'as2',
    earnedXp: 3,
    totalXp: 13,
    level: 2,
    trophies: '',
    aiCalls: 0,
    attempts: 0
  });
  expect(rows[1].studentId).toBe('s1');
});
