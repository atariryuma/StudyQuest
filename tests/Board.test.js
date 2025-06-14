const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadBoard(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
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
    ['s1','t1','Q1',new Date('2024-01-01'),new Date('2024-01-02'),'','qs1','as1',5,10,1,'T1',1,2],
    ['s2','t2','Q2',new Date('2024-01-03'),new Date('2024-01-04'),'','qs2','as2',3,13,2,'',0,5]
  ];
  const sheetStub = {
    getLastRow: jest.fn(() => subsData.length + 1),
    getLastColumn: jest.fn(() => 14),
    getRange: jest.fn(() => ({ getValues: () => subsData }))
  };
  const ssStub = { getSheetByName: jest.fn(name => name === 'Submissions' ? sheetStub : null) };
  const context = {
    SHEET_SUBMISSIONS: 'Submissions',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadBoard(context);
  const rows = context.listBoard('ABC');
  expect(sheetStub.getRange).toHaveBeenCalledWith(2, 1, subsData.length, 14);
  expect(rows[0]).toEqual({
    studentId: 's2',
    answer: 'as2',
    earnedXp: 3,
    totalXp: 13,
    level: 2,
    trophies: '',
    likeScore: 5
  });
  expect(rows[1].studentId).toBe('s1');
});

test('listTaskBoard filters and sorts submissions', () => {
  const subsData = [
    ['s1','t1','Q1',new Date('2024-01-01'),new Date('2024-01-02'),'','', 'ans1', 1, 5, 1, 'T1',0,3],
    ['s2','t1','Q2',new Date('2024-01-03'),new Date('2024-01-04'),'','', 'ans2', 2, 6, 1, 'T2',0,1],
    ['s1','t1','Q3',new Date('2024-01-05'),new Date('2024-01-06'),'','', 'latest', 3, 7, 2, 'T3',0,4],
    ['s3','t2','Qx',new Date('2024-01-07'),new Date('2024-01-08'),'','', 'other', 1, 1, 1, '',0,0]
  ];
  const sheetStub = {
    getLastRow: jest.fn(() => subsData.length + 1),
    getLastColumn: jest.fn(() => 14),
    getRange: jest.fn(() => ({ getValues: () => subsData }))
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_SUBMISSIONS: 'Submissions',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadBoard(context);
  const rows = context.listTaskBoard('ABC', 't1');
  expect(sheetStub.getRange).toHaveBeenCalledWith(2, 1, subsData.length, 14);
  expect(rows.length).toBe(2);
  expect(rows[0].studentId).toBe('s1');
  expect(rows[0].answer).toBe('latest');
  expect(rows[0].likeScore).toBe(4);
  expect(rows[1].studentId).toBe('s2');
  expect(rows[1].likeScore).toBe(1);
});
