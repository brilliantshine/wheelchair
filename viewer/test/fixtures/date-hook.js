'use strict';

const fs = require('node:fs');
const marker = process.env.ROUTES_DATE_MARKER;
const realNow = Date.now;

Date.now = () => {
  try {
    const value = Number(fs.readFileSync(marker, 'utf8'));
    return Number.isFinite(value) ? value : realNow();
  } catch { return realNow(); }
};
