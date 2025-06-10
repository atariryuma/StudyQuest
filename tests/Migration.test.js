const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadMigration(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Migration.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('deleteLegacyApiKeys removes *_apiKey properties', () => {
  const props = { 'ABC_apiKey': '123', geminiApiKey: 'xyz' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getKeys: () => Object.keys(props),
        deleteProperty: k => { delete props[k]; }
      })
    }
  };
  loadMigration(context);
  context.deleteLegacyApiKeys();
  expect(props).toEqual({ geminiApiKey: 'xyz' });
});

test('addDraftColumn inserts column when missing', () => {
  let headers = ['id','class','q','self','date','persona','closed'];
  const sheetStub = {
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r, c, num, cols) => {
      if (num && cols) return { getValues: () => [headers] };
      return { setValue: v => { headers[c - 1] = v; } };
    }),
    insertColumnAfter: jest.fn(pos => { headers.splice(pos, 0, ''); })
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_TASKS: 'Tasks',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadMigration(context);
  context.addDraftColumn('ABC');
  expect(headers[7]).toBe('draft');
});
