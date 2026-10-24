import test from 'node:test';
import assert from 'node:assert/strict';
import { marketReading,tokenVibe,profileURL,returnPath,placeLabels,tokenById } from '../lib/market-map.js';
import { chartDisplay,validChartDisplay } from '../lib/price-charts.js';
import { DAY } from '../lib/scenarios.js';
const now=Date.parse('2026-10-23T20:00:00Z'),at=new Date(now).toISOString();
const asset={id:'solana',name:'Solana',symbol:'SOL',kind:'alt',price:100,priceUpdatedAt:at,priceChange24h:4};
const win=(buy,sell)=>({buy,sell,total:buy+sell});
const record={id:'pool',network:'solana',base:'solana',quote:'tether',checkedAt:at,windows:{h1:win(16000,4000),h6:win(41000,29000)}};
const snapshot=()=>({checkedAt:at,assets:[asset],bitcoin:{id:'bitcoin',price:50000,priceUpdatedAt:at,priceChange24h:2},pools:[record],exchangeMarkets:[]});
test('map and vibe use one comparison, not another weighted sentiment score',()=>{
 const r=marketReading(snapshot(),asset,{now});assert.equal(r.pace,2);assert.equal(r.buyShare,.8);assert.ok(Math.abs(r.relative-1.9607843)<.00001);
 assert.equal(tokenVibe(r).label,'Price rising · trading picked up');assert.equal('score' in tokenVibe(r),false);
});
test('offline, old and future quotes pause positions and current descriptions',()=>{
 const s=snapshot();assert.equal(marketReading(s,asset,{now,offline:true}).pace,null);
 assert.equal(marketReading(s,asset,{now:now+31*60000}).priceReady,false);
 const r=marketReading(s,{...asset,priceUpdatedAt:new Date(now+120000).toISOString()},{now});assert.equal(r.return24h,null);assert.equal(tokenVibe(r).label,'Waiting for fresh prices');
});
test('small or incomplete samples never become apparently confident activity positions',()=>{
 const s=snapshot();s.pools.push({...record,id:'missing',windows:{h1:win(90000,10000)}});assert.equal(marketReading(s,asset,{now}).pace,null);
 s.pools=[{...record,windows:{h1:win(1600,400),h6:win(4100,2900)}}];assert.equal(marketReading(s,asset,{now}).reason,'Sample too small to compare');
});
test('measured zero remains plottable, missing is unknown and zero baseline is unavailable',()=>{
 const s=snapshot();s.pools=[{...record,windows:{h1:win(0,0),h6:win(25000,25000)}}];assert.equal(marketReading(s,asset,{now}).pace,0);
 s.pools=[];assert.equal(marketReading(s,asset,{now}).pace,null);assert.equal(tokenVibe(marketReading(s,asset,{now})).tone,'unknown');
 s.pools=[{...record,windows:{h1:win(50000,0),h6:win(50000,0)}}];assert.equal(marketReading(s,asset,{now}).reason,'No nonzero baseline');
});
test('Bitcoin comparisons require aligned fresh quotes and correct compounded return',()=>{
 const s=snapshot();s.bitcoin.priceUpdatedAt=new Date(now-6*60000).toISOString();assert.equal(marketReading(s,asset,{now}).relative,null);
 s.bitcoin.priceUpdatedAt=at;s.bitcoin.priceChange24h=-100;assert.equal(marketReading(s,asset,{now}).relative,null);
});
test('explicit source selection does not mix quote units or fall back silently',()=>{
 const s=snapshot();s.exchangeMarkets=[{...record,id:'exchange',kind:'exchange',periodEnd:now,unit:'USDT',windows:{h1:win(10000,10000),h6:win(60000,60000)}}];
 assert.equal(marketReading(s,asset,{now}).pace,2);assert.equal(marketReading(s,asset,{now,source:'exchange'}).pace,1);
 s.exchangeMarkets=[];assert.equal(marketReading(s,asset,{now,source:'exchange'}).pace,null);
});
test('stablecoin vibe describes peg distance, not safety or directional conviction',()=>{
 const stable={...asset,kind:'stable',price:0.99};const v=tokenVibe(marketReading(snapshot(),stable,{now}));assert.equal(v.label,'Dollar target · -1.000% from $1');assert.match(v.detail,/does not measure backing quality/);
});
test('canonical profile identities and return links cannot redirect outside the site',()=>{
 for(const bad of ['https://evil.test/','//evil.test/','javascript:alert(1)','/unknown.html','/\\evil.test/'])assert.equal(returnPath(bad),'./market-map.html');
 const target=profileURL('solana',{from:'./market-map.html?vs=btc&source=exchange',window:'h1'}),q=new URL(target,'https://local.test/').searchParams;
 assert.equal(q.get('coin'),'solana');assert.equal(q.get('from'),'./market-map.html?vs=btc&source=exchange');assert.equal(q.get('window'),'h1');
 assert.equal(tokenById(snapshot(),'SOL'),null);assert.equal(tokenById(snapshot(),'bitcoin').id,'bitcoin');
});
test('ten coincident labels separate without changing their measured anchors',()=>{
 const placed=placeLabels(Array.from({length:10},(_,i)=>({id:String(i),x:200,y:120})),480,270,70,42);
 assert.ok(placed.every(p=>p.anchorX===200&&p.anchorY===120));
 for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert.ok(Math.abs(placed[i].x-placed[j].x)>=70||Math.abs(placed[i].y-placed[j].y)>=42);
});
const today=Math.floor(now/DAY)*DAY;
const series={checkedAt:at,prices:Array.from({length:50},(_,i)=>[today-(50-i)*DAY,100+i])};
test('price chart geometry uses recorded completed daily prices and requested date range',()=>{
 const c=chartDisplay(series,7,{now});assert.equal(c.count,8);assert.equal(c.end,today-DAY);assert.equal(c.start,c.end-7*DAY);assert.equal(c.lastPrice,149);assert.equal(c.gaps,0);assert.equal(c.low,142);assert.equal(c.high,149);
 const all={version:1,generatedAt:at,coins:{solana:Object.fromEntries([7,30,365].map(d=>[d,chartDisplay(series,d,{now})]))}};assert.equal(validChartDisplay(all),true);assert.equal('prices' in c,false);
});
test('missing dates break the line and short or corrupt history is not fabricated',()=>{
 const g={...series,prices:series.prices.filter((_,i)=>i!==46)},c=chartDisplay(g,7,{now});assert.equal(c.gaps,1);assert.equal(c.path.match(/M/g).length,2);
 assert.equal(chartDisplay({checkedAt:at,prices:[[today-DAY,100]]},7,{now}).available,false);
 assert.equal(chartDisplay({checkedAt:at,prices:[[today-DAY,-1]]},7,{now}).available,false);
 const flat=chartDisplay({...series,prices:series.prices.map(r=>[r[0],1])},30,{now});assert.equal(flat.change,0);assert.ok(flat.max>flat.min);assert.ok(!flat.path.includes('NaN'));
});
test('chart payloads reject executable strings and invalid numeric fields',()=>{
 const d={version:1,generatedAt:at,coins:{solana:Object.fromEntries([7,30,365].map(n=>[n,chartDisplay(series,n,{now})]))}};
 d.coins.solana[7].path='M0,0" onload="evil';assert.equal(validChartDisplay(d),false);
});
