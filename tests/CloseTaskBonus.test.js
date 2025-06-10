const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTask(context) {
  const consts = fs.readFileSync(path.join(__dirname, '../src/consts.gs'), 'utf8');
  vm.runInNewContext(consts, context);
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Task.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('closeTask sets status and awards bonus XP', () => {
  const subsRows = [
    ['s1','task1','', '', '', '', '', '',0,0,1,'',1],
    ['s2','task1','', '', '', '', '', '',0,0,1,'',0]
  ];
  const subsSheet = {
    getLastRow: jest.fn(() => subsRows.length + 1),
    getRange: jest.fn(() => ({
      getValues: () => subsRows,
      setValues: values => {
        for (let i=0;i<values.length;i++) {
          subsRows[i] = values[i];
        }
      }
    }))
  };
  const studentsData = [
    ['StudentID','Grade','Class','Number','FirstLogin','LastLogin','LoginCount','TotalXP','Level','LastTrophyID'],
    ['s1',1,'A',1,new Date(),new Date(),1,0,1,''],
    ['s2',1,'A',2,new Date(),new Date(),1,0,1,'']
  ];
  const studentsSheet = {
    getLastRow: jest.fn(() => studentsData.length),
    getRange: jest.fn((row, col, rows, cols) => ({
      getValues: () => studentsData.slice(row - 1, row - 1 + rows)
                                  .map(r => r.slice(col - 1, col - 1 + cols)),
      setValues: vals => {
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            studentsData[row - 1 + i][col - 1 + j] = vals[i][j];
          }
        }
      },
      setValue: val => { studentsData[row - 1][col - 1] = val; }
    }))
  };
  const tasksSheet = { getRange: jest.fn(() => ({ getValues: () => [['task1']], setValue: jest.fn() })), getLastRow: jest.fn(() => 2) };
  const ss = {
    getSheetByName: jest.fn(name => {
      if (name === 'Tasks') return tasksSheet;
      if (name === 'Submissions') return subsSheet;
      if (name === 'Students') return studentsSheet;
      return null;
    })
  };
  const context = {
    SHEET_TASKS: 'Tasks',
    SHEET_SUBMISSIONS: 'Submissions',
    SHEET_STUDENTS: 'Students',
    getSpreadsheetByTeacherCode: () => ss
  };
  loadTask(context);
  context.closeTask('T1','task1');
  expect(subsRows[0][12]).toBe(1);
  expect(subsRows[1][12]).toBe(1);
  expect(studentsData[1][7]).toBe(5);
  expect(studentsData[2][7]).toBe(0);
});
