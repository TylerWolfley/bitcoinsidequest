import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from './scripts/collect.mjs';
import { refreshTemperature } from './scripts/collect-temperature.mjs';
import { refreshRiskTemperature } from './scripts/collect-risk-temperature.mjs';
import { buildPriceCharts } from './scripts/build-price-charts.mjs';
const ROOT = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.PORT || 4173);
let refreshing = null, lastAttempt = 0;
const refresh = () => {
  if (refreshing || Date.now() - lastAttempt < 5 * 60_000) return refreshing;
  lastAttempt = Date.now();
  refreshing = collect().then(()=>refreshRiskTemperature()).then(()=>buildPriceCharts()).catch(error => console.error('Refresh delayed: ' + error.message)).finally(() => { refreshing = null; });
  return refreshing;
};
let moodRefreshing=null,lastMoodAttempt=0;
const refreshMood=()=>{
  if(moodRefreshing||Date.now()-lastMoodAttempt<5*60_000)return moodRefreshing;
  lastMoodAttempt=Date.now();
  moodRefreshing=refreshTemperature().catch(e=>console.error('Sentiment refresh delayed: '+e.message)).finally(()=>{moodRefreshing=null;});
  return moodRefreshing;
};
const allowed = new Set(['/index.html', '/activity.css', '/activity-view.js', '/lib/activity.js', '/styles.css', '/app.js', '/research-panel.js', '/exchange-panel.js', '/favicon.svg', '/lib/model.js', '/lib/research.js', '/lib/quality.js', '/lib/exchanges.js', '/data/snapshot.json']);
['/temperature.css','/temperature-view.js','/lib/temperature.js','/lib/risk-temperature.js','/lib/market-context.js','/data/temperature.json','/data/market-temperature.json'].forEach(p=>allowed.add(p));
['temperature.html','journal.html','insights.css','site-shell.js','insight-page.js','temperature-detail.js','journal-view.js','lib/temperature-policy.js','lib/scenarios.js','lib/journal.js','data/journal.json','data/price-statistics.json','data/archive-status.json'].forEach(p=>allowed.add('/'+p));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
['market-map.html','token.html','market.css','market-map.js','token.js','market-ui.js','live-data.js','activity-detail.js','lib/market-map.js','lib/price-charts.js','data/price-charts.json'].forEach(p=>allowed.add('/'+p));
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + port), pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!allowed.has(pathname) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
    if (pathname === '/data/snapshot.json' || pathname === '/data/temperature.json') {
      const info = await stat(path.join(ROOT, pathname)).catch(() => null);
      if (!info || Date.now() - info.mtimeMs > 5 * 60_000) {
        const task = pathname === '/data/temperature.json' ? refreshMood() : refresh();
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
const timer = setInterval(()=>{refresh();refreshMood();}, 5 * 60_000);
timer.unref();
process.on('SIGINT', () => { clearInterval(timer); server.close(); });
