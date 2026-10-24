import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { dailyPrices, validPriceHistory, priceStatistics } from '../lib/scenarios.js';
const root = new URL('../data/', import.meta.url);
export async function refreshPrices({ log = console.log } = {}) {
  const file = new URL('price-history.json', root), snapshot = JSON.parse(await readFile(new URL('snapshot.json', root), 'utf8'));
  let old; try { old = JSON.parse(await readFile(file, 'utf8')); } catch {}
  const result = validPriceHistory(old) ? old : { version: 1, coins: {} };
  const today = new Date().toISOString().slice(0,10);
  for (const asset of snapshot.assets.filter(a => a.kind === 'alt')) {
    const prior = result.coins[asset.id];
    if (prior?.checkedAt?.slice(0,10) === today && prior.prices.length) continue;
    const source = 'https://api.coingecko.com/api/v3/coins/' + encodeURIComponent(asset.id) + '/market_chart?vs_currency=usd&days=365';
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(25_000), headers: { accept: 'application/json' } });
      if (!response.ok) { const error=new Error('HTTP '+response.status);error.status=response.status;throw error; }
      const data = await response.json(), prices = dailyPrices(data.prices);
      if (!prices.length) throw new Error('No completed daily prices');
      result.coins[asset.id] = { checkedAt: new Date().toISOString(), source, prices };
      log('Daily price history: ' + asset.symbol + ' · ' + prices.length + ' observations');
    } catch (e) { log('Price history delayed for ' + asset.symbol + ': ' + e.message); if(e.status===429)break; }
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
  if (!validPriceHistory(result)) throw new Error('Invalid price history');
  await writeFile(fileURLToPath(file) + '.tmp', JSON.stringify(result) + '\n');
  await rename(fileURLToPath(file) + '.tmp', file);
  await writeFile(new URL('price-statistics.json',root),JSON.stringify({version:1,coins:Object.fromEntries(Object.entries(result.coins).map(([id,series])=>[id,priceStatistics(series)]))})+'\n');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) refreshPrices().catch(e => { console.error(e.message); process.exitCode=1; });
