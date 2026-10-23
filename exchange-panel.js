import { venueName, marketURL, marketSourceURL, windowsFromBars } from './lib/exchanges.js';
import { summarizeRoutes } from './lib/model.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export const quoteAmount = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n)+' USDT' : '—';
const time = n => new Date(n).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
const percent = n => n===null ? '—' : (n*100).toFixed(1)+'%';
const counted = (n,word) => n+' '+word+(n===1?'':'s');
const license = '<p class="scope-note">Binance-derived figures: <a href="https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md" target="_blank" rel="noopener noreferrer">Binance Vision · CC BY-NC-SA 4.0</a>. Calculated window totals. Kraken figures are separately attributed.</p>';

export function exchangeDetails({snapshot,asset,windowKey,selectedRoute,currentRoutes,icon}) {
  const routes=selectedRoute?currentRoutes.filter(r=>r.otherId===selectedRoute):currentRoutes;
  const summary=summarizeRoutes(routes), markets=routes.flatMap(r=>r.pools);
  if(!summary)return '<div class="empty-coverage"><div class="empty-icon" aria-hidden="true">◌</div><h3>No exchange sample<br>for this view.</h3><p>No complete, validated spot-trading window is available. Use Automatic to see any covered on-chain activity.</p><p>Missing data does not mean no trading.</p></div>';
  const symbol=esc(asset.symbol), share=summary.buyShare;
  let html='<div class="detail-trading"><div class="sample-heading"><strong>EXCHANGE TRADES</strong><span>'+windowKey.slice(1)+'h · USDT</span></div>'+
    '<div class="balance-value '+(summary.net>=0?'up':'down')+'">'+(share===null?'No trades':percent(share)+' <small>buys</small>')+'</div><p class="balance-caption">Reported buying share · '+esc([...new Set(markets.map(m=>venueName(m.venue)))].join(' + '))+'</p>'+
    '<div class="balance-bar" aria-label="'+percent(share)+' of reported trade value bought '+symbol+'"><div style="width:'+(share===null?50:share*100)+'%"></div></div>'+
    '<div class="balance-values"><div><span>Into '+symbol+'</span><strong class="up">'+quoteAmount(summary.incoming)+'</strong></div><div><span>Out of '+symbol+'</span><strong class="down">'+quoteAmount(summary.outgoing)+'</strong></div></div>'+
    '<div class="explanation"><div class="eyebrow">WHAT HAPPENED</div><p>'+ (summary.total===0?'No trades were reported in the complete sampled window.':'<strong>'+quoteAmount(summary.total)+'</strong> traded across '+markets.length+' spot market'+(markets.length===1?'':'s')+'. '+percent(share)+' of reported trade value bought '+symbol+'.')+'</p><p class="context-note">Orders matched on an exchange. These lines are trades, not transfers between wallets.</p></div>'+
    '<p class="window-note">'+counted(Number(windowKey.slice(1)),'hour')+' ending <strong>'+esc(time(Math.min(...markets.map(m=>m.periodEnd))))+'</strong></p></div>';
  html+='<div class="detail-routes"><div class="routes-title"><span>EXPLORE THE ROUTES</span>'+(selectedRoute?'<button id="all-routes" class="text-button">Show all</button>':'<span>Total traded</span>')+'</div>';
  html+=currentRoutes.map(r=>{const other=snapshot.assets.find(a=>a.id===r.otherId);return '<button class="route-row" data-detail-route="'+esc(r.otherId)+'" aria-pressed="'+(selectedRoute===r.otherId)+'"><span class="route-coin">'+icon(other)+'<span>'+esc(other.symbol)+' <small>'+r.pools.length+' market'+(r.pools.length===1?'':'s')+'</small></span></span><strong>'+quoteAmount(r.total)+'</strong><span class="chevron" aria-hidden="true">↗</span></button>';}).join('');
  html+='<details class="pool-sources"'+(selectedRoute?' open':'')+'><summary>Evidence · '+counted(markets.length,'market')+' checked</summary>'+markets.map(m=>'<a href="'+marketURL(m)+'" target="_blank" rel="noopener noreferrer">'+esc(venueName(m.venue)+' · '+m.name)+' ↗<small>'+m.windows[windowKey].count.toLocaleString()+' trades · checked '+esc(time(m.checkedAt))+'</small></a>').join('')+'</details><p class="scope-note">USDT is the traded quote token; it is not converted to USD. Selected spot markets only. Each trade has a buyer and seller; direction follows the reported trade side. No claim of new capital or market-wide demand.</p>';
  if(markets.some(m=>m.venue==='binance'))html+=license;
  return html+'</div>';
}

