'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

function createWinForward({ stateDir, ready, spawnRelay, log = () => {}, timeouts = {}, relayScript }) {
  const directory = path.join(stateDir, 'win');
  const record = path.join(directory, 'forwards.json');
  const forwards = new Map();
  const pending = new Map();
  const stale = [];
  let writes = Promise.resolve();
  let serial = 0;
  let script = relayScript;
  const headerTimeout = timeouts.header ?? 12000;
  const checkTimeout = timeouts.check ?? 10000;

  function validate(port) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('invalid tool port');
  }
  function spawn(mode, port) {
    validate(port);
    if (script === undefined) script = fs.readFileSync(path.join(__dirname, 'win-relay.ps1'), 'utf8');
    return spawnRelay(`$Mode = '${mode}'\n$ToolPort = ${port}\n${script}`);
  }
  function writeRecord() {
    const write = writes.then(async () => {
      await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
      const data = JSON.stringify({ forwards: [...forwards].map(([tool_port, f]) => ({ tool_port, private_port: f.private_port })) });
      const temp = path.join(directory, `.forwards-${process.pid}-${++serial}.tmp`);
      try {
        await fs.promises.writeFile(temp, data, { mode: 0o600, flag: 'wx' });
        await fs.promises.rename(temp, record);
      } finally { await fs.promises.unlink(temp).catch(() => {}); }
    });
    writes = write.catch(() => {});
    return write;
  }
  function listen(toolPort, privatePort) {
    return new Promise((resolve, reject) => {
      const forward = { private_port: privatePort, state: 'ok', listener: null, connections: new Set(), last_refusal: null };
      const server = net.createServer(socket => connection(forward, toolPort, socket));
      forward.listener = server;
      server.once('error', reject);
      server.listen(privatePort, '127.0.0.1', () => {
        server.removeListener('error', reject);
        server.on('error', error => log(`Windows forward listener: ${error.message}`));
        forward.private_port = server.address().port;
        server.unref();
        resolve(forward);
      });
    });
  }
  function connection(forward, port, socket) {
    let child, settled = false, header = Buffer.alloc(0), buffered = [], size = 0, timer, stderr = Buffer.alloc(0);
    const pair = { socket, relay: null };
    forward.connections.add(pair);
    function finish(reason, clear = false) {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      if (clear) forward.last_refusal = null;
      else if (reason) forward.last_refusal = { reason, at: new Date().toISOString() };
      return true;
    }
    function cleanup() {
      socket.destroy();
      if (child) {
        for (const stream of [child.stdin, child.stdout, child.stderr]) if (stream) stream.destroy();
        try { child.kill(); } catch {}
      }
    }
    function failure(error) {
      finish(`couldn't start the Windows helper: ${error?.message || error}`);
      cleanup();
    }
    socket.on('error', () => { finish(); cleanup(); });
    socket.on('end', () => { if (!settled) { finish(); cleanup(); } });
    socket.on('close', () => { finish(); cleanup(); forward.connections.delete(pair); });
    socket.on('data', chunk => {
      if (settled) return;
      buffered.push(chunk); size += chunk.length;
      if (size > 64 * 1024) socket.pause();
    });
    try {
      child = spawn('connect', port);
      pair.relay = child;
      child.on('error', failure);
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', failure);
      child.stderr.on('data', chunk => { stderr = Buffer.concat([stderr, chunk]).subarray(-4096); });
      child.on('close', code => {
        if (stderr.length) log(`Windows helper: ${stderr.toString()}`);
        if (!settled) failure(code === null ? 'unknown exit code' : `exit code ${code}`);
      });
      child.stdout.on('data', function readHeader(chunk) {
        if (settled) return;
        header = Buffer.concat([header, chunk]);
        const end = header.indexOf(10);
        if (end < 0) { if (header.length > 512) failure('invalid header'); return; }
        const line = header.subarray(0, end).toString('utf8');
        const rest = header.subarray(end + 1);
        child.stdout.removeListener('data', readHeader);
        if (line === 'OK') {
          if (!finish(null, true)) return;
          const canWriteSocket = !rest.length || socket.write(rest);
          const canWriteChild = !size || child.stdin.write(Buffer.concat(buffered, size));
          buffered = [];
          socket.removeAllListeners('data');
          socket.pipe(child.stdin);
          child.stdout.pipe(socket);
          if (!canWriteSocket) { child.stdout.pause(); socket.once('drain', () => child.stdout.resume()); }
          if (!canWriteChild) { socket.pause(); child.stdin.once('drain', () => socket.resume()); }
          else socket.resume();
        } else if (line.startsWith('REFUSED ')) {
          finish(line.slice(8)); cleanup();
        } else failure('invalid header');
      });
      timer = setTimeout(() => { if (finish("Windows didn't answer in time")) cleanup(); }, headerTimeout);
    } catch (error) { failure(error); }
  }
  async function get(port) {
    validate(port);
    if (!ready()) throw new Error('Windows bridge not available');
    if (pending.has(port)) return pending.get(port);
    const current = forwards.get(port);
    if (current?.state === 'ok') return current.private_port;
    const promise = (async () => {
      let f = current;
      if (!f) {
        try { f = await listen(port, 0); } catch { throw new Error("couldn't open a local port"); }
        f.state = 'unrecorded';
        forwards.set(port, f);
      }
      try { await writeRecord(); } catch { throw new Error("couldn't save the port record"); }
      f.state = 'ok';
      return f.private_port;
    })();
    pending.set(port, promise);
    try { return await promise; } finally { pending.delete(port); }
  }
  function check(port) {
    validate(port);
    const reason = `couldn't check Windows for port ${port}`;
    return new Promise(resolve => {
      let child, header = Buffer.alloc(0), settled = false, timer, stderr = Buffer.alloc(0);
      function finish(result) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (child) {
          for (const stream of [child.stdin, child.stdout, child.stderr]) if (stream) stream.destroy();
          try { child.kill(); } catch {}
        }
        resolve(result);
      }
      const fail = () => finish({ ok: false, reason });
      try {
        child = spawn('check', port);
        child.on('error', fail);
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream.on('error', fail);
        child.stderr.on('data', chunk => { stderr = Buffer.concat([stderr, chunk]).subarray(-4096); });
        child.on('close', () => { if (stderr.length) log(`Windows helper: ${stderr.toString()}`); fail(); });
        child.stdout.on('data', chunk => {
          header = Buffer.concat([header, chunk]);
          const end = header.indexOf(10);
          if (end < 0) { if (header.length > 512) fail(); return; }
          const line = header.subarray(0, end).toString('utf8');
          if (line === 'OK') finish({ ok: true });
          else if (line.startsWith('REFUSED ')) finish({ ok: false, reason: line.slice(8) });
          else fail();
        });
        timer = setTimeout(fail, checkTimeout);
      } catch { fail(); }
    });
  }
  function status(port) {
    const result = {};
    const old = stale.find(item => item.tool_port === port);
    if (old) result.note = `after the machine service restarted, port ${old.private_port} couldn't be reopened; sessions started before that restart can't use this tool (new sessions can)`;
    const last = forwards.get(port)?.last_refusal;
    if (last) result.last = { ...last };
    return result;
  }
  async function restore(liveTmux) {
    let entries;
    try { entries = JSON.parse(await fs.promises.readFile(record, 'utf8')).forwards; if (!Array.isArray(entries)) return; } catch { return; }
    if (liveTmux !== null && ![...liveTmux].some(name => name.startsWith('wc-'))) { await writeRecord(); return; }
    for (const entry of entries) {
      if (!Number.isInteger(entry?.tool_port) || entry.tool_port < 1 || entry.tool_port > 65535 || !Number.isInteger(entry.private_port) || entry.private_port < 1 || entry.private_port > 65535 || forwards.has(entry.tool_port)) continue;
      try { forwards.set(entry.tool_port, await listen(entry.tool_port, entry.private_port)); }
      catch { stale.push({ ...entry, reason: 'port in use on Linux' }); }
    }
  }
  return { get, check, status, restore };
}
module.exports = { createWinForward };
