'use strict';

// Every spec runs in Chromium; specs in test/firefox-specs.js also run in Firefox.
// Specs testing drawing, touch, pixels or scroll belong on that list.
const { defineConfig, devices } = require('@playwright/test');
const { decide } = require('../test-support/browser-workers');
const firefoxSpecs = require('./test/firefox-specs');

// A full run alone uses up to eight workers; one starting beside n other live full runs
// takes max(2, floor(8 / (n + 1))), fixed at its start. Non-full runs use two.
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
