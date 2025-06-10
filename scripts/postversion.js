const fs = require('fs');
const pkg = require('../package.json');
const version = pkg.version;

function replace(file, regex, replacement) {
  const content = fs.readFileSync(file, 'utf8');
  const updated = content.replace(regex, replacement);
  fs.writeFileSync(file, updated);
}

replace('src/Code.gs', /^(?:const|var)\s+SQ_VERSION\s*=\s*'v[0-9.]+';/m,
  `var SQ_VERSION = 'v${version}';`);
replace('tests/Code.test.js', /expect\(getSqVersion\(\)\).toBe\('v[0-9.]+'\);/,
  `expect(getSqVersion()).toBe('v${version}');`);
