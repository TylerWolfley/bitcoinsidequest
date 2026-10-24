import { esc,money,signed,date } from './site-shell.js?v=20261023-map1';
import { fresh } from './lib/risk-temperature.js';
export { esc,money,signed,date };
export const compact=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n):'—';
export const percent=n=>Number.isFinite(n)?signed(n,2)+'%':'—';
export const direction=n=>!Number.isFinite(n)||n===0?'':n>0?'up':'down';
export function tokenIcon(a){let src='./favicon.svg';try{const u=new URL(a.image);if(u.protocol==='https:'&&/(^|\.)coingecko\.com$/.test(u.hostname))src=u.href;}catch{}return '<img src="'+esc(src)+'" alt="" width="32" height="32" loading="lazy">';}
export function pageStatus(snapshot,offline){
 const el=document.querySelector('#page-status'),notice=document.querySelector('#page-notice');
 el.textContent=snapshot?'Snapshot '+date(snapshot.checkedAt)+' · targets a 15-minute refresh':'Market data unavailable. Try refreshing.';
 if(notice){notice.hidden=!!snapshot&&!offline&&fresh(snapshot.checkedAt,Date.now());notice.textContent=!snapshot?'Waiting for a valid market snapshot. No values are estimated.':offline?'Refresh failed. Last-known prices stay visible; current comparisons are paused.':'This snapshot is older than 30 minutes. Current map positions and conditions are paused.';}
}
export function retainFocus(render){const active=document.activeElement;const id=active?.id,href=active?.getAttribute('href');render();if(id)document.getElementById(id)?.focus({preventScroll:true});else if(href)[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===href)?.focus({preventScroll:true});}
