import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validSnapshot,poolURL,viewHealth} from '../lib/quality.js';
const snapshot=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8'));
// Structural test fixture must also work when every DEX feed is temporarily down.
snapshot.pools=[{id:'eth_0xfixture',network:'eth',address:'0xfixture',name:'Fixture pair',dex:'fixture',base:snapshot.assets[0].id,quote:snapshot.assets[10].id,liquidity:50000,checkedAt:snapshot.checkedAt,windows:{h24:{buy:40,sell:60,total:100}}}];

test('snapshot rejects malformed amounts, unknown identities and duplicate pools',()=>{
  assert.equal(validSnapshot(snapshot),true);
  for(const mutate of [s=>s.pools[0].windows.h24.buy=-1,s=>s.pools[0].windows.h24.buy='100',s=>s.pools[0].base='unknown',s=>s.pools.push(s.pools[0]),s=>s.assets[0].price=true,s=>s.assets[0].priceChange24h='NaN',s=>s.pools[0].windows=null]){
    const s=structuredClone(snapshot);mutate(s);assert.equal(validSnapshot(s),false);
  }
});
test('public pool links are constructed, never trusted from a feed',()=>{
  const url=poolURL({network:'eth',address:'0xabc',url:'javascript:alert(1)'});
  assert.equal(url,'https://www.geckoterminal.com/eth/pools/0xabc');
  assert.equal(new URL(poolURL({network:'evil.test/../../',address:'?x=1#'})).hostname,'www.geckoterminal.com');
});
test('an older pool cannot inherit a newer snapshot freshness label',()=>{
  const now=Date.parse('2026-10-23T20:00:00Z'),s={diagnostics:[],poolErrors:[]};
  const h=viewHealth(s,[{checkedAt:'2026-10-23T19:20:00Z'},{checkedAt:'2026-10-23T19:55:00Z'}],now);
  assert.equal(h.status,'old');assert.equal(h.age,40);assert.equal(h.spreadMinutes,35);
  assert.equal(viewHealth(s,[],now).status,'no-data');
  assert.equal(viewHealth({...s,poolErrors:[{}]},[{checkedAt:'2026-10-23T19:55:00Z'}],now).status,'partial');
});
