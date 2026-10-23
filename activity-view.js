import { activityRecords, compareActivity, activityHighlights, hourlyActivity } from './lib/activity.js';
import { summarizeRoutes, ageMinutes } from './lib/model.js';
import { venueName, marketURL } from './lib/exchanges.js';
import { poolURL } from './lib/quality.js';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const symbol=a=>a.symbol==='FIGR_HELOC'?'FIGR':a.symbol;
const percent=n=>n===null||!Number.isFinite(n)?'—':(n*100).toFixed(1)+'%';
const change=n=>n===null?'—':(n>0?'+':'')+n.toFixed(2)+'%';
const numeric=n=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n);
const amount=(n,source,unit=true)=>!Number.isFinite(n)?'—':source==='exchange'?numeric(n)+(unit?' USDT':''):'$'+numeric(n);
const money=n=>n===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:n<1?4:2}).format(n);
const icon=a=>{let src='./favicon.svg';try{const u=new URL(a.image);if(u.protocol==='https:'&&/(^|\.)coingecko\.com$/.test(u.hostname))src=u.href;}catch{}return '<img src="'+esc(src)+'" width="28" height="28" alt="">';};
const clock=n=>new Date(n).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const sourceName=(source,records)=>!records.length?'Price only':source==='exchange'?[...new Set(records.map(m=>venueName(m.venue)))].join(' + '):'On-chain pools';
const countLabel=(n,source)=>n+' '+(source==='exchange'?'market':'pool')+(n===1?'':'s');
const tone=c=>c.ratio===null?'quiet':c.ratio>=1.5?'accelerating':c.ratio<=2/3?'cooling':'steady';
const paceText=c=>!c.count?'No comparison':!c.synchronized?'Windows differ':!c.fresh?'Older sample':c.ratio===null?'No baseline':c.ratio.toFixed(2)+'× pace';

function comparisonBars(c,source,small=false) {
  const max=Math.max(1,c.baseline,c.current);
  return '<div class="compare-bars '+(small?'compact-comparison':'')+'" role="img" aria-label="Previous five hours averaged '+amount(c.baseline,source)+' per hour; last hour '+amount(c.current,source)+'"><div><span>Previous 5h / hour</span><i><b style="--bar:'+c.baseline/max*100+'%"></b></i><strong>'+amount(c.baseline,source)+'</strong></div><div><span>Last hour</span><i><b style="--bar:'+c.current/max*100+'%"></b></i><strong>'+amount(c.current,source)+'</strong></div></div>';
}
function balanceCompare(c) {
  if(c.share===null||c.priorShare===null)return '<p class="small-note">Buying-share comparison unavailable in a zero-volume period.</p>';
  return '<div class="share-compare" role="img" aria-label="Buying share moved from '+percent(c.priorShare)+' to '+percent(c.share)+'"><div><span>Previous 5h <b>'+percent(c.priorShare)+'</b></span><span>Last hour <b>'+percent(c.share)+'</b></span></div><div class="share-track"><i class="share-mid"></i><i class="share-connection" style="left:'+Math.min(c.share,c.priorShare)*100+'%;width:'+Math.abs(c.share-c.priorShare)*100+'%"></i><i class="share-before" style="left:'+c.priorShare*100+'%"></i><i class="share-now" style="left:'+c.share*100+'%"></i></div><div class="share-scale"><span>0% buying</span><span>50%</span><span>100%</span></div></div>';
}

