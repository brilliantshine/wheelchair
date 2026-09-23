'use strict';

// Deliberately tiny fault seams for lifecycle races.  They are selected only by tests through
// GRAPH_TEST_HOOK, so production's listener and filesystem calls stay untouched.
const fs = require('node:fs/promises');
const net = require('node:net');
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
