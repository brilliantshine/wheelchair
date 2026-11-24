'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function chooseWorkers({ full, othersFull, cpus }) {
  return full && !othersFull ? Math.max(2, Math.min(6, Math.floor(cpus / 2))) : 2;
}

function liveOthers(dir, selfPid) {
  fs.mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!/^[1-9]\d*$/.test(name)) continue;
    const pid = Number(name);
    if (!Number.isSafeInteger(pid) || pid === selfPid) continue;
    try {
      process.kill(pid, 0);
      count++;
    } catch (error) {
      if (error.code === 'ESRCH') {
        try { fs.unlinkSync(path.join(dir, name)); } catch (unlinkError) {
          if (unlinkError.code !== 'ENOENT') throw unlinkError;
        }
      } else if (error.code === 'EPERM') count++;
      else throw error;
    }
  }
  return count;
}

function register(dir, pid) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, String(pid)), '');
}

function unregister(dir, pid) {
  try { fs.unlinkSync(path.join(dir, String(pid))); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function decide() {
  const full = process.env.WHEELCHAIR_FULL_RUN === '1';
  // A run that is not full always takes 2, even if it inherits a full run's decision.
  if (!full) return chooseWorkers({ full, othersFull: false, cpus: os.cpus().length });
  if (process.env.WHEELCHAIR_BROWSER_WORKERS !== undefined)
    return Number(process.env.WHEELCHAIR_BROWSER_WORKERS);
  const dir = path.join(os.tmpdir(), 'wheelchair-browser-tests');
  const othersFull = liveOthers(dir, process.pid) > 0;
  const workers = chooseWorkers({ full, othersFull, cpus: os.cpus().length });
  register(dir, process.pid);
  process.on('exit', () => unregister(dir, process.pid));
  process.env.WHEELCHAIR_BROWSER_WORKERS = String(workers);
  return workers;
}

module.exports = { chooseWorkers, liveOthers, register, unregister, decide };
