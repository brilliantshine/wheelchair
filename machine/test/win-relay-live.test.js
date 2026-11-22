'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createWinEnv, detectWsl } = require('../lib/win-env');

const detected = detectWsl();
const exe = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const available = detected.wsl && fs.existsSync(exe);
const env = createWinEnv({ mount: detected.mount });
const relaySource = fs.readFileSync(require.resolve('../lib/win-relay.ps1'), 'utf8');
const windowsPids = new Set();
const children = new Set();
function ps(script) {
  const child = env.spawnPs(script, { stdio: ['pipe', 'pipe', 'pipe'] });
  children.add(child);
  child.on('close', () => children.delete(child));
  child.on('error', () => {});
  child.stdin.on('error', () => {});
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});
  return child;
}
function relay(mode, port) {
  return ps(`$Mode = '${mode}'\n$ToolPort = ${port}\n${relaySource}`);
}
function header(child, timeout = 12000) {
  return new Promise((resolve, reject) => {
    let bytes = Buffer.alloc(0);
    let stderr = '';
    const timer = setTimeout(() => finish(new Error(`header timed out: ${stderr}`)), timeout);
    const onError = err => finish(err);
    const onEnd = () => finish(new Error(`no header: ${stderr}`));
    const onData = () => {
      let b;
      while ((b = child.stdout.read(1)) !== null) {
        if (b[0] === 10) return finish(null, bytes.toString('ascii'));
        bytes = Buffer.concat([bytes, b]);
        if (bytes.length > 512) return finish(new Error('header too long'));
      }
    };
    function finish(err, value) {
      clearTimeout(timer);
      child.stdout.off('readable', onData);
      child.stdout.off('end', onEnd);
      child.off('error', onError);
      err ? reject(err) : resolve(value);
    }
    child.stderr.on('data', b => { stderr += b.toString(); });
    child.stdout.on('readable', onData);
    child.stdout.on('end', onEnd);
    child.on('error', onError);
    onData();
  });
}
function exited(child, timeout = 12000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return Promise.race([
    once(child, 'close'),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('process did not exit')), timeout); timer.unref(); }),
  ]);
}
function port() { return crypto.randomInt(22000, 60000); }
async function listener(address, behavior) {
  const p = port();
  const addressCode = address === '::' ? '[System.Net.IPAddress]::IPv6Any' : `[System.Net.IPAddress]::Parse('${address}')`;
  const bodies = {
    echo: `$buffer = [byte[]]::new(65536)
while (($n = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $stream.Write($buffer, 0, $n)
    $stream.Flush()
}`,
    bulk: `$buffer = [byte[]]::new(16777216)
$offset = 0
while ($offset -lt $buffer.Length) {
    $n = $stream.Read($buffer, $offset, $buffer.Length - $offset)
    if ($n -eq 0) { throw 'input ended early' }
    $offset += $n
}
$stream.Write($buffer, 0, $buffer.Length)
$stream.Flush()`,
    final: `$buffer = [byte[]]::new(262144)
for ($i = 0; $i -lt $buffer.Length; $i++) { $buffer[$i] = $i % 251 }
$stream.Write($buffer, 0, $buffer.Length)
$stream.Flush()`,
    stall: `$c.SendBufferSize = 65536
$buffer = [byte[]]::new(65536)
for ($i = 1; $i -le 1024; $i++) {
    $stream.Write($buffer, 0, $buffer.Length)
    [Console]::Out.WriteLine("SENT $($i * 65536)")
}`,
  };
  const script = `$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
$l = [System.Net.Sockets.TcpListener]::new(${addressCode}, ${p})
${address === '::' ? '$l.Server.DualMode = $true' : ''}
$l.Start()
[Console]::Out.WriteLine("READY $PID")
$c = $l.AcceptTcpClient()
$stream = $c.GetStream()
${bodies[behavior]}
$c.Close()
$l.Stop()
`;
  const child = ps(script);
  let output = '';
  let errors = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => done(new Error(`listener did not start: ${errors}`)), 15000);
    const check = () => {
      const match = output.match(/READY (\d+)/);
      if (match) { windowsPids.add(Number(match[1])); done(); }
    };
    const end = () => done(new Error(`listener exited: ${errors}`));
    function done(err) {
      clearTimeout(timeout);
      child.stdout.off('data', check);
      child.off('close', end);
      err ? reject(err) : resolve();
    }
    child.stdout.on('data', check);
    child.on('close', end);
    check();
  });
  return { port: p, child, output: () => output };
}
after(async () => {
  for (const child of children) child.kill('SIGKILL');
  await Promise.all([...windowsPids].map(pid => new Promise(resolve => {
    const child = spawn('/mnt/c/Windows/System32/taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    child.on('error', resolve);
    child.on('close', resolve);
  })));
});

const options = { skip: available ? false : 'skipped: not WSL', timeout: 180000 };
test('Windows relay live', options, async t => {
  for (const address of ['127.0.0.1', '0.0.0.0', '::']) {
    await t.test(`${address} listener passes data`, async () => {
      const server = await listener(address, 'echo');
      const start = performance.now();
      const child = relay('connect', server.port);
      assert.equal(await header(child), 'OK');
      console.log(`OK latency ${address}: ${(performance.now() - start).toFixed(0)} ms`);
      const received = once(child.stdout, 'data');
      child.stdin.write('hello through relay');
      assert.equal((await received)[0].toString(), 'hello through relay');
      child.stdin.end();
      await exited(child);
    });
  }
  await t.test('no listener is refused', async () => {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const p = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const child = relay('check', p);
    assert.equal(await header(child), `REFUSED nothing on Windows is listening on port ${p}`);
    await exited(child);
  });
  await t.test('Linux localhostForwarding is refused', async t => {
    const server = net.createServer(socket => socket.on('data', () => assert.fail('Linux listener received tool bytes')));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.close(); server.closeAllConnections?.(); });
    const p = server.address().port;
    const config = spawnSync(exe, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(`$ProgressPreference = 'SilentlyContinue'\n$p = Join-Path $env:USERPROFILE '.wslconfig'\nif (Test-Path $p) { [Console]::Write([IO.File]::ReadAllText($p)) }\n`, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 10000 });
    const disabled = /^\s*localhostForwarding\s*=\s*false\s*$/im.test(config.stdout || '');
    if (disabled) { t.skip('localhostForwarding is off'); return; }
    let response;
    for (let attempt = 0; attempt < 10; attempt++) {
      const child = relay('check', p);
      response = await header(child);
      await exited(child);
      if (!response.includes('nothing on Windows is listening')) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.equal(response, `REFUSED port ${p} on Windows leads back to Linux`);
  });
  await t.test('16 MiB in each direction arrives intact', async () => {
    const server = await listener('127.0.0.1', 'bulk');
    const child = relay('connect', server.port);
    assert.equal(await header(child), 'OK');
    const data = crypto.randomBytes(16 * 1024 * 1024);
    const received = [];
    let size = 0;
    const done = new Promise((resolve, reject) => {
      child.stdout.on('data', chunk => { received.push(chunk); size += chunk.length; if (size >= data.length) resolve(); });
      child.stdout.on('end', () => { if (size < data.length) reject(new Error(`only received ${size} bytes`)); });
    });
    child.stdout.resume();
    child.stdin.write(data);
    await done;
    assert.deepEqual(Buffer.concat(received), data);
    child.stdin.end();
    await exited(child);
  });
  await t.test('stalled stdout bounds Windows sends', async () => {
    const server = await listener('127.0.0.1', 'stall');
    const child = relay('connect', server.port);
    assert.equal(await header(child), 'OK');
    await new Promise(resolve => setTimeout(resolve, 3000));
    const count = () => [...server.output().matchAll(/SENT (\d+)/g)].map(m => Number(m[1])).at(-1) || 0;
    const first = count();
    await new Promise(resolve => setTimeout(resolve, 1500));
    const second = count();
    console.log(`Stalled Windows sender: ${second} bytes reported`);
    assert.ok(second >= 65536, 'Windows sender must have sent data');
    assert.equal(second, first, 'Windows sender should stop advancing');
    assert.ok(second < 8 * 1024 * 1024, `sent ${second} bytes before blocking`);
    child.kill('SIGKILL');
    await exited(child);
  });
  await t.test('last bytes before Windows close arrive', async () => {
    const server = await listener('127.0.0.1', 'final');
    const child = relay('connect', server.port);
    assert.equal(await header(child), 'OK');
    const chunks = [];
    for await (const chunk of child.stdout) chunks.push(chunk);
    const expected = Buffer.alloc(262144);
    for (let i = 0; i < expected.length; i++) expected[i] = i % 251;
    assert.deepEqual(Buffer.concat(chunks), expected);
    await exited(child);
  });
  await t.test('check prints one line and exits', async () => {
    const server = await listener('127.0.0.1', 'echo');
    const start = performance.now();
    const child = relay('check', server.port);
    assert.equal(await header(child), 'OK');
    const remainder = [];
    for await (const chunk of child.stdout) remainder.push(chunk);
    await exited(child, 10000);
    assert.equal(Buffer.concat(remainder).length, 0);
    console.log(`Check start to exit: ${(performance.now() - start).toFixed(0)} ms`);
    assert.ok(performance.now() - start < 10000);
  });
  await t.test('stdin close ends connect relay', async () => {
    const server = await listener('127.0.0.1', 'echo');
    const child = relay('connect', server.port);
    assert.equal(await header(child), 'OK');
    child.stdin.end();
    await exited(child);
  });
  await t.test('40 assorted ports all start and print a header', async () => {
    const ports = [1, 80, 65535, ...Array.from({ length: 37 }, (_, i) => 1000 + i * 1709)];
    for (let i = 0; i < ports.length; i += 10) {
      await Promise.all(ports.slice(i, i + 10).map(async p => {
        const child = relay('check', p);
        const line = await header(child, 20000).catch(error => { throw new Error(`port ${p}: ${error.message}`); });
        assert.match(line, /^(OK|REFUSED .+)$/);
        await exited(child);
      }));
    }
  });
});
