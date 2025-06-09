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
      getValues: () => {
        if (!rows || rows <= 0) return [];
        const out = [];
        for (let i = 0; i < rows; i++) {
          const row = [];
          for (let j = 0; j < (cols || 1); j++) {
            row.push(data[r - 1 + i][c - 1 + j]);
          }
          out.push(row);
        }
        return out;
      },
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
