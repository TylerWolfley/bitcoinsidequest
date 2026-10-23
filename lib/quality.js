import { addressKey, WINDOWS } from './model.js';
import { validExchangeMarket } from './exchanges.js';

const finite = n => typeof n === 'number' && Number.isFinite(n);
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = value => typeof value === 'string' && value.length > 0 && value.length < 500;
const optionalNumber = n => n === null || finite(n);

// Treat downloaded and locally cached snapshots as untrusted input.
export function validSnapshot(s) {
  try {
    if (s?.schemaVersion !== 1 || !time(s.checkedAt) || !time(s.rankingCheckedAt) ||
      !Array.isArray(s.assets) || s.assets.length !== 15 || !Array.isArray(s.pools) || s.pools.length > 500 ||
      !Array.isArray(s.diagnostics) || !Array.isArray(s.poolErrors) || !s.policy || typeof s.policy.poolSample !== 'string') return false;
    const ids = new Set(s.assets.map(a => a.id));
    if (ids.size !== 15 || s.assets.filter(a => a.kind === 'alt').length !== 10 || s.assets.filter(a => a.kind === 'stable').length !== 5) return false;
    if (!s.assets.every(a => text(a.id) && text(a.name) && text(a.symbol) && finite(a.rank) && a.rank > 0 &&
      optionalNumber(a.price) && (a.price === null || a.price >= 0) && optionalNumber(a.priceChange24h) && optionalNumber(a.supplyChange24h) && time(a.priceUpdatedAt) &&
      a.coverage && text(a.coverage.reason) && Number.isInteger(a.coverage.pools) && Array.isArray(a.coverage.networks))) return false;
    if (s.bitcoin && (!optionalNumber(s.bitcoin.price) || !optionalNumber(s.bitcoin.priceChange24h))) return false;
    if (new Set(s.pools.map(p => p.id)).size !== s.pools.length) return false;
    if (s.exchangeMarkets !== undefined && (!Array.isArray(s.exchangeMarkets) || s.exchangeMarkets.length > 30 ||
      new Set(s.exchangeMarkets.map(m=>m.id)).size!==s.exchangeMarkets.length || !s.exchangeMarkets.every(m=>validExchangeMarket(m,ids)) ||
      !Array.isArray(s.exchangeDiagnostics))) return false;
    return s.pools.every(p => text(p.network) && /^[a-z0-9-]+$/.test(p.network) && text(p.address) &&
      p.id === addressKey(p.network,p.address) && text(p.name) && text(p.dex) && ids.has(p.base) && ids.has(p.quote) && p.base !== p.quote &&
      finite(p.liquidity) && p.liquidity >= 50000 && time(p.checkedAt) && p.windows && Object.keys(p.windows).length > 0 &&
      Object.entries(p.windows).every(([w,v]) => WINDOWS.includes(w) && v && finite(v.buy) && finite(v.sell) && finite(v.total) &&
        v.buy >= 0 && v.sell >= 0 && v.total === v.buy + v.sell));
  } catch { return false; }
}

export const poolURL = p => 'https://www.geckoterminal.com/' + encodeURIComponent(p.network) + '/pools/' + encodeURIComponent(p.address);
export const SOURCES = [
  {name:'CoinGecko',url:'https://www.coingecko.com/en/api',use:'Rankings, prices, contract identities'},
  {name:'GeckoTerminal',url:'https://www.geckoterminal.com/',use:'Sampled pool buy/sell dollars and liquidity'},
  {name:'DefiLlama',url:'https://defillama.com/stablecoins',use:'Stablecoin classification and circulating value'},
  {name:'Binance',url:'https://developers.binance.com/en/docs/products/spot/faqs/market_data_only',use:'Selected spot-market trades, measured in USDT'},
  {name:'Kraken',url:'https://docs.kraken.com/api-reference/market-data/get-recent-trades',use:'Selected spot-market trades, measured in USDT'},
];

export function viewHealth(snapshot, pools, now = Date.now()) {
  const timestamps = pools.map(p => Date.parse(p.checkedAt)).filter(Number.isFinite);
  const oldest = timestamps.length ? Math.min(...timestamps) : null;
  const newest = timestamps.length ? Math.max(...timestamps) : null;
  const partial = snapshot.poolErrors.length > 0 || snapshot.diagnostics.some(d => d.status !== 'ok');
  const age = oldest === null ? null : Math.max(0,(now-oldest)/60000);
  return { oldest, newest, age, spreadMinutes: oldest===null?null:(newest-oldest)/60000,
    status: !pools.length?'no-data':age>30?'old':partial?'partial':'checked', partial };
}
