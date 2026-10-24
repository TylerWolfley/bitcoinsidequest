import { riskBand, riskChange, validRiskHistory } from './lib/risk-temperature.js?v=20261023-v2';
import { compareVisit } from './lib/market-context.js?v=20261023-v2';
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:n<1?4:2}).format(n) : '—';
export const signed = (n,d=1) => Number.isFinite(n) ? (n>0?'+':'')+n.toFixed(d) : '—';
export const date = at => new Date(at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
export function renderMonitor({model,history,previousVisit,currentVisit}) {
  const root=document.querySelector('#temperature-monitor');if(!root)return;
  const band=riskBand(model.score),delta=riskChange(history,model);
  const last=validRiskHistory(history)?history.points.filter(p=>p.score!==null).at(-1):null;
  const label=band?.label??'Waiting',value=model.score??'—';
  root.innerHTML='<span class="monitor-heading">MARKET TEMP <span aria-hidden="true">↗</span></span><span class="monitor-value"><strong>'+value+'</strong><span>'+label+(delta?.comparable&&delta.value!==0?' '+(delta.value>0?'↗':'↘'):'')+'</span></span><span class="monitor-track">'+(band?'<i style="left:'+model.score+'%"></i>':'')+'</span>';
  root.setAttribute('aria-label','Market temperature: '+(band?value+' out of 100, '+label:'waiting for complete fresh data')+'. Open the breakdown.');
  root.title=band?'Higher means stronger measured conditions, not better value.':model.reason+(last?' Last recorded: '+last.score+' at '+date(last.at)+'.':'');
  const visit=document.querySelector('#visit-context'),compared=compareVisit(previousVisit,currentVisit);
  if(visit){visit.hidden=!compared?.changed;if(compared?.changed)visit.textContent='Since your last visit: '+compared.up+' of '+compared.matched.length+' matched alts are higher.'+(compared.sentimentChange!==null?' Temperature '+signed(compared.sentimentChange,0)+' points.':'');}
}
export function initPageMotion() {
  const button=document.querySelector('#motion-toggle'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let stored;try{stored=localStorage.getItem('bsq-motion');}catch{}
  function apply(){const on=stored==='on'||(stored!=='off'&&!reduced.matches);document.documentElement.dataset.motion=on?'on':'off';if(button){button.setAttribute('aria-pressed',String(on));button.textContent='◉ Motion '+(on?'on':'off');}}
  if(button)button.onclick=()=>{stored=document.documentElement.dataset.motion==='on'?'off':'on';try{localStorage.setItem('bsq-motion',stored);}catch{}apply();};
  reduced.addEventListener('change',apply);apply();
}
