const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('initTeacher rejects wrong passcode', () => {
  const context = {
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) }
  };
  loadTeacher(context);
  const result = context.initTeacher('wrong');
  expect(result.status).toBe('error');
});

test('initTeacher returns existing code if already stored', () => {
  const props = { ABC123: 'fid' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k,v)=>{props[k]=v;},
        getKeys: () => Object.keys(props),
        getProperty: (k)=>props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    DriveApp: { getFolderById: jest.fn(()=>({})), searchFolders: jest.fn() },
    logError_: () => {},
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) }
  };
  loadTeacher(context);
  context.detectTeacherFolderOnDrive_ = jest.fn(() => null);
  context.findLatestFolderByName_ = jest.fn(() => ({ getDateCreated: () => new Date() }));
  const result = context.initTeacher('kyoushi');
  expect(result).toEqual({ status: 'ok', teacherCode: 'ABC123' });
});
