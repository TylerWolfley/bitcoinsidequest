import { startLivePage } from './live-data.js?v=20261023-map1';
import { renderChanges } from './activity-view.js?v=20261023-map1';
import { marketReading,shortSymbol,profileURL } from './lib/market-map.js';
import { esc,money,percent,direction,tokenIcon,pageStatus,retainFocus } from './market-ui.js?v=20261023-map1';
// Existing shared links keep their selected coin and window after the page split.
if(new URLSearchParams(location.search).has('coin'))location.replace('./token.html'+location.search+(location.search.includes('from=')?'':'&from=.%2F'));
function render({snapshot,offline}){
 pageStatus(snapshot,offline);if(!snapshot)return;
 const to=(id,window='h24')=>profileURL(id,{from:'./',window});
 retainFocus(()=>{
 renderChanges({snapshot,source:'auto',network:'all',selected:null,windowKey:'h24',offline,onHighlight:id=>{location.href=to(id,'h1');}});
 document.querySelector('#alt-picker').innerHTML=snapshot.assets.filter(a=>a.kind==='alt').map(a=>{
  const r=marketReading(snapshot,a,{offline}),c=r.comparison,max=Math.max(1,c.current,c.baseline);
  return '<a class="asset-tile '+(r.pace===null?'quiet':r.pace>=1.5?'accelerating':r.pace<=2/3?'cooling':'steady')+'" href="'+esc(to(a.id))+'" aria-label="Open '+esc(a.name)+' profile"><span class="tile-top">'+tokenIcon(a)+'<b>'+esc(shortSymbol(a))+'</b><small class="tile-rank">#'+a.rank+'</small></span><span class="tile-pace">'+(r.pace===null?esc(r.reason):r.pace.toFixed(2)+'× pace')+'</span><span class="tile-activity" aria-hidden="true">'+(r.pace===null?'':'<i style="width:'+c.baseline/max*100+'%"></i><i style="width:'+c.current/max*100+'%"></i>')+'</span><span class="tile-foot"><span>'+money(a.price)+'</span><span class="'+direction(a.priceChange24h)+'">'+percent(a.priceChange24h)+'</span></span></a>';
 }).join('');
 document.querySelector('#stable-picker').innerHTML=snapshot.assets.filter(a=>a.kind==='stable').map(a=>'<a class="stable-tile" href="'+esc(to(a.id))+'" aria-label="Open '+esc(a.name)+' profile">'+tokenIcon(a)+'<span><b>'+esc(shortSymbol(a))+'</b><small>Dollar target</small></span><strong>'+money(a.price)+'</strong></a>').join('');
 });
}
const feed=startLivePage(render);document.querySelector('#refresh-data').onclick=()=>feed.refresh();
