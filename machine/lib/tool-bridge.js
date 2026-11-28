'use strict';
const fs = require('fs');
const path = require('path');
const { validateToolJson, inputSchema } = require('./folder-tools');
const { toolEnv, runScript, killAll, installExitHandlers } = require('./tool-run');
const { waitReady } = require('./win-tool-proxy');
const { serve } = require('./mcp-stdio');
const { projectIdentity, readKeyStore, usableReason } = require('./project-keys');
const { readSharedKeys } = require('./shared-keys');
const args = process.argv.slice(2), dirs = []; let projectDir, stateDir, current, winReadyFile, sandboxCli;
for (let i = 0; i < args.length; i++) { if (args[i] === '--sandbox-cli') sandboxCli = args[++i]; else if (args[i] === '--win-ready-file') winReadyFile = args[++i]; else if (args[i] === '--win' && current) current.windows = true; else if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--state-dir') stateDir = args[++i]; else if (args[i] === '--tool') { current = { dir: args[++i], keys: [] }; dirs.push(current); } else if (args[i] === '--key-store' && current) current.store = args[++i]; else if (args[i] === '--key' && current) current.keys.push(args[++i]); }
if (!projectDir || projectDir.startsWith('--')) { console.error('usage: --project-dir <dir> --tool <dir>'); process.exit(1); }
function read(dir) { try { const file = path.join(dir, 'tool.json'), stat = fs.statSync(file); if (!stat.isFile() || stat.size > 32768) return null; const r = validateToolJson(path.basename(dir), JSON.parse(fs.readFileSync(file, 'utf8'))); return r.ok && r.tool.kind === 'script' ? r.tool : null; } catch { return null; } }
const tools = dirs.flatMap(entry => { const { dir } = entry, tool = read(dir); if (!tool) return []; return [{ name: tool.name, description: tool.description, inputSchema: inputSchema(tool.inputs), call: async input => {
  const fresh = read(dir), changed = JSON.stringify(fresh) !== JSON.stringify(tool), sameKeys = fresh && fresh.keys.length === entry.keys.length && fresh.keys.every(k => entry.keys.includes(k));
  if (changed || !sameKeys) return { text: fresh?.keys.length ? "The tool changed. Its keys are used from the next agent start (a new session, a resume or an account switch); wc.js tool run runs it now without keys." : 'The tool changed. Try it with wc.js tool run now or through MCP after the next agent start (a new session, a resume or an account switch).', isError: true };
  const env = toolEnv(process.env, projectDir), values = [];
  if (entry.keys.length) {
    let store; try { store = entry.store === 'shared' ? await readSharedKeys(stateDir) : await readKeyStore(stateDir, await projectIdentity(projectDir)); } catch (error) { return { text: error.message, isError: true }; }
    const missing = entry.keys.filter(k => !Object.hasOwn(store.keys, k) || usableReason(store.keys[k]));
    if (missing.length) return { text: `tool ${tool.name} needs ${missing.length === 1 ? 'key' : 'keys'} ${missing.join(', ')}, not set on this machine`, isError: true };
    for (const k of entry.keys) { env[k] = store.keys[k]; values.push(store.keys[k]); }
  }
  let runTool = tool;
  if (entry.windows) {
    const started = Date.now(); let ready;
    try { ready = await waitReady(winReadyFile, { timeoutMs: tool.timeout_seconds * 1000 }); } catch (error) { return { text: error.message, isError: true }; }
    const remaining = tool.timeout_seconds * 1000 - (Date.now() - started);
    if (remaining <= 0) return { text: 'Waiting for Windows project timed out', isError: true };
    env.WHEELCHAIR_WINDOWS_PROJECT = ready.copy;
    const entries = (env.WSLENV || '').split(':').filter(Boolean);
    for (const name of ['WHEELCHAIR_WINDOWS_PROJECT', ...entry.keys]) if (!entries.some(e => e.split('/')[0] === name)) entries.push(name);
    env.WSLENV = entries.join(':');
    runTool = { ...tool, timeout_seconds: remaining / 1000 };
  }
  const result = await runScript({ dir, tool: runTool, input, env, keys: values, sandboxCli, projectDir }); if (result.refused) return { text: result.refused, isError: true }; if (result.ok) return { text: result.text, isError: false }; return { text: `Tool failed (exit code ${result.code}, signal ${result.signal}${result.timedOut ? ', timed out' : ''}).\n${result.stderr}`, isError: true };
} }]; });
installExitHandlers();
serve({ name: 'wheelchair-tools', version: '1', tools, onClose: () => { killAll(); process.exit(0); } });
