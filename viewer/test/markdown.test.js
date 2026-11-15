'use strict';

// The shared Markdown renderer's parser, loaded under Node through its guarded module.exports.
// The DOM half is covered by the browser specs (app-doc.spec.js, pages.spec.js).
const assert = require('node:assert/strict');
const test = require('node:test');

const { parseMarkdown } = require('../pages/markdown.js');

test('frontmatter, headings, tables and lists parse as the document page expects', () => {
  const parsed = parseMarkdown('---\nslug: dark\nstatus: approved # note\n---\n\n# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n');
  assert.deepEqual(parsed.frontmatter, [['slug', 'dark'], ['status', 'approved']]);
  assert.deepEqual(parsed.blocks.map((b) => b.type), ['heading', 'table', 'list']);
  assert.deepEqual(parsed.blocks[1].rows, [['1', '2']]);
  assert.equal(parsed.blocks[2].items.length, 2);
});
