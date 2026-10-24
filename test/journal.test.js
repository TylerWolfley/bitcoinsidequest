import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { dailyPrices,scenarioRange,validPriceHistory,DAY,priceStatistics,scenarioFromStatistics,validPriceStatistics } from '../lib/scenarios.js';
import { archiveKey,sealArchive,openArchive } from '../scripts/archive-crypto.mjs';
import { makeDailyNote,validJournal } from '../lib/journal.js';
import { captureEvidence,replayEvidence,saveObservation } from '../scripts/history-store.mjs';
import { riskTemperature } from '../lib/risk-temperature.js';
const now=Date.parse('2026-10-23T21:00:00Z'),at=new Date(now).toISOString(),today=Math.floor(now/DAY)*DAY;
const series={checkedAt:at,source:'https://api.coingecko.com/api/v3/coins/solana/market_chart',prices:Array.from({length:365},(_,i)=>[today-(365-i)*DAY,100*Math.exp(Math.sin(i)*.05)])};
const asset={id:'solana',price:100,priceUpdatedAt:at};
test('price ranges use only completed daily data and expose every assumption',()=>{
 const r=scenarioRange(asset,series,30,{now});assert.equal(r.available,true);assert.equal(r.count,364);assert.equal(r.drift,0);assert.ok(Math.abs(r.low*r.high-10000)<1e-8);
 assert.ok(scenarioRange(asset,series,365,{now}).high>r.high);
 assert.equal(dailyPrices([...series.prices,[now,1000]],now).length,365);
 assert.equal(validPriceHistory({version:1,coins:{solana:series}}),true);
});
test('short, gapped, stale or future price evidence cannot produce a range',()=>{
 assert.equal(scenarioRange(asset,{...series,prices:series.prices.slice(-61)},30,{now}).available,true);
 assert.equal(scenarioRange(asset,{...series,prices:series.prices.slice(-61)},365,{now}).available,false);
 assert.equal(scenarioRange(asset,{...series,prices:series.prices.filter((_,i)=>i!==100)},30,{now}).available,false);
 assert.equal(scenarioRange(asset,series,30,{now:now+4*DAY}).available,false);
 assert.equal(scenarioRange({...asset,priceUpdatedAt:new Date(now+120000).toISOString()},series,30,{now}).available,false);
 assert.throws(()=>scenarioRange(asset,series,10,{now}));
});
test('evidence replays exact inputs and rejects tampering',async()=>{
 const s=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8')),evaluated=Date.parse(s.checkedAt);
 const record=captureEvidence(s,{now:evaluated}),replayed=replayEvidence(record);assert.equal(replayed.score,record.payload.result.score);assert.deepEqual(replayed.parts,record.payload.result.parts);
 assert.equal(record.payload.input.assets.length,15);assert.ok(record.payload.policy);assert.ok(record.payload.parameters);
 assert.equal(record.payload.input.exchangeMarkets.some(m=>m.bars),false);
 const changed=structuredClone(record);changed.payload.input.assets[0].price+=1;assert.throws(()=>replayEvidence(changed),/checksum/);
});
test('durable local store deduplicates observations and freezes the first daily note',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'bsq-evidence-'));
 try {
  const s=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8')),clock=Date.parse(s.checkedAt),prices={version:1,coins:{solana:series}};
  const first=await saveObservation(s,{now:clock,directory,priceHistory:prices}),again=await saveObservation(s,{now:clock+1000,directory,priceHistory:prices});
  assert.equal(again.history.points.length,1);assert.equal(again.journal.posts.length,1);assert.equal(again.latest.sha256,first.latest.sha256);assert.deepEqual(again.journal.posts,first.journal.posts);
  const later=structuredClone(s);later.checkedAt=new Date(clock+900000).toISOString();later.assets[0].priceChange24h=9;
  const second=await saveObservation(later,{now:clock+900000,directory,priceHistory:prices});assert.equal(second.history.points.length,2);
  if(later.checkedAt.slice(0,10)===s.checkedAt.slice(0,10))assert.deepEqual(second.journal.posts,first.journal.posts);
  assert.equal(validJournal(second.journal),true);
 } finally {await rm(directory,{recursive:true,force:true});}
});
test('daily notes refuse stale snapshots and save unavailable ranges honestly',async()=>{
 const s=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8')),clock=Date.parse(s.checkedAt),m=riskTemperature(s,{now:clock});
 assert.equal(makeDailyNote(s,m,null,{now:clock+31*60000}),null);
 const note=makeDailyNote(s,m,null,{now:clock});assert.equal(note.coins.every(c=>c.scenarios.every(r=>!r.available)),true);
});

test('public volatility summaries reproduce private-history scenario calculations',()=>{
 const stats=priceStatistics(series,{now});
 assert.equal(validPriceStatistics({version:1,coins:{solana:stats}}),true);
 assert.deepEqual(scenarioFromStatistics(asset,stats,365,{now}),scenarioRange(asset,series,365,{now}));
 assert.equal('prices' in stats,false);
});
test('archive encryption authenticates content, filename and key',()=>{
 const key=archiveKey('a'.repeat(64)),bytes=Buffer.from('private replay inputs'),envelope=sealArchive(bytes,'observations/day.jsonl',key);
 assert.equal(JSON.stringify(envelope).includes('private replay inputs'),false);
 assert.deepEqual(openArchive(envelope,'observations/day.jsonl',key),bytes);
 assert.throws(()=>openArchive(envelope,'different.jsonl',key));
 assert.throws(()=>openArchive(envelope,'observations/day.jsonl',archiveKey('b'.repeat(64))));
 assert.throws(()=>archiveKey(''));
});
