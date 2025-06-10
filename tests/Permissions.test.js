const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadPermissions(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Permissions.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('grantTeacherAccess calls Drive API with writer role', () => {
  const created = [];
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => 'fileid'
      })
    },
    CONSTS: { PROP_GLOBAL_MASTER_DB: 'Global_Master_DB' },
    Drive: { Permissions: { create: jest.fn((r,f,o)=>{ created.push({r,f,o}); }) } }
  };
  loadPermissions(context);
  const res = context.grantTeacherAccess('t@example.com');
  expect(res.status).toBe('ok');
  expect(created[0].r.role).toBe('writer');
  expect(created[0].f).toBe('fileid');
});

test('grantStudentAccess grants write on teacher DB and read on global', () => {
  const calls = [];
  const props = {
    ssId_code: 'tid',
    Global_Master_DB: 'gid'
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => props[k] })
    },
    CONSTS: {
      PROP_TEACHER_SSID_PREFIX: 'ssId_',
      PROP_GLOBAL_MASTER_DB: 'Global_Master_DB'
    },
    Drive: { Permissions: { create: jest.fn((r,f,o)=>{ calls.push({r,f,o}); }) } }
  };
  loadPermissions(context);
  const res = context.grantStudentAccess('code','s@example.com');
  expect(res.status).toBe('ok');
  expect(calls.length).toBe(2);
  expect(calls[0].r.role).toBe('writer');
  expect(calls[0].f).toBe('tid');
  expect(calls[1].r.role).toBe('reader');
  expect(calls[1].f).toBe('gid');
});
