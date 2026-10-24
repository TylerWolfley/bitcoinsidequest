import { activityRecords, compareActivity } from './activity.js';
import { fresh } from './risk-temperature.js';

export const MAP_VERSION = 1;
export const allTokens = snapshot => [...(snapshot?.assets ?? []), ...(snapshot?.bitcoin ? [snapshot.bitcoin] : [])];
export const tokenById = (snapshot, id) => allTokens(snapshot).find(a => a.id === id) ?? null;
export const shortSymbol = asset => asset.symbol === 'FIGR_HELOC' ? 'FIGR' : asset.symbol;

// Only local, known pages can be a return destination. Never trust a URL from a query.
export function returnPath(value) {
  if (typeof value !== 'string' || value.length > 1500) return './market-map.html';
  try {
    const url = new URL(value, 'https://sidequest.invalid/');
    if (url.origin !== 'https://sidequest.invalid' || !['/', '/index.html', '/market-map.html', '/temperature.html', '/journal.html', '/token.html'].includes(url.pathname)) return './market-map.html';
    return '.' + url.pathname + url.search + url.hash;
  } catch { return './market-map.html'; }
}
export function profileURL(id, { from = './market-map.html', window = 'h24', source = 'auto', network = 'all' } = {}) {
  const q = new URLSearchParams({ coin: id, from: returnPath(from) });
  if (['h1','h6'].includes(window)) q.set('window',window);
  if (['dex','exchange'].includes(source)) q.set('source',source);
  if (/^[a-z0-9-]{1,50}$/.test(network) && network !== 'all') q.set('network',network);
  return './token.html?' + q;
}

export function marketReading(snapshot, asset, { now = Date.now(), offline = false, source = 'auto', network = 'all' } = {}) {
  const live = !offline && fresh(snapshot?.checkedAt, now);
  const priceReady = live && fresh(asset?.priceUpdatedAt, now) && Number.isFinite(asset?.price) && asset.price > 0 && Number.isFinite(asset.priceChange24h) && asset.priceChange24h >= -100;
  const btc = snapshot?.bitcoin;
  const btcReady = priceReady && fresh(btc?.priceUpdatedAt, now) && Number.isFinite(btc?.priceChange24h) && btc.priceChange24h > -100 && Math.abs(Date.parse(asset.priceUpdatedAt) - Date.parse(btc.priceUpdatedAt)) <= 5 * 60_000;
  const relative = btcReady ? ((1 + asset.priceChange24h / 100) / (1 + btc.priceChange24h / 100) - 1) * 100 : null;
  const scope = activityRecords(snapshot, asset.id, source, network);
  const comparison = compareActivity(scope.records, asset.id, { now });
  let reason = null;
  if (!live) reason = offline ? 'Refresh unavailable' : 'Snapshot needs refreshing';
  else if (!scope.records.length) reason = 'No mapped activity';
  else if (!comparison.fresh) reason = 'Activity needs refreshing';
  else if (!comparison.complete || !comparison.synchronized) reason = 'Incomplete comparison';
  else if (comparison.ratio === null) reason = 'No nonzero baseline';
  else if (comparison.baseline < 10_000) reason = 'Sample too small to compare';
  const activityReady = !reason;
  return { asset, priceReady, return24h: priceReady ? asset.priceChange24h : null, relative, activityReady, reason,
    pace: activityReady ? comparison.ratio : null, buyShare: activityReady ? comparison.share : null, source: scope.source, comparison };
}

export function tokenVibe(reading) {
  const {asset,priceReady,return24h,pace,activityReady,reason} = reading;
  if (!priceReady) return { label:'Waiting for fresh prices', detail:'The last available quote stays visible. Conditions are paused until it refreshes.', tone:'unknown' };
  if (asset.kind === 'stable') return { label:'Dollar target · ' + ((asset.price - 1) * 100 >= 0 ? '+' : '') + ((asset.price - 1) * 100).toFixed(3) + '% from $1', detail:'Peg distance describes this quote. It does not measure backing quality or redemption safety.', tone:'neutral' };
  const price = return24h > 0 ? 'Price rising' : return24h < 0 ? 'Price falling' : 'Price unchanged';
  if (!activityReady) return { label:price + ' · activity out of view', detail:reason + '. No trading conditions are inferred from missing coverage.', tone:'unknown' };
  const paceWord = pace >= 1.5 ? 'trading picked up' : pace <= 2/3 ? 'trading slowed' : 'trading near its recent pace';
  return { label:price + ' · ' + paceWord, detail:'Price: 24h. Activity: last hour versus the preceding five-hour average in the same selected markets.', tone:return24h >= 0 ? 'up' : 'down' };
}

// Labels may move to avoid overlap; a leader always anchors them to the true value.
export function placeLabels(points, width, height, labelWidth = 66, labelHeight = 40) {
  const placed = [];
  for (const p of [...points].sort((a,b)=>a.y-b.y || a.id.localeCompare(b.id))) {
    let best = null;
    for (let row = -8; row <= 8; row++) for (let column = -8; column <= 8; column++) {
      const y = Math.max(labelHeight/2,Math.min(height-labelHeight/2,p.y+row*(labelHeight+6)));
      const x = Math.max(labelWidth/2,Math.min(width-labelWidth/2,p.x+column*(labelWidth+8)));
      const collisions = placed.filter(q=>Math.abs(q.x-x)<labelWidth+6 && Math.abs(q.y-y)<labelHeight+4).length;
      const cost = collisions*10000 + Math.hypot(y-p.y,x-p.x);
      if (!best || cost<best.cost) best={...p,x,y,anchorX:p.x,anchorY:p.y,cost};
    }
    placed.push(best);
  }
  return placed;
}

// Keep displaced labels in the same price/activity quadrant as their true point.
export function placeMarketLabels(points,width,height,xZero,yOne,labelWidth=70,labelHeight=54){
  const result=[];
  for(const right of [false,true])for(const lower of [false,true]){
    const left=right?xZero:0,top=lower?yOne:0,w=right?width-xZero:xZero,h=lower?height-yOne:yOne;
    const group=points.filter(p=>(p.x>=xZero)===right&&(p.y>=yOne)===lower).map(p=>({...p,x:p.x-left,y:p.y-top}));
    result.push(...placeLabels(group,w,h,labelWidth,labelHeight).map(p=>({...p,x:p.x+left,y:p.y+top,anchorX:p.anchorX+left,anchorY:p.anchorY+top})));
  }
  return result;
}
