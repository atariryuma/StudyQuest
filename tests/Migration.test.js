const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadMigration(context) {
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

test('upgradeStudentsSheet adds missing columns', () => {
  let headers = ['生徒ID','学年','組','番号','初回ログイン日時'];
  const sheetStub = {
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r,c,num,cols) => {
      if (num && cols) {
        return {
          getValues: () => [headers],
          setValues: vals => { headers = vals[0]; }
        };
      }
      return { setValue: v => { headers[c - 1] = v; } };
    }),
    insertColumnAfter: jest.fn(() => { headers.push(''); })
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_STUDENTS: 'Students',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadMigration(context);
  context.upgradeStudentsSheet('ABC');
  expect(headers.length).toBe(10);
});
