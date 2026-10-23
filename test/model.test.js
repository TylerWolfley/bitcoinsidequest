import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUniverse, identityRegistry, normalizePool, routesForAsset, summarizeRoutes, numberOrNull, addressKey, ageMinutes } from '../lib/model.js';
const registry = new Map([
 ['eth_0xaaa', { assetId:'ethereum', representation:'Wrapped Ether', wrapped:true }],
 ['eth_0xbbb', { assetId:'usd-coin', representation:'USDC', wrapped:false }],
]);
function pool(overrides={}) { return { attributes:{ address:'0xPOOL',name:'WETH/USDC',reserve_in_usd:'100000', buy_volume_usd:{h1:'200'},sell_volume_usd:{h1:'80'},volume_usd:{h1:'280'},...overrides},
 relationships:{base_token:{data:{id:'eth_0xAAA'}},quote_token:{data:{id:'eth_0xBBB'}},dex:{data:{id:'uniswap'}}} }; }
test('pool buy dollars reverse correctly when selecting the quote asset',()=>{
 const p=normalizePool(pool(),registry,'eth','2026-10-23T00:00:00Z');
 assert.ok(p);
 const base=routesForAsset({pools:[p]},'ethereum','h1')[0], quote=routesForAsset({pools:[p]},'usd-coin','h1')[0];
 assert.equal(base.incoming,200);assert.equal(base.outgoing,80);assert.equal(base.net,120);
 assert.equal(quote.incoming,80);assert.equal(quote.outgoing,200);assert.equal(quote.net,-120);
});
test('repeated provider pool records cannot double-count flows',()=>{
 const p=normalizePool(pool(),registry,'eth',new Date().toISOString());
 assert.equal(summarizeRoutes(routesForAsset({pools:[p,p]},'ethereum','h1')).total,280);
});
test('buy/sell counts and missing dollar amounts never become arrows',()=>{
 assert.equal(normalizePool(pool({buy_volume_usd:undefined,transactions:{h1:{buys:100,sells:5}}}),registry,'eth','now'),null);
 assert.equal(normalizePool(pool({buy_volume_usd:{h1:null}}),registry,'eth','now'),null);
 assert.equal(normalizePool(pool({buy_volume_usd:{h1:'-2'}}),registry,'eth','now'),null);
 assert.equal(normalizePool(pool({volume_usd:{h1:'999'}}),registry,'eth','now'),null);
});
test('zero real volume stays different from absent coverage',()=>{
 const p=normalizePool(pool({buy_volume_usd:{h1:'0'},sell_volume_usd:{h1:'0'},volume_usd:{h1:'0'}}),registry,'eth','now');
 assert.equal(summarizeRoutes(routesForAsset({pools:[p]},'ethereum','h1')).buyShare,null);
 assert.equal(summarizeRoutes(routesForAsset({pools:[]},'ethereum','h1')),null);
 assert.equal(routesForAsset({pools:[p]},'ethereum','h24').length,0);
});
test('unknown counterparties and low-liquidity pools are excluded',()=>{
 const p=pool();p.relationships.quote_token.data.id='eth_0xSCAM';
 assert.equal(normalizePool(p,registry,'eth','now'),null);
 assert.equal(normalizePool(pool({reserve_in_usd:'49999'}),registry,'eth','now'),null);
});
test('rankings are dynamic, stablecoins separated, wrappers excluded',()=>{
 const stables=Array.from({length:5},(_,i)=>({gecko_id:'usd'+i,pegType:'peggedUSD'}));
 const markets=[{id:'bitcoin',name:'Bitcoin',market_cap:10000},{id:'weth',name:'Wrapped Ether',market_cap:9000},...stables.map((a,i)=>({id:a.gecko_id,name:a.gecko_id,market_cap:5000-i})),...Array.from({length:12},(_,i)=>({id:'alt'+i,name:'Alt '+i,market_cap:1000-i}))];
 const first=selectUniverse(markets,stables);
 assert.equal(first.alts.length,10);assert.equal(first.stables.length,5);assert.equal(first.alts[0].id,'alt0');
 markets.find(a=>a.id==='alt11').market_cap=2000;
 assert.equal(selectUniverse(markets,stables).alts[0].id,'alt11');
 assert.throws(()=>selectUniverse(markets,[]));
});
test('ticker lookalikes do not establish identity; native wrappers stay chain scoped',()=>{
 const result=identityRegistry([{id:'ethereum',kind:'alt'}],[{id:'weth',name:'WETH',platforms:{ethereum:'0xAAA',tron:'lookalike'}}]);
 assert.equal(result.registry.get('eth_0xaaa').assetId,'ethereum');
 assert.equal(result.registry.has('tron_lookalike'),false);
 assert.equal(addressKey('solana','AbCd'),'solana_AbCd');
 assert.equal(numberOrNull(null),null);assert.equal(numberOrNull('0'),0);
});
test('timestamps distinguish stale and unavailable data',()=>{
 assert.equal(ageMinutes('2026-10-23T00:00:00Z',Date.parse('2026-10-23T01:00:00Z')),60);
 assert.equal(ageMinutes(undefined),Infinity);
});
