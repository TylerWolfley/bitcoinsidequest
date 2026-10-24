import test from 'node:test';
import assert from 'node:assert/strict';
import { riskTemperature,recordRiskHistory,validRiskHistory,riskChange,directionScore } from '../lib/risk-temperature.js';
import { visitDigest,validVisit,compareVisit } from '../lib/market-context.js';
import { readFile } from 'node:fs/promises';
export const now=Date.parse('2026-10-23T21:00:00Z'),checkedAt=new Date(now).toISOString();
export function fixture(change=2,btc=1,buy=120000){return {checkedAt,rankingCheckedAt:checkedAt,assets:Array.from({length:10},(_,i)=>({id:'coin'+i,symbol:'C'+i,kind:'alt',price:100,priceUpdatedAt:checkedAt,priceChange24h:change})),bitcoin:{priceUpdatedAt:checkedAt,priceChange24h:btc},pools:Array.from({length:10},(_,i)=>({id:'pool'+i,base:'coin'+i,quote:'tether',network:'eth',checkedAt,windows:{h24:{buy,sell:200000-buy,total:200000}}})),exchangeMarkets:[]};}
export function policyFor(s){return {version:'test.1',coins:Object.fromEntries(s.assets.map(a=>[a.id,{source:'dex',markets:s.pools.filter(p=>p.base===a.id||p.quote===a.id).map(p=>({id:p.id,base:p.base,quote:p.quote}))}]))};}
function calc(s,options={}){return riskTemperature(s,{now,policy:policyFor(s),...options});}
test('v2 has continuous price scoring and fixed explicit weights',()=>{
 const m=calc(fixture());assert.equal(m.modelVersion,2);assert.equal(m.score,69);
 assert.equal(calc(fixture(0,0,100000)).score,50);
 assert.ok(directionScore(.251)-directionScore(.249)<.04);
 assert.ok(directionScore(20)>directionScore(.26));
 assert.equal(directionScore(0),50);assert.equal(directionScore(-3)+directionScore(3),100);
});
test('the old +0.24 to +0.26 threshold cannot make a four point jump',()=>{
 const s=fixture(0,0,100000);s.assets[0].priceChange24h=.24;const before=calc(s);
 s.assets[0].priceChange24h=.26;const after=calc(s);assert.ok(Math.abs(after.score-before.score)<=1);
 assert.ok(Math.abs(after.parts.participation.score-before.parts.participation.score)<.04);
});
test('losing the three declining prices pauses the score; it never reweights the seven winners',()=>{
 const s=fixture(1,0,100000),policy=policyFor(s);s.assets.slice(7).forEach(a=>a.priceChange24h=-1);
 assert.notEqual(calc(s,{policy}).score,null);
 s.assets.slice(7).forEach(a=>a.priceUpdatedAt=new Date(now-31*60000).toISOString());
 const m=calc(s,{policy});assert.equal(m.score,null);assert.equal(m.parts.participation.score,null);assert.equal(m.parts.participation.rows.length,7);assert.equal(m.parts.participation.expected,10);
});
test('a missing declared market pauses the score; new pools and exchange fallbacks do not replace it',()=>{
 const s=fixture(),policy=policyFor(s),before=calc(s,{policy});
 s.pools.shift();s.pools.push({id:'replacement',base:'coin0',quote:'tether',checkedAt,windows:{h24:{buy:200000,sell:0,total:200000}}});
 const m=calc(s,{policy});assert.equal(m.score,null);assert.equal(m.scope,before.scope);assert.equal(m.parts.buying.rows.length,9);assert.equal(m.parts.buying.score,null);
});
test('known price-only exclusions are explicit; missing and newly ranked coins cannot self-exclude',()=>{
 const s=fixture(),policy=policyFor(s);policy.coins.coin9={source:'price-only',reason:'No reviewed feed'};s.pools.pop();
 const m=calc(s,{policy});assert.notEqual(m.score,null);assert.equal(m.parts.buying.expected,9);assert.equal(m.excluded.length,1);
 s.pools.pop();assert.equal(calc(s,{policy}).score,null);
 s.assets[8].id='newcoin';assert.equal(calc(s,{policy}).score,null);assert.deepEqual(calc(s,{policy}).unsupported,['newcoin']);
});
test('relative strength uses return division and aligned quote timestamps',()=>{
 const s=fixture(20,10),m=calc(s);assert.ok(Math.abs(m.parts.leadership.rows[0].value-9.090909)<.00001);
 s.bitcoin.priceUpdatedAt=new Date(now-6*60000).toISOString();assert.equal(calc(s).score,null);
});
test('quote direction is reversed, duplicate observations do not add weight, coins are equal weighted',()=>{
 const s=fixture();s.pools[0].base='tether';s.pools[0].quote='coin0';const policy=policyFor(s);s.pools.push({...s.pools[0]});s.pools[1].windows.h24={buy:600000,sell:400000,total:1000000};
 const m=calc(s,{policy});assert.equal(m.parts.buying.rows[0].score,40);assert.equal(m.parts.buying.score,58);assert.equal(m.parts.buying.rows[0].markets.length,1);
});
test('stale, offline, future, tiny and incomplete inputs fail closed',()=>{
 const s=fixture(),policy=policyFor(s);s.pools[0].checkedAt=new Date(now-31*60000).toISOString();assert.equal(calc(s,{policy}).score,null);
 assert.equal(calc(fixture(),{offline:true}).score,null);assert.equal(calc(fixture(),{now:now+31*60000}).score,null);
 const f=fixture();f.checkedAt=new Date(now+120000).toISOString();assert.equal(calc(f).score,null);
 const tiny=fixture();tiny.pools[0].windows.h24={buy:1,sell:1,total:2};assert.equal(calc(tiny).score,null);
});
test('history records incomplete snapshots as gaps and refuses comparisons through them',()=>{
 const m=calc(fixture()),h=recordRiskHistory(null,m,{now});assert.equal(validRiskHistory(h,{now}),true);
 assert.equal(recordRiskHistory(h,m,{now}).points.length,1);
 const s=fixture();s.checkedAt=new Date(now+900000).toISOString();s.pools.pop();
 const gap=calc(s,{now:now+900000,policy:policyFor(fixture())}),two=recordRiskHistory(h,gap,{now:now+900000});assert.equal(two.points.length,2);assert.equal(two.points[1].score,null);
 const good=calc({...fixture(),checkedAt:new Date(now+1800000).toISOString()},{now:now+1800000});
 assert.equal(riskChange(two,good),null);
 const tampered=structuredClone(h);tampered.points[0].score=99;assert.equal(validRiskHistory(tampered),false);
});
test('last-visit comparison requires matching model and coverage',()=>{
 const s=fixture(),m=calc(s),before=visitDigest(s,m,{now});assert.equal(validVisit(before),true);
 s.checkedAt=new Date(now+60000).toISOString();s.assets[0].price=110;
 const after=visitDigest(s,{...m,at:now+60000},{now:now+60000});
 assert.equal(compareVisit(before,after).up,1);assert.equal(compareVisit(before,after).sentimentChange,0);
 after.temperature.modelVersion=1;assert.equal(compareVisit(before,after).sentimentChange,null);
 assert.equal(validVisit({...before,coins:[null]}),false);
});
test('saved v2 history is valid and future points are rejected',async()=>{
 const saved=JSON.parse(await readFile(new URL('../data/market-temperature.json',import.meta.url),'utf8'));assert.equal(validRiskHistory(saved),true);
 const h=recordRiskHistory(null,calc(fixture()),{now});h.points[0].at=now+120000;assert.equal(validRiskHistory(h,{now}),false);
});
