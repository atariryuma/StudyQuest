const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGemini(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Gemini.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

function loadTeacher(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Teacher.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('generateFollowupFromAnswer builds prompt and calls API', () => {
  const calls = [];
  const context = {};
  loadGemini(context);
  context.callGeminiAPI_GAS = jest.fn((t, p, persona) => {
    calls.push({ t, p, persona });
    return 'ok';
  });
  const res = context.generateFollowupFromAnswer('T1', 'sample answer', 'P');
  expect(res).toBe('ok');
  expect(calls[0].t).toBe('T1');
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
  context.callGeminiAPI_GAS('TC', 'prompt', '');
  expect(spy).toHaveBeenCalled();
  expect(context.UrlFetchApp.fetch.mock.calls[0][0]).toContain('key=TESTKEY');
});
