import { numberOrNull, routesForAsset, WINDOWS } from './model.js';

export const BAR_MS = 300_000;
export const HOURS = { h1: 1, h6: 6, h24: 24 };
export const BINANCE = 'https://data-api.binance.vision/api/v3';
export const KRAKEN = 'https://api.kraken.com/0/public';
// Reviewed identities, never a symbol search. Additions follow docs/coverage-system.md.
export const EXCHANGE_MARKETS = [
  { venue: 'binance', base: 'binancecoin', baseCode: 'BNB', pair: 'BNBUSDT' },
  { venue: 'binance', base: 'ripple', baseCode: 'XRP', pair: 'XRPUSDT' },
  { venue: 'binance', base: 'dogecoin', baseCode: 'DOGE', pair: 'DOGEUSDT' },
  { venue: 'binance', base: 'zcash', baseCode: 'ZEC', pair: 'ZECUSDT' },
  { venue: 'kraken', base: 'monero', baseCode: 'XXMR', pair: 'XMRUSDT', displayPair: 'XMR/USDT' },
].map(m => ({ ...m, quote: 'tether', quoteCode: 'USDT', unit: 'USDT', id: m.venue + ':' + m.pair }));

export const venueName = venue => ({binance:'Binance',kraken:'Kraken'})[venue] ?? 'Unknown exchange';
export function eligibleMarkets(assets) {
  const ids = new Set(assets.map(a => a.id));
  return EXCHANGE_MARKETS.filter(m => ids.has(m.base) && ids.has(m.quote));
}
export function validateMarketIdentity(m, metadata) {
  if (m.venue === 'binance') return metadata?.symbol === m.pair && metadata.baseAsset === m.baseCode && metadata.quoteAsset === m.quoteCode && metadata.status === 'TRADING' && metadata.isSpotTradingAllowed === true;
  return m.venue === 'kraken' && metadata?.altname === m.pair && metadata.wsname === m.displayPair && metadata.base === m.baseCode && metadata.quote === m.quoteCode && metadata.status === 'online';
}
export const marketURL = m => m.venue === 'binance'
  ? 'https://www.binance.com/en/trade/' + encodeURIComponent(m.pair.replace(/USDT$/, '_USDT')) + '?type=spot'
  : 'https://pro.kraken.com/app/trade/' + encodeURIComponent(m.pair.replace(/USDT$/, '-USDT').toLowerCase());
export const marketSourceURL = m => m.venue === 'binance'
  ? BINANCE + '/klines?symbol=' + encodeURIComponent(m.pair) + '&interval=5m&limit=300&startTime=' + m.periodStart + '&endTime=' + (m.periodEnd - 1)
  : KRAKEN + '/Trades?pair=' + encodeURIComponent(m.pair) + '&count=1000&since=' + String(BigInt(m.periodStart) * 1_000_000n);

export function binanceBars(rows, start, end) {
  if (!Array.isArray(rows)) throw new Error('Candles missing');
  const bars = new Map();
  for (const r of rows) {
    if (!Array.isArray(r)) throw new Error('Malformed candle');
    const [at, close, total, buy, count] = [r[0], r[6], r[7], r[10], r[8]].map(numberOrNull);
    if (at === null || close === null) throw new Error('Candle time missing');
    if (at < start || at >= end) continue;
    if (!Number.isSafeInteger(at) || at % BAR_MS || close !== at + BAR_MS - 1 || close >= end ||
      total === null || buy === null || buy < 0 || total < buy || !Number.isSafeInteger(count) || count < 0 ||
      (count === 0 && total !== 0)) throw new Error('Invalid completed candle');
    const bar = { at, buy, sell: total - buy, total, count };
    if (bars.has(at)) throw new Error('Duplicate candle');
    bars.set(at, bar);
  }
  for (let at = start; at < end; at += BAR_MS) if (!bars.has(at)) throw new Error('Incomplete candle window');
  return [...bars.values()].sort((a,b) => a.at-b.at);
}

export function parseKrakenTrade(row) {
  if (!Array.isArray(row)) throw new Error('Malformed trade');
  const price = numberOrNull(row[0]), quantity = numberOrNull(row[1]), seconds = numberOrNull(row[2]), id = row[6];
  if (!(price > 0) || !(quantity > 0) || !(seconds > 0) || !Number.isFinite(price * quantity) ||
      !['b','s'].includes(row[3]) || !Number.isSafeInteger(id) || id < 0) throw new Error('Invalid trade fields');
  return { id, at: seconds * 1000, side: row[3], value: price * quantity, fingerprint: JSON.stringify(row.slice(0,7)) };
}

