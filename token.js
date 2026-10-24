import { startLivePage } from './live-data.js?v=20261023-map1';
import { allTokens,tokenById,marketReading,tokenVibe,shortSymbol,profileURL,returnPath } from './lib/market-map.js';
import { validChartDisplay } from './lib/price-charts.js';
import { initActivityDetails } from './activity-detail.js?v=20261023-map1';
import { esc,money,compact,percent,direction,tokenIcon,pageStatus,retainFocus,date } from './market-ui.js?v=20261023-map1';
let snapshot=null,offline=false,charts=null,chartFailed=false,coin,days,from;
const detail=initActivityDetails(()=>render());
function readURL(){const q=new URLSearchParams(location.search);coin=q.get('coin')||'ethereum';days=[7,30,365].includes(Number(q.get('days')))?Number(q.get('days')):30;from=returnPath(q.get('from'));}
function chart(){
 const c=charts?.coins?.[coin]?.[days],root=document.querySelector('#token-chart');
 document.querySelectorAll('[data-chart-days]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.chartDays)===days)));
 if(!c?.available){root.innerHTML='<div class="chart-empty"><strong>'+(!charts&&!chartFailed?'Loading recorded history…':'Price history is not ready.')+'</strong><span>'+esc(c?.reason??'The historical feed could not be loaded. No line is estimated.')+'</span></div>';return;}
 const day=n=>new Date(n).toLocaleDateString(undefined,{month:'short',day:'numeric',year:days===365?'numeric':undefined,timeZone:'UTC'});
 const axisMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:c.max-c.min<.01?6:c.max<10?4:2}).format(n);
 const stale=Date.now()-c.last>3*86400000,partial=c.first>c.start||c.last<c.end||c.gaps>0;
 root.innerHTML='<div class="chart-readout"><strong>'+money(c.lastPrice)+'</strong><span class="'+direction(c.change)+'">'+percent(c.change)+' over shown observations</span><span>Last daily observation · '+day(c.last)+' UTC</span></div><div class="token-chart-stage"><div class="price-axis"><span>'+axisMoney(c.max)+'</span><span>'+axisMoney((c.max+c.min)/2)+'</span><span>'+axisMoney(c.min)+'</span></div><svg class="token-price-svg" viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label="'+esc(days+'-day price chart. '+c.count+' daily observations. Low '+money(c.low)+', high '+money(c.high)+'. '+c.gaps+' gaps. Last observation '+day(c.last)+' UTC.')+'"><path class="price-chart-grid" d="M0 0H1000 M0 120H1000 M0 240H1000"/><path class="price-chart-line" d="'+esc(c.path)+'"/>'+c.dots.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="3" class="price-chart-point"/>').join('')+'</svg></div><div class="price-chart-dates"><span>'+day(c.start)+'</span><span>'+day(c.end)+' · UTC</span></div><div class="chart-foot"><span>'+c.count+' daily observations'+(partial?' · partial history; gaps stay visible':'')+(stale?' · historical feed needs refreshing':'')+'</span><a href="https://www.coingecko.com/en/coins/'+encodeURIComponent(coin)+'" target="_blank" rel="noopener noreferrer">CoinGecko ↗</a></div>';
}
function render(){
 pageStatus(snapshot,offline);if(!snapshot)return;
 const a=tokenById(snapshot,coin),back=document.querySelector('#profile-back');back.href=from;
 back.textContent='← '+(from.startsWith('./market-map.html')?'Market Map':from.startsWith('./temperature.html')?'Temperature':from.startsWith('./journal.html')?'Journal':from.startsWith('./token.html')?'Previous token':'Activity');
 const picker=document.querySelector('#profile-select');
 picker.innerHTML=allTokens(snapshot).map(t=>'<option value="'+esc(t.id)+'"'+(t.id===coin?' selected':'')+'>'+esc(t.name)+' · '+esc(shortSymbol(t))+'</option>').join('');
 const activity=document.querySelector('#token-activity');
 if(!a){document.title='Token unavailable — Bitcoin Side Quest';document.querySelector('#profile-summary').innerHTML='<section class="profile-empty"><h1>This token is outside the current lineup.</h1><p>Rankings can change. Choose a current token above or return to the Market Map.</p><a class="button-light" href="./market-map.html">Explore the current market ↗</a></section>';document.querySelector('#price-chart-card').hidden=true;activity.hidden=true;document.querySelector('#token-next').innerHTML='';picker.selectedIndex=-1;return;}
 const q=new URLSearchParams(location.search),source=['dex','exchange'].includes(q.get('source'))?q.get('source'):'auto',network=snapshot.pools.some(p=>p.network===q.get('network'))?q.get('network'):'all';
 const r=marketReading(snapshot,a,{offline,source,network}),vibe=tokenVibe(r);
 document.title=a.name+' ('+shortSymbol(a)+') — Bitcoin Side Quest';document.querySelector('link[rel=canonical]').href='https://bitcoinsidequest.com/token.html?coin='+encodeURIComponent(a.id);
 const evidenceOpen=document.querySelector('.vibe-card details')?.open;
 retainFocus(()=>{
 document.querySelector('#profile-summary').innerHTML='<section class="profile-hero"><div class="profile-heading"><div class="profile-identity">'+tokenIcon(a)+'<div><span class="eyebrow">'+(a.kind==='stable'?'USD STABLECOIN':a.kind==='reference'?'BITCOIN REFERENCE':'TOP TEN ALT')+' · #'+a.rank+'</span><h1>'+esc(a.name)+' <small>'+esc(shortSymbol(a))+'</small></h1></div></div><button id="profile-share" class="button-light">Share profile ↗</button></div><div class="profile-numbers"><div class="profile-current-price"><span>Price · USD</span><strong>'+money(a.price)+'</strong><small class="'+direction(a.priceChange24h)+'">'+percent(a.priceChange24h)+' <span>over 24 hours</span></small></div><div><span>Market cap</span><strong>'+compact(a.marketCap)+'</strong><small>Circulating supply × price</small></div><div><span>Reported volume · 24h</span><strong>'+compact(a.volume24h)+'</strong><small>Market-wide price feed</small></div></div><div class="profile-quote-time">'+(!r.priceReady?'Last-known quote · ':'Quote updated · ')+date(a.priceUpdatedAt)+'</div></section><section class="vibe-card '+vibe.tone+'"><div><span class="eyebrow">THE VIBE · MEASURED CONDITIONS</span><h2>'+esc(vibe.label)+'</h2><p>'+esc(vibe.detail)+'</p></div><details><summary>What supports this?</summary><div class="vibe-evidence"><span>Price · 24h <b>'+percent(r.return24h)+'</b></span><span>Against BTC · 24h <b>'+percent(r.relative)+'</b></span><span>Activity pace · 1h <b>'+(r.pace===null?'—':r.pace.toFixed(2)+'×')+'</b></span><span>Reported buying · 1h <b>'+(r.buyShare===null?'—':(r.buyShare*100).toFixed(1)+'%')+'</b></span></div><p>Activity is a selected '+(r.source==='exchange'?'exchange':'on-chain')+' sample. “Picked up” means at least 1.5×; “slowed” means two-thirds or less. These are descriptive thresholds, not predictions or a sentiment survey.</p></details></section>';
 document.querySelector('.vibe-card details').open=Boolean(evidenceOpen);
 document.querySelector('#price-chart-card').hidden=false;chart();
 activity.hidden=a.kind==='reference';if(!activity.hidden)detail.update(snapshot,coin,offline);
 document.querySelector('#token-next').innerHTML='<a href="./market-map.html"><span>COMPARE THE MARKET</span><b>See this coin in context ↗</b></a><a href="./journal.html'+(a.kind==='alt'?'?coin='+encodeURIComponent(coin)+'#scenarios':'')+'"><span>READ THE DAILY CHECK-IN</span><b>Market notes'+(a.kind==='alt'?' &amp; separate price scenarios':'')+' ↗</b></a>';
 const share=document.querySelector('#profile-share');share.onclick=async()=>{try{await navigator.clipboard.writeText(location.href);share.textContent='Link copied';}catch{document.querySelector('#share-url').value=location.href;document.querySelector('#share-dialog').showModal();document.querySelector('#share-url').select();}};
 });
}
readURL();const feed=startLivePage(state=>{snapshot=state.snapshot;offline=state.offline;render();});
async function loadCharts(){try{const r=await fetch('./data/price-charts.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('History unavailable');const d=await r.json();if(!validChartDisplay(d))throw new Error('Invalid chart');charts=d;chartFailed=false;}catch{chartFailed=true;}if(snapshot&&tokenById(snapshot,coin))chart();}
loadCharts();setInterval(()=>{if(!document.hidden)loadCharts();},300000);
document.querySelector('#refresh-data').onclick=()=>{feed.refresh();loadCharts();};
document.querySelector('#profile-select').onchange=e=>{location.href=profileURL(e.target.value,{from});};
document.querySelectorAll('[data-chart-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.chartDays);const q=new URLSearchParams(location.search);q.set('days',days);history.replaceState(null,'',location.pathname+'?'+q);chart();});
window.addEventListener('popstate',()=>{readURL();render();});
