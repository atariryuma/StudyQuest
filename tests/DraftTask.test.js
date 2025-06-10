const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTask(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
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
  const payload = { classId: 'C1', question: 'Q', subject:'S', type:'text', choices:[] };
  const id = context.saveDraftTask('ABC', payload);
  expect(id).toBe('uid1');
  expect(sheetStub.appendRow).toHaveBeenCalled();
  const row = sheetStub.appendRow.mock.calls[0][0];
  expect(row[0]).toBe('uid1');
  expect(row[1]).toBe('C1');
  expect(row[2]).toBe('S');
  expect(row[3]).toBe('Q');
  expect(row[10]).toBe(1);
});

test('deleteDraftTask deletes only draft rows', () => {
  const rows = [
    ['id1','', 'S','Q','text','[]','', new Date(), '', '', 1],
    ['id2','', 'S2','Q2','text','[]','', new Date(), '', '', '']
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
