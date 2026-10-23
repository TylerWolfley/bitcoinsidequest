import { activitySource } from './exchanges.js';
import { ageMinutes } from './model.js';

export function activityRecords(snapshot, asset, source='auto', network='all', window='h1', other=null) {
  const chosen=activitySource(snapshot,asset,window,source,network);
  const records=(chosen==='exchange'?(snapshot.exchangeMarkets??[]):snapshot.pools).filter(p=>
    (chosen==='exchange'||network==='all'||p.network===network)&&(p.base===asset||p.quote===asset)&&
    (!other||(p.base===asset?p.quote:p.base)===other));
  return {source:chosen,records:[...new Map(records.map(p=>[p.id,p])).values()]};
}

// Disjoint intervals, identical records, consistent side amounts. A change in
// sampled membership must never become an activity change.
export function compareActivity(records,asset,{now=Date.now()}={}) {
  const unique=[...new Map(records.map(p=>[p.id,p])).values()];
  const usable=unique.filter(p=>{
    const a=p.windows?.h1,b=p.windows?.h6;
    return a&&b&&['buy','sell','total'].every(k=>Number.isFinite(a[k])&&Number.isFinite(b[k])&&a[k]>=0&&b[k]>=a[k]);
  });
  let currentBuy=0,currentSell=0,previousBuy=0,previousSell=0;
  for(const p of usable){
    const a=p.windows.h1,b=p.windows.h6,base=p.base===asset;
    currentBuy+=base?a.buy:a.sell;currentSell+=base?a.sell:a.buy;
    previousBuy+=base?b.buy-a.buy:b.sell-a.sell;previousSell+=base?b.sell-a.sell:b.buy-a.buy;
  }
  const current=currentBuy+currentSell,previous=previousBuy+previousSell,baseline=previous/5;
  const share=current>0?currentBuy/current:null,priorShare=previous>0?previousBuy/previous:null;
  const ends=usable.filter(p=>p.kind==='exchange').map(p=>p.periodEnd);
  const clocks=usable.map(p=>Date.parse(p.checkedAt));
  const oldest=clocks.length?Math.min(...clocks):null;
  const synchronized=ends.length===0||ends.every(t=>t===ends[0]);
  const fresh=usable.length>0&&clocks.every(t=>Number.isFinite(t)&&t<=now+60_000)&&ageMinutes(new Date(oldest).toISOString(),now)<=30&&
    ends.every(t=>Number.isFinite(t)&&t<=now&&now-t<=30*60_000);
  return {records:usable,count:usable.length,available:unique.length,complete:usable.length===unique.length,
    current,baseline,currentBuy,currentSell,share,priorShare,
    ratio:baseline>0&&usable.length&&synchronized?current/baseline:null,
    shareChange:share!==null&&priorShare!==null&&synchronized?(share-priorShare)*100:null,
    oldest,end:ends.length&&synchronized?ends[0]:null,fresh,synchronized};
}

// Editorial thresholds describe observed change; they are not statistical
// significance, a prediction, or a cross-coin ranking of capital inflows.
export function activityHighlights(snapshot,{source='auto',network='all',now=Date.now(),offline=false}={}) {
  const checked=Date.parse(snapshot.checkedAt);
  if(offline||!Number.isFinite(checked)||checked>now+60_000||ageMinutes(snapshot.checkedAt,now)>30)return [];
  const candidates=[];
  for(const asset of snapshot.assets.filter(a=>a.kind==='alt')) {
    const scope=activityRecords(snapshot,asset.id,source,network), c=compareActivity(scope.records,asset.id,{now});
    if(!c.fresh||!c.complete||!c.synchronized||c.ratio===null||c.baseline<10_000)continue;
    const choices=[];
    if(c.ratio>=1.5||c.ratio<=2/3)choices.push({type:'pace',score:c.ratio===0?100:Math.abs(Math.log2(c.ratio)),direction:c.ratio>1?'up':'down'});
    if(c.current>=10_000&&c.shareChange!==null&&Math.abs(c.shareChange)>=10)choices.push({type:'balance',score:Math.abs(c.shareChange)/20,direction:c.shareChange>0?'up':'down'});
    choices.sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type));
    if(choices.length)candidates.push({...choices[0],assetId:asset.id,source:scope.source,comparison:c});
  }
  return candidates.sort((a,b)=>b.score-a.score||a.assetId.localeCompare(b.assetId)).slice(0,3);
}

// Only exchange feeds contain actual sub-window observations. DEX rolling totals
// cannot be expanded into a timeline or a synthetic sparkline.
export function hourlyActivity(records,asset) {
  const unique=[...new Map(records.map(p=>[p.id,p])).values()];
  if(!unique.length||unique.some(p=>p.kind!=='exchange'||!Array.isArray(p.bars)||p.bars.length!==288||p.periodEnd!==unique[0].periodEnd))return null;
  const start=unique[0].periodEnd-86_400_000;
  if(unique.some(p=>p.bars.some((b,i)=>b.at!==start+i*300_000)))return null;
  return Array.from({length:24},(_,i)=>{
    let buy=0,sell=0;
    for(const p of unique)for(const b of p.bars.slice(i*12,(i+1)*12)){buy+=p.base===asset?b.buy:b.sell;sell+=p.base===asset?b.sell:b.buy;}
    return {start:start+i*3_600_000,end:start+(i+1)*3_600_000,buy,sell,total:buy+sell};
  });
}
