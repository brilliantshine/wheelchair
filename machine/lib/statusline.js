'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
let text = '';
process.stdin.on('data', chunk => { text += chunk; });
process.stdin.on('end', () => {
  let raw = {}; try { raw = JSON.parse(text); } catch {}
  const model = raw.model?.display_name || 'Claude';
  const used = raw.rate_limits?.five_hour?.used_percentage;
  console.log(`${model}${typeof used === 'number' ? ` · 5h ${used}%` : ''}`);
  const [kind, session] = process.argv.slice(2);
  if (!process.env.WHEELCHAIR_SESSION_TOKEN || !raw.rate_limits || !/^[A-Za-z0-9._-]+$/.test(session)) return;
  const state = process.env.WHEELCHAIR_STATE_DIR || path.join(os.homedir(), '.local/state/wheelchair');
  try {
    const dir = path.join(state, 'statusline'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stamp = path.join(dir, session);
    try { if (Date.now() - fs.statSync(stamp).mtimeMs < 60000) return; } catch {}
    fs.writeFileSync(stamp, '', { mode: 0o600 });
    spawnSync(process.execPath, [path.join(__dirname, 'hook-post.js'), state, process.env.WHEELCHAIR_SESSION_TOKEN, kind, session], { input: text, timeout: 5000, stdio: ['pipe', 'ignore', 'ignore'] });
  } catch {}
});
