import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePool } from '../lib/model.js';
import { scopedPools, studyPools, auditArithmetic, identifierKind } from '../lib/research.js';
const registry=new Map([['eth_0xaaa',{assetId:'eth',representation:'WETH',wrapped:true}],['eth_0xbbb',{assetId:'usd',representation:'USDC',wrapped:false}]]);
function make(id,buy,sell,h6Total=1000){return normalizePool({attributes:{address:id,name:'WETH / USDC',reserve_in_usd:'100000',buy_volume_usd:{h1:String(buy),h6:String(h6Total/2)},sell_volume_usd:{h1:String(sell),h6:String(h6Total/2)},volume_usd:{h1:String(buy+sell),h6:String(h6Total)}},relationships:{base_token:{data:{id:'eth_0xaaa'}},quote_token:{data:{id:'eth_0xbbb'}},dex:{data:{id:'uniswap'}}}},registry,'eth','2026-10-23T20:00:00Z');}
test('pace compares the last hour with the preceding five hours on identical pools',()=>{
 const p=make('a',300,200,1500),q=make('b',80,20,600);
 const s=studyPools([p,q,p],'eth','h1');
 assert.equal(s.summary.total,600);assert.equal(s.pace.lastHour,600);assert.equal(s.pace.precedingHourly,300);assert.equal(s.pace.ratio,2);assert.equal(s.liquidity,200000);
 assert.equal(s.largestShare,500/600);
});
test('missing and inconsistent windows never create a pace claim',()=>{
 const missing=make('a',1,1);delete missing.windows.h6;
 const inconsistent=make('b',300,200,100);
 const s=studyPools([missing,inconsistent],'eth','h1');assert.equal(s.pace.pools,0);assert.equal(s.pace.ratio,null);
 const zero=studyPools([make('c',0,0,0)],'eth','h1');assert.equal(zero.largestShare,null);assert.equal(zero.pace.ratio,null);
});
test('sensitivity exposes a direction flip when a dominant pool is removed',()=>{
 const s=studyPools([make('big',800,200),make('small',0,300)],'eth','h1');assert.equal(s.summary.net,300);assert.equal(s.withoutLargest.net,-300);
 assert.equal(studyPools([make('only',1,0)],'eth','h1').withoutLargest,null);
});
test('network and counterparty scopes preserve distinct pool identities',()=>{
 const p=make('a',20,10),q={...p,id:'solana_a',network:'solana'},r={...p,id:'eth_b',quote:'dai'};
 assert.deepEqual(scopedPools({pools:[p,p,q,r]},'eth','eth','usd').map(p=>p.id),['eth_a']);
 assert.equal(scopedPools({pools:[p,q]},'eth','tron').length,0);
});
test('source arithmetic checks direction, missing inputs, tampering and identity',()=>{
 const p=make('a',300,100);
 assert.equal(auditArithmetic([p],'eth','h1').net,200);assert.equal(auditArithmetic([p],'usd','h1').net,-200);
 assert.equal(auditArithmetic([p],'usd','h1').status,'reproduced');
 const noInputs={...p};delete noInputs.sourceInputs;assert.equal(auditArithmetic([noInputs],'eth','h1').status,'missing-inputs');
 const tamper=structuredClone(p);tamper.sourceInputs.buy.h1='600';assert.equal(auditArithmetic([tamper],'eth','h1').status,'mismatch');
 const wrong=structuredClone(p);wrong.baseTokenAddress='0xdifferent';assert.equal(auditArithmetic([wrong],'eth','h1').status,'mismatch');
});
test('a pool ID is not advertised as an execution contract',()=>{
 assert.equal(identifierKind({network:'eth',address:'0x'+'a'.repeat(64)}),'Pool ID · not a contract address');
 assert.equal(identifierKind({network:'eth',address:'0x'+'a'.repeat(40)}),'Pool address');
});
test('source identity validation rejects another network and boolean amounts',()=>{
 const p=make('a',300,100),wrong=structuredClone(p);
 wrong.sourceInputs.baseTokenId='solana_0xaaa';
 assert.equal(auditArithmetic([wrong],'eth','h1').status,'mismatch');
 wrong.sourceInputs.baseTokenId=12;
 assert.equal(auditArithmetic([wrong],'eth','h1').status,'mismatch');
 wrong.sourceInputs=structuredClone(p.sourceInputs);wrong.sourceInputs.buy.h1=true;
 assert.equal(auditArithmetic([wrong],'eth','h1').status,'mismatch');
});
