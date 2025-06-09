const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGamification(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Gamification.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

function makeSheet(data) {
  return {
    getLastRow: jest.fn(() => data.length),
    getLastColumn: jest.fn(() => data[0].length),
    getRange: jest.fn((r, c, rows, cols) => ({
      getValue: () => data[r - 1][c - 1],
      getValues: () => {
        const out = [];
        for (let i = 0; i < (rows || 1); i++) {
          const row = [];
          for (let j = 0; j < (cols || 1); j++) {
            row.push(data[r - 1 + i][c - 1 + j]);
          }
          out.push(row);
        }
        return out;
      },
      setValue: v => { data[r - 1][c - 1] = v; },
      setValues: vals => {
        for (let i = 0; i < vals.length; i++) {
          for (let j = 0; j < vals[i].length; j++) {
            data[r - 1 + i][c - 1 + j] = vals[i][j];
          }
        }
      }
    })),
    appendRow: jest.fn(row => data.push(row))
  };
}

test('purchaseItem deducts coins and records inventory', () => {
  const users = [
    ['Email','Name','Role','XP','Level','Coins','Title'],
    ['user@example.com','Alice','student',0,1,20,'']
  ];
  const items = [
    ['ItemID','Name','Type','Price','Effect'],
    ['item1','Potion','consumable',5,'{}']
  ];
  const inventory = [['UserItemID','UserEmail','ItemID','Quantity','AcquiredAt']];

  const userSheet = {
    getLastRow: jest.fn(() => users.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValue: () => users[r-1][c-1],
      getValues: () => {
        const res = [];
        for (let i=0;i<(rows||1);i++) {
          const row=[];
          for (let j=0;j<(cols||1);j++) row.push(users[r-1+i][c-1+j]);
          res.push(row);
        }
        return res;
      },
      setValue: v => { users[r-1][c-1] = v; },
      setValues: vals => {
        for (let i=0;i<rows;i++) for (let j=0;j<cols;j++) users[r-1+i][c-1+j] = vals[i][j];
      }
    }))
  };
  const invSheet = { appendRow: jest.fn(row => inventory.push(row)) };
  const itemsSheet = {
    getLastRow: jest.fn(() => items.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValues: () => {
        const res=[];
        for (let i=0;i<(rows||1);i++) {
          const row=[];
          for (let j=0;j<(cols||1);j++) row.push(items[r-1+i][c-1+j]);
          res.push(row);
        }
        return res;
      }
    }))
  };
  const ssStub = {
    getSheetByName: jest.fn(name => {
      if (name === 'Global_Users') return userSheet;
      if (name === 'Global_Items_Inventory') return invSheet;
      if (name === 'Items') return itemsSheet;
      return null;
    })
  };
  const context = {
    getGlobalDb_: () => ssStub,
    LockService: { getScriptLock: () => ({ waitLock: jest.fn(), releaseLock: jest.fn() }) },
    Utilities: { getUuid: () => 'uid1' }
  };
  loadGamification(context);
  const res = context.purchaseItem('user@example.com','item1',2);
  expect(res.status).toBe('ok');
  expect(users[1][5]).toBe(10);
  expect(inventory.length).toBe(2);
  expect(inventory[1][1]).toBe('user@example.com');
  expect(inventory[1][2]).toBe('item1');
  expect(inventory[1][3]).toBe(2);

});

test('checkAndAwardTrophies awards trophies when conditions met', () => {
  const trophies = [
    ['TrophyID','Name','Desc','Icon','Condition'],
    ['t1','T1','d','', JSON.stringify({ Global_TotalXP: 50 })],
    ['t2','T2','d','', JSON.stringify({ LoginStreak: 3 })]
  ];
  const trophySheet = makeSheet(trophies);
  const log = [['UserTrophyID','UserEmail','TrophyID','AwardedAt']];
  const logSheet = makeSheet(log);
  const users = [
    ['Email','Name','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak'],
    ['u@example.com','A','student',80,2,10,'','','',2]
  ];
  const userSheet = makeSheet(users);
  const teacherDb = { getSheetByName: jest.fn(name => name === 'Trophies' ? trophySheet : null) };
  const globalDb = { getSheetByName: jest.fn(name => {
    if (name === 'Global_Trophies_Log') return logSheet;
    if (name === 'Global_Users') return userSheet;
    return null;
  }) };
  const context = {
    getSpreadsheetByTeacherCode: () => teacherDb,
    getGlobalDb_: () => globalDb,
    Utilities: { getUuid: () => 'uid1' }
  };
  loadGamification(context);
  const awarded = context.checkAndAwardTrophies('u@example.com', { teacherCode: 'T' });
  expect(awarded).toEqual(['t1']);
  expect(log[1][1]).toBe('u@example.com');
  expect(log[1][2]).toBe('t1');
});

 test('checkAndAwardTrophies returns empty when none match', () => {
  const trophies = [
    ['TrophyID','Name','Desc','Icon','Condition'],
    ['t1','T1','d','', JSON.stringify({ Global_TotalXP: 100 })]
  ];
  const trophySheet = makeSheet(trophies);
  const log = [['UserTrophyID','UserEmail','TrophyID','AwardedAt']];
  const logSheet = makeSheet(log);
  const users = [
    ['Email','Name','Role','Global_TotalXP','Global_Level','Global_Coins','EquippedTitle','CreatedAt','LastGlobalLogin','LoginStreak'],
    ['u@example.com','A','student',80,2,10,'','','',1]
  ];
  const userSheet = makeSheet(users);
  const teacherDb = { getSheetByName: jest.fn(name => name === 'Trophies' ? trophySheet : null) };
  const globalDb = { getSheetByName: jest.fn(name => {
    if (name === 'Global_Trophies_Log') return logSheet;
    if (name === 'Global_Users') return userSheet;
    return null;
  }) };
  const context = {
    getSpreadsheetByTeacherCode: () => teacherDb,
    getGlobalDb_: () => globalDb,
    Utilities: { getUuid: () => 'uid1' }
  };
  loadGamification(context);
  const awarded = context.checkAndAwardTrophies('u@example.com', { teacherCode: 'T' });
  expect(awarded.length).toBe(0);
  expect(log.length).toBe(1);

});
