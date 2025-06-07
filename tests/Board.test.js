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
