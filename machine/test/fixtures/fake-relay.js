'use strict';
const net = require('node:net');
const text = process.argv[2];
const options = JSON.parse(process.argv[3] || '{}');
const mode = /\$Mode = '(\w+)'/.exec(text)[1];
const port = Number(/\$ToolPort = (\d+)/.exec(text)[1]);
if (options.never) { process.stdin.resume(); return; }
if (options.noHeader) process.exit(7);
if (options.longHeader) { process.stdout.write('x'.repeat(513)); process.stdin.resume(); return; }
function start() {
  if (options.refuse) { process.stdout.write(`REFUSED ${options.refuse}\n`, () => process.exit(0)); return; }
  if (options.immediate) { process.stdout.write(options.immediate, () => process.exit(0)); return; }
  const target = net.connect(port, '127.0.0.1');
  target.on('error', () => { process.stdout.write('REFUSED nothing listening\n', () => process.exit(0)); });
  target.on('connect', () => {
    if (mode === 'check') { target.destroy(); process.stdout.write('OK\n', () => process.exit(0)); return; }
    if (options.exitUpload) { process.stdout.write('OK\n'); process.stdin.destroy(); setTimeout(() => process.exit(0), 20); return; }
    process.stdout.write(options.withBytes ? 'OK\nfirst' : 'OK\n');
    process.stdin.pipe(target); target.pipe(process.stdout);
    process.stdin.on('end', () => { target.destroy(); process.exit(0); });
    target.on('end', () => process.stdout.end());
  });
}
setTimeout(start, options.delay || 0);
