const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadSubmission(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Submission.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

function makeSheet(data) {
  return {
    getLastRow: jest.fn(() => data.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValue: () => data[r-1][c-1],
      getValues: () => {
        const out=[]; for(let i=0;i<rows;i++){ const row=[]; for(let j=0;j<cols;j++){ row.push(data[r-1+i][c-1+j]); } out.push(row); } return out;
      },
      setValues: vals => { for(let i=0;i<vals.length;i++) for(let j=0;j<vals[i].length;j++) data[r-1+i][c-1+j]=vals[i][j]; },
      setValue: val => { data[r-1][c-1]=val; }
    })),
    appendRow: jest.fn(row => data.push(row))
  };
}

test('processSubmission updates user XP and calls submitAnswer', () => {
  const users = [
    ['Email','Name','Role','Global_TotalXP','Global_Level','Global_Coins','Equipped','Created','Last','Streak'],
    ['stu1','n','student',0,1,0,'',new Date(),new Date(),1]
  ];
  const userSheet = makeSheet(users);
  const globalDb = { getSheetByName: jest.fn(() => userSheet) };

  const context = {
    getTaskMap_: () => ({ task1: { q: JSON.stringify({ correctAnswer:'42', explanation:'exp' }), closed:false } }),
    getGlobalDb_: () => globalDb,
    LockService: { getScriptLock: () => ({ waitLock: jest.fn(), releaseLock: jest.fn() }) },
    calcLevelFromXp_: xp => { let lv=1; let r=xp; while(r>=lv*100){ r-=lv*100; lv++; } return lv; },
    submitAnswer: jest.fn(),
    summarizeStudentAnswer: jest.fn(()=>'sum'),
    checkAndAwardTrophies: jest.fn(()=>[])
  };

  loadSubmission(context);
  const res = context.processSubmission('T','stu1','task1','ans');
  expect(res.status).toBe('ok');
  expect(context.submitAnswer).toHaveBeenCalled();
  expect(users[1][3]).toBe(10);
  expect(users[1][4]).toBe(1);
});

test('processSubmission rejects closed task', () => {
  const context = {
    getTaskMap_: () => ({ t:{ closed:true } }),
    submitAnswer: jest.fn(),
    getGlobalDb_: jest.fn(),
    checkAndAwardTrophies: jest.fn(),
    calcLevelFromXp_: jest.fn()
  };
  loadSubmission(context);
  const res = context.processSubmission('T','stu1','t','a');
  expect(res.status).toBe('error');
  expect(context.submitAnswer).not.toHaveBeenCalled();
});
