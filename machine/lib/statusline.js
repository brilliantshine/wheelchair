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
  if (!process.env.WHEELCHAIR_SESSION_TOKEN || !/^[A-Za-z0-9._-]+$/.test(session)) return;
  const state = process.env.WHEELCHAIR_STATE_DIR || path.join(os.homedir(), '.local/state/wheelchair');
  try {
    const dir = path.join(state, 'statusline'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const payload = {};
    for (const [field, stampName, interval, present] of [
      ['rate_limits', session, 60000, !!raw.rate_limits],
      ['context_window', `${session}.context`, 15000, typeof raw.context_window?.used_percentage === 'number'],
    ]) {
      if (!present) continue;
      const stamp = path.join(dir, stampName);
      let due = true; try { due = Date.now() - fs.statSync(stamp).mtimeMs >= interval; } catch {}
      if (due) { fs.writeFileSync(stamp, '', { mode: 0o600 }); payload[field] = raw[field]; }
    }
    if (Object.keys(payload).length) spawnSync(process.execPath, [path.join(__dirname, 'hook-post.js'), state, process.env.WHEELCHAIR_SESSION_TOKEN, kind, session], { input: JSON.stringify(payload), timeout: 5000, stdio: ['pipe', 'ignore', 'ignore'] });
  } catch {}
});