export function renderChanges(context) {
  const {snapshot,source,network,selected,windowKey,onHighlight,offline}=context;
  const items=activityHighlights(snapshot,{source,network,offline});
  const comparable=snapshot.assets.filter(a=>a.kind==='alt').some(a=>{const c=compareActivity(activityRecords(snapshot,a.id,source,network).records,a.id);return c.fresh&&c.complete&&c.synchronized&&c.ratio!==null&&c.baseline>=10000;});
  $('#comparison-scope').textContent=(source==='auto'?'Automatic source':source==='dex'?'On-chain only':'Exchange only')+(source==='exchange'?'':network==='all'?' · all networks':' · '+network+' network');
  $('#changes-status').textContent=offline?'Showing saved data':ageMinutes(snapshot.checkedAt)>30?'Waiting for a fresh sample':items.length?'Select a change to explore':comparable?'No qualifying changes in this sample':'No eligible comparisons in this scope';
  $('#changes-grid').innerHTML=items.length?items.map((h,i)=>{
    const a=snapshot.assets.find(a=>a.id===h.assetId),c=h.comparison;
    const title=h.type==='pace'?(h.direction==='up'?'Trading picked up':'Trading cooled down'):(h.direction==='up'?'Buying share grew':'Buying share fell');
    const value=h.type==='pace'?c.ratio.toFixed(2)+'×':(c.shareChange>0?'+':'')+c.shareChange.toFixed(1)+'<small> points</small>';
    return '<button class="change-card '+tone(c)+(selected===a.id&&windowKey==='h1'?' is-selected':'')+'" data-highlight="'+esc(a.id)+'" style="--order:'+i+'" aria-label="'+esc(symbol(a)+' — '+title)+'. '+(h.type==='pace'?c.ratio.toFixed(2)+' times the previous pace':Math.abs(c.shareChange).toFixed(1)+' percentage points '+(h.direction==='up'?'higher':'lower'))+'. Select its last-hour activity."><span class="change-card-top"><span class="asset-mark">'+icon(a)+'<b>'+esc(symbol(a))+'</b></span><span class="change-arrow" aria-hidden="true">'+(h.direction==='up'?'↗':'↘')+'</span></span><span class="change-title">'+title+'</span><strong class="change-value">'+value+'</strong><span class="change-description">'+(h.type==='pace'?'last hour / previous hourly average':'change in buying share')+'</span>'+(h.type==='pace'?comparisonBars(c,h.source,true):balanceCompare(c))+'<span class="change-card-foot">'+esc(sourceName(h.source,c.records))+' · '+countLabel(c.count,h.source)+'<b aria-hidden="true">↗</b></span></button>';
  }).join(''):'<div class="changes-empty"><span aria-hidden="true">◎</span><div><strong>'+((offline||ageMinutes(snapshot.checkedAt)>30)?'Fresh comparisons will appear with the next successful update.':comparable?'A quieter picture is still a picture.':'A fresh, complete comparison is unavailable here.')+'</strong><p>Highlights need a fresh, complete comparison and a meaningful measured change. Explore any coin below.</p></div></div>';
  $('#changes-grid').querySelectorAll('[data-highlight]').forEach(b=>b.onclick=()=>onHighlight(b.dataset.highlight));
}

export function renderCoinPicker({snapshot,selected,source,network,onCoin}) {
  $('#alt-picker').innerHTML=snapshot.assets.filter(a=>a.kind==='alt').map(a=>{
    const scope=activityRecords(snapshot,a.id,source,network), c=compareActivity(scope.records,a.id);
    const s=scope.source==='exchange'?'Exchange':'On-chain';
    const max=Math.max(1,c.current,c.baseline);
    return '<button class="asset-tile '+tone(c)+'" data-coin="'+esc(a.id)+'" aria-pressed="'+(a.id===selected)+'" aria-label="Select '+esc(a.name)+'. '+paceText(c)+'. Price '+change(a.priceChange24h)+' in 24 hours."><span class="tile-top">'+icon(a)+'<b>'+esc(symbol(a))+'</b><small class="tile-rank">#'+a.rank+'</small></span><span class="tile-pace">'+esc(paceText(c))+'</span><span class="tile-activity" aria-hidden="true"><i style="width:'+c.baseline/max*100+'%"></i><i style="width:'+c.current/max*100+'%"></i></span><span class="tile-foot"><span>'+ (scope.records.length?s:'Price only')+'</span><span class="'+(a.priceChange24h>=0?'up':'down')+'">'+change(a.priceChange24h)+'</span></span></button>';
  }).join('');
  $('#stable-picker').innerHTML=snapshot.assets.filter(a=>a.kind==='stable').map(a=>'<button class="stable-tile" data-coin="'+esc(a.id)+'" aria-pressed="'+(a.id===selected)+'" aria-label="Select '+esc(a.name)+'. Price '+money(a.price)+'. Dollar target is not a safety rating.">'+icon(a)+'<span><b>'+esc(symbol(a))+'</b><small>Dollar target</small></span><strong>'+money(a.price)+'</strong></button>').join('');
  document.querySelectorAll('#coin-picker [data-coin]').forEach(b=>b.onclick=()=>onCoin(b.dataset.coin));
}

