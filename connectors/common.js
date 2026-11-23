'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
exports.root = path.resolve(__dirname, '..');
exports.quote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;
exports.iso = value => { const date = new Date(typeof value === 'number' ? value * 1000 : value); return value != null && !Number.isNaN(date.getTime()) ? date.toISOString() : null; };
exports.seed = (dir, usual, instruction, cli, id) => {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const source = path.join(usual, instruction), dest = path.join(dir, instruction);
  if (fs.existsSync(source) && !fs.existsSync(dest)) { try { fs.symlinkSync(source, dest); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  if (cli === 'codex') { try { fs.writeFileSync(path.join(dir, 'config.toml'), 'cli_auth_credentials_store = "file"\n', { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  fs.writeFileSync(path.join(dir, 'wheelchair-account.json'), JSON.stringify({ id, cli }) + '\n', { mode: 0o600 });
};
exports.status = (cli, args, env, parse) => { const r = spawnSync(cli, args, { encoding: 'utf8', timeout: 15000, env: { ...process.env, ...env } }); try { return { logged_in: r.status === 0 && (!parse || parse(r.stdout)) }; } catch { return { logged_in: false }; } };
exports.home = (env, fallback) => process.env[env] || path.join(os.homedir(), fallback);

exports.loadedTools = (names, mcp, mount, replaceEntries = {}) => names.map(name => {
  const entry = mcp.servers[name], stdio = entry.type === undefined || entry.type === 'stdio';
  // `wrapped` means a stdio go-between; a replaced HTTP entry (a Windows forward) is not one.
  return { name, windows: stdio && require('../machine/lib/project-programs').isWindowsProgram(entry.command, mount || '/mnt'), wrapped: stdio && Object.hasOwn(replaceEntries || {}, name) && replaceEntries[name] != null };
});

