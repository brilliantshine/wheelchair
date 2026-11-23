'use strict';
const fs = require('node:fs');
const path = require('node:path');
const truncate = text => { text = String(text || ''); return text.length > 80 ? text.slice(0, 79) + '…' : text; };
const shellTarget = command => String(command || '').replace(/^\s*cd\s+(?:'[^']*'|"[^"]*"|\S+)\s*&&\s*/, '').split(/\r?\n/)[0];
function relative(target, cwd) {
  if (cwd && path.isAbsolute(target)) { const rel = path.relative(cwd, target); if (rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel)) return rel || '.'; }
  return target;
}
function keyFor(kind, target = '', verb = '', ctx = {}) {
  if (kind === 'shell') return `shell:${shellTarget(target).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' ')}`;
  if (kind === 'files') return target ? `files:${verb} ${verb === 'Searched' ? relative(target, ctx.cwd) : path.dirname(relative(target, ctx.cwd))}` : `files:${verb}`;
  return `${kind}:${kind}`;
}
function classify(cli, toolName, input, ctx = {}) {
  const vocab = typeof cli === 'string' ? require('../../connectors').machine(cli).stepVocabulary : cli;
  const name = String(toolName || ''), data = input && typeof input === 'object' ? input : {};
  let command = typeof input === 'string' ? input : (data.command || data.cmd || '');
  if (Array.isArray(command)) command = command.length === 3 && ['-lc', '-c'].includes(command[1]) ? command[2] : command.join(' ');
  const card = vocab.card.includes(name) && /(?:^|[\s/])card\.js\s+(message|result)\b(?:\s+([^\s;&|]+))?/.exec(command);
  let kind, label, target = '', verb = '';
  if (card) {
    kind = 'starter'; label = 'Reported back';
    if (card[1] === 'message') {
      label = 'Sent a message';
      try { const file = card[2].replace(/^['"]|['"]$/g, ''); const to = JSON.parse(fs.readFileSync(path.resolve(ctx.cwd || process.cwd(), file), 'utf8')).to; if (typeof to === 'string' && to) label = `Messaged ${to.replace(/^wc-[^-]+-/, '')}`; } catch {}
    }
  } else if (vocab.agents.includes(name)) {
    kind = 'helpers'; label = `Asked a helper: ${data.description || String(data.prompt || data.message || '').split(/\r?\n/)[0]}`;
  } else if (vocab.web.includes(name)) {
    kind = 'web'; if (data.query) label = `Searched the web: ${data.query}`; else { let host = data.url || ''; try { host = new URL(host).host; } catch {} label = `Read ${host}`; }
  } else if ((vocab.files.includes(name) || (vocab.fileSubstring && name.toLowerCase().includes('file')))) {
    kind = 'files'; target = data.file_path || data.path || data.notebook_path || data.pattern || '';
    if (name === 'apply_patch') {
      const patch = typeof input === 'string' ? input : (data.patch || data.input || '');
      const files = [...patch.matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)].map(m => m[1]); target = files[0] || ''; verb = 'Edited'; label = files.length > 1 ? `Edited ${files.length} files` : target ? `Edited ${path.basename(target)}` : 'Edited files';
    } else if (['Glob', 'Grep', 'LS'].includes(name)) { verb = 'Searched'; target = data.pattern || data.path || ''; label = `Searched ${target}`; }
    else { verb = ['Read', 'view_image'].includes(name) || /read/i.test(name) ? 'Read' : 'Edited'; label = `${verb} ${path.basename(target)}`; }
  } else { kind = 'shell'; target = command || name; label = vocab.shellDescription.includes(name) && data.description ? data.description : command ? `Ran ${shellTarget(command)}` : `Used ${name}`; }
  return { kind, label: truncate(label), key: keyFor(kind, target, verb, ctx) };
}
module.exports = { classify, shellTarget, truncate, keyFor };
