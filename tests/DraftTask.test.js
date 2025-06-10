const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTask(context) {
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Task.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('saveDraftTask appends row with draft flag', () => {
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
  expect(row[0]).toBe('uid1');
  expect(row[1]).toBe('C1');
  expect(row[2]).toBe(payload);
  expect(row[7]).toBe(1);
});

test('deleteDraftTask deletes only draft rows', () => {
  const rows = [
    ['id1','', 'p1','', new Date(), '', '', 1],
    ['id2','', 'p2','', new Date(), '', '', '']
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
  sheetStub.deleteRow.mockClear();
  context.deleteDraftTask('ABC', 'id2');
  expect(sheetStub.deleteRow).not.toHaveBeenCalled();
});
