import { routesForAsset, ageMinutes } from './lib/model.js';
import { renderResearch } from './research-panel.js';
import { validSnapshot, SOURCES, viewHealth } from './lib/quality.js';
import { activitySource, exchangeRoutes, venueName } from './lib/exchanges.js';
import { renderExchangeResearch } from './exchange-panel.js';
import { renderTradeMap, drawTradeRoutes, renderFocusCard } from './activity-view.js?v=20261023-map1';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const compact = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);
const pct = n => n === null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const shortSymbol = a => a.symbol === 'FIGR_HELOC' ? 'FIGR' : a.symbol;
const networkName = n => ({ eth: 'Ethereum', bsc: 'BNB Chain', solana: 'Solana', tron: 'TRON', hyperevm: 'HyperEVM', arbitrum: 'Arbitrum', base: 'Base' })[n] ?? n;
const imageURL = a => { try { const u = new URL(a.image); return u.protocol === 'https:' && /(^|\.)coingecko\.com$/.test(u.hostname) ? u.href : './favicon.svg'; } catch { return './favicon.svg'; } };
const icon = (a, cls = '') => '<img class="' + cls + '" src="' + esc(imageURL(a)) + '" width="24" height="24" alt="" loading="lazy">';

import { profileURL } from './lib/market-map.js';
export function initActivityDetails(onScopeChange=()=>{}) {
let snapshot=null,currentRoutes=[],selected=null,windowKey='h24',selectedRoute=null,btc=false,network='all',source='auto',activeSource='dex',offline=false,mapInView=false;
const inNetwork=()=>snapshot.pools.filter(p=>network==='all'||p.network===network);
function readState() {
  const q = new URLSearchParams(location.search);
  selected = q.get('coin') || 'ethereum';
  windowKey = ['h1','h6','h24'].includes(q.get('window')) ? q.get('window') : 'h24';
  selectedRoute = q.get('route'); btc = q.get('btc') === '1';
  network = q.get('network') || 'all';
  source = ['dex','exchange'].includes(q.get('source')) ? q.get('source') : 'auto';
}
function saveState(push = true) {
  const q = new URLSearchParams(location.search); q.set('coin',selected);q.set('window',windowKey);for(const key of ['route','btc','network','source'])q.delete(key);
  if (selectedRoute) q.set('route', selectedRoute);
  if (btc) q.set('btc', '1');
  if (network !== 'all') q.set('network', network);
  if (source !== 'auto') q.set('source', source);
  const url = location.pathname + '?' + q;
  if (location.pathname + location.search !== url) history[push ? 'pushState' : 'replaceState'](null, '', url);
  onScopeChange();
}
function selectRoute(id){selectedRoute=selectedRoute===id?null:id;render();saveState();}
function scrollToView(selector) {
  $(selector).scrollIntoView({behavior:document.documentElement.dataset.motion==='on'?'smooth':'auto',block:'start'});
}
function viewContext() {
  return {snapshot,selected,selectedRoute,currentRoutes,windowKey,activeSource,source,network,offline,
    onCoin:id=>{location.href=profileURL(id,{from:location.pathname+location.search,source,network});},
    
    onRoute:selectRoute,
    onDetails:()=>{scrollToView('#inspector');$('#inspector').focus({preventScroll:true});},
    onAll:()=>{selectedRoute=null;render();saveState();},
    onResearch:()=>{$('#research-shell').open=true;scrollToView('#research-shell');}};
}
function renderMap() {
  renderTradeMap(viewContext());
  document.querySelectorAll('[data-window]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.window===windowKey)));
  $('#btc-toggle').setAttribute('aria-pressed',String(btc));
  $('#btc-reference').hidden=!btc;
  if(btc&&snapshot.bitcoin){const a=snapshot.bitcoin;$('#btc-reference').innerHTML='<a href="'+esc(profileURL(a.id,{from:location.pathname+location.search}))+'"><b>₿ Bitcoin ↗</b></a><strong>'+money(a.price)+'</strong><span class="'+(a.priceChange24h>=0?'up':'down')+'">'+pct(a.priceChange24h)+' · 24h</span><span>Price reference · no flow estimate</span>';}
  requestAnimationFrame(drawConnections);
}
function drawConnections(){if(snapshot)drawTradeRoutes(viewContext());}
function renderInspector(){renderFocusCard(viewContext());}
function render() {
  if (!snapshot || !snapshot.assets.some(a=>a.id===selected)) return;
  const focused = document.activeElement;
  const dataFocus=['coin','highlight','focusRoute','hour','priceCoin'].find(k=>focused?.dataset[k]);
  const focusSelector=focused?.id?'#'+CSS.escape(focused.id):focused?.dataset.pair?'[data-pair="'+CSS.escape(focused.dataset.pair)+'"][data-side="'+focused.dataset.side+'"]':dataFocus?'[data-'+dataFocus.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+CSS.escape(focused.dataset[dataFocus])+'"]':null;
  if (!snapshot.assets.some(a => a.id===selected)) { selected = snapshot.assets[0].id; selectedRoute = null; }
  const networks = [...new Set(snapshot.pools.map(p=>p.network))].sort();
  if(network!=='all'&&!networks.includes(network))network='all';
  $('#network-filter').innerHTML='<option value="all">All sampled networks</option>'+networks.map(n=>'<option value="'+esc(n)+'">'+esc(networkName(n))+'</option>').join('');
  $('#network-filter').value=network;
  activeSource=activitySource(snapshot,selected,windowKey,source,network);
  $('#source-filter').value=source;
  $('#network-scope').hidden=source==='exchange';
  $('#activity-subtitle').textContent=activeSource==='exchange'?'Exchange trades · measured in USDT':'On-chain swaps · measured in USD';
  $('#map-measure').textContent='Thicker lines = more traded. Motion shows direction, not individual trades.';
  $('#research-shell > summary small').textContent=activeSource==='exchange'?'Compare activity · inspect markets · check the numbers':'Compare activity · inspect pools · check the numbers';
  currentRoutes = activeSource==='exchange'?exchangeRoutes(snapshot.exchangeMarkets??[],selected,windowKey):routesForAsset({pools:inNetwork()}, selected, windowKey);
  if (selectedRoute && !currentRoutes.some(r=>r.otherId===selectedRoute)) selectedRoute=null;
  renderMap(); renderInspector();
  const health=viewHealth(snapshot,currentRoutes.flatMap(r=>r.pools));
  $('#view-health').textContent=(offline?'Offline · ':'')+(health.age===null?'No covered trades':'Oldest market check '+Math.floor(health.age)+'m ago');
  if(activeSource==='exchange')renderExchangeResearch({snapshot,selected,windowKey,selectedRoute});
  else renderResearch({snapshot,selected,windowKey,network,selectedRoute});
  $('#mobile-summary').hidden = !mapInView;
  if (focusSelector) requestAnimationFrame(() => document.querySelector(focusSelector)?.focus({ preventScroll: true }));
}
function openMethod() {
  $('#method-content').innerHTML = '<p class="method-intro">Choose a coin, then read its two sides: green routes show buying; dashed copper routes show selling. These are separate trades, not a journey by the same money. Wider lines show larger amounts among the visible routes. The ring shows buying share across all routes in the selection. Motion shows direction, not individual transactions.</p>' +
    '<div class="method-grid"><article><h3>How changes are chosen</h3><p>We compare the last hour with the previous five hours averaged per hour, using the same markets. Highlights require fresh, complete data and a previous hourly average of at least 10,000 source units. Pace must increase to 1.5× or fall to two-thirds; buying share must change by at least 10 percentage points with 10,000 units traded in the last hour. These are editorial thresholds, not statistical significance, causes or predictions. Hourly charts use recorded exchange intervals; rolling pool totals cannot supply a timeline.</p></article><article><h3>Two kinds of activity</h3><p>Automatic shows on-chain pools when available, otherwise a covered exchange spot market. The trading view identifies the source and unit. Highlights and coin comparisons follow your Activity and Network filters; their comparison is always last hour versus the previous five hours. Choose On-chain only or Exchange only to keep a fixed scope.</p></article><article><h3>Keep the units honest</h3><p>On-chain amounts are provider-reported USD. Exchange amounts are USDT quote units, with completed five-minute intervals. We do not assume one USDT equals one dollar or add the two sources together. Every exchange trade has a buyer and seller; reported side indicates its direction.</p></article><article><h3>Automatic rankings</h3><p>Ten non-stable assets by CoinGecko market cap, plus five USD-pegged stablecoins identified by DefiLlama. BTC and known wrapped/staked/bridged duplicates are excluded from the ten. Other asset types, including tokenized assets, remain eligible. A new ranking does not create a new identity mapping automatically.</p></article><article><h3>Freshness you can see</h3><p>The shared collector targets a 15-minute refresh. Schedules and upstream feeds can be delayed. Exchange details show an explicit window end; pool windows roll at the provider. Retrieval times do not guarantee upstream accuracy. Missing coverage never means zero trading.</p></article></div>' +
    (snapshot ? '<h2>Coverage in this snapshot</h2><p class="method-foot">Counts below use the selected '+windowKey.slice(1)+'h timeframe across all sources and networks. They measure which coins have a sample, not the share of global trading captured.</p><table class="coverage-table"><thead><tr><th>Asset</th><th>Rank</th><th>On-chain</th><th>Exchange</th></tr></thead><tbody>' + snapshot.assets.map(a => {
      const pools=snapshot.pools.filter(p=>p.windows[windowKey]&&(p.base===a.id||p.quote===a.id));
      const markets=(snapshot.exchangeMarkets??[]).filter(m=>m.windows[windowKey]&&(m.base===a.id||m.quote===a.id));
      const failed=(snapshot.exchangeDiagnostics??[]).filter(d=>d.assetId===a.id&&d.status!=='ok');
      return '<tr><td>'+esc(a.name)+'</td><td>#'+a.rank+'</td><td>'+(pools.length?pools.length+' pools · '+esc([...new Set(pools.map(p=>networkName(p.network)))].join(', ')):'No sample')+'</td><td>'+(markets.length?markets.length+' market'+(markets.length===1?'':'s')+' · '+esc([...new Set(markets.map(m=>venueName(m.venue)))].join(', ')):failed.length?'Feed unavailable':'No mapped market')+'</td></tr>';
    }).join('') + '</tbody></table><p class="method-foot">' + esc(snapshot.policy.poolSample) + ' Native wrapped forms are explicit; bridged lookalikes are not silently substituted. Exchange identity must match a reviewed pair and current spot-market metadata. Assets without an eligible trading feed remain visible with price data.<br><br>Rankings retrieved ' + new Date(snapshot.rankingCheckedAt).toLocaleString() + '. Collection completed ' + new Date(snapshot.checkedAt).toLocaleString() + '.<br>Sources: ' + SOURCES.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + '</a> (' + esc(s.use) + ')').join(' · ') + '.</p><p class="method-foot">Binance-derived figures: <a href="https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md" target="_blank" rel="noopener noreferrer">Binance Vision · CC BY-NC-SA 4.0</a>. Window totals are calculated by this site; other providers retain their own terms. Technical access does not establish unrestricted commercial reuse.</p>' : '<p>Coverage details appear once a snapshot is available.</p>');
  $('#method-dialog').showModal();
}
$('#coverage-button').onclick=openMethod;
$('#close-method').onclick=()=>$('#method-dialog').close();
$('#method-dialog').onclick=e=>{if(e.target===$('#method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
document.querySelectorAll('[data-window]').forEach(button=>button.onclick=()=>{windowKey=button.dataset.window;render();saveState();});
$('#btc-toggle').onclick=()=>{btc=!btc;render();saveState();};
$('#network-filter').onchange=e=>{network=e.target.value;selectedRoute=null;render();saveState();};
$('#source-filter').onchange=e=>{source=e.target.value;selectedRoute=null;render();saveState();};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#mobile-summary').onclick=()=>{ scrollToView('#inspector'); $('#inspector').focus({preventScroll:true}); };
new IntersectionObserver(entries=>{ mapInView=entries[0].isIntersecting; $('#mobile-summary').hidden=!snapshot || !mapInView; },{threshold:0.1}).observe($('#map'));
window.addEventListener('popstate',()=>{readState();render();});
new ResizeObserver(()=>requestAnimationFrame(drawConnections)).observe($('#map'));
readState();
return {update(data,id,isOffline){snapshot=data;selected=id;offline=isOffline;render();}};
}
