'use strict';
// Off WSL there is no wslpath. The bridge only needs it to name temp files for the fake
// Windows tools, which run on Linux, so put a pass-through stand-in (bin/wslpath) on PATH.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
if (spawnSync('wslpath', ['-u', '/']).error) {
  process.env.PATH = `${path.join(__dirname, 'bin')}${path.delimiter}${process.env.PATH}`;
}
