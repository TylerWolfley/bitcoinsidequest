import { previewStory,previewBars } from './lib/map-preview.js';
import { shortSymbol } from './lib/market-map.js';
import { esc,money,percent,direction,tokenIcon,date } from './market-ui.js?v=20261023-map1';

export function createMapPreview({root,getReading,getBenchmark,getHref}){
  const card=document.createElement('aside');
  card.id='map-preview';card.className='map-preview';card.hidden=true;
  card.setAttribute('role','region');card.setAttribute('aria-label','Token preview');
  document.body.append(card);
  let active=null,over=null,cardOver=false,pinned=false,dismissed=null,timer=null;
  const triggerFor=e=>e.target.closest?.('[data-preview-coin]');
  const triggerKey=el=>el?el.dataset.previewCoin+(el.hasAttribute('data-preview-toggle')?':button':':link'):null;
  const isInside=el=>el&&(card.contains(el)||active?.contains(el));
  const cancel=()=>{clearTimeout(timer);timer=null;};
  function unmark(){root.querySelectorAll('.is-previewed').forEach(el=>el.classList.remove('is-previewed'));root.querySelectorAll('[aria-describedby="map-preview-description"]').forEach(el=>el.removeAttribute('aria-describedby'));root.querySelectorAll('[data-preview-toggle]').forEach(el=>el.setAttribute('aria-expanded','false'));}
  function hide({restore=false,dismiss=false}={}){
    const trigger=active;cancel();dismissed=dismiss?triggerKey(trigger):null;
    active=null;pinned=false;cardOver=false;card.hidden=true;unmark();
    if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});
  }
  function leave(){cancel();timer=setTimeout(()=>{if(!pinned&&!over&&!cardOver&&!isInside(document.activeElement))hide();},160);}
  function position(){
    if(!active||card.hidden)return;
    const margin=12,r=active.getBoundingClientRect(),w=card.offsetWidth,h=card.offsetHeight;
    const mobile=matchMedia('(max-width:600px), (hover:none)').matches;
    let left=mobile?(innerWidth-w)/2:r.right+12,top=mobile?innerHeight-h-margin:r.top-20;
    if(!mobile&&left+w>innerWidth-margin)left=r.left-w-12;
    if(!mobile&&left<margin){left=(innerWidth-w)/2;top=r.bottom+12;if(top+h>innerHeight-margin)top=r.top-h-12;}
    card.style.left=Math.max(margin,Math.min(innerWidth-w-margin,left))+'px';
    card.style.top=Math.max(margin,Math.min(innerHeight-h-margin,top))+'px';
  }
  function paint(){
    if(!active)return;
    const reading=getReading(active.dataset.previewCoin);if(!reading){hide();return;}
    const a=reading.asset,benchmark=getBenchmark(),story=previewStory(reading,{benchmark}),bars=previewBars(reading);
    const metric=benchmark==='btc'&&a.kind==='alt'?reading.relative:reading.return24h;
    const metricLabel=benchmark==='btc'&&a.kind==='alt'?'Against BTC · 24h':'Price change · 24h';
    const unitAmount=n=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(n)+(bars?.unit==='USDT'?' USDT':'');
    const amount=n=>(bars?.unit==='USD'?'$':'')+unitAmount(n);
    const description=story.title+'. '+story.detail;
    const focusedId=card.contains(document.activeElement)?document.activeElement.id:null;
    card.innerHTML='<div class="preview-top"><div>'+tokenIcon(a)+'<span><b>'+esc(shortSymbol(a))+'</b><small>'+esc(a.name)+'</small></span></div><button type="button" id="preview-close" class="preview-close" aria-label="Close token preview">×</button></div>'+
      '<div class="preview-price"><strong>'+money(a.price)+'</strong><span>'+(!reading.priceReady?'Last-known price':'Current quote')+'</span></div>'+
      '<div class="preview-metrics"><div><span>'+metricLabel+'</span><b class="'+direction(metric)+'">'+percent(metric)+'</b></div><div><span>Trading pace · 1h</span><b>'+(bars?reading.pace.toFixed(2)+'×':'—')+'</b></div></div>'+
      (bars?'<div class="preview-bars" aria-label="Previous five hours averaged '+esc(amount(bars.baseline))+' per hour; last hour '+esc(amount(bars.current))+'"><div><span>Before · per hour</span><b>'+esc(amount(bars.baseline))+'</b><i><em style="width:'+bars.baselineWidth+'%"></em></i></div><div><span>Last hour</span><b>'+esc(amount(bars.current))+'</b><i><em style="width:'+bars.currentWidth+'%"></em></i></div></div>':'')+
      '<div class="preview-story '+story.tone+'"><span>'+(story.standout?'WHY IT STANDS OUT':'HOW TO READ IT')+'</span><div id="map-preview-description"><h3>'+esc(story.title)+'</h3><p>'+esc(story.detail)+'</p></div></div>'+
      '<div class="preview-scope">'+(bars?bars.count+' selected '+(reading.source==='exchange'?'exchange market':'on-chain pool')+(bars.count===1?'':'s')+' · '+bars.unit+'<br>':'')+'Quote '+esc(date(a.priceUpdatedAt))+(bars?'<br>Activity checked '+esc(date(new Date(reading.comparison.oldest).toISOString())):'')+'</div>'+
      '<a class="preview-profile" id="preview-profile" href="'+esc(getHref(a.id))+'">Open '+esc(shortSymbol(a))+' profile <span aria-hidden="true">↗</span></a>';
    card.querySelector('#preview-close').onclick=()=>hide({restore:card.contains(document.activeElement),dismiss:true});
    unmark();active.classList.add('is-previewed');active.setAttribute('aria-describedby','map-preview-description');
    if(active.hasAttribute('data-preview-toggle'))active.setAttribute('aria-expanded','true');
    root.querySelectorAll('[data-point-coin]').forEach(el=>el.classList.toggle('is-previewed',el.dataset.pointCoin===a.id));
    card.hidden=false;position();if(focusedId)card.querySelector('#'+focusedId)?.focus({preventScroll:true});
  }
  function show(trigger,{pin=false,focus=false}={}){
    if(!trigger||triggerKey(trigger)===dismissed)return;
    dismissed=null;cancel();active=trigger;pinned=pin;paint();if(focus&&!card.hidden)card.querySelector('#preview-close').focus({preventScroll:true});
  }
  root.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch'||e.target.closest('[data-preview-toggle]'))return;
    const t=triggerFor(e);if(!t||t.contains(e.relatedTarget))return;
    over=t;show(t);
  });
  root.addEventListener('pointerout',e=>{
    const t=triggerFor(e);if(!t||t.contains(e.relatedTarget))return;
    if(over===t)over=null;if(dismissed===triggerKey(t))dismissed=null;leave();
  });
  root.addEventListener('focusin',e=>{
    const t=triggerFor(e);if(!t){dismissed=null;return;}if(t.hasAttribute('data-preview-toggle'))return;
    show(t);
  });
  root.addEventListener('focusout',e=>{if(!isInside(e.relatedTarget))leave();});
  root.addEventListener('click',e=>{
    const t=e.target.closest('[data-preview-toggle]');if(!t)return;
    if(active===t&&!card.hidden){hide({dismiss:true});return;}
    dismissed=null;show(t,{pin:true,focus:true});
  });
  card.addEventListener('pointerenter',()=>{cardOver=true;cancel();});
  card.addEventListener('pointerleave',()=>{cardOver=false;leave();});
  card.addEventListener('focusout',e=>{if(!isInside(e.relatedTarget)){pinned=false;leave();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden){e.preventDefault();hide({restore:card.contains(document.activeElement),dismiss:true});}});
  document.addEventListener('pointerdown',e=>{if(!card.hidden&&!isInside(e.target))hide();});
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,{passive:true});
  function sync(){
    if(!active)return;
    if(!active.isConnected){
      const id=active.dataset.previewCoin,toggle=active.hasAttribute('data-preview-toggle');
      active=[...root.querySelectorAll('[data-preview-coin]')].find(el=>el.dataset.previewCoin===id&&el.hasAttribute('data-preview-toggle')===toggle&&el.getClientRects().length);
      if(over)over=active;
    }
    if(!active||!active.getClientRects().length){hide();return;}
    paint();
  }
  return {sync,hide};
}
