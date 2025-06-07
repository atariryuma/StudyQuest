const { getGasVersion } = require('../src/Code.gs');

test('getGasVersion returns correct version', () => {
  expect(getGasVersion()).toBe('v1.0.0');
});
