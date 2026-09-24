'use strict';

// Deliberately tiny fault seams for lifecycle races.  They are selected only by tests through
// GRAPH_TEST_HOOK, so production's listener and filesystem calls stay untouched.
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const path = require('node:path');

const mode = process.env.GRAPH_TEST_HOOK;
if (mode === 'delay-listen-callback') {
  const listen = net.Server.prototype.listen;
  net.Server.prototype.listen = function(...args) {
    const callback = args.at(-1);
    if (typeof callback !== 'function') return listen.apply(this, args);
    args[args.length - 1] = function(...callbackArgs) { setTimeout(() => callback.apply(this, callbackArgs), 180); };
    return listen.apply(this, args);
  };
}
if (mode === 'fail-server-rename') {
  const rename = fs.rename;
  fs.rename = async function(from, to) {
    if (path.basename(to) === '.server') throw new Error('injected .server rename failure');
    return rename.call(this, from, to);
  };
}
if (mode === 'ignore-sigterm') {
  // Removing the server's listener alone would restore SIGTERM's default action and kill the
  // process at once; the no-op listener is what makes the signal ignored.
  const ignore = () => {};
  const timer = setInterval(() => {
    for (const listener of process.listeners('SIGTERM')) {
      if (listener !== ignore) process.removeListener('SIGTERM', listener);
    }
    if (!process.listeners('SIGTERM').includes(ignore)) process.on('SIGTERM', ignore);
  }, 10);
  timer.unref();
}
if (mode === 'pause-before-register') {
  const request = http.request;
  http.request = function(options, ...args) {
    if (options.path === '/register' && process.env.GRAPH_TEST_MARKER) {
      const outgoing = new EventEmitter();
      fssync.writeFileSync(process.env.GRAPH_TEST_MARKER, 'ready');
      outgoing.end = function(...endArgs) {
        const timer = setInterval(() => {
          if (fssync.existsSync(process.env.GRAPH_TEST_MARKER)) return;
          clearInterval(timer);
          const actual = request.call(this, options, ...args);
          actual.on('error', (error) => outgoing.emit('error', error));
          actual.on('timeout', () => outgoing.emit('timeout'));
          actual.end(...endArgs);
        }, 10);
        return outgoing;
      };
      outgoing.destroy = (error) => { if (error) outgoing.emit('error', error); };
      return outgoing;
    }
    return request.call(this, options, ...args);
  };
}
if (mode === 'delay-relisten-after-stop') {
  globalThis.__wheelchairAfterServiceStop = async () => {
    const marker = process.env.GRAPH_TEST_MARKER;
    if (!marker) throw new Error('delay-relisten-after-stop needs GRAPH_TEST_MARKER');
    fssync.writeFileSync(marker, 'paused');
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (fssync.existsSync(marker)) return;
        clearInterval(timer); resolve();
      }, 10);
    });
  };
}
