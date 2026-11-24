'use strict';

// Two projects so `npm run test:browser` (viewer/package.json) checks both browsers the user
// actually uses (Decision Log #94): Chromium and Firefox. testDir/testMatch keep this to the
// viewer's own suite — everything under test/ named *.spec.js, currently browser.spec.js and
// touch.spec.js — and leave viewer/test/*.test.js (node --test's unit suite) alone.
const { defineConfig, devices } = require('@playwright/test');
const { decide } = require('../test-support/browser-workers');

// Full runs alone can use up to six workers; overlapping and short runs stay capped at two.
// --workers on the command line still overrides the cap.
module.exports = defineConfig({
  workers: decide(),
  testDir: 'test',
  testMatch: '*.spec.js',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
