const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGlobal(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Global.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('initGlobalDb creates sheets and stores id', () => {
  const props = {};
  const userSheet = { setName: jest.fn(), appendRow: jest.fn(), setTabColor: jest.fn() };
  const trophySheet = { appendRow: jest.fn(), setTabColor: jest.fn() };
  const invSheet = { appendRow: jest.fn(), setTabColor: jest.fn() };
  const ssStub = {
    getId: jest.fn(() => 'gid'),
    getSheets: jest.fn(() => [userSheet]),
    insertSheet: jest.fn(name => name === 'Global_Trophies_Log' ? trophySheet : invSheet)
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => props[k],
        setProperty: (k,v) => { props[k]=v; },
        deleteProperty: k => { delete props[k]; }
      })
    },
    SpreadsheetApp: { create: jest.fn(() => ssStub), openById: jest.fn() }
  };
  loadGlobal(context);
  const result = context.initGlobalDb();
  expect(result.status).toBe('created');
  expect(props.Global_Master_DB).toBe('gid');
  expect(userSheet.setName).toHaveBeenCalledWith('Global_Users');
  expect(context.SpreadsheetApp.create).toHaveBeenCalledWith('StudyQuest_Global_Master_DB');
  expect(ssStub.insertSheet).toHaveBeenCalledWith('Global_Trophies_Log');
  expect(ssStub.insertSheet).toHaveBeenCalledWith('Global_Items_Inventory');
});

test('initGlobalDb returns existing when already created', () => {
  const props = { Global_Master_DB: 'gid' };
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k], deleteProperty: k => delete props[k] }) },
    SpreadsheetApp: {
      openById: jest.fn(() => ({})),
      create: jest.fn()
    }
  };
  loadGlobal(context);
  const result = context.initGlobalDb();
  expect(result).toEqual({ status: 'exists', id: 'gid' });
  expect(context.SpreadsheetApp.create).not.toHaveBeenCalled();
});
