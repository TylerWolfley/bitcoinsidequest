import { startLivePage } from './live-data.js?v=20261023-map1';
import { marketReading,profileURL,shortSymbol,placeLabels } from './lib/market-map.js';
import { esc,money,percent,direction,tokenIcon,pageStatus,retainFocus } from './market-ui.js?v=20261023-map1';
let snapshot=null,offline=false,benchmark='usd',source='auto',readings=[];
const plot=document.querySelector('#market-plot');
function readURL(){const q=new URLSearchParams(location.search);benchmark=q.get('vs')==='btc'?'btc':'usd';source=['dex','exchange'].includes(q.get('source'))?q.get('source'):'auto';}
function saveURL(){const q=new URLSearchParams({vs:benchmark});if(source!=='auto')q.set('source',source);history.replaceState(null,'',location.pathname+'?'+q);}
const href=id=>profileURL(id,{from:location.pathname+location.search,source});
function rows(){return readings.map(r=>({...r,x:benchmark==='btc'?r.relative:r.return24h}));}
function drawPlot(){
 const previous=new Map([...plot.querySelectorAll('a')].map(a=>[a.dataset.coin,{left:a.style.left,top:a.style.top}]));
 const width=plot.clientWidth;if(width<10)return;
 const data=rows().filter(r=>r.pace!==null&&r.x!==null),h=390,left=65,right=32,top=46,bottom=73,innerW=width-left-right,innerH=h-top-bottom;
 if(!data.length){plot.innerHTML='<div class="chart-empty"><strong>No fresh, comparable positions.</strong><span>Profiles and last-known prices remain available below.</span></div>';return;}
 const values=data.map(r=>r.x),bound=Math.max(.25,...values.map(Math.abs))*1.2;
 const positives=data.filter(r=>r.pace>0).map(r=>r.pace),minLog=Math.min(-1,...positives.map(Math.log2))-0.55,maxLog=Math.max(1,...positives.map(Math.log2))+0.55;
 const x=v=>left+(v+bound)/(2*bound)*innerW,y=v=>top+(maxLog-Math.log2(v))/(maxLog-minLog)*innerH;
 const zero=data.filter(r=>r.pace===0),zeroRows=Math.ceil(zero.length/Math.max(1,Math.floor(innerW/82))),plotHeight=h+zeroRows*52,zeroY=h+24;
 let svg='<svg viewBox="0 0 '+width+' '+(plotHeight)+'" class="market-svg" role="img" aria-label="24-hour price change compared with last-hour activity pace. Each label links to a token profile."><rect x="'+left+'" y="'+top+'" width="'+innerW+'" height="'+innerH+'" class="plot-field"/>';
 for(let i=0;i<=4;i++){const v=-bound+2*bound*i/4,px=x(v);svg+='<line x1="'+px+'" x2="'+px+'" y1="'+top+'" y2="'+(h-bottom)+'" class="plot-grid"/><text x="'+px+'" y="'+(h-bottom+24)+'" text-anchor="middle" class="plot-axis">'+(Math.abs(v)<.0001?'0':(v>0?'+':'')+v.toFixed(bound>20?0:1))+'%</text>';}
 const step=Math.max(1,Math.ceil((maxLog-minLog)/5));
 for(let n=Math.ceil(minLog);n<=maxLog;n+=step){const v=2**n,py=y(v);svg+='<line x1="'+left+'" x2="'+(width-right)+'" y1="'+py+'" y2="'+py+'" class="plot-grid"/><text x="'+(left-12)+'" y="'+(py+4)+'" text-anchor="end" class="plot-axis">'+(v>=1?v.toFixed(0):v.toFixed(v<.1?2:1))+'×</text>';}
 svg+='<line x1="'+x(0)+'" x2="'+x(0)+'" y1="'+top+'" y2="'+(h-bottom)+'" class="plot-zero"/><line x1="'+left+'" x2="'+(width-right)+'" y1="'+y(1)+'" y2="'+y(1)+'" class="plot-zero"/>';
 svg+='<text x="'+left+'" y="24" class="plot-label">'+(benchmark==='btc'?'Behind BTC':'Price down')+' · busier</text><text x="'+(width-right)+'" y="24" text-anchor="end" class="plot-label">'+(benchmark==='btc'?'Ahead of BTC':'Price up')+' · busier</text><text x="'+left+'" y="'+(h-10)+'" class="plot-label">← '+(benchmark==='btc'?'Behind Bitcoin':'Down in dollars')+'</text><text x="'+(width-right)+'" y="'+(h-10)+'" text-anchor="end" class="plot-label">'+(benchmark==='btc'?'Ahead of Bitcoin':'Up in dollars')+' →</text>';
 const points=data.filter(r=>r.pace>0).map(r=>({id:r.asset.id,x:x(r.x)-left,y:y(r.pace)-top,reading:r}));
 const labels=placeLabels(points,innerW,innerH,70,42);
 const zeroLabels=placeLabels(zero.map(r=>({id:r.asset.id,x:x(r.x)-left,y:24,reading:r})),innerW,zeroRows*52,70,42);
 for(const p of zeroLabels)labels.push({...p,y:p.y+h-top,anchorY:p.anchorY+h-top});
 if(zero.length)svg+='<text x="'+(left-12)+'" y="'+(zeroY+4)+'" text-anchor="end" class="plot-axis">0×</text>';
 let links='';
 for(const p of labels){const r=p.reading,ax=p.anchorX+left,ay=p.anchorY+top,lx=p.x+left,ly=p.y+top;
  svg+='<line x1="'+ax+'" x2="'+lx+'" y1="'+ay+'" y2="'+ly+'" class="plot-leader"/><rect x="'+(ax-3)+'" y="'+(ay-3)+'" width="6" height="6" class="plot-anchor '+direction(r.x)+'"/>';
  links+='<a data-coin="'+esc(r.asset.id)+'" class="market-token '+direction(r.x)+'" href="'+esc(href(r.asset.id))+'" style="left:'+lx+'px;top:'+ly+'px" aria-label="'+esc(r.asset.name)+': '+percent(r.x)+' '+(benchmark==='btc'?'against Bitcoin':'in dollars')+' over 24 hours; '+r.pace.toFixed(2)+' times activity. Open profile."><b>'+esc(shortSymbol(r.asset))+'</b><span>'+percent(r.x)+'</span></a>';
 }
 plot.innerHTML=svg+'</svg>'+links;plot.style.height=(plotHeight)+'px';
 if(document.documentElement.dataset.motion==='on')plot.querySelectorAll('a').forEach(a=>{const p=previous.get(a.dataset.coin);if(p&&(p.left!==a.style.left||p.top!==a.style.top))a.animate([p,{left:a.style.left,top:a.style.top}],{duration:350,easing:'ease-out'});});
}
function render(){
 pageStatus(snapshot,offline);if(!snapshot)return;
 readings=snapshot.assets.filter(a=>a.kind==='alt').map(a=>marketReading(snapshot,a,{offline,source}));
 document.querySelectorAll('[data-benchmark]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.benchmark===benchmark)));
 document.querySelector('#map-source').value=source;
 const data=rows(),eligible=data.filter(r=>r.pace!==null&&r.x!==null);
 document.querySelector('#map-coverage').textContent=eligible.length+'/10 comparable · selected trading samples';
 retainFocus(()=>{
 drawPlot();
 const largest=Math.max(1,...eligible.map(r=>Math.abs(r.x)));
 document.querySelector('#map-mobile').innerHTML=eligible.map(r=>'<a class="mobile-market-row" href="'+esc(href(r.asset.id))+'"><span class="mobile-market-name">'+tokenIcon(r.asset)+'<b>'+esc(shortSymbol(r.asset))+'</b></span><span class="mobile-market-price '+direction(r.x)+'"><b>'+percent(r.x)+'</b><span class="mini-return"><i style="width:'+Math.abs(r.x)/largest*100+'%"></i></span></span><span class="mobile-market-pace"><b>'+r.pace.toFixed(2)+'×</b><small>'+(r.pace>=1.005?'Busier':r.pace<.995?'Quieter':'Same pace')+'</small></span><span aria-hidden="true">↗</span></a>').join('')||'<div class="chart-empty">No fresh, comparable positions.</div>';
 document.querySelector('#map-unavailable').innerHTML=data.some(r=>r.pace===null||r.x===null)?'<span class="subtle">Outside the plot · still available to explore</span><div>'+data.filter(r=>r.pace===null||r.x===null).map(r=>'<a href="'+esc(href(r.asset.id))+'">'+tokenIcon(r.asset)+'<b>'+esc(shortSymbol(r.asset))+'</b><span>'+esc(!r.priceReady?'Price needs refreshing':r.x===null?'BTC comparison unavailable':r.reason)+'</span><span aria-hidden="true">↗</span></a>').join('')+'</div>':'';
 document.querySelector('#map-stables').innerHTML=snapshot.assets.filter(a=>a.kind==='stable').map(a=>'<a class="stable-card" href="'+esc(href(a.id))+'"><span>'+tokenIcon(a)+'<b>'+esc(shortSymbol(a))+'</b><i aria-hidden="true">↗</i></span><strong>'+money(a.price)+'</strong><small>'+percent(Number.isFinite(a.price)?(a.price-1)*100:null)+' from $1</small><span class="stable-supply">Circulating value · 24h <b>'+percent(a.supplyChange24h)+'</b></span></a>').join('');
 const b=snapshot.bitcoin;document.querySelector('#map-bitcoin').innerHTML=b?'<a class="bitcoin-reference" href="'+esc(href(b.id))+'">'+tokenIcon(b)+'<b>Bitcoin</b><span>'+money(b.price)+'</span><span class="'+direction(b.priceChange24h)+'">'+percent(b.priceChange24h)+' · 24h</span><span>Open reference profile ↗</span></a>':'';
 });
}
readURL();const feed=startLivePage(state=>{snapshot=state.snapshot;offline=state.offline;render();});
document.querySelectorAll('[data-benchmark]').forEach(b=>b.onclick=()=>{benchmark=b.dataset.benchmark;saveURL();render();});
document.querySelector('#map-source').onchange=e=>{source=e.target.value;saveURL();render();};
document.querySelector('#refresh-data').onclick=()=>feed.refresh();
window.addEventListener('popstate',()=>{readURL();render();});
new ResizeObserver(()=>{if(snapshot)drawPlot();}).observe(plot);
