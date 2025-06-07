const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('detectTeacherFolderOnDrive_ returns folder info from Drive', () => {
  const listMock = jest.fn(() => ({ items: [{ id: 'id123', title: 'StudyQuest_ABCDEF' }] }));
  const context = {
    FOLDER_NAME_PREFIX: 'StudyQuest_',
    Drive: {
      Files: {
        list: listMock
      }
    },
    logError_: () => {}
  };
  loadTeacher(context);
  const result = context.detectTeacherFolderOnDrive_();
  expect(result).toEqual({ code: 'ABCDEF', id: 'id123' });
  const expectedQuery = `'root' in parents and mimeType='application/vnd.google-apps.folder' and title contains '${context.FOLDER_NAME_PREFIX}' and trashed=false`;
  expect(listMock).toHaveBeenCalledWith({ q: expectedQuery, orderBy: 'createdDate desc' });
});
