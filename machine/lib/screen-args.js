'use strict';

const OPS = ['start', 'run', 'shot', 'windows', 'move', 'click', 'drag', 'type', 'key', 'focus', 'stop', 'status'];
const modifiers = new Set(['ctrl', 'alt', 'shift', 'super']);
const keys = new Set(['Return', 'Escape', 'Tab', 'space', 'BackSpace', 'Delete', 'Insert', 'Home', 'End', 'Page_Up', 'Page_Down', 'Up', 'Down', 'Left', 'Right', 'minus', 'equal', 'comma', 'period', 'slash', 'semicolon', 'apostrophe', 'bracketleft', 'bracketright', 'backslash', 'grave']);

function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }
function decimal(value, maxDigits, name) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value) || value.length > maxDigits) fail(`${name} must be a decimal integer`);
  return Number(value);
}
function isKeyToken(token, { allowLoneModifier = false } = {}) {
  if (typeof token !== 'string') return false;
  const parts = token.split('+');
  if (parts.length === 1 && allowLoneModifier && modifiers.has(token)) return true;
  const key = parts.pop();
  if (!(keys.has(key) || /^[a-zA-Z0-9]$/.test(key) || /^F(?:[1-9]|1[0-2])$/.test(key))) return false;
  const seen = new Set();
  for (const part of parts) {
    if (!modifiers.has(part) || seen.has(part)) return false;
    seen.add(part);
  }
  return true;
}
function parseOp(op, args) {
  if (!OPS.includes(op) || !Array.isArray(args) || !args.every(a => typeof a === 'string')) fail('invalid operation or arguments');
  const count = n => { if (args.length !== n) fail('incorrect number of arguments'); };
  const coord = (v) => decimal(v, 7, 'coordinate');
  const windowId = (v) => decimal(v, 10, 'window id');
  switch (op) {
    case 'start': {
      if (args.length !== 0 && (args.length !== 2 || args[0] !== '--size')) fail('invalid size arguments');
      const match = (args[1] || (args.length ? '' : '1280x800')).match(/^([0-9]+)x([0-9]+)$/);
      if (!match) fail('size must be WxH');
      const width = Number(match[1]), height = Number(match[2]);
      if (width < 200 || width > 2560 || height < 200 || height > 2560) fail('size out of range');
      return { size: { width, height } };
    }
    case 'run': {
      const env = []; let i = 0;
      while (i < args.length && args[i] !== '--') {
        if (args[i] !== '--env' || i + 1 >= args.length) fail('expected --env or --');
        const entry = args[i + 1], at = entry.indexOf('=');
        const key = entry.slice(0, at);
        if (at < 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || ['DISPLAY', 'XAUTHORITY', 'WHEELCHAIR_SESSION_TOKEN'].includes(key)) fail('invalid environment variable');
        env.push([key, entry.slice(at + 1)]); i += 2;
      }
      if (args[i] !== '--') fail('command separator required');
      const command = args.slice(i + 1);
      if (!command.length || !command[0] || command[0] === '-' || command[0].includes('=')) fail('invalid command');
      return { env, command };
    }
    case 'shot':
      if (!args.length) return { window: null };
      if (args.length !== 2 || args[0] !== '--window') fail('invalid window arguments');
      return { window: windowId(args[1]) };
    case 'windows': case 'stop': case 'status': count(0); return {};
    case 'move': count(2); return { x: coord(args[0]), y: coord(args[1]) };
    case 'click': {
      if (args.length < 2) fail('coordinates required');
      const x = coord(args[0]), y = coord(args[1]);
      let button = 1, double = false, buttonSeen = false;
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--double' && !double) double = true;
        else if (args[i] === '--button' && !buttonSeen && ['left', 'middle', 'right'].includes(args[i + 1])) {
          button = { left: 1, middle: 2, right: 3 }[args[++i]]; buttonSeen = true;
        } else fail('invalid click option');
      }
      return { x, y, button, double };
    }
    case 'drag': count(4); return { x1: coord(args[0]), y1: coord(args[1]), x2: coord(args[2]), y2: coord(args[3]) };
    case 'type': count(1); if (!/^[\x20-\x7e\n\t]{1,400}$/.test(args[0])) fail('invalid text'); return { text: args[0] };
    case 'key': {
      let hold = null, tokens = args;
      if (args[0] === '--hold') {
        hold = decimal(args[1], 4, 'hold');
        if (hold < 50 || hold > 5000) fail('hold out of range');
        tokens = args.slice(2);
      }
      if (!tokens.length || tokens.length > (hold === null ? 20 : 6) || !tokens.every(t => isKeyToken(t, { allowLoneModifier: hold !== null }))) fail('invalid keys');
      return { hold, tokens };
    }
    case 'focus': count(1); return { window: windowId(args[0]) };
  }
}
function typeTimeoutMs(text) { return 10000 + 30 * text.length; }
function parseRootChildren(stdout) {
  const lines = stdout.split(/\r?\n/);
  const index = lines.findIndex(line => /^\s*\d+ children:/.test(line));
  if (index < 0) return [];
  const count = Number(lines[index].match(/\d+/)[0]);
  const ids = [];
  for (const line of lines.slice(index + 1)) {
    const match = line.match(/^\s*(0x[0-9a-f]+)\s+(?:"|\(has no name\))/i);
    if (match) ids.push(Number(match[1]));
    if (ids.length === count) break;
  }
  return ids;
}
function parseWindowInfo(stdout) {
  const line = stdout.match(/^\s*xwininfo: Window id:\s*(0x[0-9a-f]+)([^\r\n]*)/im);
  const tail = line[2], first = tail.indexOf('"'), last = tail.lastIndexOf('"');
  const field = name => Number(stdout.match(new RegExp(`^\\s*${name}:\\s*(-?\\d+)`, 'm'))[1]);
  return { id: Number(line[1]), name: first < 0 || last === first ? '' : tail.slice(first + 1, last), x: field('Absolute upper-left X'), y: field('Absolute upper-left Y'), width: field('Width'), height: field('Height'), viewable: /^\s*Map State:\s*IsViewable\s*$/m.test(stdout) };
}
module.exports = { OPS, parseOp, isKeyToken, typeTimeoutMs, parseRootChildren, parseWindowInfo };
