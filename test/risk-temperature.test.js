import test from 'node:test';
import assert from 'node:assert/strict';
import { riskTemperature,recordRiskHistory,validRiskHistory,riskChange,directionScore } from '../lib/risk-temperature.js';
import { visitDigest,validVisit,compareVisit } from '../lib/market-context.js';
import { readFile } from 'node:fs/promises';
const now=Date.parse('2026-10-23T21:00:00Z'),checkedAt=new Date(now).toISOString();
function fixture(change=2,btc=1,buy=120000){return {checkedAt,assets:Array.from({length:10},(_,i)=>({id:'coin'+i,symbol:'C'+i,kind:'alt',price:100,priceUpdatedAt:checkedAt,priceChange24h:change})),bitcoin:{priceUpdatedAt:checkedAt,priceChange24h:btc},pools:Array.from({length:10},(_,i)=>({id:'pool'+i,base:'coin'+i,quote:'tether',network:'eth',checkedAt,windows:{h24:{buy,sell:200000-buy,total:200000}}})),exchangeMarkets:[]};}
test('custom temperature has reproducible weights and never uses a reference sentiment score',()=>{
 const model=riskTemperature(fixture(),{now});assert.equal(model.score,88);assert.equal(model.parts.participation.score,100);assert.equal(model.parts.leadership.score,100);assert.equal(model.parts.buying.score,60);
 assert.equal(riskTemperature(fixture(0,0,100000),{now}).score,50);assert.equal(riskTemperature(fixture(-3,-1,80000),{now}).score,12);
 assert.equal(directionScore(.25),50);assert.equal(directionScore(-.25),50);assert.equal(directionScore(.251),100);
});
test('relative strength uses return division with aligned quote timestamps',()=>{
 const s=fixture(20,10),m=riskTemperature(s,{now});assert.ok(Math.abs(m.parts.leadership.rows[0].value-9.090909)<.00001);
 s.bitcoin.priceUpdatedAt=new Date(now-6*60000).toISOString();assert.equal(riskTemperature(s,{now}).score,null);assert.equal(riskTemperature(s,{now}).parts.leadership.rows.length,0);
});
test('buying reverses quote direction, deduplicates markets and weights coins equally',()=>{
 const s=fixture();s.pools[0].base='tether';s.pools[0].quote='coin0';s.pools.push({...s.pools[0]});s.pools[1].windows.h24={buy:600000,sell:400000,total:1000000};
 const m=riskTemperature(s,{now});assert.equal(m.parts.buying.rows[0].score,40);assert.equal(m.parts.buying.score,58);assert.equal(m.parts.buying.rows[0].markets.length,1);
});
test('coverage never becomes fear; seven fresh coins are required in every component',()=>{
 const s=fixture();s.pools.splice(7);assert.equal(riskTemperature(s,{now}).score,88);s.pools.pop();const m=riskTemperature(s,{now});assert.equal(m.score,null);assert.equal(m.parts.buying.rows.length,6);
 assert.equal(riskTemperature(fixture(),{now,offline:true}).score,null);assert.equal(riskTemperature(fixture(),{now:now+31*60000}).score,null);
 const future=fixture();future.checkedAt=new Date(now+120000).toISOString();assert.equal(riskTemperature(future,{now}).score,null);
});
test('stale, incomplete, tiny and invalid trading samples are excluded as a whole',()=>{
 const s=fixture();s.pools[0].checkedAt=new Date(now-31*60000).toISOString();s.pools[1].windows={};s.pools[2].windows.h24={buy:10,sell:10,total:20};s.pools[3].windows.h24={buy:100,sell:100,total:1000};const m=riskTemperature(s,{now});assert.equal(m.parts.buying.rows.length,6);assert.equal(m.score,null);
});
test('history records real snapshots once, reproduces the score and guards coverage changes',()=>{
 const m=riskTemperature(fixture(),{now}),h=recordRiskHistory(null,m,{now});assert.equal(h.points.length,1);assert.equal(validRiskHistory(h),true);assert.equal(recordRiskHistory(h,m,{now}).points.length,1);
 const s=fixture();s.checkedAt=new Date(now+900000).toISOString();const n=riskTemperature(s,{now:now+900000}),two=recordRiskHistory(h,n,{now:now+900000});assert.equal(two.points.length,2);assert.equal(riskChange(two,n).comparable,true);
 s.pools[0].id='different-pool';const shifted=riskTemperature(s,{now:now+900000});assert.equal(riskChange(h,shifted).comparable,false);const tampered=structuredClone(two);tampered.points[0].score=99;assert.equal(validRiskHistory(tampered),false);
 const absent=riskTemperature(fixture(),{now:now+31*60000});assert.deepEqual(recordRiskHistory(h,absent,{now:now+31*60000}),h);
});
test('last visit compares only matching coins and rejects malformed, old or future baselines',()=>{
 const s=fixture(),m=riskTemperature(s,{now}),before=visitDigest(s,m,{now});assert.equal(validVisit(before),true);assert.equal(validVisit({...before,coins:[null]}),false);
 s.checkedAt=new Date(now+60000).toISOString();s.assets[0].price=110;s.assets[1].id='newcoin';const after=visitDigest(s,{...m,at:now+60000},{now:now+60000});const c=compareVisit(before,after);assert.equal(c.matched.length,9);assert.equal(c.up,1);assert.equal(c.membershipChanged,true);assert.equal(c.sentimentChange,0);
 after.temperature.scope='changed';assert.equal(compareVisit(before,after).sentimentChange,null);assert.equal(compareVisit(after,before),null);assert.equal(compareVisit(before,{...after,visitedAt:now+31*86400000}),null);
});
test('saved history is a valid reproducible series, and future observations are rejected',async()=>{
 const saved=JSON.parse(await readFile(new URL('../data/market-temperature.json',import.meta.url),'utf8'));assert.equal(validRiskHistory(saved),true);
 const h=recordRiskHistory(null,riskTemperature(fixture(),{now}),{now});h.points[0].at=now+120000;assert.equal(validRiskHistory(h,{now}),false);
});
