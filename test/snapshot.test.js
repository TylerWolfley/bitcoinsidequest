import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routesForAsset } from '../lib/model.js';
import { auditArithmetic, scopedPools } from '../lib/research.js';
import { validSnapshot } from '../lib/quality.js';
test('saved live snapshot has unique identities and reproducible routes',async()=>{
 const s=JSON.parse(await readFile(new URL('../data/snapshot.json',import.meta.url),'utf8'));
 assert.equal(validSnapshot(s),true);
 assert.equal(s.schemaVersion,1);
 assert.equal(s.assets.filter(a=>a.kind==='alt').length,10);
 assert.equal(s.assets.filter(a=>a.kind==='stable').length,5);
 assert.equal(new Set(s.assets.map(a=>a.id)).size,15);
 assert.equal(new Set(s.pools.map(a=>a.id)).size,s.pools.length);
 assert.ok(s.pools.length+(s.exchangeMarkets?.length??0)>0);
 assert.ok(Number.isFinite(Date.parse(s.checkedAt)));
 for(const p of s.pools){
   assert.ok(s.assets.some(a=>a.id===p.base));assert.ok(s.assets.some(a=>a.id===p.quote));
   assert.ok(p.liquidity>=50000);assert.ok(p.url.startsWith('https://www.geckoterminal.com/'));
   for(const [w,v] of Object.entries(p.windows)){
     assert.ok(v.buy>=0&&v.sell>=0);
     const a=routesForAsset({pools:[p]},p.base,w)[0],b=routesForAsset({pools:[p]},p.quote,w)[0];
     assert.equal(a.net+b.net,0);assert.equal(a.total,b.total);
   }
 }
 if(s.evidenceVersion===1)for(const a of s.assets)for(const w of ['h1','h6','h24']){
   const audit=auditArithmetic(scopedPools(s,a.id),a.id,w);
   assert.ok(['reproduced','no-data'].includes(audit.status),a.id+' '+w+' recorded inputs disagree with normalized data');
 }
});
