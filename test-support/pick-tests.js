'use strict';

const path = require('node:path').posix;
const { execFileSync } = require('node:child_process');

try {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const args = process.argv.slice(2);
  let base, head = 'HEAD', json = false, full = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) base = args[++i];
    else if (args[i] === '--head' && args[i + 1]) head = args[++i];
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--full') full = true;
    else throw new Error('usage: --base <commit> [--head <commit>] [--json], or --full');
  }
  if (full === Boolean(base)) throw new Error('supply exactly one of --base or --full');
  git('rev-parse', '--verify', `${head}^{commit}`);
  const suites = [
    ['viewer-node', 'node --test viewer/test/*.test.js'],
    ['viewer-browser', 'npm --prefix viewer run test:browser'],
    ['machine', 'bash machine/test/run.sh'],
    ['test-support', 'node --test test-support/test/*.test.js'],
    ['sensitivity', 'bash sensitivity/test/run.sh'], ['codex', 'bash codex/test/run.sh'],
    ['install', 'bash install/test/run.sh'],
    ['sudo-helper', ['python3 -m unittest discover -s sudo-helper/test', 'bash sudo-helper/test/install-test.sh']]
  ];
  const state = new Map(suites.map(([name]) => [name, { whole: false, files: new Set(), reasons: new Set() }]));
  const files = new Set(git('ls-tree', '-r', '--name-only', '-z', head).split('\0').filter(Boolean));
  const testSuite = p => /^viewer\/test\/[^/]+\.test\.js$/.test(p) ? 'viewer-node' : /^viewer\/test\/[^/]+\.spec\.js$/.test(p) ? 'viewer-browser' : /^machine\/test\/[^/]+\.test\.js$/.test(p) ? 'machine' : null;
  const tests = [...files].filter(testSuite).sort();
  const mark = (suite, file, reason) => { const s = state.get(suite); if (!s) return false; if (file && !files.has(file)) return false; if (file) s.files.add(file); else s.whole = true; s.reasons.add(reason); return true; };
  const whole = (names, reason) => names.forEach(name => mark(name, null, reason));
  const glob = pattern => {
    let re = '^';
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === '*' && pattern[i + 1] === '*') { i++; if (pattern[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; }
      else if (c === '*') re += '[^/]*';
      else re += c.replace(/[\\^$+.?()|[\]{}]/g, '\\$&');
    }
    return new RegExp(re + '$');
  };
  let changed = [];
  if (full) whole(suites.map(s => s[0]), 'full run');
  else {
    git('rev-parse', '--verify', `${base}^{commit}`);
    const fields = git('diff', '--name-status', '-M', '-z', base, head, '--').split('\0');
    for (let i = 0; i < fields.length && fields[i];) {
      const status = fields[i++]; changed.push(fields[i++]);
      if (status.startsWith('R') || status.startsWith('C')) changed.push(fields[i++]);
    }
    changed = [...new Set(changed)].sort();
    const map = JSON.parse(git('show', `${head}:test-support/test-map.json`));
    const contents = new Map(tests.filter(p => testSuite(p) !== 'viewer-browser').map(p => [p, git('show', `${head}:${p}`)]));
    for (const p of changed) {
      const ownTest = testSuite(p);
      if (ownTest) { if (files.has(p)) mark(ownTest, p, 'changed test'); continue; }
      let covered = false, mapped = false, mapEntry = false;
      if (!p.startsWith('docs/') && !/(^|\/)test\//.test(p)) {
        const sourceBase = path.basename(p, path.extname(p));
        for (const [test, text] of contents) {
          const component = p.split('/')[0];
          const baseName = path.basename(test);
          const byName = test.startsWith(component + '/test/') && (baseName.startsWith(sourceBase + '.') || baseName.startsWith(sourceBase + '-'));
          const imports = /(?:require\s*\(\s*|\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["'](\.[^"']+)["']/g;
          let match, byImport = false;
          while ((match = imports.exec(text))) {
            const resolved = path.normalize(path.join(path.dirname(test), match[1]));
            if (resolved === p || resolved + '.js' === p || resolved + '/index.js' === p) byImport = true;
          }
          if (byName || byImport) { mark(testSuite(test), test, byImport ? 'import' : 'basename'); mapped = covered = true; }
        }
      }
      for (const entry of map) if (glob(entry.glob).test(p)) for (const target of entry.tests) {
        const suite = testSuite(target);
        if (suite ? mark(suite, target, `map: ${entry.glob}`) : mark(target, null, `map: ${entry.glob}`)) mapped = covered = mapEntry = true;
      }
      const fan = [];
      if (/^viewer\/test\/(helpers|fixtures)\//.test(p) || /^viewer\/(playwright\.config\.js|package(?:-lock)?\.json)$/.test(p)) fan.push('viewer-node', 'viewer-browser');
      if (p.startsWith('machine/test/')) fan.push('machine');
      if (p === 'test-support/run-dir.js') fan.push('viewer-node', 'viewer-browser', 'machine', 'test-support');
      else for (const name of ['test-support', 'sensitivity', 'codex', 'install', 'sudo-helper']) if (p.startsWith(name + '/')) fan.push(name);
      if (p === 'install.sh') fan.push('install');
      if (fan.length) { whole(fan, 'shared file'); covered = true; }
      // Rule 6: front-end files reach browser specs only through the map; unmapped ones fall back
      // even when a Node test imports them.
      const frontEnd = /^viewer\/(app\/)?pages\//.test(p) || /^viewer\/.*\.(html|css)$/.test(p) || p === 'viewer/doc.js';
      if ((!mapped || (frontEnd && !mapEntry)) && !/(^|\/)test\//.test(p) && !p.startsWith('docs/') && !p.endsWith('.md')) {
        if (p.startsWith('viewer/')) { whole(['viewer-node', 'viewer-browser'], 'viewer fallback'); covered = true; }
        else if (p.startsWith('machine/')) { whole(['machine'], 'machine fallback'); covered = true; }
      }
      if (!covered && !p.startsWith('docs/') && !p.endsWith('.md') && !['.gitignore'].includes(p)) whole(suites.map(s => s[0]), 'fallback');
    }
  }
  const result = suites.flatMap(([suite, command]) => {
    const s = state.get(suite); if (!s.whole && !s.files.size) return [];
    const selected = s.whole ? [] : [...s.files].sort();
    if (!s.whole) command = suite === 'viewer-browser' ? `npm --prefix viewer run test:browser -- ${selected.map(p => path.basename(p)).join(' ')}` : `node --test ${selected.join(' ')}`;
    return [{ suite, command, files: selected, reason: [...s.reasons].sort().join(', ') }];
  });
  if (json) console.log(JSON.stringify({ changed, suites: result }, null, 2));
  else for (const s of result) for (const command of [].concat(s.command)) console.log(command);
} catch (error) {
  console.error(`test picker: ${String(error.message).split('\n')[0]}`);
  process.exitCode = 1;
}
