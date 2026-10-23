import { eligibleMarkets, validateMarketIdentity, BINANCE, KRAKEN, BAR_MS, binanceBars, krakenBars, exchangeRecord, validExchangeMarket } from '../lib/exchanges.js';

export async function collectExchanges(assets, request, {now=Date.now(),log=console.log,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const end=Math.floor(now/BAR_MS)*BAR_MS, start=end-86_400_000;
  const markets=[], diagnostics=[], ids=new Set(assets.map(a=>a.id));
  for (const venue of ['binance','kraken']) {
    const specs=eligibleMarkets(assets).filter(m=>m.venue===venue);
    if(!specs.length)continue;
    let lastCall=0;
    const get=async url=>{
      await pause(Math.max(0,1100-(Date.now()-lastCall)));lastCall=Date.now();
      return request(url);
    };
    let metadata;
    try {
      const clock=await get(venue==='binance'?BINANCE+'/time':KRAKEN+'/Time');
      if(venue==='kraken'&&clock.error?.length)throw new Error('Exchange clock unavailable');
      const serverTime=venue==='binance'?clock.serverTime:clock.result?.unixtime*1000;
      if(!Number.isFinite(serverTime)||serverTime<end||Math.abs(serverTime-Date.now())>300_000)throw new Error('Exchange clock unavailable or inconsistent');
      if(venue==='kraken')metadata=await get(KRAKEN+'/AssetPairs');
      if(venue==='kraken'&&(!Array.isArray(metadata.error)||metadata.error.length))throw new Error('Market identities unavailable');
    } catch(error) {
      for(const m of specs)diagnostics.push({id:m.id,assetId:m.base,venue,status:'unavailable',error:error.message});
      continue;
    }
    for(const m of specs)try {
      // One bad/delisted symbol must not invalidate other Binance pairs.
      const identity=venue==='binance'?(await get(BINANCE+'/exchangeInfo?symbol='+m.pair)).symbols?.find(s=>s.symbol===m.pair):metadata.result?.[m.pair];
      if(!validateMarketIdentity(m,identity))throw new Error('Reviewed spot identity is absent, changed or not active');
      let result;
      if(venue==='binance')result={bars:binanceBars(await get(BINANCE+'/klines?symbol='+m.pair+'&interval=5m&limit=300&startTime='+start+'&endTime='+(end-1)),start,end),pages:1};
      else result=await krakenBars(m,start,end,get);
      const market=exchangeRecord(m,result.bars,end,new Date().toISOString(),result.pages);
      if(!validExchangeMarket(market,ids))throw new Error('Exchange window validation failed');
      markets.push(market);diagnostics.push({id:m.id,assetId:m.base,venue,status:'ok',pages:result.pages,checkedAt:market.checkedAt});
      log(m.id+': complete 24h window, '+market.windows.h24.count+' trades');
    } catch(error) {diagnostics.push({id:m.id,assetId:m.base,venue,status:'unavailable',error:error.message});log(m.id+': '+error.message);}
  }
  return {markets,diagnostics};
}
