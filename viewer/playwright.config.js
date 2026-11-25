'use strict';

// Every spec runs in Chromium; specs in test/firefox-specs.js also run in Firefox.
// Specs testing drawing, touch, pixels or scroll belong on that list.
const { defineConfig, devices } = require('@playwright/test');
const { decide } = require('../test-support/browser-workers');
const firefoxSpecs = require('./test/firefox-specs');

// Full runs alone use up to eight workers; overlapping full runs share that budget.
// --workers on the command line still overrides the cap.
module.exports = defineConfig({
  workers: decide(),
  testDir: 'test',
  testMatch: '*.spec.js',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: firefoxSpecs, use: { ...devices['Desktop Firefox'] } },
  ],
});
