import test from 'node:test';
import assert from 'node:assert/strict';
import { previewStory,previewBars } from '../lib/map-preview.js';
import { marketReading } from '../lib/market-map.js';
const at=Date.parse('2026-10-24T01:00:00Z'),stamp=new Date(at).toISOString();
function reading({pace=2,price=-5,kind='alt',source='dex',currentShare=.5,priorShare=.5,offline=false}={}){
 const asset={id:'example',symbol:'EX',kind,price:100,priceChange24h:price,priceUpdatedAt:stamp};
 const baseline=20000,current=baseline*pace,previous=baseline*5;
 const record={id:'sample',base:asset.id,quote:'tether',network:'eth',checkedAt:stamp,windows:{h1:{buy:current*currentShare,sell:current*(1-currentShare),total:current},h6:{buy:current*currentShare+previous*priorShare,sell:current*(1-currentShare)+previous*(1-priorShare),total:current+previous}}};
 const snap={checkedAt:stamp,assets:[asset],pools:[record],exchangeMarkets:[],bitcoin:{priceUpdatedAt:stamp,priceChange24h:-10}};
 const r=marketReading(snap,asset,{now:at,offline});r.source=source;return r;
}
test('preview describes measured pace and price together without inventing a cause',()=>{
 const r=reading(),s=previewStory(r),bars=previewBars(r);
 assert.match(s.title,/Price falling.*busier/);assert.equal(s.standout,true);assert.match(s.detail,/2.00×.*same markets/);
 assert.equal(bars.baseline,20000);assert.equal(bars.current,40000);assert.equal(bars.baselineWidth,50);assert.equal(bars.currentWidth,100);assert.equal(bars.unit,'USD');
 assert.equal(previewBars(reading({source:'exchange'})).unit,'USDT');
});
test('preview benchmark agrees with the selected compounded BTC return',()=>{
 const r=reading(),s=previewStory(r,{benchmark:'btc'});assert.match(s.title,/Ahead of Bitcoin/);assert.ok(s.change>0);assert.equal(s.change,r.relative);
 r.relative=null;assert.match(previewStory(r,{benchmark:'btc'}).title,/comparison unavailable/);
});
test('quiet and zero samples remain distinct from missing data',()=>{
 assert.match(previewStory(reading({pace:.5})).detail,/50% lower/);
 const zero=reading({pace:0});assert.match(previewStory(zero).title,/No reported trades/);assert.equal(previewBars(zero).currentWidth,0);
 zero.activityReady=false;zero.reason='No mapped activity';zero.pace=null;
 assert.equal(previewBars(zero),null);assert.equal(previewStory(zero).standout,false);assert.match(previewStory(zero).detail,/Missing activity is not zero/);
});
test('buying-share changes are percentage points and respect the current-volume floor',()=>{
 const r=reading({pace:1,currentShare:.7,priorShare:.5});assert.match(previewStory(r).title,/Buying took/);assert.match(previewStory(r).detail,/20.0 percentage points/);
 r.comparison.current=9999;assert.equal(previewStory(r).standout,false);
 const s=previewStory(reading({pace:1,currentShare:.3,priorShare:.5}));assert.match(s.title,/Selling took/);assert.match(s.detail,/lower/);
});
test('ordinary trading is not manufactured into a standout signal',()=>{
 const r=reading({pace:1.2,price:12});assert.equal(previewStory(r).standout,false);assert.match(previewStory(r).title,/No standout shift/);
 assert.equal(previewStory(reading({pace:1.5})).standout,true);assert.equal(previewStory(reading({pace:2/3})).standout,true);
});
test('stale prices, stables and BTC have honest distinct preview states',()=>{
 const r=reading({offline:true});assert.match(previewStory(r).title,/Waiting for fresh/);assert.equal(previewStory(r).change,null);assert.equal(previewBars(r),null);
 assert.match(previewStory(reading({kind:'stable'})).title,/not a safety rating/);
 assert.match(previewStory(reading({kind:'reference'})).detail,/not sampled/);
});
