const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '..', 'node_modules');

if (!fs.existsSync(modulesDir) || !fs.existsSync(path.join(modulesDir, 'jest'))) {
  console.error('Dependencies not installed. Please run `npm install` or `scripts/setup-codex.sh` before `npm test`.');
  process.exit(1);
}
