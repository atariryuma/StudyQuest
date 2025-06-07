const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadMigration(context) {
  const code = fs.readFileSync(path.join(__dirname, '../src/Migration.gs'), 'utf8');
  vm.runInNewContext(code, context);
}

test('deleteLegacyApiKeys removes *_apiKey properties', () => {
  const props = { 'ABC_apiKey': '123', geminiApiKey: 'xyz' };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getKeys: () => Object.keys(props),
        deleteProperty: k => { delete props[k]; }
      })
    }
  };
  loadMigration(context);
  context.deleteLegacyApiKeys();
  expect(props).toEqual({ geminiApiKey: 'xyz' });
});
