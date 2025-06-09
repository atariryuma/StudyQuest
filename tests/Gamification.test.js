const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGame(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Gamification.gs'), 'utf8');
  vm.runInNewContext(code, context);
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
  loadGame(context);
  const res = context.purchaseItem('user@example.com','item1',2);
  expect(res.status).toBe('ok');
  expect(users[1][5]).toBe(10);
  expect(inventory.length).toBe(2);
  expect(inventory[1][1]).toBe('user@example.com');
  expect(inventory[1][2]).toBe('item1');
  expect(inventory[1][3]).toBe(2);
});
