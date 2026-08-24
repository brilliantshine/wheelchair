// Throwaway spike server. No auth, no tokens, no locking — localhost only.
// Serves any graph in graphs/ by name so a container node can point at a child.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIR = process.argv[2] || path.join(__dirname, 'graphs');
const ROOT = process.env.ROOT || 'records';
const PORT = Number(process.env.PORT || 7373);

const send = (res, code, type, body) =>
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }).end(body);

// A name is a bare graph name, never a path — keeps the spike from writing anywhere odd.
const resolve = (name) => {
  if (!/^[a-z0-9_-]+$/i.test(name || '')) return null;
  return path.join(DIR, name + '.json');
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/graph') {
    const file = resolve(url.searchParams.get('name') || ROOT);
    if (!file) return send(res, 400, 'text/plain', 'bad name');
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return send(res, 404, 'text/plain', 'no such graph');
      return send(res, 200, 'application/json', fs.readFileSync(file));
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => (body += c));
      return req.on('end', () => {
        try {
          const g = JSON.parse(body);
          for (const n of g.nodes) { n.x = Math.round(n.x); n.y = Math.round(n.y); }
          fs.writeFileSync(file, JSON.stringify(g, null, 2) + '\n');
          send(res, 200, 'application/json', '{"ok":true}');
        } catch (e) {
          send(res, 400, 'text/plain', String(e.message));
        }
      });
    }
  }
  if (url.pathname === '/' || url.pathname.startsWith('/index'))
    return send(res, 200, 'text/html', fs.readFileSync(path.join(__dirname, 'graph.html')));
  send(res, 404, 'text/plain', 'not found');
}).listen(PORT, '127.0.0.1', () => {
  console.log(`graphs: ${DIR}  (root: ${ROOT})`);
  console.log(`open:   http://127.0.0.1:${PORT}/`);
});
