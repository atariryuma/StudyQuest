const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('initTeacher detects existing folder when script properties empty', () => {
  const props = {};
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        setProperty: (k, v) => { props[k] = v; },
        getKeys: () => Object.keys(props),
        getProperty: (k) => props[k]
      })
    },
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    Drive: {
      Files: {
        list: () => ({ items: [{ id: 'id123', title: 'StudyQuest_ABCDEF' }] })
      }
    },
    logError_: () => {},
  };
  loadTeacher(context);
  const result = context.initTeacher('kyoushi');
  expect(result).toEqual({ status: 'ok', teacherCode: 'ABCDEF' });
  expect(props['ABCDEF']).toBe('id123');
});
