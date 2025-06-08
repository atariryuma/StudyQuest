const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTask(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Task.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('saveDraftTask appends row with new schema', () => {
  const sheetStub = { appendRow: jest.fn() };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_TASKS: 'Tasks',
    Utilities: { getUuid: () => 'uid1' },
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadTask(context);
  const payload = JSON.stringify({ classId: 'C1', question: 'Q' });
  const id = context.saveDraftTask('ABC', payload);
  expect(id).toBe('uid1');
  expect(sheetStub.appendRow).toHaveBeenCalled();
  const row = sheetStub.appendRow.mock.calls[0][0];
  expect(row.length).toBe(5);
  expect(row[0]).toBe('uid1');
  expect(row[1]).toBe('C1');
  expect(row[2]).toBe(payload);
  expect(Object.prototype.toString.call(row[4])).toBe('[object Date]');
});

test('deleteDraftTask deletes row by id', () => {
  const rows = [
    ['id1','', 'p1','', new Date()],
    ['id2','', 'p2','', new Date()]
  ];
  const sheetStub = {
    getLastRow: jest.fn(() => rows.length + 1),
    getRange: jest.fn(() => ({ getValues: () => rows })),
    deleteRow: jest.fn()
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_TASKS: 'Tasks',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadTask(context);
  context.deleteDraftTask('ABC', 'id1');
  expect(sheetStub.deleteRow).toHaveBeenCalledWith(2);
});
