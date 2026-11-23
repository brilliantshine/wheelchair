'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const connectors = require('../../connectors');
const [state, token, cli, argSession, ...args] = process.argv.slice(2);
const hook = connectors.manifest(cli)?.hook;
if (!hook) process.exit(64);
const session = argSession || (hook.sessionFromEnv ? process.env.WHEELCHAIR_SESSION_NAME : '');
if (!session) process.exit(hook.sessionFromEnv ? 0 : 1);
// Shell command substitution removes trailing newlines from stdin.
const payload = hook.payload === 'stdin' ? fs.readFileSync(0, 'utf8').replace(/\n+$/, '') : (args.length ? args[args.length - 1] : session);
const result = spawnSync(process.execPath, [path.join(__dirname, 'hook-post.js'), state, token, cli, session], { input: payload, stdio: ['pipe', 'inherit', 'inherit'] });
process.exit(result.status ?? 1);
