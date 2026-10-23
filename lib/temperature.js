export const TEMPERATURE_SOURCE = 'https://alternative.me/crypto/fear-and-greed-index/';
export const TEMPERATURE_API = 'https://api.alternative.me/fng/?limit=90&format=json';
export const DAY = 86_400_000;
const classifications = new Set(['Extreme Fear','Fear','Neutral','Greed','Extreme Greed']);
const validTime = value => typeof value==='string' && Number.isFinite(Date.parse(value));

// Preserve the provider's score. The site's temperature words are presentation,
// not a new proprietary index, risk rating, or reconstruction of hidden factors.
export function temperatureBand(value) {
  if(!Number.isInteger(value)||value<0||value>100)return null;
  return value<25?{label:'Cold',text:'The index signals strong caution.',color:'#3978ca'}:
    value<45?{label:'Cool',text:'The index leans toward caution.',color:'#519fb4'}:
    value<=55?{label:'Balanced',text:'The index sits between fear and greed.',color:'#998229'}:
    value<75?{label:'Warm',text:'The index leans toward optimism.',color:'#c07938'}:
    {label:'Hot',text:'The index signals strong optimism.',color:'#c6543e'};
}

export function normalizeTemperature(payload,checkedAt=new Date().toISOString()) {
  if(payload?.metadata?.error || !validTime(checkedAt) || !Array.isArray(payload?.data) || !payload.data.length || payload.data.length>1000)throw new Error('Invalid sentiment response');
  const points=payload.data.map(p=>{
    if(typeof p.value!=='string'||!/^\d{1,3}$/.test(p.value)||typeof p.timestamp!=='string'||!/^\d+$/.test(p.timestamp)||!classifications.has(p.value_classification))throw new Error('Invalid sentiment observation');
    const value=Number(p.value),at=Number(p.timestamp)*1000;
    if(!Number.isInteger(value)||value<0||value>100||!Number.isSafeInteger(at)||at<Date.UTC(2018,0,1)||at>Date.parse(checkedAt)+60_000)throw new Error('Invalid sentiment value or date');
    return {at,value,classification:p.value_classification};
  }).sort((a,b)=>b.at-a.at);
  if(new Set(points.map(p=>p.at)).size!==points.length)throw new Error('Duplicate sentiment dates');
  return {schemaVersion:1,source:'alternative.me',checkedAt,attemptedAt:checkedAt,status:'ok',points:points.slice(0,90)};
}

export function validTemperature(feed) {
  try {
    if(feed?.schemaVersion!==1||feed.source!=='alternative.me'||!validTime(feed.attemptedAt)||!['ok','cached','unavailable'].includes(feed.status)||!Array.isArray(feed.points)||feed.points.length>90)return false;
    if(feed.status==='unavailable')return feed.checkedAt===null&&feed.points.length===0;
    if(!validTime(feed.checkedAt)||Date.parse(feed.checkedAt)>Date.parse(feed.attemptedAt)||!feed.points.length)return false;
    return feed.points.every((p,i)=>Number.isSafeInteger(p.at)&&p.at>=Date.UTC(2018,0,1)&&p.at<=Date.parse(feed.checkedAt)+60_000&&Number.isInteger(p.value)&&p.value>=0&&p.value<=100&&classifications.has(p.classification)&&(!i||feed.points[i-1].at>p.at));
  }catch{return false;}
}

export function temperatureState(feed,{now=Date.now(),offline=false}={}) {
  if(!validTemperature(feed)||!feed.points.length)return {status:'unavailable',current:null,previous:null,week:null,change:null,weekChange:null,history:[]};
  const current=feed.points[0],previous=feed.points.find(p=>p.at===current.at-DAY)??null,week=feed.points.find(p=>p.at===current.at-7*DAY)??null;
  const stale=current.at>now+60_000||now-current.at>36*3_600_000||Date.parse(feed.checkedAt)>now+60_000||now-Date.parse(feed.checkedAt)>2*3_600_000;
  return {status:offline?'offline':stale?'old':feed.status==='cached'?'cached':'current',current,previous,week,
    change:previous?current.value-previous.value:null,weekChange:week?current.value-week.value:null,
    history:[...feed.points].reverse(),band:temperatureBand(current.value)};
}

// Calendar spacing is preserved. Missing days break the line instead of
// becoming interpolated history; comparisons require exact dated observations.
export function temperatureHistory(feed,days=30) {
  if(!validTemperature(feed)||!feed.points.length)return [];
  const latest=feed.points[0].at;
  return feed.points.filter(p=>p.at>=latest-(days-1)*DAY).reverse();
}
