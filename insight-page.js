import { validSnapshot } from './lib/quality.js';
import { riskTemperature,validRiskHistory } from './lib/risk-temperature.js?v=20261023-map1';
import { validTemperature } from './lib/temperature.js';
import { validPriceStatistics as validPriceHistory } from './lib/scenarios.js';
import { validJournal } from './lib/journal.js';
import { renderMonitor,initPageMotion,date } from './site-shell.js?v=20261023-map1';
import { renderTemperatureDetail } from './temperature-detail.js?v=20261023-map1';
import { renderJournal } from './journal-view.js?v=20261023-map1';
const page=document.body.dataset.page,root=document.querySelector('#insight-content'),status=document.querySelector('#page-status');
let snapshot=null,history=null,reference=null,prices=null,journal=null,archive=null,offline=false,historyFailed=false,journalFailed=false,loading=false;
function render(){
 const focused=document.activeElement?.id,model=riskTemperature(snapshot,{offline});
 renderMonitor({model,history});
 status.textContent=offline?'Market refresh failed. The temperature and current scenarios are paused.':snapshot?'Market snapshot '+date(snapshot.checkedAt)+' · refresh targets every 15 minutes':'Market data is unavailable. Try refreshing.';
 if(page==='temperature')renderTemperatureDetail(root,{model,history,reference,archive,historyFailed});
 else renderJournal(root,{snapshot,journal,prices,offline,journalFailed});
 if(focused)document.getElementById(focused)?.focus({preventScroll:true});
}
async function load(){
 if(loading)return;loading=true;
 const definitions=[['snapshot',validSnapshot],['market-temperature',validRiskHistory],['temperature',validTemperature],['archive-status',d=>d?.version===1&&Number.isInteger(d.observations)&&typeof d.durable==='boolean']];
 if(page==='journal')definitions.push(['price-statistics',validPriceHistory],['journal',validJournal]);
 const results=await Promise.allSettled(definitions.map(async([name,validate])=>{const response=await fetch('./data/'+name+'.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(name+' unavailable');const d=await response.json();if(!validate(d))throw new Error(name+' invalid');return d;}));
 results.forEach((r,i)=>{
  const name=definitions[i][0],ok=r.status==='fulfilled';
  if(name==='snapshot'){offline=!ok;if(ok)snapshot=r.value;}
  if(name==='market-temperature'){historyFailed=!ok;if(ok)history=r.value;}
  if(name==='temperature'&&ok)reference=r.value;
  if(name==='archive-status'&&ok)archive=r.value;
  if(name==='price-statistics'&&ok)prices=r.value;
  if(name==='journal'){journalFailed=!ok;if(ok)journal=r.value;}
 });
 loading=false;render();
}
initPageMotion();load();
setInterval(()=>{if(!document.hidden)load();},60000);
setInterval(()=>{if(!document.hidden&&!loading)render();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
