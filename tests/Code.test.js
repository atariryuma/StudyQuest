const { getSqVersion } = require('../src/Code.gs');
const { getStudentTemplateCsv } = require('../src/StudentCsv.gs');

test('getSqVersion returns correct version', () => {
  expect(getSqVersion()).toBe('v1.0.214');
});

test('getStudentTemplateCsv returns header row', () => {
  expect(getStudentTemplateCsv()).toBe('Email,Name,Grade,Class,Number\n');
});

test('getStudentTemplateCsv returns header row', () => {
  expect(getStudentTemplateCsv()).toBe('Email,Name,Grade,Class,Number\n');
});

test('getStudentTemplateCsv returns header row', () => {
  expect(getStudentTemplateCsv()).toBe('Email,Name,Grade,Class,Number\n');
});
