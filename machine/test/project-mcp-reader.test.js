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

test('marks duplicate header keys from every header object without marking other paths', async () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const dir = makeTempSync();
  fs.writeFileSync(path.join(dir, '.mcp.json'), String.raw`{
    "mcpServers": {
      "exact": {"type":"http", "url":"x", "headers":{"X-Fixture":"1", "X-Fixture":"2"}},
      "case": {"type":"sse", "url":"x", "headers":{"Authorization":"1", "authorization":"2"}},
      "escaped": {"type":"http", "url":"x", "headers":{"X":"1", "\u0058":"2"}},
      "repeated": {"type":"http", "url":"x", "headers":{"a":"1", "a":"2"}, "headers":{"b":"3"}},
      "clean": {"type":"http", "url":"x", "headers":{"X":"1"}, "env":{"z":"1", "z":"2"}},
      "local": {"command":"x", "headers":{"a":"1", "a":"2"}}
    },
    "other": {"mcpServers":{"clean":{"headers":{"a":"1", "a":"2"}}}}
  }`);
  const { mcp, warnings } = await readProjectMcp(dir);
  assert.deepEqual(warnings, []);
  for (const name of ['exact', 'case', 'escaped', 'repeated']) {
    const entry = mcp.servers[name];
    assert.equal(entry[DUPLICATE_HEADERS], true, name);
    assert.deepEqual(Object.keys(entry), Object.keys(JSON.parse(JSON.stringify(entry))));
    assert.ok(!JSON.stringify(entry).includes('duplicate headers'));
  }
  for (const name of ['clean', 'local']) assert.equal(mcp.servers[name][DUPLICATE_HEADERS], undefined, name);
});

test('deeply nested valid JSON still reads (duplicate scan gives up quietly)', async () => {
  const dir = makeTempSync('reader-deep-');
  const deep = '['.repeat(15000) + ']'.repeat(15000);
  fs.writeFileSync(path.join(dir, '.mcp.json'), `{"mcpServers":{"a":{"command":"x"}},"deep":${deep}}`);
  const result = await readProjectMcp(dir);
  assert.ok(result.mcp, JSON.stringify(result.warnings));
  assert.deepEqual(Object.keys(result.mcp.servers), ['a']);
});
