'use strict';

function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }
function parseWinOp(op, args) {
  if (!Array.isArray(args) || !args.every(arg => typeof arg === 'string')) fail('invalid arguments');
  const count = n => { if (args.length !== n) fail('incorrect number of arguments'); };
  switch (op) {
    case 'info': case 'sync': case 'windows': count(0); return {};
    case 'status': case 'stop':
      if (args.length > 1) fail('incorrect number of arguments');
      return { id: args.length ? args[0] : null };
    case 'path': count(1); if (!args[0]) fail('path required'); return { path: args[0] };
    case 'shot': {
      count(1);
      if (!/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(args[0])) fail('invalid handle');
      const handle = Number(args[0]);
      if (!Number.isSafeInteger(handle)) fail('invalid handle');
      return { handle };
    }
    case 'run': case 'start': {
      const env = []; let timeout = 540, timeoutSeen = false, i = 0;
      while (i < args.length && args[i] !== '--') {
        if (args[i] === '--env' && i + 1 < args.length) {
          const entry = args[i + 1], at = entry.indexOf('='), key = entry.slice(0, at);
          if (at < 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key === 'WHEELCHAIR_SESSION_TOKEN') fail('invalid environment variable');
          env.push([key, entry.slice(at + 1)]); i += 2;
        } else if (op === 'run' && args[i] === '--timeout' && !timeoutSeen && i + 1 < args.length) {
          if (!/^[0-9]+$/.test(args[i + 1])) fail('invalid timeout');
          timeout = Number(args[i + 1]);
          if (timeout < 1 || timeout > 540) fail('invalid timeout');
          timeoutSeen = true; i += 2;
        } else fail('invalid option');
      }
      if (args[i] !== '--') fail('command separator required');
      const [program, ...argv] = args.slice(i + 1);
      if (!program) fail('program required');
      return op === 'run' ? { timeout, env, program, argv } : { env, program, argv };
    }
    default: fail('unknown operation');
  }
}
module.exports = { parseWinOp };
