'use strict';
const fs = require('node:fs');
const write = fs.writeSync;
fs.writeSync = function(fd, data, ...args) {
  if (fd === 1 && Buffer.isBuffer(data) && data.length === 0) fs.appendFileSync(process.env.PROBE_LOG, `${process.stdout.writableLength}\n`);
  return write.call(this, fd, data, ...args);
};