export function renderTradeMap(context) {
  const {snapshot,selected,selectedRoute,currentRoutes,windowKey,activeSource,onRoute,onDetails}=context;
  const asset=snapshot.assets.find(a=>a.id===selected), routes=selectedRoute?currentRoutes.filter(r=>r.otherId===selectedRoute):currentRoutes.slice(0,3);
  const focused=selectedRoute?routes:currentRoutes, total=summarizeRoutes(focused),buy=total?.buyShare??null;
  $('#map-title').textContent=symbol(asset)+' trading, in view';
  $('#buy-label').textContent='Buying '+symbol(asset);$('#sell-label').textContent='Selling '+symbol(asset);
  $('#map-unit').textContent=activeSource==='exchange'?'Amounts in USDT':'Amounts in USD';
  let html='<button class="trade-hub" id="trade-hub" aria-label="Open details for '+esc(asset.name)+'" style="--buy-share:'+(buy===null?50:buy*100)+'%;"><span class="hub-ring '+(buy===null?'no-volume':'')+'"><span>'+icon(asset)+'<strong>'+esc(symbol(asset))+'</strong></span></span><b>'+(buy===null?'No measured trades':percent(buy)+' buying')+'</b><small>'+(total?countLabel(new Set(focused.flatMap(r=>r.pools.map(p=>p.id))).size,activeSource)+(!selectedRoute&&currentRoutes.length>3?' · all '+currentRoutes.length+' routes':''):'Price available')+'</small></button>';
  for(const [i,r] of routes.entries()) {
    const a=snapshot.assets.find(a=>a.id===r.otherId),y=routes.length===1?50:routes.length===2?29+i*42:19+i*31;
    for(const side of ['buy','sell']) {
      const n=side==='buy'?r.incoming:r.outgoing;
      html+='<button class="trade-end '+side+'" data-pair="'+esc(r.otherId)+'" data-side="'+side+'" style="top:'+y+'%" aria-pressed="'+(selectedRoute===r.otherId)+'" aria-label="'+esc(symbol(a))+' route: '+amount(n,activeSource)+' '+(side==='buy'?'buying ':'selling ')+esc(symbol(asset))+'"><span>'+icon(a)+'<b>'+esc(symbol(a))+'</b></span><strong>'+amount(n,activeSource,false)+'</strong><small>'+ (n===0?'No trades reported':side==='buy'?'spent to buy':'received on sale')+'</small></button>';
    }
  }
  if(!routes.length)html+='<div class="map-no-data"><span>◌</span><strong>No covered route</strong><p>Missing coverage does not mean no trading.</p></div>';
  $('#nodes').innerHTML=html;$('#loading').hidden=true;
  $('#trade-hub').onclick=onDetails;
  $('#nodes').querySelectorAll('[data-pair]').forEach(b=>{
    b.onclick=()=>onRoute(b.dataset.pair);
    const highlight=on=>{document.querySelectorAll('#connections [data-line]').forEach(p=>{p.classList.toggle('route-dim',on&&p.dataset.line!==b.dataset.pair);p.classList.toggle('route-bright',on&&p.dataset.line===b.dataset.pair);});};
    b.onpointerenter=()=>highlight(true);b.onpointerleave=()=>highlight(false);b.onfocus=()=>highlight(true);b.onblur=()=>highlight(false);
  });
  $('#route-count').textContent=routes.length?'Showing '+routes.length+' of '+currentRoutes.length+' routes · '+windowKey.slice(1)+'h sample':'No routes in this selection';
  $('#map-summary').innerHTML=total&&buy!==null?'<span class="buy-summary"><i></i><b>'+percent(buy)+'</b> buying '+esc(symbol(asset))+'</span><span class="sell-summary"><i></i><b>'+percent(1-buy)+'</b> selling '+esc(symbol(asset))+'</span>':'<span>Choose another source or coin to explore covered activity.</span>';
}

