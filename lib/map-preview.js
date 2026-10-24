// Descriptions of measured changes, never explanations of price causation.
// Pace and share thresholds match the existing activity highlights.
export function previewStory(reading,{benchmark='usd'}={}){
  const {asset,priceReady,return24h,relative,activityReady,pace,comparison:c,reason}=reading;
  const result={title:'Waiting for fresh prices',detail:'The last-known quote remains visible. Current price comparisons are paused.',standout:false,tone:'unknown',change:null};
  if(!priceReady)return result;
  const change=benchmark==='btc'?relative:return24h;
  result.change=change;
  if(asset.kind==='stable')return {...result,title:'A dollar target, not a safety rating',detail:'Distance from $1 shows this quote’s peg deviation. It does not describe reserves or redemption safety.',tone:'neutral'};
  if(asset.kind==='reference')return {...result,title:'The Bitcoin reference',detail:'Use this price move to put the alts in context. Bitcoin trading activity is not sampled here.',tone:'neutral'};
  if(!activityReady)return {...result,title:'Price is visible; activity is not',detail:(reason??'Activity unavailable')+'. Missing activity is not zero trading.'};
  const move=change===null?'Price comparison unavailable':benchmark==='btc'?(change>0?'Ahead of Bitcoin':change<0?'Behind Bitcoin':'Keeping pace with Bitcoin'):(change>0?'Price rising':change<0?'Price falling':'Price unchanged');
  if(pace===0)return {...result,title:'No reported trades in the last hour',detail:'The same sampled markets had trading in the preceding five hours. This does not mean trading stopped everywhere.',standout:true,tone:'quiet'};
  if(pace>=1.5)return {...result,title:move+' · busier trading',detail:'Trading is '+pace.toFixed(2)+'× the preceding five-hour hourly average in the same markets.',standout:true,tone:'active'};
  if(pace<=2/3)return {...result,title:move+' · quieter trading',detail:'Trading is '+Math.round((1-pace)*100)+'% lower than the preceding five-hour hourly average in the same markets.',standout:true,tone:'quiet'};
  if(c.current>=10000&&Number.isFinite(c.shareChange)&&Math.abs(c.shareChange)>=10)return {...result,title:c.shareChange>0?'Buying took a bigger share':'Selling took a bigger share',detail:'Reported buying moved from '+(c.priorShare*100).toFixed(1)+'% to '+(c.share*100).toFixed(1)+'% of sampled volume. That is '+Math.abs(c.shareChange).toFixed(1)+' percentage points '+(c.shareChange>0?'higher':'lower')+'.',standout:true,tone:'balance'};
  return {...result,title:'No standout shift in trading',detail:move+'. Trading pace and buying share have not crossed this map’s highlight thresholds.',tone:'neutral'};
}

export function previewBars(reading){
  const c=reading.comparison;
  if(!reading.activityReady||!Number.isFinite(c?.baseline)||!Number.isFinite(c?.current)||c.baseline<=0||c.current<0)return null;
  const max=Math.max(c.baseline,c.current);
  return {baseline:c.baseline,current:c.current,baselineWidth:c.baseline/max*100,currentWidth:c.current/max*100,
    changePercent:(reading.pace-1)*100,count:c.count,unit:reading.source==='exchange'?'USDT':'USD'};
}
