'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { windowsTarget, rewriteUrl } = require('../lib/win-mark');
test('Windows URL eligibility and textual rewrite', () => {
  for (const [url, port] of [['http://localhost', 80], ['http://localhost:1/path?q=1', 1], ['http://127.0.0.1:65535', 65535], ['HTTP://LOCALHOST:8080#x', 8080]]) assert.equal(windowsTarget({ type: 'http', url }).port, port);
  for (const url of ['https://localhost', 'http:localhost:8080', 'http://localhost\\path', 'http://a@localhost', 'http://localhost:0', 'http://localhost:65536', 'http://other']) assert.equal(windowsTarget({ type: 'http', url }), null, url);
  for (const type of ['sse', 'stdio']) assert.equal(windowsTarget({ type, url: 'http://localhost' }), null);
  assert.equal(rewriteUrl('http://localhost:8080/mcp/${PROJECT}?a=b#c', 4242), 'http://127.0.0.1:4242/mcp/${PROJECT}?a=b#c');
  assert.equal(rewriteUrl('http://localhost:0', 4242), null);
});
