'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createFileMatcher } = require('playwright/lib/util');
const firefoxSpecs = require('./firefox-specs');

delete process.env.WHEELCHAIR_FULL_RUN;
const config = require('../playwright.config');
const firefox = config.projects.find(project => project.name === 'firefox');
const chromium = config.projects.find(project => project.name === 'chromium');
const specFiles = fs.readdirSync(__dirname).filter(name => name.endsWith('.spec.js'));

test('Firefox matches exactly the listed existing spec files', () => {
  for (const name of firefoxSpecs) assert.ok(specFiles.includes(name), `${name} does not exist`);
  const matches = createFileMatcher(firefox.testMatch);
  assert.deepEqual(specFiles.filter(name => matches(path.join(__dirname, name))).sort(), [...firefoxSpecs].sort());
});

test('Chromium has no project-specific restriction', () => {
  assert.equal(chromium.testMatch, undefined);
  assert.equal(chromium.testIgnore, undefined);
  const matches = createFileMatcher(config.testMatch);
  assert.deepEqual(specFiles.filter(name => matches(path.join(__dirname, name))).sort(), specFiles.sort());
});
