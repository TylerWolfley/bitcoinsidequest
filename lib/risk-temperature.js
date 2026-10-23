import { activityRecords } from './activity.js';

// Experimental v1: explicit design choices, not fitted prediction weights.
// Each component uses reported 24h evidence. Missing inputs never become zero.
export const MODEL_VERSION=1;
export const WEIGHTS={participation:.4,leadership:.3,buying:.3};
const fresh=(at,now)=>Number.isFinite(Date.parse(at))&&Date.parse(at)<=now+60_000&&now-Date.parse(at)<=30*60_000;
export const directionScore=(change)=>change>.25?100:change<-.25?0:50;
const mean=rows=>rows.length?rows.reduce((s,r)=>s+r.score,0)/rows.length:null;
export function riskTemperature(snapshot,{now=Date.now(),offline=false}={}){
  const assets=(snapshot?.assets??[]).filter(a=>a.kind==='alt');
  const live=!!snapshot&&!offline&&fresh(snapshot.checkedAt,now);
  const priced=live?assets.filter(a=>Number.isFinite(a.priceChange24h)&&a.priceChange24h>=-100&&fresh(a.priceUpdatedAt,now)):[];
  const btc=live&&snapshot.bitcoin&&fresh(snapshot.bitcoin.priceUpdatedAt,now)&&Number.isFinite(snapshot.bitcoin.priceChange24h)&&snapshot.bitcoin.priceChange24h>-100?snapshot.bitcoin:null;
  const participation=priced.map(a=>({id:a.id,symbol:a.symbol,value:a.priceChange24h,score:directionScore(a.priceChange24h)}));
  const leadership=btc?priced.filter(a=>Math.abs(Date.parse(a.priceUpdatedAt)-Date.parse(btc.priceUpdatedAt))<=5*60_000).map(a=>{const value=((1+a.priceChange24h/100)/(1+btc.priceChange24h/100)-1)*100;return {id:a.id,symbol:a.symbol,value,score:directionScore(value)};}):[];
  const buying=live?assets.map(a=>{
    const scope=activityRecords(snapshot,a.id,'auto','all','h24'),records=scope.records;
    if(!records.length||records.some(p=>!p.windows?.h24||!fresh(p.checkedAt,now)))return null;
    const ends=records.filter(p=>p.kind==='exchange').map(p=>p.periodEnd);
    if(ends.some(t=>!Number.isFinite(t)||t>now||now-t>30*60_000||t!==ends[0]))return null;
    let buy=0,total=0;
    for(const p of records){const w=p.windows.h24;if(![w.buy,w.sell,w.total].every(Number.isFinite)||w.buy<0||w.sell<0||Math.abs(w.total-w.buy-w.sell)>Math.max(.01,w.total*1e-6))return null;buy+=a.id===p.base?w.buy:w.sell;total+=w.total;}
    // Avoid a tiny sampled market setting an entire coin's contribution.
    if(!Number.isFinite(total)||!Number.isFinite(buy)||total<100_000)return null;
    const value=buy/total*100;
    return {id:a.id,symbol:a.symbol,value,score:value,source:scope.source,markets:records.map(p=>p.id).sort()};
  }).filter(Boolean):[];
  const parts={participation:{rows:participation,score:mean(participation),weight:WEIGHTS.participation},leadership:{rows:leadership,score:mean(leadership),weight:WEIGHTS.leadership},buying:{rows:buying,score:mean(buying),weight:WEIGHTS.buying}};
  const enough=assets.length===10&&Object.values(parts).every(p=>p.rows.length>=7);
  const score=enough?Math.round(Object.values(parts).reduce((s,p)=>s+p.score*p.weight,0)):null;
  const scope=JSON.stringify(Object.entries(parts).map(([key,p])=>[key,p.rows.map(r=>[r.id,...(r.markets??[])]).sort((a,b)=>a[0].localeCompare(b[0]))]));
  const reason=!live?'Waiting for a fresh market snapshot.':assets.length!==10?'The top-ten lineup is incomplete.':!enough?'At least 7 of the 10 alts need fresh data in each check.':null;
  return {modelVersion:MODEL_VERSION,live,score,parts,scope,assets,at:snapshot?Date.parse(snapshot.checkedAt):null,reason};
}

export function riskBand(score){
  if(!Number.isInteger(score)||score<0||score>100)return null;
  return score<25?{label:'Cold',text:'Broad weakness in the measured signals.',color:'#3978ca'}:score<45?{label:'Cool',text:'The measured signals lean cautious.',color:'#519fb4'}:score<=55?{label:'Balanced',text:'The measured signals are mixed.',color:'#998229'}:score<75?{label:'Warm',text:'The measured signals lean toward risk.',color:'#b27532'}:{label:'Hot',text:'Broad strength in the measured signals.',color:'#c6543e'};
}

export function validRiskHistory(data,{now=Date.now()}={}){
  try{return data?.modelVersion===MODEL_VERSION&&Array.isArray(data.points)&&data.points.length<=3000&&data.points.every((p,i)=>Number.isSafeInteger(p.at)&&p.at>=Date.UTC(2026,0,1)&&p.at<=now+60_000&&(!i||p.at>data.points[i-1].at)&&typeof p.scope==='string'&&p.scope.length>0&&p.scope.length<40000&&p.parts&&Object.keys(WEIGHTS).every(k=>Number.isFinite(p.parts[k]?.score)&&p.parts[k].score>=0&&p.parts[k].score<=100&&Number.isInteger(p.parts[k].count)&&p.parts[k].count>=7&&p.parts[k].count<=10)&&p.score===Math.round(Object.entries(WEIGHTS).reduce((s,[k,w])=>s+p.parts[k].score*w,0)));}catch{return false;}
}
export function recordRiskHistory(history,model,{now=Date.now()}={}){
  const points=(validRiskHistory(history)?history.points:[]).filter(p=>p.at<=now+60_000&&now-p.at<=30*86_400_000);
  if(model.score!==null&&model.at<=now+60_000&&!points.some(p=>p.at===model.at))points.push({at:model.at,score:model.score,scope:model.scope,parts:Object.fromEntries(Object.entries(model.parts).map(([k,p])=>[k,{score:p.score,count:p.rows.length}]))});
  return {modelVersion:MODEL_VERSION,points:points.sort((a,b)=>a.at-b.at).slice(-3000)};
}
export function riskChange(history,model){
  if(!validRiskHistory(history)||model.score===null)return null;
  const previous=history.points.filter(p=>p.at<model.at).at(-1);
  if(!previous||model.at-previous.at>60*60_000)return null;
  return {value:model.score-previous.score,at:previous.at,comparable:previous.scope===model.scope};
}
