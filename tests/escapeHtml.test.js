const fs = require('fs');
const vm = require('vm');
const path = require('path');

const context = {};
const code = fs.readFileSync(path.join(__dirname, '../src/escapeHtml.gs'), 'utf8');
vm.runInNewContext(code, context);
const escapeHtml = context.escapeHtml;

module.exports = escapeHtml;

test('escapeHtml escapes special characters', () => {
  const input = "<div>&\"'></div>";
  const expected = "&lt;div&gt;&amp;&quot;&#39;&gt;&lt;/div&gt;";
  expect(escapeHtml(input)).toBe(expected);
});

test('escapeHtml handles null and empty', () => {
  expect(escapeHtml(null)).toBe('');
  expect(escapeHtml('plain')).toBe('plain');
});
