'use strict';
// Heuristic guard: escaped tool IDs, dynamic computed values and ambiguous regex/division
// syntax can evade detection; unusual language syntax can still yield false hits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const connectors = require('../../connectors');
const root = path.resolve(__dirname, '../..');
const ids = [...new Set(connectors.list().flatMap(m => [m.cli, m.provider]))];
const word = ids.join('|');
const literal = `['"]#+['"]`;
const js = [
  new RegExp(`(?:===|!==|==|!=)\\s*${literal}|${literal}\\s*(?:===|!==|==|!=)`),
  new RegExp(`\\bcase\\s+${literal}\\s*:`),
  new RegExp(`(?:\\(|,)\\s*${literal}(?=\\s*(?:,|\\)))`),
  new RegExp(`(?:\\?|:|\\|\\||&&)\\s*${literal}|${literal}\\s*(?:\\|\\||&&)`),
  new RegExp(`\\[[^\\]]*${literal}[^\\]]*\\]`),
  new RegExp(`(?:\\{|,)\\s*(?:${literal}|(?:${word}))\\s*:`),
  new RegExp(`(?:\\{|,)\\s*(?:${word})\\s*(?=,|\\})`),
  new RegExp(`\\b(?:adapters|connectors)\\.\\s*(?:${word})\\b`),
  new RegExp(`require\\s*\\(\\s*['"]@+['"]`)
];
const shell = new RegExp(String.raw`(?:^|[| (])(?:${word})(?:[|)]|\s*\]\])|\bfor\s+\w+\s+in\s+[^;\n]*(?:\\\n[^;\n]*)*\b(?:${word})\b`);
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
// Preserve offsets and newlines; only exact ID literals and connector paths receive
// markers. Template expressions are code, while template text remains blank.
function mask(source, file) {
  const out = source.split('');
  const blank = (a, b, mark = ' ') => { for (let j = a; j < b; j++) if (source[j] !== '\n' && source[j] !== '\r') out[j] = mark; };
  const shellLike = !file.endsWith('.js');
  function code(start, expression = false) {
    let i = start, depth = 0;
    while (i < source.length) {
      const c = source[i], n = source[i + 1];
      if (expression && c === '}' && depth-- === 0) return i + 1;
      if (expression && c === '{') depth++;
      if ((c === '/' && n === '/') || (shellLike && c === '#')) {
        let end = source.indexOf('\n', i); if (end < 0) end = source.length;
        blank(i, end); i = end; continue;
      }
      if (c === '/' && n === '*') {
        let end = source.indexOf('*/', i + 2); end = end < 0 ? source.length : end + 2;
        blank(i, end); i = end; continue;
      }
      if (c === "'" || c === '"') {
        let end = i + 1;
        while (end < source.length && source[end] !== c) { if (source[end] === '\\') end++; end++; }
        const value = source.slice(i + 1, end);
        const marker = ids.includes(value) ? '#' : /(?:^|\/)connectors\/(?:[^/]+)\//.test(value) && ids.some(id => value.includes(`connectors/${id}/`)) ? '@' : ' ';
        blank(i + 1, end, marker); i = Math.min(end + 1, source.length); continue;
      }
      if (!shellLike && c === '`') {
        out[i++] = ' ';
        while (i < source.length) {
          if (source[i] === '\\') { blank(i, Math.min(i + 2, source.length)); i += 2; continue; }
          if (source[i] === '`') { out[i++] = ' '; break; }
          if (source[i] === '$' && source[i + 1] === '{') { blank(i, i + 2); i = code(i + 2, true); out[i - 1] = ' '; continue; }
          blank(i, i + 1); i++;
        }
        continue;
      }
      if (!shellLike && c === '/' && /(?:^|[=(:,!\[?;{}]|\breturn)\s*$/.test(source.slice(0, i))) {
        let end = i + 1, bracket = false;
        while (end < source.length && source[end] !== '\n') {
          if (source[end] === '\\') { end += 2; continue; }
          if (source[end] === '[') bracket = true;
          if (source[end] === ']') bracket = false;
          if (source[end] === '/' && !bracket) { end++; while (/[a-z]/i.test(source[end] || '') && end < source.length) end++; break; }
          end++;
        }
        blank(i, end); i = end; continue;
      }
      i++;
    }
    return i;
  }
  code(0);
  return out.join('');
}
function detect(source, file = 'snippet.js') {
  const hits = [], scan = mask(source, file);
  const patterns = file.endsWith('.js') ? js : [shell, ...(file === 'codex/model.sh' ? [python] : [])];
  for (const re of patterns) {
    const global = new RegExp(re.source, [...new Set(re.flags + 'gm')].join(''));
    for (const match of scan.matchAll(global)) {
      const target = new RegExp(literal + `|['"]@+['"]|\\b(?:${word})\\b`).exec(match[0]);
      if (!target) continue;
      const offset = match.index + target.index;
      const lineNumber = source.slice(0, offset).split('\n').length;
      const line = source.split('\n')[lineNumber - 1];
      if (!allow.some(a => a.file === file && a.pattern.test(line))) hits.push({ line: lineNumber, text: line.trim() });
    }
  }
  return hits;
}
test('detector recognizes name checks across lines', () => {
  for (const snippet of ["x === 'codex'", "'codex' !== x", "case 'codex':", "f('codex')", "f(\n x,\n 'codex'\n)", "x ? 'codex' : y", "'codex' || x", "x && 'codex'", "['codex']", "{\n codex\n: 1}", "{ codex, other }", "connectors.codex", "require('connectors/codex/machine')"]) assert.ok(detect(snippet).length, snippet);
  for (const snippet of ["x ?\n 'codex' : y", "x ? y :\n 'codex'", "[\n 'codex'\n]", "{\n 'codex'\n : 1 }", "{\n codex\n : 1 }", "obj[\n 'codex'\n]", "adapters.\n codex", "require(\n 'connectors/codex/machine'\n)"]) assert.ok(detect(snippet).length, snippet);
  for (const snippet of ["x || 'codex'", "'codex' && x", "x && 'codex'", "'codex' || x", "x ? y : 'codex'", "{ codex: 1 }", "{ 'codex': 1 }", "obj['codex']", "adapters.codex", "f(x, 'codex')", "x ||\n'codex'", "'codex'\n|| x", "x &&\n'codex'", "'codex'\n&& x", "{\n codex,\n other }", "f(\n x,\n 'codex'\n)", "`text ${f('codex')}`"]) assert.ok(detect(snippet).length, snippet);
  for (const snippet of ["die('cli must be claude, codex, agy, kimi or pi')", "`f('codex') { codex, other }`", "// f('codex')", "/* { codex, other } */", "const kimiTimer = 1", "/f('codex')/", "'codex_mode'", "'pi-guard'", "'https://example.com/codex'", "const x = 'codex';"]) assert.deepEqual(detect(snippet), [], snippet);
  assert.equal(detect("f(\n  'codex'\n)")[0].line, 2);
  assert.deepEqual(detect("f('codex',\n 'kimi')").map(x => x.line), [1, 2]);
  for (const snippet of ["x\n===\n'codex'", "case\n'codex':", "['codex',\n x]", "obj[\n'codex'\n]", "x ||\n'codex'", "'codex'\n&& x", "{\n'codex'\n: x}"]) assert.ok(detect(snippet).length, snippet);
  for (const snippet of ['# for x in codex', "echo 'for x in codex'"]) assert.deepEqual(detect(snippet, 'test.sh'), [], snippet);
  for (const snippet of ['case x in codex)', '[[ $x == codex ]]', 'for x in claude codex', 'case x in\n codex)', '[[ $x ==\n codex ]]', 'for x in other \\\n codex']) assert.ok(detect(snippet, 'test.sh').length, snippet);
  for (const snippet of ["x == 'codex'", "x ==\n 'codex'", "x in ['codex']", "x in [\n 'codex'\n]", "('codex', 'other')", "(\n 'codex',\n 'other')"]) assert.ok(detect(snippet, 'codex/model.sh').length, snippet);
});
test('tool names do not dispatch outside connectors', () => {
  const files = [...walk('machine', ['.js', '.sh']), ...walk('viewer/app', ['.js']), ...walk('viewer/pages', ['.js']), 'viewer/server.js', 'install.sh', 'codex/model.sh'];
  const hits = [];
  for (const file of files) for (const hit of detect(fs.readFileSync(path.join(root, file), 'utf8'), file)) hits.push(`${file}:${hit.line}: ${hit.text}`);
  assert.deepEqual(hits, []);
});
