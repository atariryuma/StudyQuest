const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadDashboard(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Dashboard.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('getTaskCompletionStatus counts submissions per task', () => {
  const subsData = [
    ['s1','t1'],
    ['s2','t1'],
    ['s1','t2']
  ];
  const subsSheet = {
    getLastRow: jest.fn(() => subsData.length + 1),
    getRange: jest.fn(() => ({ getValues: () => subsData })),
    getSheetByName: jest.fn()
  };
  const ssStub = { getSheetByName: name => name === 'Submissions' ? subsSheet : null };
  const context = {
    SHEET_SUBMISSIONS: 'Submissions',
    getSpreadsheetByTeacherCode: () => ssStub,
    listTasks: jest.fn(() => [
      { id: 't1', classId: '1', q: '{"question":"Q1"}' },
      { id: 't2', classId: '1', q: '{"question":"Q2"}' }
    ]),
    listStudents: jest.fn(() => [
      { id: 's1', grade: 1, class: 'A' },
      { id: 's2', grade: 1, class: 'A' },
      { id: 's3', grade: 1, class: 'A' }
    ]),
    getClassIdMap: jest.fn(() => ({ '1': '1-A' }))
  };
  loadDashboard(context);
  const res = context.getTaskCompletionStatus('X');
  expect(res[0].count).toBe(2);
  expect(res[0].total).toBe(3);
  expect(res[1].count).toBe(1);
  expect(res[1].total).toBe(3);
});
