'use strict';
// Line-based guard: multiline expressions, escaped literals, template literals and
// computed properties can evade it; comments and unusual syntax can give false hits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const connectors = require('../../connectors');
const root = path.resolve(__dirname, '../..');
const ids = [...new Set(connectors.list().flatMap(m => [m.cli, m.provider]))];
const word = ids.join('|');
const literal = `['\"\x60](?:${word})['\"\x60]`;
const js = [
  new RegExp(`(?:===|!==|==|!=)\\s*${literal}|${literal}\\s*(?:===|!==|==|!=)`),
  new RegExp(`\\bcase\\s+${literal}\\s*:`),
  new RegExp(`(?:\\(|,)\\s*${literal}\\s*(?:,|\\))`),
  new RegExp(`(?:\\?|:|\\|\\||&&)\\s*${literal}`),
  new RegExp(`\\[[^\\]]*${literal}[^\\]]*\\]`),
  new RegExp(`(?:\\{|,)\\s*(?:${literal}|(?:${word}))\\s*:`),
  new RegExp(`\\b(?:adapters|connectors)\\.(?:${word})\\b`),
  new RegExp(`require\\s*\\(\\s*['\"][^'\"]*connectors/(?:${word})/`)
];
const shell = new RegExp(`(?:^|[| (])(?:${word})(?:[|)]|\\s*\\]\])|\\bfor\\s+\\w+\\s+in\\s+.*\\b(?:${word})\\b`);
const python = new RegExp(`(?:==|!=|\\bin\\b)\\s*${literal}|${literal}\\s*(?:==|!=|,)|[[(,]\\s*${literal}\\s*[,\\])]`);
const allow = [
  ...['viewer/app/balancer.js', 'viewer/app/sessions.js', 'viewer/app/settings.js'].map(file => ({ file, pattern: /path\.join\(hub\.root, 'codex', 'model\.sh'\)/, tag: 'not-tool', reason: 'This is the model script directory.' })),
  { file: 'viewer/pages/settings.js', pattern: /class: toolOf\(provider\)\.settings\.modelHeadsUp \? 'gpt'/, tag: 'not-tool', reason: 'This is a CSS class.' },
  { file: 'viewer/server.js', pattern: /(?:\['claude', 'codex', 'other'\]\.includes\((?:body\.harness|entry\??\.harness)\)|process\.env\.CLAUDECODE === '1' \? 'claude' : 'other'|name === 'claude' \|\| name === 'codex')/, tag: 'compat', reason: 'Graph caller labels remain compatible.' },
  { file: 'install.sh', pattern: /(?:claude|codex)\) (?:claude|codex)_present=/, tag: 'legacy', reason: 'Legacy cleanup derives these flags.' },
  { file: 'codex/model.sh', pattern: /(?:FORMATS\["(?:gpt|kimi)"\]|provider == "(?:claude|gpt)"|pins\["gpt"\]|cell\(pins, "gpt"|DEFAULTS\["gpt"\]|slot_for\("(?:gpt|claude)"|read_cell\(pin_path, "(?:gpt|claude)"|write_pin\(pin_path, "gpt"|argv\[:2\] == \["family", "claude"\]|key = "gpt", slot)/, tag: 'model-script', reason: 'Marked per-tool model workflows retain their existing formats.' },
  { file: 'codex/model.sh', pattern: /os\.path\.join\(root, "codex", "model\.sh"\)/, tag: 'not-tool', reason: 'This is the model script directory.' },
];
function walk(dir, extensions) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e => {
    const name = `${dir}/${e.name}`;
    if (e.isDirectory()) return name === 'machine/test' ? [] : walk(name, extensions);
    return extensions.some(ext => name.endsWith(ext)) && !/\.test\.js$/.test(name) ? [name] : [];
  });
}
test('tool names do not dispatch outside connectors', () => {
  const files = [...walk('machine', ['.js', '.sh']), ...walk('viewer/app', ['.js']), ...walk('viewer/pages', ['.js']), 'viewer/server.js', 'install.sh', 'codex/model.sh'];
  const hits = [];
  for (const file of files) fs.readFileSync(path.join(root, file), 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(?:\/\/|#|\*)/.test(line)) return;
    const found = file.endsWith('.js') ? js.some(re => re.test(line)) : shell.test(line) || (file === 'codex/model.sh' && python.test(line));
    if (found && !allow.some(a => a.file === file && a.pattern.test(line))) hits.push(`${file}:${i + 1}: ${line.trim()}`);
  });
  assert.deepEqual(hits, []);
});