export function renderExchangeResearch({snapshot,selected,windowKey,selectedRoute}) {
  const asset=snapshot.assets.find(a=>a.id===selected);
  const markets=(snapshot.exchangeMarkets??[]).filter(m=>(m.base===selected||m.quote===selected)&&(!selectedRoute||m.base===selectedRoute||m.quote===selectedRoute));
  const host=document.querySelector('#research');
  let html='<div class="research-header"><div><div class="eyebrow">GO ONE LAYER DEEPER</div><h2>'+esc(asset.symbol)+' <span>exchange evidence</span></h2></div></div>';
  html+='<p class="research-intro">Completed '+windowKey.slice(1)+'h windows. Binance reports taker-buy quote volume; Kraken reports a buy/sell side for each trade. Selecting USDT reverses those directions. On-chain pool totals are kept separate.</p>';
  if(!markets.length)html+='<p>No eligible exchange market in this selection. No trading activity has been inferred from price.</p>';
  html+='<div class="pool-cards">'+markets.map(m=>{
    const w=m.windows[windowKey], base=m.base===selected, buy=base?w.buy:w.sell, sell=base?w.sell:w.buy;
    const last=m.windows.h1.total, previous=(m.windows.h6.total-last)/5, max=Math.max(last,previous,1);
    return '<article class="pool-card"><div class="pool-card-top"><div><h3>'+esc(venueName(m.venue)+' · '+m.name)+'</h3><p>Spot market · '+esc(m.unit)+' quote units</p></div><a href="'+marketURL(m)+'" target="_blank" rel="noopener noreferrer">View market ↗</a></div>'+
      '<div class="pool-stat-row"><span>Into '+esc(asset.symbol)+'<b>'+quoteAmount(buy)+'</b></span><span>Out of '+esc(asset.symbol)+'<b>'+quoteAmount(sell)+'</b></span><span>Executed trades<b>'+w.count.toLocaleString()+'</b></span><span>Observed window<b>'+counted(Number(windowKey.slice(1)),'hour')+'</b></span></div>'+
      '<p>'+esc(time(w.start))+' → '+esc(time(w.end))+'</p><div class="pace-bars"><div><span>Last hour</span><i style="width:'+last/max*100+'%"></i><b>'+quoteAmount(last)+'</b></div><div><span>Previous 5h / hour</span><i style="width:'+previous/max*100+'%"></i><b>'+quoteAmount(previous)+'</b></div></div><p>Same pair, separate periods. '+(previous>0?(last/previous).toFixed(2)+'× the previous pace.':'No nonzero baseline.')+' This is activity, not a forecast.</p>'+
      '<details><summary>Identity, source & calculation</summary><div class="identity-field"><label>Reviewed asset → venue pair</label><code>'+esc(m.base)+' / '+esc(m.quote)+' → '+esc(m.id)+'</code></div><p>'+(m.venue==='binance'?'Sum of completed five-minute candles. Buy = taker-buy quote volume. Sell = total quote volume minus buy.':'Paginated public trades. Trade value = executed price × quantity in USDT. Buy/sell uses the provider’s b/s field; repeated trade IDs are counted once.')+'</p><p>'+m.bars.length+' consecutive five-minute buckets; '+m.pages+' response page'+(m.pages===1?'':'s')+'. Retrieved '+esc(time(m.checkedAt))+'.</p><a href="'+marketSourceURL(m)+'" target="_blank" rel="noopener noreferrer">Open provider response'+(m.venue==='kraken'?' · first page':'')+' ↗</a><p>A fresh request may differ. Source records are not signed; window completeness depends on the provider honoring the request.</p></details></article>';
  }).join('')+'</div>';
  if(markets.length)html+='<div class="verification-grid exchange-verification"><article><h3>Check the calculation</h3><p>Rebuild the totals from the stored five-minute buckets. This checks arithmetic consistency; it does not independently verify trades or exchange reporting.</p><button class="button-light" id="reproduce-exchange">Reproduce this view</button><p id="exchange-audit-result" role="status">Ready to check '+counted(markets.length,'market')+'.</p></article><article><h3>One venue is a limited view</h3><p>These markets do not reveal other exchanges, wallet movements, trader intent, manipulation, order-book depth or executable prices. There is no on-chain proof for these exchange records.</p></article></div>';
  if(markets.some(m=>m.venue==='binance'))html+=license;
  host.innerHTML=html;
  const button=host.querySelector('#reproduce-exchange');
  if(button)button.onclick=()=>{
    let buy=0,sell=0,okay=true;
    for(const m of markets){const w=windowsFromBars(m.bars,m.periodEnd)[windowKey];okay&&=['buy','sell','total','count'].every(k=>w?.[k]===m.windows[windowKey][k]);buy+=m.base===selected?w.buy:w.sell;sell+=m.base===selected?w.sell:w.buy;}
    host.querySelector('#exchange-audit-result').textContent=okay?'Reproduced '+counted(markets.length,'market')+'. Into '+quoteAmount(buy)+' · out '+quoteAmount(sell)+'. Arithmetic checked; source accuracy not independently verified.':'Recorded inputs disagree. Do not rely on these totals.';
  };
}
