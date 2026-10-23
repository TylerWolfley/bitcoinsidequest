import { routesForAsset, summarizeRoutes, ageMinutes } from './lib/model.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const compact = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = n => n === null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 4 : 2 }).format(n);
const pct = n => n === null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + compact(Math.abs(n));
const timeframe = { h1: 'last hour', h6: 'last 6 hours', h24: 'last 24 hours' };
const shortSymbol = a => a.symbol === 'FIGR_HELOC' ? 'FIGR' : a.symbol;
const networkName = n => ({ eth: 'Ethereum', bsc: 'BNB Chain', solana: 'Solana', tron: 'TRON', hyperevm: 'HyperEVM', arbitrum: 'Arbitrum', base: 'Base' })[n] ?? n;
const imageURL = a => { try { const u = new URL(a.image); return u.protocol === 'https:' && /(^|\.)coingecko\.com$/.test(u.hostname) ? u.href : './favicon.svg'; } catch { return './favicon.svg'; } };
const icon = (a, cls = '') => '<img class="' + cls + '" src="' + esc(imageURL(a)) + '" width="24" height="24" alt="" loading="lazy">';
const positions = [[30,29],[50,15],[12,16],[51,44],[12,46],[31,61],[12,77],[51,77],[31,87],[66,62]];
let snapshot = null, pending = null, currentRoutes = [], selected = 'ethereum', windowKey = 'h24', selectedRoute = null, btc = false;
let offline = false, loading = false, mapInView = false, toastTimer;
function readState() {
  const q = new URLSearchParams(location.search);
  selected = q.get('coin') || 'ethereum';
  windowKey = ['h1','h6','h24'].includes(q.get('window')) ? q.get('window') : 'h24';
  selectedRoute = q.get('route'); btc = q.get('btc') === '1';
}
function saveState(push = true) {
  const q = new URLSearchParams({ coin: selected, window: windowKey });
  if (selectedRoute) q.set('route', selectedRoute);
  if (btc) q.set('btc', '1');
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
  return data?.schemaVersion === 1 && Array.isArray(data.assets) && data.assets.length === 15 &&
    Array.isArray(data.pools) && data.assets.every(a => a.id && a.symbol && a.coverage && a.priceUpdatedAt) && Number.isFinite(Date.parse(data.checkedAt));
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
  } else if (snapshot?.poolErrors?.length || snapshot?.diagnostics?.some(d => d.status !== 'ok')) {
    notice.textContent = 'Some pool feeds are unavailable. The map shows only the pools successfully checked.'; notice.hidden = false;
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
    if (snapshot && snapshot.checkedAt === data.checkedAt) { freshness(); renderNotice(); if (manual) toast('You have the latest available snapshot'); return; }
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
  } finally { loading = false; }
}
function freshness() {
  if (!snapshot) return;
  const minutes = ageMinutes(snapshot.checkedAt);
  const text = minutes < 1 ? 'Snapshot checked just now' : minutes < 60 ? 'Snapshot checked ' + Math.floor(minutes) + 'm ago' : 'Snapshot checked ' + Math.floor(minutes / 60) + 'h ago';
  $('#freshness span').textContent = text;
  $('#freshness').classList.toggle('stale', offline || minutes > 30);
  $('#freshness').title = 'Retrieved ' + new Date(snapshot.checkedAt).toLocaleString() + '. Each pool has its own check time; upstream data may be delayed.';
}
function renderOverview() {
  const alts = snapshot.assets.filter(a => a.kind === 'alt'), withPrice = alts.filter(a => a.priceChange24h !== null), positive = withPrice.filter(a => a.priceChange24h > 0).length;
  const biggest = [...withPrice].sort((a, b) => Math.abs(b.priceChange24h) - Math.abs(a.priceChange24h))[0];
  const covered = snapshot.assets.filter(a => a.coverage.pools > 0).length;
  $('#overview').innerHTML = '<div class="overview-card"><div><div class="eyebrow">THE LAST 24 HOURS</div><div class="overview-value">' + positive + ' of ' + withPrice.length + '<small>alts up in price</small></div></div><div class="mini-breadth" aria-hidden="true">' + alts.map(a => '<i class="' + (a.priceChange24h > 0 ? 'up' : a.priceChange24h < 0 ? 'down' : '') + '"></i>').join('') + '</div></div>' +
    '<div class="overview-card"><div><div class="eyebrow">BIGGEST PRICE MOVE</div><div class="overview-value">' + (biggest ? esc(shortSymbol(biggest)) + ' <span class="' + (biggest.priceChange24h >= 0 ? 'up' : 'down') + '">' + pct(biggest.priceChange24h) + '</span>' : 'Unavailable') + '</div></div>' + (biggest ? icon(biggest, 'overview-coin') : '') + '</div>' +
    '<div class="overview-card"><div><div class="eyebrow">OUR TRADING SAMPLE</div><div class="overview-value">' + covered + ' of 15<small>coins · ' + snapshot.pools.length + ' pools</small></div></div><div class="coverage-dots" aria-hidden="true">' + Array.from({length:15}, (_,i) => '<i class="' + (i < covered ? 'filled' : '') + '"></i>').join('') + '</div></div>';
}
function renderMap(asset) {
  const related = new Set(currentRoutes.map(r => r.otherId));
  let ai = 0, si = 0;
  $('#nodes').innerHTML = snapshot.assets.map(a => {
    const pos = a.kind === 'stable' ? [89, 13 + si++ * 18] : positions[ai++];
    const active = a.id === selected;
    const caption = active ? 'SELECTED' : a.coverage.pools ? 'SAMPLED' : 'PRICE ONLY';
    return '<button class="coin-node' + (related.has(a.id) ? ' related' : '') + (!active && !related.has(a.id) ? ' muted' : '') + '" data-coin="' + esc(a.id) + '" style="left:' + pos[0] + '%;top:' + pos[1] + '%" aria-pressed="' + active + '" aria-label="' + esc(a.name) + ', ' + pct(a.priceChange24h) + ' price in 24 hours. ' + (a.coverage.pools ? a.coverage.pools + ' sampled pools.' : 'Price only, no flow coverage.') + '" title="' + esc(a.name) + ' · ' + money(a.price) + '"><span class="node-icon">' + icon(a) + '</span><span class="coin-symbol">' + esc(shortSymbol(a)) + '</span><span class="coin-change ' + (a.priceChange24h >= 0 ? 'up' : 'down') + '">' + pct(a.priceChange24h) + '</span><span class="node-caption' + (!a.coverage.pools ? ' limited' : '') + '">' + caption + '</span></button>';
  }).join('');
  $('#nodes').querySelectorAll('[data-coin]').forEach(el => el.onclick = () => selectCoin(el.dataset.coin));
  $('#loading').hidden = true;
  document.querySelectorAll('[data-window]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.window === windowKey)));
  $('#btc-toggle').setAttribute('aria-pressed', String(btc));
  $('#btc-reference').hidden = !btc;
  if (btc && snapshot.bitcoin) {
    const a = snapshot.bitcoin;
    $('#btc-reference').innerHTML = '<b>₿ Bitcoin</b><strong>' + money(a.price) + '</strong><span class="' + (a.priceChange24h >= 0 ? 'up' : 'down') + '">' + pct(a.priceChange24h) + ' · 24h</span><span>Price reference · no flow estimate</span>';
  }
  const shown = selectedRoute ? currentRoutes.filter(r => r.otherId === selectedRoute) : currentRoutes.slice(0,3);
  $('#route-count').textContent = currentRoutes.length ? (selectedRoute ? 'One route selected' : 'Showing ' + shown.length + ' of ' + currentRoutes.length + ' routes') + ' · ' + timeframe[windowKey] : 'No sampled routes for ' + shortSymbol(asset);
  requestAnimationFrame(drawConnections);
}
function drawConnections() {
  if (!snapshot) return;
  const map = $('#map'), svg = $('#connections'), bounds = map.getBoundingClientRect();
  svg.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height);
  const chosenNode = [...$('#nodes').children].find(el => el.dataset.coin === selected);
  if (!chosenNode) return;
  const point = el => { const r = el.getBoundingClientRect(); return { x: r.left - bounds.left + r.width / 2, y: r.top - bounds.top + r.height / 2, radius: r.width / 2 + 5 }; };
  const chosen = point(chosenNode);
  const routes = selectedRoute ? currentRoutes.filter(r => r.otherId === selectedRoute) : currentRoutes.slice(0,3);
  const max = Math.max(1, ...routes.flatMap(r => [r.incoming,r.outgoing]));
  let html = '<defs><marker id="in-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 Z" fill="#247c68"/></marker><marker id="out-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5 L0,10 Z" fill="#b56b53"/></marker></defs>';
  for (const route of routes) {
    const otherNode = [...$('#nodes').children].find(el => el.dataset.coin === route.otherId);
    if (!otherNode) continue;
    const other = point(otherNode), dx = chosen.x - other.x, dy = chosen.y - other.y, length = Math.hypot(dx,dy);
    const ux = dx / length, uy = dy / length, nx = -uy, ny = ux;
    const from = { x: other.x + ux * other.radius, y: other.y + uy * other.radius };
    const to = { x: chosen.x - ux * chosen.radius, y: chosen.y - uy * chosen.radius };
    const otherAsset = snapshot.assets.find(a => a.id === route.otherId);
    for (const incoming of [true,false]) {
      const value = incoming ? route.incoming : route.outgoing;
      if (value <= 0) continue;
      const direction = incoming ? 1 : -1, offset = direction * Math.min(19, bounds.width * .035);
      const cx = (from.x + to.x) / 2 + nx * offset * 2, cy = (from.y + to.y) / 2 + ny * offset * 2;
      const start = incoming ? from : to, end = incoming ? to : from;
      const d = 'M' + start.x + ',' + start.y + ' Q' + cx + ',' + cy + ' ' + end.x + ',' + end.y;
      const label = (incoming ? shortSymbol(otherAsset) + ' to ' + shortSymbol(snapshot.assets.find(a=>a.id===selected)) : shortSymbol(snapshot.assets.find(a=>a.id===selected)) + ' to ' + shortSymbol(otherAsset)) + ': ' + compact(value);
      html += '<g><path class="route-hit" data-route="' + esc(route.otherId) + '" d="' + d + '" role="button" tabindex="0" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title></path><path class="route-path' + (selectedRoute ? ' active' : '') + '" d="' + d + '" stroke="' + (incoming ? '#247c68' : '#b56b53') + '" stroke-width="' + (1 + 5 * value / max) + '" marker-end="url(#' + (incoming ? 'in-arrow' : 'out-arrow') + ')" pointer-events="none"/>';
      if (selectedRoute) html += '<text class="map-route-label" text-anchor="middle" x="' + ((from.x+to.x)/2+nx*(offset+6*direction)) + '" y="' + ((from.y+to.y)/2+ny*(offset+6*direction)) + '">' + compact(value) + '</text>';
      html += '</g>';
    }
  }
  svg.innerHTML = html;
  svg.querySelectorAll('[data-route]').forEach(el => {
    el.onclick = () => selectRoute(el.dataset.route);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRoute(el.dataset.route); } };
  });
}
function renderInspector(asset) {
  const routes = selectedRoute ? currentRoutes.filter(r => r.otherId === selectedRoute) : currentRoutes;
  const summary = summarizeRoutes(routes), pools = routes.flatMap(r => r.pools), totalPools = new Set(pools.map(p => p.id)).size;
  const symbol = esc(shortSymbol(asset));
  let html = '<div class="detail-top"><div class="coin-heading">' + icon(asset) + '<div><h2>' + symbol + '</h2><p>' + esc(asset.name) + '</p></div><span class="coin-rank">#' + asset.rank + '</span></div>' +
    '<div class="price-line"><strong>' + money(asset.price) + '</strong><span class="' + (asset.priceChange24h >= 0 ? 'up' : 'down') + '">' + pct(asset.priceChange24h) + ' · 24h</span></div><p class="price-source">Market-wide price · ' + (ageMinutes(asset.priceUpdatedAt) > 30 ? 'older quote · ' : '') + new Date(asset.priceUpdatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</p>';
  if (asset.kind === 'stable') html += '<div class="stable-detail"><span>Distance from $1</span><strong>' + (asset.price === null ? 'Unavailable' : pct((asset.price - 1)*100)) + '</strong></div>';
  html += '</div><div class="detail-trading">';
  if (!summary) {
    const reason = asset.coverage.pools ? 'A verified dollar breakdown is unavailable for the ' + timeframe[windowKey] + '. Try another timeframe.' : asset.coverage.reason;
    html += '<div class="empty-coverage"><div class="empty-icon" aria-hidden="true">◌</div><h3>Price available.<br>Flows still out of view.</h3><p>' + esc(reason) + '</p><p>Missing coverage doesn’t mean no trading. We haven’t estimated any arrows.</p><a href="https://www.coingecko.com/en/coins/' + encodeURIComponent(asset.id) + '" target="_blank" rel="noopener noreferrer">Explore ' + symbol + ' markets ↗</a></div>';
  } else {
    const share = summary.buyShare;
    const biggest = routes[0], other = snapshot.assets.find(a => a.id === biggest.otherId);
    html += '<div class="sample-heading"><strong>' + (selectedRoute ? 'SELECTED ROUTE' : 'SAMPLED SWAPS') + '</strong><span>' + timeframe[windowKey] + '</span></div>' +
      '<div class="balance-value ' + (summary.net >= 0 ? 'up' : 'down') + '">' + signed(summary.net) + '</div><p class="balance-caption">' + (summary.net > 0 ? 'more bought than sold' : summary.net < 0 ? 'more sold than bought' : 'buying and selling balanced') + '</p>' +
      '<div class="balance-bar" aria-label="' + (share === null ? 'No trades in this window' : Math.round(share * 100) + '% of sampled dollars bought ' + shortSymbol(asset)) + '"><div style="width:' + (share === null ? 50 : share * 100) + '%"></div></div>' +
      '<div class="balance-values"><div><span>Into ' + symbol + '</span><strong class="up">' + compact(summary.incoming) + '</strong></div><div><span>Out of ' + symbol + '</span><strong class="down">' + compact(summary.outgoing) + '</strong></div></div>' +
      '<div class="explanation"><div class="eyebrow">WHAT HAPPENED</div><p>' + (summary.total === 0 ? 'No swaps were reported in these sampled pools during the ' + timeframe[windowKey] + '.' : 'Of <strong>' + compact(summary.total) + '</strong> traded across ' + totalPools + ' sampled pool' + (totalPools===1?'':'s') + ', <strong>' + Math.round(share*100) + '%</strong> was into ' + symbol + '. ' + (!selectedRoute ? 'The busiest connection was ' + esc(shortSymbol(other)) + '.' : 'This view is focused on the ' + esc(shortSymbol(other)) + ' connection.')) + '</p><p class="context-note">The trades show activity. They don’t establish its cause.</p></div>';
  }
  html += '</div><div class="detail-routes">';
  if (currentRoutes.length) {
    html += '<div class="routes-title"><span>EXPLORE THE ROUTES</span>' + (selectedRoute ? '<button id="all-routes" class="text-button">Show all</button>' : '<span>Total traded</span>') + '</div>';
    html += currentRoutes.map(route => {
      const other = snapshot.assets.find(a => a.id === route.otherId);
      return '<button class="route-row" data-detail-route="' + esc(route.otherId) + '" aria-pressed="' + (selectedRoute===route.otherId) + '"><span class="route-coin">' + icon(other) + '<span>' + esc(shortSymbol(other)) + ' <small>' + route.pools.length + ' pool' + (route.pools.length===1?'':'s') + '</small></span></span><strong>' + compact(route.total) + '</strong><span class="chevron" aria-hidden="true">↗</span></button>';
    }).join('');
    const unique = [...new Map(pools.map(p => [p.id,p])).values()];
    html += '<details class="pool-sources"' + (selectedRoute ? ' open' : '') + '><summary>Evidence · ' + unique.length + ' pools checked</summary>' + unique.map(p => '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.name) + ' ↗<small>' + esc(networkName(p.network)) + ' · ' + esc(p.dex.replaceAll('_',' ')) + ' · checked ' + new Date(p.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</small></a>').join('') + '</details>';
    html += '<p class="scope-note">Selected DEX pools only. Includes native wrapped forms where applicable. Net buying is not new capital; swaps may include arbitrage and routing legs.</p>';
  }
  if (asset.kind === 'stable' && asset.supplyChange24h !== null) html += '<div class="stable-detail"><span>Circulating value · 24h</span><strong>' + pct(asset.supplyChange24h) + '</strong></div><p class="scope-note">DefiLlama circulating value in USD. Supply and price can both affect this figure; it does not measure purchases.</p>';
  html += '</div>';
  $('#inspector').innerHTML = html;
  $('#mobile-summary').innerHTML = '<span><strong>' + symbol + '</strong><small>' + (summary ? signed(summary.net) + ' sampled net buying' : 'Price only · flows unavailable') + '</small></span><span>Details ↓</span>';
  $('#inspector').querySelectorAll('[data-detail-route]').forEach(el => el.onclick = () => selectRoute(el.dataset.detailRoute));
  if ($('#all-routes')) $('#all-routes').onclick = () => { selectedRoute = null; render(); saveState(); };
}
function renderPriceBars() {
  const assets = snapshot.assets.filter(a => a.kind === 'alt'), max = Math.max(1,...assets.map(a=>Math.abs(a.priceChange24h ?? 0)));
  $('#price-bars').innerHTML = assets.map(a => '<button class="price-item" data-price-coin="' + esc(a.id) + '" aria-label="Select ' + esc(a.name) + ', price ' + pct(a.priceChange24h) + ' in 24 hours"><span class="price-item-top"><strong>' + esc(shortSymbol(a)) + '</strong><span class="' + (a.priceChange24h>=0?'up':'down') + '">' + pct(a.priceChange24h) + '</span></span><span class="price-track ' + (a.priceChange24h<0?'negative':'') + '"><span style="width:' + (Math.abs(a.priceChange24h??0)/max*100) + '%"></span></span></button>').join('');
  $('#price-bars').querySelectorAll('[data-price-coin]').forEach(el => el.onclick=()=>{selectCoin(el.dataset.priceCoin); $('#inspector').scrollIntoView({behavior:'smooth',block:'nearest'});});
}
function render() {
  if (!snapshot) return;
  const focused = document.activeElement;
  const focusSelector = focused?.id ? '#' + CSS.escape(focused.id) : focused?.dataset.coin ? '[data-coin="' + CSS.escape(focused.dataset.coin) + '"]' : focused?.dataset.detailRoute ? '[data-detail-route="' + CSS.escape(focused.dataset.detailRoute) + '"]' : focused?.dataset.route ? '[data-route="' + CSS.escape(focused.dataset.route) + '"]' : null;
  if (!snapshot.assets.some(a => a.id===selected)) { selected = snapshot.assets[0].id; selectedRoute = null; }
  currentRoutes = routesForAsset(snapshot, selected, windowKey);
  if (selectedRoute && !currentRoutes.some(r=>r.otherId===selectedRoute)) selectedRoute=null;
  const asset = snapshot.assets.find(a=>a.id===selected);
  renderOverview(); renderMap(asset); renderInspector(asset); renderPriceBars(); freshness(); renderNotice();
  $('#mobile-summary').hidden = !mapInView;
  if (focusSelector) requestAnimationFrame(() => document.querySelector(focusSelector)?.focus({ preventScroll: true }));
}
function openMethod() {
  $('#method-content').innerHTML = '<p class="method-intro">Each circle is a coin. Select one to see recorded swaps involving other coins in this view. Green arrows point into your selection; terracotta arrows point out. All circles are the same size.</p>' +
    '<div class="method-grid"><article><h3>A trading sample</h3><p>We check selected decentralized exchange pools. Centralized exchanges, other tokens and untracked pools are outside this picture. A missing line means no covered route, not no trading.</p></article><article><h3>Activity, with a boundary</h3><p>Amounts are gross swap dollars. Net is buying minus selling from the trader’s perspective. It is not fresh money entering crypto, a price prediction, or proof of investor intent.</p></article><article><h3>Automatic rankings</h3><p>Ten non-stable assets by CoinGecko market cap, plus five USD-pegged stablecoins identified by DefiLlama. BTC and known wrapped/staked/bridged duplicates are excluded from the ten. Other asset types, including tokenized assets, remain eligible.</p></article><article><h3>Freshness you can see</h3><p>The shared collector targets a 15-minute refresh on GitHub Pages. Scheduled runs can be delayed. Local preview checks about every five minutes. Times show retrieval, not guaranteed upstream freshness. An old snapshot is labeled.</p></article></div>' +
    (snapshot ? '<h2>Coverage in this snapshot</h2><table class="coverage-table"><thead><tr><th>Asset</th><th>Market rank</th><th>Trading sample</th><th>Networks</th></tr></thead><tbody>' + snapshot.assets.map(a => '<tr><td>' + esc(a.name) + '</td><td>#' + a.rank + '</td><td>' + (a.coverage.pools ? a.coverage.pools + ' pools' : 'Price only') + '</td><td>' + esc(a.coverage.networks.map(networkName).join(', ') || '—') + '</td></tr>').join('') + '</tbody></table><p class="method-foot">' + esc(snapshot.policy.poolSample) + ' Native wrapped ETH, SOL, BNB, TRX and HYPE can be mapped to their underlying coins on their native network; bridged lookalikes are not silently substituted. Stablecoin circulating value is measured in USD and can change with its price.<br><br>Rankings retrieved ' + new Date(snapshot.rankingCheckedAt).toLocaleString() + '. Pool checks completed ' + new Date(snapshot.checkedAt).toLocaleString() + '.<br>Sources: ' + snapshot.sources.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + '</a> (' + esc(s.use) + ')').join(' · ') + '.</p>' : '<p>Coverage details appear once a snapshot is available.</p>');
  $('#method-dialog').showModal();
}
['#about-button','#coverage-button','#footer-method'].forEach(id=>$(id).onclick=openMethod);
$('#close-method').onclick=()=>$('#method-dialog').close();
$('#method-dialog').onclick=e=>{if(e.target===$('#method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
document.querySelectorAll('[data-window]').forEach(button=>button.onclick=()=>{windowKey=button.dataset.window;render();saveState();});
$('#btc-toggle').onclick=()=>{btc=!btc;render();saveState();};
$('#share-button').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast('View link copied');}catch{$('#share-url').value=location.href;$('#share-dialog').showModal();$('#share-url').select();}};
$('#close-share').onclick=()=>$('#share-dialog').close();
$('#mobile-summary').onclick=()=>{ $('#inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}); $('#inspector').focus({preventScroll:true}); };
new IntersectionObserver(entries=>{ mapInView=entries[0].isIntersecting; $('#mobile-summary').hidden=!snapshot || !mapInView; },{threshold:0.1}).observe($('#map'));
window.addEventListener('popstate',()=>{readState();render();});
new ResizeObserver(()=>requestAnimationFrame(drawConnections)).observe($('#map'));
readState();loadData();
setInterval(()=>{if(!document.hidden)loadData();},60_000);
setInterval(()=>{freshness();if(snapshot)renderNotice();},30_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadData();});
