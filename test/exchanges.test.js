import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXCHANGE_MARKETS, BAR_MS, eligibleMarkets, validateMarketIdentity, binanceBars, krakenBars, exchangeRecord, validExchangeMarket, exchangeRoutes, activitySource, marketURL } from '../lib/exchanges.js';
import { collectExchanges } from '../scripts/collect-exchanges.mjs';
import { validSnapshot } from '../lib/quality.js';
const end=Date.parse('2026-10-23T20:00:00Z'), start=end-86_400_000;
const bnb=EXCHANGE_MARKETS[0], xmr=EXCHANGE_MARKETS.find(m=>m.venue==='kraken');
const candles=()=>Array.from({length:288},(_,i)=>[start+i*BAR_MS,'1','1','1','1','100',start+(i+1)*BAR_MS-1,'100',2,'40','40','0']);
const record=()=>exchangeRecord(bnb,binanceBars(candles(),start,end),end,new Date(end+60_000).toISOString());
const trade=(id,at,side='b',price='10',qty='2')=>[price,qty,at/1000,side,'m','',id];
const page=(rows,last)=>({error:[],result:{XMRUSDT:rows,last:String(last)}});

test('market admission uses canonical IDs, both selected ends and active spot metadata',()=>{
  assert.deepEqual(eligibleMarkets([{id:'binancecoin'},{id:'tether'},{id:'unreviewed',symbol:'XRP'}]).map(m=>m.id),['binance:BNBUSDT']);
  assert.equal(eligibleMarkets([{id:'binancecoin'}]).length,0);
  const metadata={symbol:'BNBUSDT',baseAsset:'BNB',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true};
  assert.ok(validateMarketIdentity(bnb,metadata));
  for(const override of [{baseAsset:'FAKE'},{quoteAsset:'USD'},{status:'BREAK'},{isSpotTradingAllowed:false}])assert.equal(validateMarketIdentity(bnb,{...metadata,...override}),false);
  assert.ok(validateMarketIdentity(xmr,{altname:'XMRUSDT',wsname:'XMR/USDT',base:'XXMR',quote:'USDT',status:'online'}));
  assert.equal(validateMarketIdentity(xmr,{altname:'XMRUSDT',wsname:'XMR/USDT',base:'XMR',quote:'USDT',status:'online'}),false);
});
test('Binance complete candles supply measured quote volume, not counts or USD estimates',()=>{
  const m=record();assert.equal(m.unit,'USDT');assert.equal(m.windows.h1.buy,480);assert.equal(m.windows.h1.sell,720);assert.equal(m.windows.h24.total,28800);
  assert.equal(m.windows.h6.count,144);assert.equal(m.windows.h24.end,end);
  assert.ok(validExchangeMarket(m,new Set(['binancecoin','tether'])));
  const unfinished=[end,'1','1','1','1','900',end+BAR_MS-1,'900',2,'900','900','0'];
  assert.equal(binanceBars([...candles(),unfinished],start,end).length,288);
});
test('missing, duplicated, partial or inconsistent candles are rejected, not zero filled',()=>{
  for(const mutate of [r=>r.splice(100,1),r=>r.push(r[0]),r=>r[20][10]='101',r=>r[20][10]=null,r=>r[20][7]=true,r=>r[20][6]-=1,r=>r[20][8]=0]){
    const r=candles();mutate(r);assert.throws(()=>binanceBars(r,start,end));
  }
  const r=candles();for(const b of r){b[7]='0';b[10]='0';b[8]=0;}
  const m=exchangeRecord(bnb,binanceBars(r,start,end),end,new Date(end).toISOString());
  assert.equal(m.windows.h24.total,0);assert.ok(validExchangeMarket(m,new Set(['binancecoin','tether'])));
});
test('Kraken follows exact cursors and deduplicates overlapping trade IDs',async()=>{
  const cursor=String(BigInt(start)*1_000_000n+999000000n), urls=[];
  const rows=Array.from({length:1000},(_,i)=>trade(i,start+i));
  const responses=[page(rows,cursor),page([rows.at(-1),trade(1000,start+5000,'s')],BigInt(cursor)+1n)];
  const r=await krakenBars(xmr,start,end,async url=>{urls.push(url);return responses.shift();});
  assert.equal(r.pages,2);assert.ok(urls[1].endsWith('&since='+cursor));
  const m=exchangeRecord(xmr,r.bars,end,new Date(end).toISOString(),r.pages);
  assert.equal(m.windows.h24.count,1001);assert.equal(m.windows.h24.buy,20000);assert.equal(m.windows.h24.sell,20);
  assert.equal(m.windows.h1.total,0);assert.ok(validExchangeMarket(m,new Set(['monero','tether'])));
});
test('Kraken boundaries are start-inclusive/end-exclusive; invalid or truncated pages never publish',async()=>{
  const cursor=String(BigInt(end)*1_000_000n);
  const r=await krakenBars(xmr,start,end,async()=>page([trade(1,start-1),trade(2,start),trade(3,end-1,'s'),trade(4,end)],cursor));
  assert.equal(r.bars.reduce((s,b)=>s+b.count,0),2);
  const startCursor=String(BigInt(start)*1_000_000n);
  const full=Array.from({length:1000},(_,i)=>trade(i,start+i));
  await assert.rejects(krakenBars(xmr,start,end,async()=>page(full,startCursor)),/stalled/);
  await assert.rejects(krakenBars(xmr,start,end,async()=>page(full,cursor),{maxPages:1}),/budget/);
  await assert.rejects(krakenBars(xmr,start,end,async()=>page([trade(1,start),trade(1,start,'s')],cursor)),/Conflicting/);
  await assert.rejects(krakenBars(xmr,start,end,async()=>page([trade(1,start,'?')],cursor)),/Invalid/);
  await assert.rejects(krakenBars(xmr,start,end,async()=>({error:['Rate limit']})),/unavailable/);
});
test('source selection is deterministic, preserves explicit choices, and does not mix units',()=>{
  const m=record(), s={pools:[{id:'pool',base:'binancecoin',quote:'tether',windows:{h24:{buy:1,sell:2,total:3}},liquidity:50000}],exchangeMarkets:[m]};
  assert.equal(activitySource(s,'binancecoin','h24'),'dex');
  assert.equal(activitySource(s,'binancecoin','h1'),'exchange');
  assert.equal(activitySource(s,'binancecoin','h1','dex'),'dex');
  assert.equal(activitySource(s,'unknown','h24'),'dex');
  const a=exchangeRoutes([m,m],'binancecoin','h24')[0],q=exchangeRoutes([m],'tether','h24')[0];
  assert.equal(a.total,28800);assert.equal(a.net,-q.net);assert.equal(a.incoming,q.outgoing);assert.equal(a.pools.length,1);
});
test('saved exchange windows validate independently and reject identity, unit or input tampering',async()=>{
  const s=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8'));
  s.pools=[];
  if(!s.assets.some(a=>a.id==='binancecoin'))s.assets.find(a=>a.kind==='alt').id='binancecoin';
  if(!s.assets.some(a=>a.id==='tether'))s.assets.find(a=>a.kind==='stable').id='tether';
  s.exchangeMarkets=[record()];s.exchangeDiagnostics=[];assert.ok(validSnapshot(s));
  for(const mutate of [m=>m.unit='USD',m=>m.base='ripple',m=>m.windows.h24.buy+=1,m=>m.bars[0].buy+=1,m=>m.bars[0].count=NaN,m=>m.bars.pop(),m=>m.periodEnd+=1,m=>m.checkedAt=new Date(start).toISOString()]){
    const broken=structuredClone(s);mutate(broken.exchangeMarkets[0]);assert.equal(validSnapshot(broken),false);
  }
  s.exchangeMarkets.push(record());assert.equal(validSnapshot(s),false);
  assert.equal(new URL(marketURL({...record(),url:'javascript:alert(1)'})).hostname,'www.binance.com');
});
test('an exchange outage removes only that venue, with explicit diagnostics and no stale reuse',async()=>{
  const now=Date.now(),aligned=Math.floor(now/BAR_MS)*BAR_MS;
  const r=await collectExchanges([{id:'binancecoin'},{id:'monero'},{id:'tether'}],async url=>{
    if(url.includes('binance'))throw new Error('HTTP 451');
    if(url.endsWith('/Time'))return {result:{unixtime:Math.floor(Date.now()/1000)}};
    if(url.endsWith('/AssetPairs'))return {error:[],result:{XMRUSDT:{altname:'XMRUSDT',wsname:'XMR/USDT',base:'XXMR',quote:'USDT',status:'online'}}};
    return page([trade(10,aligned-1000)],String(BigInt(aligned)*1_000_000n));
  },{now,pause:async()=>{},log:()=>{}});
  assert.deepEqual(r.markets.map(m=>m.id),['kraken:XMRUSDT']);
  assert.equal(r.diagnostics.find(d=>d.venue==='binance').status,'unavailable');
});
test('a delisted Binance pair cannot remove another valid pair',async()=>{
  const now=Date.now(),aligned=Math.floor(now/BAR_MS)*BAR_MS;
  const shifted=candles().map(r=>{r[0]+=aligned-end;r[6]+=aligned-end;return r;});
  const r=await collectExchanges([{id:'binancecoin'},{id:'ripple'},{id:'tether'}],async url=>{
    if(url.endsWith('/time'))return {serverTime:Date.now()};
    if(url.includes('exchangeInfo?symbol=BNBUSDT'))throw new Error('Invalid symbol');
    if(url.includes('exchangeInfo'))return {symbols:[{symbol:'XRPUSDT',baseAsset:'XRP',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}]};
    return shifted;
  },{now,pause:async()=>{},log:()=>{}});
  assert.deepEqual(r.markets.map(m=>m.id),['binance:XRPUSDT']);
  assert.equal(r.diagnostics.find(d=>d.assetId==='binancecoin').status,'unavailable');
});
