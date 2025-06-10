const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadLike(context) {
  const consts = fs.readFileSync(path.join(__dirname,'../src/consts.gs'),'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname,'../src/Utils.gs'),'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname,'../src/Like.gs'),'utf8');
  vm.runInNewContext(code, context);
}

test('addLike updates scores and ignores duplicates', () => {
  const likes = [['LikeID','TaskID','StudentID','LikedBy','Value','CreatedAt']];
  const likesSheet = {
    getLastRow: jest.fn(() => likes.length),
    getRange: jest.fn(() => ({ getValues: () => likes.slice(1) })),
    appendRow: jest.fn(row => likes.push(row))
  };
  const subsData = [
    ['StudentID','TaskID','Q','Start','Submit','URL','QS','AS','XP','TXP','LV','TR','ST','Like'],
    ['1-1-1','task1','Q1',new Date(),new Date(),'','','',0,0,1,'',1,0]
  ];
  const subsSheet = {
    getLastRow: jest.fn(() => subsData.length),
    getRange: jest.fn((r,c,rows,cols) => ({
      getValues: () => subsData.slice(r-1,r-1+rows).map(row=>row.slice(c-1,c-1+cols)),
      getValue: () => subsData[r-1][c-1],
      setValue: v => { subsData[r-1][c-1] = v; }
    }))
  };
  const students = [['StudentID','Grade','Class','Number','F','L','C','XP','Lvl','T','TotalLikes'],
                    ['1-1-1',1,1,1,'','',1,0,1,'',0]];
  const studentsSheet = {
    getLastRow: jest.fn(() => students.length),
    getRange: jest.fn((r,c,rows,cols)=>({
      getValues: () => students.slice(r-1,r-1+rows).map(row=>row.slice(c-1,c-1+cols)),
      getValue: () => students[r-1][c-1],
      setValue: v => { students[r-1][c-1] = v; }
    }))
  };
  const enroll = [['UserEmail','ClassRole','Grade','Class','Number','EnrolledAt'],
                  ['student@example.com','student',1,1,1,'']];
  const enrollSheet = { getLastRow: jest.fn(() => enroll.length), getLastColumn: jest.fn(() => enroll[0].length), getRange: jest.fn(() => ({ getValues: () => enroll.slice(1) })) };

  const globalUsers = [
    ['Email','Handle','Role','XP','Lvl','Coins','Title','CAt','LAt','Streak','TotalLikesGiven','TotalLikesReceived'],
    ['teacher@example.com','T','teacher',0,1,0,'','', '',1,0,0],
    ['student@example.com','S','student',0,1,0,'','', '',1,0,0]
  ];
  const userSheet = {
    getLastRow: jest.fn(() => globalUsers.length),
    getRange: jest.fn((r,c,rows,cols)=>({
      getValues: () => globalUsers.slice(r-1,r-1+rows).map(row=>row.slice(c-1,c-1+cols)),
      getValue: () => globalUsers[r-1][c-1],
      setValue: v => { globalUsers[r-1][c-1] = v; }
    }))
  };
  const ssStub = { getSheetByName: name => {
    if(name==='Likes') return likesSheet;
    if(name==='Submissions') return subsSheet;
    if(name==='Students') return studentsSheet;
    if(name==='Enrollments') return enrollSheet;
    return null;
  }};
  const context = {
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_STUDENTS: 'Students',
    SHEET_LIKES: 'Likes',
    getSpreadsheetByTeacherCode: () => ssStub,
    getGlobalDb_: () => ({ getSheetByName: () => userSheet }),
    getCurrentUserRole: () => 'teacher',
    Session: { getEffectiveUser: () => ({ getEmail: () => 'teacher@example.com' }) },
    Utilities: { getUuid: () => 'uid1' },
    removeCacheValue_: jest.fn(),
    getStudentRowMap_: () => ({ '1-1-1':2 })
  };
  loadLike(context);
  context.getGlobalDb_ = () => ({ getSheetByName: () => userSheet });
  const res1 = context.addLike('TC','task1','1-1-1');
  expect(res1.status).toBe('ok');
  expect(subsData[1][13]).toBe(5);
  expect(globalUsers[1][10]).toBe(5);
  expect(globalUsers[2][11]).toBe(5);
  const res2 = context.addLike('TC','task1','1-1-1');
  expect(res2.status).toBe('ignored');
  expect(subsData[1][13]).toBe(5);
});
