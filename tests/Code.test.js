const { getSqVersion, getStudentTemplateCsv } = require('../src/Code.gs');

test('getSqVersion returns correct version', () => {
  expect(getSqVersion()).toBe('v1.0.192');
});

test('getStudentTemplateCsv returns header row', () => {
  expect(getStudentTemplateCsv()).toBe('Email,Name,Grade,Class,Number\n');
});
