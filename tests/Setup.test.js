const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSetup(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Setup.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('quickStudyQuestSetup creates shared drive and moves files', () => {
  const props = {};
  const driveCreate = jest.fn(() => ({ id: 'did' }));
  const permCreate = jest.fn();
  const folder = {};
  const file = { moveTo: jest.fn() };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k],
      setProperty: (k,v) => { props[k] = v; }
    }) },
    Drive: { Drives: { create: driveCreate }, Permissions: { create: permCreate } },
    DriveApp: { getFolderById: jest.fn(() => folder), getFileById: jest.fn(() => file) },
    DocumentApp: { create: jest.fn(() => ({ getBody: () => ({ appendParagraph: jest.fn(() => ({ setHeading: jest.fn() })) }), getId: () => 'doc' })), ParagraphHeading: { HEADING1: 'H1' } },
    ScriptApp: { getScriptId: () => 'sid' },
    Utilities: { getUuid: jest.fn(() => 'uuid') },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) }
  };
  loadSetup(context);
  context.initGlobalDb = jest.fn(() => ({ status: 'ok', id: 'gid' }));
  const res = context.quickStudyQuestSetup('PASS');
  expect(driveCreate).toHaveBeenCalledWith({ name: 'StudyQuest' }, 'uuid');
  expect(props.Global_Drive_ID).toBe('did');
  expect(context.initGlobalDb).toHaveBeenCalledWith('did');
  expect(context.DriveApp.getFileById).toHaveBeenCalledWith('sid');
  expect(file.moveTo).toHaveBeenCalledWith(folder);
  expect(res.status).toBe('ok');
  expect(res.passcode).toBe('PASS');
});

test('quickStudyQuestSetup uses existing drive', () => {
  const props = { Global_Drive_ID: 'did' };
  const driveCreate = jest.fn();
  const folder = {};
  const file = { moveTo: jest.fn() };
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k],
      setProperty: (k,v)=>{ props[k]=v; }
    }) },
    Drive: { Drives: { create: driveCreate }, Permissions: { create: jest.fn() } },
    DriveApp: { getFolderById: jest.fn(() => folder), getFileById: jest.fn(() => file) },
    DocumentApp: { create: jest.fn(() => ({ getBody: () => ({ appendParagraph: jest.fn(() => ({ setHeading: jest.fn() })) }), getId: () => 'doc' })), ParagraphHeading: { HEADING1: 'H1' } },
    ScriptApp: { getScriptId: () => 'sid' },
    Utilities: { getUuid: jest.fn() },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) }
  };
  loadSetup(context);
  context.initGlobalDb = jest.fn(() => ({ status: 'ok', id: 'gid' }));
  const res = context.quickStudyQuestSetup('PASS');
  expect(driveCreate).not.toHaveBeenCalled();
  expect(context.initGlobalDb).toHaveBeenCalledWith('did');
  expect(res.status).toBe('ok');
  expect(res.passcode).toBe('PASS');
});