export function drawTradeRoutes({currentRoutes,selectedRoute}) {
  const map=$('#map'),svg=$('#connections'),bounds=map.getBoundingClientRect(),hub=$('#trade-hub .hub-ring');
  if(!hub)return;
  const h=hub.getBoundingClientRect(),center={x:h.left-bounds.left+h.width/2,y:h.top-bounds.top+h.height/2,r:h.width/2+3};
  svg.setAttribute('viewBox','0 0 '+bounds.width+' '+bounds.height);
  const routes=selectedRoute?currentRoutes.filter(r=>r.otherId===selectedRoute):currentRoutes.slice(0,3),max=Math.max(1,...routes.flatMap(r=>[r.incoming,r.outgoing]));
  let html='<defs><marker id="buy-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3.5 L0,7 Z" fill="#187b69"/></marker><marker id="sell-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3.5 L0,7 Z" fill="#b26743"/></marker></defs>';
  for(const r of routes)for(const side of ['buy','sell']) {
    const value=side==='buy'?r.incoming:r.outgoing;if(value<=0)continue;
    const node=[...$('#nodes').querySelectorAll('[data-pair]')].find(n=>n.dataset.pair===r.otherId&&n.dataset.side===side);
    if(!node)continue;const b=node.getBoundingClientRect(),left=side==='buy';
    const a=left?{x:b.right-bounds.left+3,y:b.top-bounds.top+b.height/2}:{x:center.x+center.r,y:center.y};
    const z=left?{x:center.x-center.r,y:center.y}:{x:b.left-bounds.left-3,y:b.top-bounds.top+b.height/2};
    const middle=(a.x+z.x)/2,d='M'+a.x+','+a.y+' C'+middle+','+a.y+' '+middle+','+z.y+' '+z.x+','+z.y;
    const width=1.5+5.5*value/max;
    html+='<g data-line="'+esc(r.otherId)+'" class="trade-line '+side+'"><path class="trade-stroke" d="'+d+'" stroke-width="'+width+'" marker-end="url(#'+side+'-arrow)"/><path class="route-motion" d="'+d+'" stroke-width="'+Math.min(width,2.5)+'"/></g>';
  }
  svg.innerHTML=html;
}

