const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const host = '127.0.0.1';
const port = 4173;
const root = __dirname;
const staticFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'application/javascript; charset=utf-8'] };

function data() {
  const result = spawnSync('python', [path.join(root, 'hermes_reader.py')], { encoding: 'utf8', timeout: 10000 });
  if (result.status !== 0) return { error: 'Hermes data reader unavailable' };
  try { return JSON.parse(result.stdout); } catch { return { error: 'Hermes data reader returned invalid JSON' }; }
}

function reply(res, status, type, body) { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); }
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${host}`);
  if (staticFiles[url.pathname]) {
    const [file, type] = staticFiles[url.pathname];
    return fs.readFile(path.join(root, file), (err, body) => reply(res, err ? 404 : 200, type, err ? 'Not Found' : body));
  }
  if (url.pathname.startsWith('/api/')) {
    const all = data();
    const key = url.pathname.slice(5);
    if (key === 'data') return reply(res, 200, 'application/json; charset=utf-8', JSON.stringify(all));
    if (!(key in all)) return reply(res, 404, 'application/json; charset=utf-8', JSON.stringify({ error: 'Not Found' }));
    return reply(res, 200, 'application/json; charset=utf-8', JSON.stringify(all[key]));
  }
  reply(res, 404, 'text/plain; charset=utf-8', 'Not Found');
});

if (require.main === module) server.listen(port, host, () => console.log(`Mission Control: http://${host}:${port}`));
module.exports = { data, server };
