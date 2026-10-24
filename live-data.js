import { validSnapshot } from './lib/quality.js';
import { validRiskHistory, riskTemperature } from './lib/risk-temperature.js';
import { renderMonitor, initPageMotion } from './site-shell.js?v=20261023-map1';
import { validVisit,visitDigest } from './lib/market-context.js';

export function startLivePage(onUpdate) {
  let snapshot=null, history=null, offline=false, busy=false;
  let previousVisit=null;try{const old=JSON.parse(localStorage.getItem('bsq-visit-v2'));if(validVisit(old))previousVisit=old;}catch{}
  initPageMotion();
  const draw=()=>{const model=riskTemperature(snapshot,{offline}),currentVisit=offline?null:visitDigest(snapshot,model);renderMonitor({model,history,previousVisit,currentVisit});if(currentVisit)try{localStorage.setItem('bsq-visit-v2',JSON.stringify(currentVisit));}catch{}onUpdate({snapshot,offline});};
  async function load(){
    if(busy)return;busy=true;
    const results=await Promise.allSettled(['snapshot','market-temperature'].map(async name=>{
      const r=await fetch('./data/'+name+'.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw new Error('Feed unavailable');const d=await r.json();
      if(!(name==='snapshot'?validSnapshot(d):validRiskHistory(d)))throw new Error('Invalid feed');return d;
    }));
    offline=results[0].status!=='fulfilled';
    if(!offline){snapshot=results[0].value;try{localStorage.setItem('bsq-snapshot-v1',JSON.stringify(snapshot));}catch{}}
    else if(!snapshot)try{const d=JSON.parse(localStorage.getItem('bsq-snapshot-v1'));if(validSnapshot(d))snapshot=d;}catch{}
    if(results[1].status==='fulfilled')history=results[1].value;
    busy=false;draw();
  }
  load();setInterval(()=>{if(!document.hidden)load();},60000);setInterval(()=>{if(!document.hidden&&!busy)draw();},30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  return {refresh:load};
}
