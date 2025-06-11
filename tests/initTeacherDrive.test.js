const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}


test('initTeacher returns existing code if already stored', () => {
  const props = { ABC123: 'fid', teacherPasscode: 'PASS' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k,v)=>{props[k]=v;},
        getKeys: () => Object.keys(props),
        getProperty: (k)=>props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    SHEET_TROPHIES: 'Trophies',
    SHEET_ITEMS: 'Items',
    DriveApp: { getFolderById: jest.fn(()=>({})), searchFolders: jest.fn() },
    logError_: () => {},
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) }
  };
  loadTeacher(context);
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => ({ getDateCreated: () => new Date() }));
  const result = context.initTeacher('PASS');
  expect(result).toEqual({ status: 'ok', teacherCode: 'ABC123' });
});
