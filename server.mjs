import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './scripts/collect.mjs';
const ROOT = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.PORT || 4173);
let refreshing = null, lastAttempt = 0;
const refresh = () => {
  if (refreshing || Date.now() - lastAttempt < 5 * 60_000) return refreshing;
  lastAttempt = Date.now();
  refreshing = collect().catch(error => console.error('Refresh delayed: ' + error.message)).finally(() => { refreshing = null; });
  return refreshing;
};
const allowed = new Set(['/index.html', '/styles.css', '/app.js', '/research-panel.js', '/exchange-panel.js', '/favicon.svg', '/lib/model.js', '/lib/research.js', '/lib/quality.js', '/lib/exchanges.js', '/data/snapshot.json']);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + port), pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!allowed.has(pathname) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
    if (pathname === '/data/snapshot.json') {
      const info = await stat(path.join(ROOT, pathname)).catch(() => null);
      if (!info || Date.now() - info.mtimeMs > 5 * 60_000) {
        const task = refresh();
        if (!info) await task;
      }
    }
    const data = await readFile(path.join(ROOT, pathname));
    res.writeHead(200, { 'Content-Type': (mime[path.extname(pathname)] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(503); res.end('Data is not ready. Please try again shortly.'); }
});
server.listen(port, '127.0.0.1', () => console.log('Bitcoin Side Quest: http://localhost:' + port));
const timer = setInterval(refresh, 5 * 60_000);
timer.unref();
process.on('SIGINT', () => { clearInterval(timer); server.close(); });
