const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGemini(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Gemini.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

function loadTeacher(context) {
  const utils = fs.readFileSync(path.join(__dirname, '../src/Utils.gs'), 'utf8');
  vm.runInNewContext(utils, context);
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('generateFollowupFromAnswer builds prompt and calls API', () => {
  const calls = [];
  const context = {};
  loadGemini(context);
  context.callGeminiAPI_GAS = jest.fn((p, persona) => {
    calls.push({ p, persona });
    return 'ok';
  });
  const res = context.generateFollowupFromAnswer('sample answer', 'P');
  expect(res).toBe('ok');
  expect(calls[0].persona).toBe('P');
  expect(calls[0].p).toContain('sample answer');
});

test('callGeminiAPI_GAS uses getGlobalGeminiApiKey', () => {
  const context = {
    UrlFetchApp: {
      fetch: jest.fn(() => ({ getContentText: () => JSON.stringify({}) }))
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: jest.fn(() => 'ZGF0YQ==') })
    },
    Utilities: {
      base64Decode: str => Buffer.from(str, 'base64'),
      newBlob: data => ({ getDataAsString: () => data.toString() }),
      base64Encode: str => Buffer.from(str).toString('base64')
    }
  };
  loadTeacher(context);
  loadGemini(context);
  const spy = jest.fn(() => 'TESTKEY');
  context.getGlobalGeminiApiKey = spy;
  context.callGeminiAPI_GAS('prompt', '');
  expect(spy).toHaveBeenCalled();
  expect(context.UrlFetchApp.fetch.mock.calls[0][0]).toContain('key=TESTKEY');
});

test('generateProblemPrompt builds prompt and calls API', () => {
  const calls = [];
  const context = {};
  loadGemini(context);
  context.callGeminiAPI_GAS = jest.fn((p, persona) => {
    calls.push({ p, persona });
    return 'ok';
  });
  const res = context.generateProblemPrompt('T1', 'Math', 'fractions', 'P');
  expect(res).toBe('ok');
  // teacherCode is ignored by callGeminiAPI_GAS
  expect(calls[0].persona).toBe('P');
  expect(calls[0].p).toContain('Math');
  expect(calls[0].p).toContain('fractions');
});

test('generateChoicePrompt builds prompt and calls API', () => {
  const calls = [];
  const context = {};
  loadGemini(context);
  context.callGeminiAPI_GAS = jest.fn((p, persona) => {
    calls.push({ p, persona });
    return 'ok';
  });
  const res = context.generateChoicePrompt('T2', 'What?', '単語', 3, 'P');
  expect(res).toBe('ok');
  // teacherCode is ignored by callGeminiAPI_GAS
  expect(calls[0].persona).toBe('P');
  expect(calls[0].p).toContain('What?');
  expect(calls[0].p).toContain('単語');
  expect(calls[0].p).toContain('3');
});

test('generateDeepeningPrompt builds prompt and calls API', () => {
  const calls = [];
  const context = {};
  loadGemini(context);
  context.callGeminiAPI_GAS = jest.fn((p, persona) => {
    calls.push({ p, persona });
    return 'ok';
  });
  const res = context.generateDeepeningPrompt('T3', 'Explain gravity', 'P');
  expect(res).toBe('ok');
  // teacherCode is ignored by callGeminiAPI_GAS
  expect(calls[0].persona).toBe('P');
  expect(calls[0].p).toContain('Explain gravity');
});

test('logToSpreadsheet writes row with incremented LogID', () => {
  const rows = [];
  const sheetStub = {
    getLastRow: jest.fn(() => rows.length + 1),
    appendRow: jest.fn(row => rows.push(row))
  };
  const ssStub = { getSheetByName: jest.fn(() => sheetStub) };
  const context = {
    SHEET_AI_FEEDBACK: 'AI',
    getSpreadsheetByTeacherCode: () => ssStub
  };
  loadGemini(context);
  context.logToSpreadsheet({ teacherCode: 'T', submissionId: 'S1', feedback: 'F' });
  expect(rows[0][0]).toBe(1);
  expect(rows[0][1]).toBe('S1');
  expect(rows[0][2]).toBe('F');
  expect(typeof rows[0][3].getTime).toBe('function');
});
