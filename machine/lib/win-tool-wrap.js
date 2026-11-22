'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const { isWindowsProgram } = require('./project-programs');

const PROXY = exports.PROXY = path.join(__dirname, 'win-tool-proxy.js');
exports.wrapEntries = ({ servers, wsl, mount, readyFile, cacheFile }) => {
  const wrapped = {};
  if (!wsl) return wrapped;
  for (const [name, entry] of Object.entries(servers)) {
    if ((entry.type !== undefined && entry.type !== 'stdio') || !isWindowsProgram(entry.command, mount) || (entry.args || []).includes('mcp-for-unity')) continue;
    Object.defineProperty(wrapped, name, { value: { ...entry, command: process.execPath, args: [PROXY, '--ready-file', readyFile, '--list-cache', cacheFile(name, entry), '--name', name, '--', entry.command, ...(entry.args || [])] }, enumerable: true, writable: true, configurable: true });
  }
  return wrapped;
};
exports.cacheKey = (commonDir, name, entry) => crypto.createHash('sha256').update(JSON.stringify([commonDir, name, entry.command, entry.args || []])).digest('hex');
