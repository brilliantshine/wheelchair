'use strict';
const { spawn } = require('node:child_process');

function run(program, args, { cwd, env, timeout = 30000, messages, parse }) {
  return new Promise((resolve, reject) => {
    let child, output = '', settled = false, response = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child?.kill('SIGKILL'); finish(new Error('usage probe timed out')); }, timeout);
    try { child = spawn(program, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { finish(error); return; }
    child.on('error', error => finish(error));
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (!messages) return;
      let end;
      while ((end = output.indexOf('\n')) !== -1) {
        const line = output.slice(0, end); output = output.slice(end + 1);
        let item; try { item = JSON.parse(line); } catch { continue; }
        if (item.id !== 2) continue;
        response = true; child.stdin.end(); child.kill();
        try { const reading = parse(item); if (!reading) throw new Error('invalid usage response'); finish(null, reading); }
        catch (error) { finish(error); }
        return;
      }
    });
    child.on('close', code => {
      if (response || settled) return;
      if (code !== 0) return finish(new Error(`usage probe exited ${code}`));
      try { const reading = messages ? null : parse(output); if (!reading) throw new Error('invalid usage response'); finish(null, reading); }
      catch (error) { finish(error); }
    });
    if (messages) child.stdin.write(messages.map(m => JSON.stringify(m)).join('\n') + '\n');
    else child.stdin.end();
  });
}
module.exports = { run };