export function renderFocusCard(context) {
  const {snapshot,selected,selectedRoute,currentRoutes,windowKey,activeSource,network,onRoute,onAll,onResearch}=context;
  const asset=snapshot.assets.find(a=>a.id===selected),scope=activityRecords(snapshot,selected,activeSource,network,windowKey,selectedRoute);
  const c=compareActivity(scope.records,selected),routes=selectedRoute?currentRoutes.filter(r=>r.otherId===selectedRoute):currentRoutes;
  const totals=summarizeRoutes(routes),records=routes.flatMap(r=>r.pools),timeline=hourlyActivity(scope.records,selected),unit=activeSource==='exchange'?'USDT':'USD';
  let html='<div class="focus-heading"><span class="asset-mark">'+icon(asset)+'<span><h2>'+esc(symbol(asset))+'</h2><small>'+esc(asset.name)+'</small></span></span><span class="source-pill">'+esc(sourceName(activeSource,scope.records)||'No sample')+'</span></div><div class="focus-price"><strong>'+money(asset.price)+'</strong><span class="'+(asset.priceChange24h>=0?'up':'down')+'">'+change(asset.priceChange24h)+'<small> price · 24h</small></span></div>';
  if(asset.kind==='stable')html+='<div class="peg-note"><span>Distance from $1</span><b>'+change(asset.price===null?null:(asset.price-1)*100)+'</b></div><p class="small-note">A dollar target is not a safety rating.</p>';
  if(c.count&&c.synchronized) {
    html+='<div class="focus-comparison '+tone(c)+'"><div class="eyebrow">IS ACTIVITY CHANGING?</div><div class="pace-result"><strong>'+(c.ratio===null?'—':c.ratio.toFixed(2)+'<small>×</small>')+'</strong><span>'+(c.ratio===null?'No nonzero baseline':c.ratio>=1?'the previous pace':'of the previous pace')+'<small>Last hour vs previous 5h / hour</small></span></div>'+comparisonBars(c,activeSource)+'<p class="cohort-note">Same '+countLabel(c.count,activeSource)+(c.complete?'':' · '+(c.available-c.count)+' excluded from comparison')+(c.fresh?'':' · older data')+'</p></div>';
    html+='<div class="focus-share"><div class="eyebrow">DID BUYING SHARE CHANGE?</div>'+balanceCompare(c)+'</div>';
  }else html+='<div class="focus-empty"><strong>'+ (scope.records.length?'A comparable history is unavailable.':'Price available. Activity out of view.')+'</strong><p>'+ (scope.records.length?'The source windows cannot support this comparison.':'Try another source or coin. We do not estimate missing trades.')+'</p></div>';
  if(totals)html+='<div class="focus-observation"><span aria-hidden="true">↗</span><p><b>'+amount(totals.total,activeSource)+'</b> traded in the '+windowKey.slice(1)+'h sample. '+(totals.buyShare===null?'No trades were reported.':'<b>'+percent(totals.buyShare)+'</b> bought '+esc(symbol(asset))+'.')+'<small>Trade direction alone does not explain a price move.</small></p></div>';
  if(timeline) {
    const max=Math.max(1,...timeline.map(b=>b.total));
    html+='<div class="timeline-block"><div class="timeline-title"><span>24h of reported trades</span><small>Hourly · '+unit+'</small></div><div class="hourly-chart" aria-label="Hourly trading volume for the last 24 hours">'+timeline.map((b,i)=>'<button class="hour-bar" data-hour="'+i+'" style="--volume:'+b.total/max*100+'%;--order:'+i+'" aria-label="'+esc(clock(b.start)+' to '+clock(b.end)+': '+amount(b.total,activeSource))+'"><span></span></button>').join('')+'</div><div class="timeline-axis"><span>'+clock(timeline[0].start)+' · '+new Date(timeline[0].start).toLocaleDateString([],{month:'short',day:'numeric'})+'</span><span>'+clock(timeline.at(-1).end)+'</span></div><p id="hour-detail" class="small-note" aria-live="polite">Hover or focus a bar to inspect that hour.</p></div>';
  }
  html+='<details class="focus-evidence"'+(selectedRoute?' open':'')+'><summary>Sources & routes <span>'+countLabel(records.length,activeSource)+'</span></summary><div class="focus-routes">'+currentRoutes.map(r=>{const a=snapshot.assets.find(a=>a.id===r.otherId);return '<button data-focus-route="'+esc(r.otherId)+'" aria-pressed="'+(selectedRoute===r.otherId)+'">'+icon(a)+'<b>'+esc(symbol(a))+'</b><span>'+amount(r.total,activeSource)+'</span></button>';}).join('')+(selectedRoute?'<button class="text-button" id="all-routes">Show all routes</button>':'')+'</div>'+records.map(p=>'<a href="'+esc(activeSource==='exchange'?marketURL(p):poolURL(p))+'" target="_blank" rel="noopener noreferrer">'+esc(activeSource==='exchange'?venueName(p.venue)+' · '+p.name:p.name)+' ↗</a>').join('')+'<p class="small-note">Price updated '+clock(asset.priceUpdatedAt)+'. '+(activeSource==='exchange'&&records.length?'Trading window ends '+clock(Math.min(...records.map(m=>m.periodEnd)))+'.':'Pool windows roll at the provider.')+' Amounts in '+unit+'. Coverage is a selected sample.</p>'+(asset.kind==='stable'&&Number.isFinite(asset.supplyChange24h)?'<p class="small-note">Circulating value · 24h: '+change(asset.supplyChange24h)+'. DefiLlama USD value; price and supply both affect it. This does not measure purchases.</p>':'')+(records.some(m=>m.venue==='binance')?'<p class="small-note">Binance-derived figures: <a href="https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md" target="_blank" rel="noopener noreferrer">Binance Vision · CC BY-NC-SA 4.0</a>.</p>':'')+'</details><button class="inspect-jump" id="open-research">Inspect the evidence <span>↗</span></button>';
  $('#inspector').innerHTML=html;
  $('#inspector').querySelectorAll('[data-focus-route]').forEach(b=>b.onclick=()=>onRoute(b.dataset.focusRoute));
  if($('#all-routes'))$('#all-routes').onclick=onAll;
  $('#open-research').onclick=onResearch;
  $('#inspector').querySelectorAll('[data-hour]').forEach(b=>{const inspect=()=>{const h=timeline[Number(b.dataset.hour)];$('#hour-detail').textContent=clock(h.start)+'–'+clock(h.end)+' · '+amount(h.total,activeSource)+' · '+(h.total?percent(h.buy/h.total)+' buying':'no trades');};b.onpointerenter=inspect;b.onfocus=inspect;b.onclick=inspect;});
  $('#mobile-summary').innerHTML='<span><strong>'+esc(symbol(asset))+'</strong><small>'+esc(paceText(c))+' · '+(activeSource==='exchange'?'exchange':'on-chain')+'</small></span><span>Read the change ↓</span>';
}
