const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadGemini(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Gemini.gs'), 'utf8');
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
