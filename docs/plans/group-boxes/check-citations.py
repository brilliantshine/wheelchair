import re, sys
# Resolves every file:line citation in COMPLETION.md and reports any that is unresolvable, out
# of range, or blank. Run from the repo root. Written because the citations in that document went
# stale twice under remediation, each time because new tests shifted the lines beneath them, and a
# reviewer cannot check a claim whose evidence points at the wrong place.
#
#   python3 docs/plans/group-boxes/check-citations.py          # report bad ones
#   python3 docs/plans/group-boxes/check-citations.py --all    # dump every citation with its line
DOC = 'docs/plans/group-boxes/COMPLETION.md'
KNOWN = {
 'server.js': 'viewer/server.js', 'index.html': 'viewer/index.html',
 'server.test.js': 'viewer/test/server.test.js', 'browser.spec.js': 'viewer/test/browser.spec.js',
 'graphs.md': 'protocol/graphs.md', 'diagrams.md': 'protocol/diagrams.md',
 'IDEA.md': 'docs/plans/group-boxes/IDEA.md', 'AGENTS.md': 'AGENTS.md', 'PLAN.md': 'docs/plans/group-boxes/PLAN.md',
}
cache = {}
def lines(p):
    if p not in cache: cache[p] = open(p).read().split('\n')
    return cache[p]

# qualified path, bare filename, or bare `:N` inheriting the last path on that line
CITE = re.compile(r'`((?:[A-Za-z0-9_./-]*/)?[A-Za-z0-9_.-]+\.[A-Za-z0-9]+)?:(\d+)(?:-(\d+))?`')
out, bad = [], 0
for ln, line in enumerate(open(DOC).read().split('\n'), 1):
    last = None
    for m in CITE.finditer(line):
        raw, a, b = m.group(1), int(m.group(2)), m.group(3)
        if raw:
            path = raw if '/' in raw else KNOWN.get(raw)
            last = path
        else:
            path = last
        if not path:
            out.append(f'!! doc:{ln}  UNRESOLVABLE  {m.group(0)}'); bad += 1; continue
        src = lines(path)
        hi = int(b) if b else a
        if a < 1 or hi > len(src):
            out.append(f'!! doc:{ln}  OUT OF RANGE  {path}:{a}-{hi}'); bad += 1; continue
        body = ' / '.join(x.strip() for x in src[a-1:hi] if x.strip())
        if not body:
            out.append(f'!! doc:{ln}  BLANK  {path}:{a}'); bad += 1; continue
        out.append(f'   doc:{ln}  {path}:{a}' + (f'-{b}' if b else '') + f'\n        {body[:190]}')
import sys as _s
show_all = '--all' in _s.argv
print('\n'.join(o for o in out if show_all or o.startswith('!!')))
print(f'{len(out)} citations, {bad} unresolvable/blank')
_s.exit(1 if bad else 0)
