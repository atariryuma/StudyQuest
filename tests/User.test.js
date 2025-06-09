const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadUser(context) {
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/User.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('registerUsersFromCsv creates new users and enrollments', () => {
  const userRows = [
    ['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak']
  ];
  const enrollRows = [
    ['UserEmail','Role','Grade','Class','Number','EnrolledAt']
  ];
  const userSheet = {
    getLastRow: jest.fn(() => userRows.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValues: () => {
        const out = [];
        for (let i=0;i<rows;i++) {
          const row = userRows[r-1+i] || [];
          out.push(row.slice(c-1,c-1+cols));
        }
        return out;
      },
      setValues: vals => { vals.forEach(v => userRows.push(v)); }
    }))
  };
  const enrollSheet = {
    getLastRow: jest.fn(() => enrollRows.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      setValues: vals => { vals.forEach(v => enrollRows.push(v)); }
    }))
  };
  const teacherDb = { getSheetByName: jest.fn(name => name === 'Enrollments' ? enrollSheet : null) };
  const globalDb = { getSheetByName: jest.fn(name => name === 'Global_Users' ? userSheet : null) };
  const context = {
    Utilities: { parseCsv: str => str.trim().split(/\r?\n/).map(l => l.split(',')) }
  };
  loadUser(context);
  context.getTeacherDb_ = () => teacherDb;
  context.getGlobalDb_ = () => globalDb;
  const csv = 'alice@example.com,Alice,1,A,1\nbob@example.com,Bob,1,A,2';
  const res = context.registerUsersFromCsv('TC', csv);
  expect(res).toEqual({ status:'success', created:2, enrolled:2 });
  expect(userRows.length).toBe(3);
  expect(enrollRows.length).toBe(3);
  expect(userRows[1][0]).toBe('alice@example.com');
  expect(typeof userRows[1][7].getTime).toBe('function');
});

test('registerUsersFromCsv skips existing users', () => {
  const now = new Date();
  const userRows = [
    ['Email','HandleName','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak'],
    ['alice@example.com','Alice','student',0,1,0,'',now,now,1]
  ];
  const enrollRows = [
    ['UserEmail','Role','Grade','Class','Number','EnrolledAt']
  ];
  const userSheet = {
    getLastRow: jest.fn(() => userRows.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValues: () => {
        const out = [];
        for (let i=0;i<rows;i++) {
          const row = userRows[r-1+i] || [];
          out.push(row.slice(c-1,c-1+cols));
        }
        return out;
      },
      setValues: vals => { vals.forEach(v => userRows.push(v)); }
    }))
  };
  const enrollSheet = {
    getLastRow: jest.fn(() => enrollRows.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      setValues: vals => { vals.forEach(v => enrollRows.push(v)); }
    }))
  };
  const teacherDb = { getSheetByName: jest.fn(name => name === 'Enrollments' ? enrollSheet : null) };
  const globalDb = { getSheetByName: jest.fn(name => name === 'Global_Users' ? userSheet : null) };
  const context = {
    Utilities: { parseCsv: str => str.trim().split(/\r?\n/).map(l => l.split(',')) }
  };
  loadUser(context);
  context.getTeacherDb_ = () => teacherDb;
  context.getGlobalDb_ = () => globalDb;
  const csv = 'alice@example.com,Alice,1,A,1\ncharlie@example.com,Charlie,1,B,3';
  const res = context.registerUsersFromCsv('TC', csv);
  expect(res).toEqual({ status:'success', created:1, enrolled:2 });
  expect(userRows.length).toBe(3);
  expect(userRows[2][0]).toBe('charlie@example.com');
  expect(enrollRows.length).toBe(3);
});
