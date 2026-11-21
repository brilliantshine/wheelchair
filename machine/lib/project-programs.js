'use strict';

const fs = require('node:fs');
const { serverLabel } = require('./project-mcp');

function isExecutableFile(candidate) {
  try {
    if (!fs.statSync(candidate).isFile()) return false;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isWindowsProgram(command, mount = '/mnt') {
  if (typeof command !== 'string') return false;
  return [mount, '/mnt'].some(root => {
    const prefix = root.replace(/\/+$/, '') + '/';
    return command.startsWith(prefix) && /^[A-Za-z]\/.+\.exe$/i.test(command.slice(prefix.length));
  });
}

function missingPrograms({ worktree, mcp, path, wsl = false, mount = '/mnt' }) {
  if (!mcp) return [];
  const lines = [];
  for (const [name, server] of Object.entries(mcp.servers)) {
    if ((server.type !== undefined && server.type !== 'stdio') || server.command.includes('${')) continue;
    const command = server.command;
    let found;
    if (isWindowsProgram(command, mount)) {
      if (!wsl) found = true;
      else { try { found = fs.statSync(command).isFile(); } catch { found = false; } }
    } else if (command.includes('/')) {
      found = isExecutableFile(command.startsWith('/') ? command : `${worktree}/${command}`);
    } else {
      found = path.split(':').some(entry => {
        const dir = entry === '' ? worktree : entry.startsWith('/') ? entry : `${worktree}/${entry}`;
        return isExecutableFile(`${dir}/${command}`);
      });
    }
    if (!found) lines.push({ names: [name], text: `${serverLabel(name)}: its program can't be found` });
  }
  return lines;
}

module.exports = { missingPrograms, isWindowsProgram };
