import { scopedPools, studyPools, sourceEndpoint, identifierKind, auditArithmetic } from './lib/research.js';
import { ageMinutes } from './lib/model.js';
import { poolURL, viewHealth } from './lib/quality.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const dollars = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(value) : '—';
const percent = value => Number.isFinite(value) ? (value * 100).toFixed(1) + '%' : '—';
const net = value => (value > 0 ? '+' : value < 0 ? '−' : '') + dollars(Math.abs(value));
const networkName = n => ({eth:'Ethereum',bsc:'BNB Chain',solana:'Solana',tron:'TRON',hyperevm:'HyperEVM',arbitrum:'Arbitrum',base:'Base'})[n] ?? n;
const age = time => {const n=ageMinutes(time);return !Number.isFinite(n)?'unknown':n<1?'under 1m':Math.floor(n)+'m';};
const tilt = summary => !summary || summary.buyShare===null ? 'No measured trades' : percent(summary.buyShare)+' buys · '+net(summary.net)+' imbalance';
let panel = 'activity';
let latest;


export function renderResearch(context) {
  latest = context;
  const {snapshot,selected,windowKey,network,selectedRoute} = context;
  const asset = snapshot.assets.find(a=>a.id===selected);
  const pools = scopedPools(snapshot,selected,network,selectedRoute);
  const study = studyPools(pools,selected,windowKey);
  const host = document.querySelector('#research');
  const focus = host.contains(document.activeElement) ? document.activeElement?.id : null;
  const other = snapshot.assets.find(a=>a.id===selectedRoute);
  const title = asset.symbol + (other ? ' / '+other.symbol : '');
  const audit = auditArithmetic(pools,selected,windowKey);
  const health = viewHealth(snapshot,pools);
  const oldest = health.oldest;
  let html = '<div class="research-header"><div><div class="eyebrow">GO ONE LAYER DEEPER</div><h2>'+esc(title)+' <span>under the lens</span></h2></div><div class="research-tabs" role="tablist" aria-label="Research perspective">'+[['activity','Read the activity'],['pools','Inspect pools'],['evidence','Verify the numbers']].map(([id,label])=>'<button id="research-tab-'+id+'" role="tab" aria-selected="'+(panel===id)+'" aria-controls="research-content" tabindex="'+(panel===id?'0':'-1')+'" data-research-tab="'+id+'">'+label+'</button>').join('')+'</div></div>';
  html += '<div class="research-scope"><span>'+esc(network==='all'?'All sampled networks':networkName(network))+' · '+windowKey.slice(1)+'h view'+(selectedRoute?' · selected route':'')+'</span><span>'+study.rows.length+' / '+study.poolCount+' pools have this window · market-wide coverage unknown</span></div>';
  html += '<div id="research-content" role="tabpanel" aria-labelledby="research-tab-'+panel+'" tabindex="0">';
  if (panel==='activity') {
    if (!study.summary) html += '<div class="research-empty"><h3>No activity to analyse in this view.</h3><p>Prices alone cannot establish flows. Choose another coin or network to inspect measured swaps.</p></div>';
    else {
      const pace = study.pace, max = Math.max(1,pace.lastHour,pace.precedingHourly);
      html += '<div class="research-metrics"><article><div class="metric-label">ACTIVITY PACE · LAST HOUR</div><strong>'+(pace.ratio===null?'No baseline':pace.ratio.toFixed(2)+'×')+'</strong><div class="pace-bars"><div><span>Last hour</span><i style="width:'+pace.lastHour/max*100+'%"></i><b>'+dollars(pace.lastHour)+'</b></div><div><span>Previous 5h / hour</span><i style="width:'+pace.precedingHourly/max*100+'%"></i><b>'+dollars(pace.precedingHourly)+'</b></div></div><p>'+pace.pools+' comparable pools. Same pools; disjoint periods. A pace comparison, not a forecast.</p></article>';
      html += '<article><div class="metric-label">LARGEST POOL’S VOLUME SHARE</div><strong>'+percent(study.largestShare)+'</strong><div class="concentration-track"><i style="width:'+Math.max(0,(study.largestShare??0)*100)+'%"></i></div><p>'+esc(study.largest.pool.name)+'<br>'+esc(networkName(study.largest.pool.network))+' · '+esc(study.largest.pool.dex)+'</p></article>';
      html += '<article><div class="metric-label">REPORTED POOL LIQUIDITY</div><strong>'+dollars(study.liquidity)+'</strong><p>Across '+study.rows.length+' unique pools in this view.</p><p>Total pool value does not tell you executable depth, slippage, or whether a contract is safe.</p></article></div>';
      const flipped = study.withoutLargest && Math.sign(study.summary.net)!==Math.sign(study.withoutLargest.net) && study.summary.net!==0 && study.withoutLargest.net!==0;
      html += '<div class="sensitivity"><div><h3>Does one pool change the story?</h3><p>Compare this sample with its largest-volume pool removed.</p></div><div><span>All included pools</span><strong>'+tilt(study.summary)+'</strong></div><div><span>Without the largest pool</span><strong>'+tilt(study.withoutLargest)+'</strong></div>'+(flipped?'<div class="sensitivity-alert">The direction flips. This result depends heavily on one pool.</div>':'')+'</div>';
      html += '<div class="evidence-boundary"><b>Observed:</b> '+percent(study.summary.buyShare)+' of sampled swap dollars bought '+esc(asset.symbol)+'. <b>Unresolved:</b> arbitrage, routing, wash trading and trader intent. These aggregates cannot separate them or explain price causality.</div>';
    }
  } else if (panel==='pools') {
    html += '<p class="research-intro">Inspect each market behind the map. Identity comes from provider network/address records; deployment, bytecode, proxy permissions and oracle safety have not been audited.</p>';
    if (!study.rows.length) html += '<p class="research-empty">No covered pool in this selection. No contract or pool identity has been guessed.</p>';
    html += '<div class="pool-cards">'+study.rows.map(({pool:p,incoming,outgoing,total}) => '<article class="pool-card"><div class="pool-card-top"><div><h3>'+esc(p.name)+'</h3><p>'+esc(networkName(p.network))+' · '+esc(p.dex)+'</p></div><a href="'+esc(poolURL(p))+'" target="_blank" rel="noopener noreferrer">View market ↗</a></div><div class="pool-stat-row"><span>Into '+esc(asset.symbol)+'<b>'+dollars(incoming)+'</b></span><span>Out of '+esc(asset.symbol)+'<b>'+dollars(outgoing)+'</b></span><span>Pool liquidity<b>'+dollars(p.liquidity)+'</b></span><span>Volume share<b>'+percent(study.summary.total ? total/study.summary.total : null)+'</b></span></div><details><summary>Identifiers & recorded inputs</summary><div class="identity-field"><label>'+identifierKind(p)+'</label><code>'+esc(p.address)+'</code><button data-copy-id="'+esc(p.address)+'">Copy</button></div>'+[['Base',p.baseRepresentation,p.baseTokenAddress],['Quote',p.quoteRepresentation,p.quoteTokenAddress]].map(([side,name,address])=>'<div class="identity-field"><label>'+side+' · '+esc(name)+'</label><code>'+esc(address??'Not recorded in this older snapshot')+'</code>'+(address?'<button data-copy-id="'+esc(address)+'">Copy</button>':'')+'</div>').join('')+'<p class="identity-note">'+(p.wrapped?'Native wrapped representation is used. ':'')+'Buying is defined relative to the provider’s base token; quote selection reverses directions.</p><a href="'+esc(sourceEndpoint(p))+'" target="_blank" rel="noopener noreferrer">Open current provider response ↗</a><p class="identity-note">Recorded '+esc(new Date(p.checkedAt).toLocaleString())+'. A new provider request may return changed values.</p></details></article>').join('')+'</div>';
  } else {
    html += '<div class="trust-path"><span><small>1 · SOURCE</small><b>Provider aggregates</b><em>One flow indexer</em></span><i>→</i><span><small>2 · CALCULATION</small><b>Recorded inputs</b><em>Reproducible sums</em></span><i>→</i><span><small>3 · CHAIN PROOF</small><b>Not independently verified</b><em>No receipts or signatures</em></span></div>';
    html += '<div class="verification-grid"><article><h3>Check the calculation</h3><p>Rebuild the selected buy/sell totals from the provider fields recorded with each pool. Check token direction and input consistency.</p><button class="button-light" id="reproduce-view" '+(!study.rows.length?'disabled':'')+'>Reproduce this view</button><p id="audit-result" role="status" class="audit-result">'+(audit.status==='missing-inputs'?'This older snapshot has no recorded source inputs for some pools. Wait for a refreshed dataset.':'Ready to check '+study.rows.length+' pools.')+'</p></article><article><h3>Follow the evidence</h3><p>Open “Inspect pools” for exact network and token identifiers, recorded check times, and links to the provider. Independent chain verification is not available.</p><p>Reproducing a calculation checks consistency, not whether the source is correct.</p></article></div>';
    html += '<dl class="trust-facts"><div><dt>Pool retrieval age, oldest in view</dt><dd>'+ (oldest!==null?age(new Date(oldest).toISOString()):'Not available')+'</dd></div><div><dt>Selected market price age</dt><dd>'+age(asset.priceUpdatedAt)+'</dd></div><div><dt>Time between first and last pool checks</dt><dd>'+(health.spreadMinutes===null?'Not available':health.spreadMinutes.toFixed(1)+'m · retrieval times, not synchronized blocks')+'</dd></div><div><dt>Flow source diversity</dt><dd>GeckoTerminal only. CoinGecko is not an independent confirmation.</dd></div><div><dt>Not established</dt><dd>Block inclusion, finality, source authenticity, complete coverage, or economic intent.</dd></div></dl>';
  }
  html += '</div><div id="research-status" class="sr-only" role="status"></div>';
  host.innerHTML = html;
  host.querySelectorAll('[data-research-tab]').forEach((button,index,buttons)=>{
    button.onclick=()=>{panel=button.dataset.researchTab;renderResearch(latest);document.querySelector('#research-tab-'+panel).focus({preventScroll:true});};
    button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[i].click();}};
  });
  host.querySelectorAll('[data-copy-id]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(button.dataset.copyId);button.textContent='Copied';}catch{document.querySelector('#research-status').textContent='Clipboard unavailable; select and copy the displayed identifier.';}});
  const reproduce=host.querySelector('#reproduce-view');
  if(reproduce)reproduce.onclick=()=>{
    const a=auditArithmetic(pools,selected,windowKey);
    const text=a.status==='reproduced'?'Reproduced '+a.checked+'/'+a.expected+' pools. Into '+dollars(a.incoming)+' · out '+dollars(a.outgoing)+' · imbalance '+net(a.net)+'. This checks arithmetic, not the blockchain.':a.status==='mismatch'?'Mismatch in '+a.errors.length+' pools. Do not rely on these totals.':a.status==='missing-inputs'?'Cannot fully reproduce: '+a.missing.length+' pools lack recorded inputs.':'No pool data to check.';
    host.querySelector('#audit-result').textContent=text;
  };
  if(focus)document.getElementById(focus)?.focus({preventScroll:true});
}
