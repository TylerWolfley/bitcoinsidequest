import { routesForAsset, ageMinutes } from './lib/model.js';
import { renderResearch } from './research-panel.js';
import { validSnapshot, SOURCES, viewHealth } from './lib/quality.js';
import { activitySource, exchangeRoutes, venueName } from './lib/exchanges.js';
import { renderExchangeResearch } from './exchange-panel.js';
import { renderChanges, renderCoinPicker, renderTradeMap, drawTradeRoutes, renderFocusCard } from './activity-view.js?v=20261023-visual1';
import { renderTemperature } from './temperature-view.js?v=20261023-temperature1';
import { validTemperature } from './lib/temperature.js';
import { validVisit,visitDigest } from './lib/market-context.js';
import { riskTemperature,validRiskHistory } from './lib/risk-temperature.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const compact = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);
const pct = n => n === null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const shortSymbol = a => a.symbol === 'FIGR_HELOC' ? 'FIGR' : a.symbol;
const networkName = n => ({ eth: 'Ethereum', bsc: 'BNB Chain', solana: 'Solana', tron: 'TRON', hyperevm: 'HyperEVM', arbitrum: 'Arbitrum', base: 'Base' })[n] ?? n;
const imageURL = a => { try { const u = new URL(a.image); return u.protocol === 'https:' && /(^|\.)coingecko\.com$/.test(u.hostname) ? u.href : './favicon.svg'; } catch { return './favicon.svg'; } };
const icon = (a, cls = '') => '<img class="' + cls + '" src="' + esc(imageURL(a)) + '" width="24" height="24" alt="" loading="lazy">';
let snapshot = null, pending = null, currentRoutes = [], selected = 'ethereum', windowKey = 'h24', selectedRoute = null, btc = false, network = 'all';
let source = 'auto', activeSource = 'dex';
const inNetwork = () => snapshot.pools.filter(p => network === 'all' || p.network === network);
let offline = false, loading = false, mapInView = false, toastTimer;
let temperatureFeed=null,temperatureOffline=false,temperatureLoading=false,visitStorage=true,previousVisit=null,riskHistory=null,historyLoading=false,historyUnavailable=false;
let savedVisit=null;
try{savedVisit=localStorage.getItem('bsq-visit-v2');}catch{visitStorage=false;}
try{const v=JSON.parse(savedVisit);if(validVisit(v))previousVisit=v;}catch{}
function renderMood(){
  const model=riskTemperature(snapshot,{offline});
  const currentVisit=!offline?visitDigest(snapshot,model):null;
  if(currentVisit&&visitStorage)try{localStorage.setItem('bsq-visit-v2',JSON.stringify(currentVisit));}catch{visitStorage=false;}
  renderTemperature({feed:temperatureFeed,model,history:riskHistory,historyUnavailable,temperatureOffline,previousVisit,currentVisit,storage:visitStorage,
    onRetry:()=>{loadData(true);loadTemperature();loadRiskHistory();},onCoin:id=>{source='auto';network='all';windowKey='h24';selectCoin(id);scrollToView('.workspace');}});
}
async function loadTemperature(){
  if(temperatureLoading)return;
  temperatureLoading=true;
  try{
    const response=await fetch('./data/temperature.json',{cache:'no-cache',signal:AbortSignal.timeout(15_000)});
    if(!response.ok)throw new Error('Sentiment unavailable');
    const data=await response.json();if(!validTemperature(data))throw new Error('Invalid sentiment');
    temperatureFeed=data;temperatureOffline=false;
    try{localStorage.setItem('bsq-temperature-v1',JSON.stringify(data));}catch{}
  }catch{
    temperatureOffline=true;
    if(!temperatureFeed)try{const cached=JSON.parse(localStorage.getItem('bsq-temperature-v1'));if(validTemperature(cached))temperatureFeed=cached;}catch{}
  }finally{temperatureLoading=false;renderMood();}
}
async function loadRiskHistory(){
  if(historyLoading)return;historyLoading=true;
  try{const response=await fetch('./data/market-temperature.json',{cache:'no-cache',signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error('History unavailable');const data=await response.json();if(!validRiskHistory(data))throw new Error('Invalid history');riskHistory=data;historyUnavailable=false;}
  catch{historyUnavailable=true;}
  finally{historyLoading=false;renderMood();}
}
function readState() {
  const q = new URLSearchParams(location.search);
  selected = q.get('coin') || 'ethereum';
  windowKey = ['h1','h6','h24'].includes(q.get('window')) ? q.get('window') : 'h24';
  selectedRoute = q.get('route'); btc = q.get('btc') === '1';
  network = q.get('network') || 'all';
  source = ['dex','exchange'].includes(q.get('source')) ? q.get('source') : 'auto';
}
function saveState(push = true) {
  const q = new URLSearchParams({ coin: selected, window: windowKey });
  if (selectedRoute) q.set('route', selectedRoute);
  if (btc) q.set('btc', '1');
  if (network !== 'all') q.set('network', network);
  if (source !== 'auto') q.set('source', source);
  const url = location.pathname + '?' + q;
  if (location.pathname + location.search !== url) history[push ? 'pushState' : 'replaceState'](null, '', url);
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 3000); }
function selectCoin(id) {
  if (!snapshot?.assets.some(a => a.id === id)) return;
  selected = id; selectedRoute = null; render(); saveState();
}
function selectRoute(id) { selectedRoute = selectedRoute === id ? null : id; render(); saveState(); }
function validate(data) {
  return validSnapshot(data);
}
function renderNotice() {
  const notice = $('#notice');
  if (pending) {
    notice.innerHTML = 'The top-ten lineup has changed. Your current view is held in place. <button id="apply-rankings">Update map</button>';
    notice.hidden = false;
    $('#apply-rankings').onclick = () => { snapshot = pending; pending = null; render(); saveState(false); };
  } else if (offline || ageMinutes(snapshot?.checkedAt) > 30) {
    notice.innerHTML = (offline ? 'The latest feed could not be reached. Showing the last available snapshot.' : 'This snapshot is over 30 minutes old. Trading amounts may have changed.') + ' <button id="retry-data">Check again</button>';
    notice.hidden = false; $('#retry-data').onclick = () => loadData(true);
  } else if (snapshot?.poolErrors?.length || snapshot?.diagnostics?.some(d => d.status !== 'ok') || snapshot?.exchangeDiagnostics?.some(d=>d.status!=='ok')) {
    notice.textContent = 'Some trading feeds are unavailable. The map shows only the markets successfully checked. Check coverage for details.'; notice.hidden = false;
  } else notice.hidden = true;
}
async function loadData(manual = false) {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch('./data/snapshot.json', { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Snapshot unavailable');
    const data = await response.json();
    if (!validate(data)) throw new Error('Invalid snapshot');
    offline = false;
    if (snapshot && snapshot.checkedAt === data.checkedAt) { freshness(); renderNotice(); renderChanges(viewContext()); renderMood(); if (manual) toast('You have the latest available snapshot'); return; }
    if (snapshot && snapshot.assets.map(a => a.id).join() !== data.assets.map(a => a.id).join()) pending = data;
    else { snapshot = data; pending = null; }
    try { localStorage.setItem('bsq-snapshot-v1', JSON.stringify(data)); } catch {}
    render(); saveState(false);
    if (manual) toast('Checked for the latest snapshot');
  } catch {
    offline = true;
    if (!snapshot) {
      try { const cached = JSON.parse(localStorage.getItem('bsq-snapshot-v1')); if (validate(cached)) snapshot = cached; } catch {}
    }
    if (snapshot) render();
    else {
      $('#loading').innerHTML = '<strong>The market feed is taking a moment.</strong><span>No prices or flows have been estimated.</span><button class="button-light" id="initial-retry">Try again</button>';
      $('#initial-retry').onclick = () => loadData(true);
      $('#freshness span').textContent = 'Data unavailable';
      $('#freshness').classList.add('stale');
    }
  } finally { loading = false; renderMood(); }
}
function freshness() {
  if (!snapshot) return;
  const minutes = ageMinutes(snapshot.checkedAt);
  const text = minutes < 1 ? 'Snapshot checked just now' : minutes < 60 ? 'Snapshot checked ' + Math.floor(minutes) + 'm ago' : 'Snapshot checked ' + Math.floor(minutes / 60) + 'h ago';
  $('#freshness span').textContent = text;
  $('#freshness').classList.toggle('stale', offline || minutes > 30);
  $('#freshness').title = 'Retrieved ' + new Date(snapshot.checkedAt).toLocaleString() + '. Each market has its own check time; upstream data may be delayed.';
  const records = currentRoutes.flatMap(r=>r.pools);
  const healthSnapshot = activeSource==='exchange' ? {poolErrors:(snapshot.exchangeDiagnostics??[]).filter(d=>d.status!=='ok'),diagnostics:[]} : snapshot;
  const health = viewHealth(healthSnapshot, records);
  const checked = health.age === null ? 'No trades covered' : 'Oldest '+(activeSource==='exchange'?'market':'pool')+' check ' + (health.age < 1 ? 'under 1m' : Math.floor(health.age) + 'm') + ' ago';
  $('#view-health').textContent = (offline ? 'Offline · ' : health.status === 'old' ? 'Old data · ' : health.partial ? 'Partial feed · ' : '') + checked;
  $('#view-health').classList.toggle('health-warning', offline || health.status === 'old' || health.partial);
  $('#view-health').title = 'Retrieval time, not a guarantee of upstream freshness. Checks span ' + (health.spreadMinutes ?? 0).toFixed(1) + ' minutes.';
}
function scrollToView(selector) {
  $(selector).scrollIntoView({behavior:document.documentElement.dataset.motion==='on'?'smooth':'auto',block:'start'});
}
function viewContext() {
  return {snapshot,selected,selectedRoute,currentRoutes,windowKey,activeSource,source,network,offline,
    onCoin:id=>{selectCoin(id);scrollToView('.workspace');},
    onHighlight:id=>{windowKey='h1';selectCoin(id);scrollToView('.workspace');},
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
  if(btc&&snapshot.bitcoin){const a=snapshot.bitcoin;$('#btc-reference').innerHTML='<b>₿ Bitcoin</b><strong>'+money(a.price)+'</strong><span class="'+(a.priceChange24h>=0?'up':'down')+'">'+pct(a.priceChange24h)+' · 24h</span><span>Price reference · no flow estimate</span>';}
  requestAnimationFrame(drawConnections);
}
function drawConnections(){if(snapshot)drawTradeRoutes(viewContext());}
function renderInspector(){renderFocusCard(viewContext());}
function renderPriceBars() {
  const assets = snapshot.assets.filter(a => a.kind === 'alt'), max = Math.max(1,...assets.map(a=>Math.abs(a.priceChange24h ?? 0)));
  $('#price-bars').innerHTML = assets.map(a => '<button class="price-item" data-price-coin="' + esc(a.id) + '" aria-label="Select ' + esc(a.name) + ', price ' + pct(a.priceChange24h) + ' in 24 hours"><span class="price-item-top"><strong>' + esc(shortSymbol(a)) + '</strong><span class="' + (a.priceChange24h>=0?'up':'down') + '">' + pct(a.priceChange24h) + '</span></span><span class="price-track ' + (a.priceChange24h<0?'negative':'') + '"><span style="width:' + (Math.abs(a.priceChange24h??0)/max*100) + '%"></span></span></button>').join('');
  $('#price-bars').querySelectorAll('[data-price-coin]').forEach(el => el.onclick=()=>{selectCoin(el.dataset.priceCoin); scrollToView('.workspace');});
}
function render() {
  if (!snapshot) return;
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
  renderMood(); renderChanges(viewContext()); renderCoinPicker(viewContext()); renderMap(); renderInspector(); renderPriceBars(); freshness(); renderNotice();
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
['#about-button','#coverage-button','#footer-method'].forEach(id=>$(id).onclick=openMethod);
$('#close-method').onclick=()=>$('#method-dialog').close();
$('#method-dialog').onclick=e=>{if(e.target===$('#method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
document.querySelectorAll('[data-window]').forEach(button=>button.onclick=()=>{windowKey=button.dataset.window;render();saveState();});
$('#btc-toggle').onclick=()=>{btc=!btc;render();saveState();};
$('#network-filter').onchange=e=>{network=e.target.value;selectedRoute=null;render();saveState();};
$('#source-filter').onchange=e=>{source=e.target.value;selectedRoute=null;render();saveState();};
$('#share-button').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('View link copied');}catch{$('#share-url').value=location.href;$('#share-dialog').showModal();$('#share-url').select();}};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#mobile-summary').onclick=()=>{ scrollToView('#inspector'); $('#inspector').focus({preventScroll:true}); };
new IntersectionObserver(entries=>{ mapInView=entries[0].isIntersecting; $('#mobile-summary').hidden=!snapshot || !mapInView; },{threshold:0.1}).observe($('#map'));
window.addEventListener('popstate',()=>{readState();render();});
new ResizeObserver(()=>requestAnimationFrame(drawConnections)).observe($('#map'));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let savedMotion=null;
try{savedMotion=localStorage.getItem('bsq-motion');}catch{}
function applyMotion(){
  const on=savedMotion==='on'||(savedMotion!=='off'&&!reducedMotion.matches);
  document.documentElement.dataset.motion=on?'on':'off';
  $('#motion-toggle').setAttribute('aria-pressed',String(on));
  $('#motion-toggle').innerHTML='<span aria-hidden="true">◉</span> Motion '+(on?'on':'off');
}
$('#motion-toggle').onclick=()=>{savedMotion=document.documentElement.dataset.motion==='on'?'off':'on';try{localStorage.setItem('bsq-motion',savedMotion);}catch{}applyMotion();};
reducedMotion.addEventListener('change',applyMotion);
applyMotion();readState();loadTemperature();loadRiskHistory();renderMood();loadData();
setInterval(()=>{if(!document.hidden){loadData();loadTemperature();loadRiskHistory();}},60_000);
setInterval(()=>{freshness();renderMood();if(snapshot){renderNotice();if(offline||ageMinutes(snapshot.checkedAt)>30)renderChanges(viewContext());}},30_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadData();loadTemperature();loadRiskHistory();}});
