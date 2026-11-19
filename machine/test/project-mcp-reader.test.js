'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeTempSync } = require('../../test-support/run-dir');
const { readProjectMcp } = require('../lib/project-mcp');

test('reader accepts sse, validates headers and hashes file bytes', async () => {
  const dir = makeTempSync();
  const bytes = Buffer.from(JSON.stringify({ mcpServers: { stream: { type: 'sse', url: 'https://example.test', headers: { Key: 'value' } }, bad: { type: 'http', url: 'x', headers: { Key: 1 } }, array: { type: 'sse', url: 'x', headers: [] } } }));
  fs.writeFileSync(path.join(dir, '.mcp.json'), bytes);
  const result = await readProjectMcp(dir);
  assert.deepEqual(Object.keys(result.mcp.servers), ['stream']);
  assert.deepEqual(result.warnings, ['bad', 'array'].map(name => ({ names: [name], text: `${name}: skipped: not a valid stdio, http or sse entry` })));
  assert.equal(result.hash, crypto.createHash('sha256').update(bytes).digest('hex'));
  fs.writeFileSync(path.join(dir, '.mcp.json'), '{');
  const invalid = await readProjectMcp(dir);
  assert.equal(invalid.hash, crypto.createHash('sha256').update('{').digest('hex'));
  assert.deepEqual(invalid.warnings, [{ names: [], text: '.mcp.json could not be read: "invalid JSON"' }]);
});

test('missing file has null hash', async () => {
  assert.deepEqual(await readProjectMcp(makeTempSync()), { mcp: null, warnings: [], hash: null });
});
