const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('detectTeacherFolderOnDrive_ returns folder info from Drive', () => {
  const context = {
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    Drive: {
      Files: {
        list: () => ({ items: [{ id: 'id123', title: 'StudyQuest_ABCDEF' }] })
      }
    },
    logError_: () => {}
  };
  loadTeacher(context);
  const result = context.detectTeacherFolderOnDrive_();
  expect(result).toEqual({ code: 'ABCDEF', id: 'id123' });
});
