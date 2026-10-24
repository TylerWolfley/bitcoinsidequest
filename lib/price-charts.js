import { DAY, dailyPrices } from './scenarios.js';
export const CHART_PERIODS = [7,30,365];

// Rounded display geometry, not a downloadable copy of the research price series.
// Each gap starts a new path; there is no interpolation across missing days.
export function chartDisplay(series, days, { now=Date.now() }={}) {
  if(!CHART_PERIODS.includes(days))throw new Error('Unsupported chart period');
  let rows;try{rows=dailyPrices(series?.prices,now);}catch{return {available:false,reason:'Daily price history is not available yet.'};}
  const end=Math.floor(now/DAY)*DAY-DAY,start=end-days*DAY;
  rows=rows.filter(([at])=>at>=start&&at<=end);
  if(rows.length<2)return {available:false,reason:'At least two recorded daily prices are needed.'};
  const low=Math.min(...rows.map(r=>r[1])),high=Math.max(...rows.map(r=>r[1]));
  const pad=Math.max((high-low)*.1,high*.00001),min=low-pad,max=high+pad;
  let path='',gaps=0;
  const dots=[];
  rows.forEach(([at,value],i)=>{
    const gap=i>0&&at-rows[i-1][0]!==DAY;if(gap)gaps++;
    const x=+(1000*(at-start)/(end-start)).toFixed(1),y=+(240-240*(value-min)/(max-min)).toFixed(1);
    path+=(i===0||gap?'M':'L')+x+','+y;
    if((!i||gap)&&(i===rows.length-1||rows[i+1][0]-at!==DAY))dots.push([x,y]);
  });
  return {available:true,days,start,end,first:rows[0][0],last:rows.at(-1)[0],count:rows.length,gaps,path,dots,
    low,high,min,max,lastPrice:rows.at(-1)[1],change:(rows.at(-1)[1]/rows[0][1]-1)*100,checkedAt:series.checkedAt};
}
export function validChartDisplay(data) {
  try{return data?.version===1&&Number.isFinite(Date.parse(data.generatedAt))&&data.coins&&Object.entries(data.coins).length<=300&&Object.entries(data.coins).every(([id,periods])=>/^[a-z0-9-]{1,150}$/.test(id)&&CHART_PERIODS.every(days=>{
    const c=periods[days];if(c?.available===false)return typeof c.reason==='string'&&c.reason.length<200;
    return c?.available===true&&c.days===days&&[c.start,c.end,c.first,c.last].every(Number.isSafeInteger)&&c.start<=c.first&&c.first<c.last&&c.last<=c.end&&c.end-c.start===days*DAY&&Number.isInteger(c.count)&&c.count>=2&&c.count<=days+1&&Number.isInteger(c.gaps)&&c.gaps>=0&&[c.low,c.high,c.min,c.max,c.lastPrice,c.change].every(Number.isFinite)&&c.low>0&&c.high>=c.low&&c.max>c.min&&typeof c.path==='string'&&c.path.length<15000&&/^M[0-9.,ML]+$/.test(c.path)&&Array.isArray(c.dots)&&c.dots.length<=c.count&&c.dots.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&Number.isFinite(Date.parse(c.checkedAt));
  }));}catch{return false;}
}
