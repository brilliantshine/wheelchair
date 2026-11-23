'use strict';
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, 'registry.json');
const content = JSON.stringify({ tools: require('./index').list() }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) { console.error('connectors/registry.json is stale; run node connectors/export.js'); process.exitCode = 1; }
} else fs.writeFileSync(file, content);
