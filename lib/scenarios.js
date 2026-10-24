export const SCENARIO_VERSION = 1;
export const DAY = 86_400_000;
// Preserve only actual completed UTC daily observations. No invented daily fills.
export function dailyPrices(rows, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Daily prices missing');
  const today = Math.floor(now / DAY) * DAY, byDay = new Map();
  for (const row of rows) {
    if (!Array.isArray(row) || !Number.isSafeInteger(row[0]) || !(row[1] > 0) || !Number.isFinite(row[1])) throw new Error('Invalid price observation');
    if (row[0] % DAY !== 0 || row[0] >= today) continue;
    if (byDay.has(row[0])) throw new Error('Duplicate daily price');
    byDay.set(row[0], row[1]);
  }
  return [...byDay].sort((a,b) => a[0] - b[0]).slice(-366);
}
export function scenarioRange(asset, series, horizon, { now = Date.now() } = {}) {
  if (![30,365].includes(horizon)) throw new Error('Unsupported horizon');
  const missing = reason => ({ version: SCENARIO_VERSION, horizon, available: false, reason });
  if (!(asset?.price > 0) || !Number.isFinite(asset.price) || !Number.isFinite(Date.parse(asset.priceUpdatedAt)) || now - Date.parse(asset.priceUpdatedAt) > 30 * 60_000 || Date.parse(asset.priceUpdatedAt) > now + 60_000) return missing('Waiting for a fresh anchor price.');
  let prices; try { prices = dailyPrices(series?.prices, now); } catch { return missing('Historical prices are unavailable.'); }
  if (!prices.length || now - prices.at(-1)[0] > 3 * DAY) return missing('Historical prices need refreshing.');
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i][0] - prices[i-1][0] !== DAY) return missing('Daily history has a gap. No range is estimated.');
    returns.push(Math.log(prices[i][1] / prices[i-1][1]));
  }
  const needed = horizon === 365 ? 300 : 60;
  if (returns.length < needed) return missing('Needs ' + needed + ' complete daily returns; ' + returns.length + ' available.');
  const mean = returns.reduce((a,b) => a+b,0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((s,r) => s + (r-mean)**2,0) / (returns.length-1));
  const width = sigma * Math.sqrt(horizon), low = asset.price * Math.exp(-width), high = asset.price * Math.exp(width);
  if (![sigma,low,high].every(Number.isFinite) || low <= 0) return missing('Historical variation is too extreme for this model.');
  return { version: SCENARIO_VERSION, available: true, horizon, anchor: asset.price, anchorAt: asset.priceUpdatedAt, low, high, sigma, count: returns.length, start: prices[0][0], end: prices.at(-1)[0], source: series.source, drift: 0, scale: 1 };
}
export function validPriceHistory(data) {
  try { return data?.version === 1 && data.coins && Object.entries(data.coins).length <= 300 && Object.entries(data.coins).every(([id,s]) => /^[a-z0-9-]{1,150}$/.test(id) && Number.isFinite(Date.parse(s.checkedAt)) && typeof s.source === 'string' && s.source.startsWith('https://api.coingecko.com/api/v3/coins/') && Array.isArray(s.prices) && s.prices.length <= 366 && s.prices.every((r,i) => Array.isArray(r) && r.length === 2 && Number.isSafeInteger(r[0]) && r[0] % DAY === 0 && Number.isFinite(r[1]) && r[1] > 0 && (!i || r[0] > s.prices[i-1][0]))); } catch { return false; }
}

export function priceStatistics(series, { now = Date.now() } = {}) {
  const r = scenarioRange({price:1,priceUpdatedAt:new Date(now).toISOString()},series,30,{now});
  return r.available ? {version:1,available:true,sigma:r.sigma,count:r.count,start:r.start,end:r.end,source:r.source} : {version:1,available:false,reason:r.reason};
}
export function scenarioFromStatistics(asset, stats, horizon, { now = Date.now() } = {}) {
  if (![30,365].includes(horizon)) throw new Error('Unsupported horizon');
  const missing = reason => ({version:SCENARIO_VERSION,horizon,available:false,reason});
  if (!(asset?.price>0) || !Number.isFinite(asset.price) || !Number.isFinite(Date.parse(asset.priceUpdatedAt)) || now-Date.parse(asset.priceUpdatedAt)>30*60000 || Date.parse(asset.priceUpdatedAt)>now+60000) return missing('Waiting for a fresh anchor price.');
  if (!stats?.available) return missing(stats?.reason??'Historical prices are unavailable.');
  if (stats.end>now || now-stats.end>3*DAY) return missing('Historical prices need refreshing.');
  if (stats.count < (horizon===365?300:60)) return missing('Needs '+(horizon===365?300:60)+' complete daily returns; '+stats.count+' available.');
  const width=stats.sigma*Math.sqrt(horizon),low=asset.price*Math.exp(-width),high=asset.price*Math.exp(width);
  if (![low,high].every(Number.isFinite) || low<=0) return missing('Historical variation is too extreme for this model.');
  return {version:SCENARIO_VERSION,available:true,horizon,anchor:asset.price,anchorAt:asset.priceUpdatedAt,low,high,sigma:stats.sigma,count:stats.count,start:stats.start,end:stats.end,source:stats.source,drift:0,scale:1};
}
export function validPriceStatistics(data) {
  try{return data?.version===1 && data.coins && Object.entries(data.coins).length<=300 && Object.entries(data.coins).every(([id,s])=>/^[a-z0-9-]{1,150}$/.test(id) && s.version===1 && (s.available===false?typeof s.reason==='string'&&s.reason.length<300:s.available===true&&Number.isFinite(s.sigma)&&s.sigma>=0&&Number.isSafeInteger(s.count)&&s.count>=60&&s.count<=365&&Number.isSafeInteger(s.start)&&Number.isSafeInteger(s.end)&&s.end>s.start&&typeof s.source==='string'&&s.source.startsWith('https://api.coingecko.com/api/v3/coins/')));}catch{return false;}
}