// Page from an explicit start, keeping the nanosecond cursor as a string. A last-1000
// response alone is never a 24h window. Exhaustion or crossing end closes the window.
export async function krakenBars(m, start, end, request, { maxPages = 40 } = {}) {
  let since = String(BigInt(start) * 1_000_000n), pages = 0, complete = false;
  const trades = new Map();
  while (pages++ < maxPages) {
    const body = await request(KRAKEN + '/Trades?pair=' + encodeURIComponent(m.pair) + '&count=1000&since=' + since);
    if (!Array.isArray(body?.error) || body.error.length || !Array.isArray(body.result?.[m.pair])) throw new Error('Trade page unavailable');
    const rows = body.result[m.pair], cursor = body.result.last;
    if (rows.length > 1000 || typeof cursor !== 'string' || !/^\d+$/.test(cursor) || BigInt(cursor) < BigInt(since)) throw new Error('Invalid trade cursor');
    let lastTime = -Infinity, crossed = false;
    for (const row of rows) {
      const t = parseKrakenTrade(row);
      if (t.at < lastTime) throw new Error('Trade page is not chronological');
      lastTime = t.at;
      const previous = trades.get(t.id);
      if (previous && previous.fingerprint !== t.fingerprint) throw new Error('Conflicting duplicate trade');
      if (t.at >= start && t.at < end) trades.set(t.id, t);
      if (t.at >= end) crossed = true;
    }
    if (crossed || rows.length < 1000) { complete = true; break; }
    if (cursor === since) throw new Error('Trade cursor stalled before window completed');
    since = cursor;
  }
  if (!complete) throw new Error('Trade window exceeds page budget; excluded rather than truncated');
  const bars = new Map();
  for (let at = start; at < end; at += BAR_MS) bars.set(at, {at,buy:0,sell:0,total:0,count:0});
  for (const t of trades.values()) {
    const b = bars.get(Math.floor(t.at / BAR_MS) * BAR_MS);
    b[t.side === 'b' ? 'buy' : 'sell'] += t.value; b.count++;
  }
  for (const b of bars.values()) b.total = b.buy + b.sell;
  return { bars: [...bars.values()], pages, cursor: since };
}

export function windowsFromBars(bars, end) {
  const windows = {};
  for (const [w,hours] of Object.entries(HOURS)) {
    const rows = bars.filter(b => b.at >= end-hours*3_600_000 && b.at < end).sort((a,b)=>a.at-b.at);
    if (rows.length !== hours*12 || rows.some((b,i)=>b.at !== end-hours*3_600_000+i*BAR_MS)) continue;
    const buy = rows.reduce((s,b)=>s+b.buy,0), sell = rows.reduce((s,b)=>s+b.sell,0);
    windows[w] = {buy,sell,total:buy+sell,count:rows.reduce((s,b)=>s+b.count,0),start:end-hours*3_600_000,end};
  }
  return windows;
}

export function exchangeRecord(m, bars, end, checkedAt, pages = 1) {
  return { ...m, kind:'exchange', name: m.pair.replace(/USDT$/, ' / USDT'), checkedAt,
    periodStart: end-86_400_000, periodEnd:end, intervalMs:BAR_MS, pages,
    sideBasis:m.venue==='binance'?'taker':'provider-reported',
    bars, windows:windowsFromBars(bars,end) };
}

export function validExchangeMarket(m, ids) {
  const identity = EXCHANGE_MARKETS.find(x=>x.id===m?.id);
  if (!identity || !['venue','base','quote','pair','unit','baseCode','quoteCode'].every(k=>m[k]===identity[k]) ||
      !ids.has(m.base) || !ids.has(m.quote) || m.kind!=='exchange' || typeof m.name!=='string' || m.name.length>100 || typeof m.checkedAt!=='string' || !Number.isFinite(Date.parse(m.checkedAt)) ||
      !Number.isSafeInteger(m.periodEnd) || m.periodEnd%BAR_MS || m.periodStart!==m.periodEnd-86_400_000 ||
      m.periodEnd>Date.parse(m.checkedAt) || m.intervalMs!==BAR_MS ||
      m.sideBasis!==(m.venue==='binance'?'taker':'provider-reported') ||
      !Number.isInteger(m.pages) || m.pages<1 || m.pages>40 || !Array.isArray(m.bars) || m.bars.length!==288) return false;
  if (!m.bars.every((b,i)=>b.at===m.periodStart+i*BAR_MS && ['buy','sell','total'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k])&&b[k]>=0) &&
      Math.abs(b.buy+b.sell-b.total)<=Math.max(1e-8,b.total*1e-10) && Number.isSafeInteger(b.count) && b.count>=0 && (b.count!==0 || b.total===0))) return false;
  const rebuilt=windowsFromBars(m.bars,m.periodEnd);
  return m.windows && Object.keys(m.windows).length===3 && WINDOWS.every(w=>m.windows[w]&&['buy','sell','total','count','start','end'].every(k=>m.windows[w][k]===rebuilt[w][k]));
}

export function activitySource(snapshot, asset, window, preference = 'auto', network = 'all') {
  if (preference !== 'auto') return preference;
  if (snapshot.pools.some(p=>(network==='all'||p.network===network)&&(p.base===asset||p.quote===asset)&&p.windows[window])) return 'dex';
  if ((snapshot.exchangeMarkets??[]).some(p=>(p.base===asset||p.quote===asset)&&p.windows[window])) return 'exchange';
  return 'dex';
}
export function exchangeRoutes(markets, asset, window) {
  // Same base/quote inversion as pools; pool liquidity is not available or displayed.
  return routesForAsset({pools:markets},asset,window);
}
