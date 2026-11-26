'use strict';
const fs = require('fs');
const path = require('path');
const { validateToolJson, inputSchema } = require('./folder-tools');
const { toolEnv, runScript, killAll, installExitHandlers } = require('./tool-run');
const { serve } = require('./mcp-stdio');
const args = process.argv.slice(2), dirs = []; let projectDir;
for (let i = 0; i < args.length; i++) { if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--tool') dirs.push(args[++i]); }
if (!projectDir || projectDir.startsWith('--')) { console.error('usage: --project-dir <dir> --tool <dir>'); process.exit(1); }
function read(dir) { try { const file = path.join(dir, 'tool.json'), stat = fs.statSync(file); if (!stat.isFile() || stat.size > 32768) return null; const r = validateToolJson(path.basename(dir), JSON.parse(fs.readFileSync(file, 'utf8'))); return r.ok && r.tool.kind === 'script' ? r.tool : null; } catch { return null; } }
const tools = dirs.flatMap(dir => { const tool = read(dir); if (!tool) return []; return [{ name: tool.name, description: tool.description, inputSchema: inputSchema(tool.inputs), call: async input => { if (JSON.stringify(read(dir)) !== JSON.stringify(tool)) return { text: 'The tool changed. Try it with wc.js tool run now or through MCP after the next agent start (a new session, a resume or an account switch).', isError: true }; const result = await runScript({ dir, tool, input, env: toolEnv(process.env, projectDir) }); if (result.ok) return { text: result.text, isError: false }; return { text: `Tool failed (exit code ${result.code}, signal ${result.signal}${result.timedOut ? ', timed out' : ''}).\n${result.stderr}`, isError: true }; } }]; });
installExitHandlers();
serve({ name: 'wheelchair-tools', version: '1', tools, onClose: () => { killAll(); process.exit(0); } });
