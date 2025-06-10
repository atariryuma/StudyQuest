const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadTask(context) {
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Task.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('getLatestActiveTaskId returns newest open task', () => {
  const context = {};
  loadTask(context);
  context.listTasks = jest.fn(() => [
    { id: 't3', closed: true },
    { id: 't2', closed: false },
    { id: 't1', closed: false }
  ]);
  expect(context.getLatestActiveTaskId('ABC')).toBe('t2');
});

test('getLatestActiveTaskId returns null when none open', () => {
  const context = {};
  loadTask(context);
  context.listTasks = jest.fn(() => [ { id: 't1', closed: true } ]);
  expect(context.getLatestActiveTaskId('ABC')).toBeNull();
});
