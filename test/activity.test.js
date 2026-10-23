import test from 'node:test';
import assert from 'node:assert/strict';
import { activityRecords, compareActivity, activityHighlights, hourlyActivity } from '../lib/activity.js';
const now=Date.parse('2026-10-23T20:01:00Z'),end=now-60_000,checkedAt=new Date(now).toISOString();
const window=(buy,sell)=>({buy,sell,total:buy+sell});
const pool=(id='p',base='ethereum',current=[18000,12000],six=[48000,32000])=>({id,base,quote:'tether',network:'eth',checkedAt,windows:{h1:window(...current),h6:window(...six)}});
const snapshot=(pools,exchangeMarkets=[])=>({checkedAt,pools,exchangeMarkets,assets:[...new Set(pools.concat(exchangeMarkets).map(p=>p.base))].map(id=>({id,kind:'alt'})).concat({id:'tether',kind:'stable'})});

test('pace compares disjoint periods on the same records and reverses quote direction',()=>{
  const p=pool(),c=compareActivity([p,p],'ethereum',{now});
  assert.equal(c.count,1);assert.equal(c.current,30000);assert.equal(c.baseline,10000);assert.equal(c.ratio,3);assert.equal(c.share,.6);assert.equal(c.shareChange,0);
  const q=compareActivity([p],'tether',{now});assert.equal(q.ratio,c.ratio);assert.equal(q.share,.4);assert.equal(q.currentBuy,c.currentSell);
});
test('incomplete membership and inconsistent nested sides cannot create a highlight',()=>{
  const p=pool(),missing={...pool('missing'),windows:{h1:window(500000,100000)}};
  const c=compareActivity([p,missing],'ethereum',{now});assert.equal(c.complete,false);assert.equal(c.count,1);assert.equal(c.available,2);assert.equal(c.ratio,3);
  assert.deepEqual(activityHighlights(snapshot([p,missing]),{now}),[]);
  const inconsistent=pool('bad','ethereum',[18000,12000],[17000,70000]);
  assert.equal(compareActivity([inconsistent],'ethereum',{now}).count,0);
});
test('measured zero activity remains zero and a zero baseline is unavailable',()=>{
  const zero=compareActivity([pool('p','ethereum',[0,0],[30000,20000])],'ethereum',{now});
  assert.equal(zero.ratio,0);assert.equal(zero.share,null);assert.equal(zero.shareChange,null);
  const noBaseline=compareActivity([pool('p','ethereum',[18000,12000],[18000,12000])],'ethereum',{now});assert.equal(noBaseline.ratio,null);
  assert.equal(activityHighlights(snapshot([pool('p','ethereum',[0,0],[30000,20000])]),{now})[0].comparison.ratio,0);
});
test('highlights are fresh, bounded, alt-only, deterministic and suppressed offline',()=>{
  const s=snapshot(['a','b','c','d'].map(id=>pool(id,id)));
  assert.deepEqual(activityHighlights(s,{now}).map(h=>h.assetId),['a','b','c']);
  assert.deepEqual(activityHighlights(s,{now,offline:true}),[]);
  assert.deepEqual(activityHighlights(s,{now:now+31*60_000}),[]);
  const future=structuredClone(s);future.checkedAt=new Date(now+120_000).toISOString();assert.deepEqual(activityHighlights(future,{now}),[]);
  const stale=structuredClone(s);stale.pools.forEach(p=>p.checkedAt=new Date(now-31*60_000).toISOString());assert.deepEqual(activityHighlights(stale,{now}),[]);
  const futureRecord=pool();futureRecord.checkedAt=new Date(now+120_000).toISOString();assert.equal(compareActivity([futureRecord],'ethereum',{now}).fresh,false);
});
test('highlight thresholds distinguish a pace change, a share change, and quiet small samples',()=>{
  assert.equal(activityHighlights(snapshot([pool()]),{now})[0].type,'pace');
  const balance=pool('p','ethereum',[18000,2000],[68000,52000]);
  const h=activityHighlights(snapshot([balance]),{now})[0];assert.equal(h.type,'balance');assert.equal(h.comparison.ratio,1);assert.equal(h.comparison.shareChange,40);
  assert.deepEqual(activityHighlights(snapshot([pool('p','ethereum',[8999,1000],[33999,26000])]),{now}),[]);
  assert.deepEqual(activityHighlights(snapshot([pool('p','ethereum',[10000,10000],[60000,60000])]),{now}),[]);
});
test('source and network filters never pool USD with USDT or force automatic fallback on explicit scope',()=>{
  const p=pool(),m={...pool('binance:ETHUSDT'),kind:'exchange',unit:'USDT',periodEnd:end};
  const s=snapshot([p],[m]);
  assert.deepEqual(activityRecords(s,'ethereum').records,[p]);
  assert.deepEqual(activityRecords(s,'ethereum','exchange').records,[m]);
  assert.deepEqual(activityRecords(s,'ethereum','dex','solana').records,[]);
  assert.equal(activityRecords(s,'ethereum','auto','solana').source,'exchange');
  assert.deepEqual(activityRecords(s,'ethereum','dex','all','h1','unrelated').records,[]);
});
test('exchange comparisons reject mismatched or expired observation ends',()=>{
  const a={...pool('a'),kind:'exchange',periodEnd:end},b={...pool('b'),kind:'exchange',periodEnd:end-300_000};
  const c=compareActivity([a,b],'ethereum',{now});assert.equal(c.synchronized,false);assert.equal(c.ratio,null);assert.equal(c.shareChange,null);
  assert.deepEqual(activityHighlights(snapshot([],[a,b]),{now}),[]);
  assert.equal(compareActivity([{...a,periodEnd:end-31*60_000}],'ethereum',{now}).fresh,false);
});
test('hourly charts aggregate real closed intervals and reject rolling totals, gaps or mismatched windows',()=>{
  const m={...pool(),kind:'exchange',periodEnd:end,bars:Array.from({length:288},(_,i)=>({at:end-86_400_000+i*300_000,buy:2,sell:3}))};
  const bars=hourlyActivity([m,m],'ethereum');assert.equal(bars.length,24);assert.equal(bars[0].total,60);assert.equal(bars[0].start,end-86_400_000);assert.equal(bars.at(-1).end,end);assert.equal(bars.reduce((n,b)=>n+b.total,0),1440);
  assert.equal(hourlyActivity([m],'tether')[0].buy,36);
  assert.equal(hourlyActivity([pool()],'ethereum'),null);
  assert.equal(hourlyActivity([m,{...m,id:'two',periodEnd:end-300_000}],'ethereum'),null);
  const broken=structuredClone(m);broken.bars[10].at+=300_000;assert.equal(hourlyActivity([broken],'ethereum'),null);
});
