'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { htmlDownload } = require('../app/html-download.js');
test('HTML download places policy after leading doctype and removes refresh tags', () => {
  for (const lead of ['<!doctype html>', '<!-- comment -->\n<!DOCTYPE html>', '\ufeff <!doctype html>']) {
    const out = htmlDownload(`${lead}<meta HTTP-EQUIV="Refresh" content="0"><p>café</p>`).toString();
    assert.ok(out.startsWith(lead + '<meta charset="utf-8">'));
    assert.doesNotMatch(out, /http-equiv="refresh"/i);
    assert.match(out, /café/);
  }
  assert.ok(htmlDownload('<p>hello</p>').toString().startsWith('<meta charset="utf-8">'));
});
