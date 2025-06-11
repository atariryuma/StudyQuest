const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSetup(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Setup.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('quickStudyQuestSetup picks editable folder', () => {
  const folder1 = { createFile: jest.fn(() => { throw new Error('ro'); }) };
  const folder2 = { createFile: jest.fn(() => ({ setTrashed: jest.fn() })) };
  const iterator = {
    list: [folder1, folder2],
    hasNext() { return this.list.length > 0; },
    next() { return this.list.shift(); }
  };
  const root = {
    getFoldersByName: jest.fn(() => iterator),
    createFolder: jest.fn()
  };
  const context = {
    DriveApp: {
      getRootFolder: () => root,
      getFileById: jest.fn(() => ({ moveTo: jest.fn() }))
    },
    DocumentApp: { create: jest.fn(() => ({ getBody: () => ({ appendParagraph: jest.fn(() => ({ setHeading: jest.fn() })) }), getId: () => 'd' })), ParagraphHeading: { HEADING1: 'H1' } },
    ScriptApp: { getScriptId: () => 'sid' }
  };
  loadSetup(context);
  context.initGlobalDb = jest.fn(() => ({ status: 'ok' }));
  const res = context.quickStudyQuestSetup();
  expect(root.createFolder).not.toHaveBeenCalled();
  expect(res.status).toBe('ok');
});

test('quickStudyQuestSetup creates new folder when none writable', () => {
  const folder1 = { createFile: jest.fn(() => { throw new Error('ro'); }) };
  const iterator = {
    list: [folder1],
    hasNext() { return this.list.length > 0; },
    next() { return this.list.shift(); }
  };
  const createdFolder = {};
  const root = {
    getFoldersByName: jest.fn(() => iterator),
    createFolder: jest.fn(() => createdFolder)
  };
  const context = {
    DriveApp: {
      getRootFolder: () => root,
      getFileById: jest.fn(() => ({ moveTo: jest.fn() }))
    },
    DocumentApp: { create: jest.fn(() => ({ getBody: () => ({ appendParagraph: jest.fn(() => ({ setHeading: jest.fn() })) }), getId: () => 'd' })), ParagraphHeading: { HEADING1: 'H1' } },
    ScriptApp: { getScriptId: () => 'sid' }
  };
  loadSetup(context);
  context.initGlobalDb = jest.fn(() => ({ status: 'ok' }));
  const res = context.quickStudyQuestSetup();
  expect(root.createFolder).toHaveBeenCalledWith('StudyQuest');
  expect(res.status).toBe('ok');
});
