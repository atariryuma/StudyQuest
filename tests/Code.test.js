const { getSqVersion } = require('../src/Code.gs');

test('getSqVersion returns correct version', () => {
  expect(getSqVersion()).toBe('v1.0.76');
});
