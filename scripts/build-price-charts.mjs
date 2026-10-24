import { readFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chartDisplay,CHART_PERIODS,validChartDisplay } from '../lib/price-charts.js';
import { allTokens } from '../lib/market-map.js';
export async function buildPriceCharts({now=Date.now()}={}) {
 const root=new URL('../data/',import.meta.url),snapshot=JSON.parse(await readFile(new URL('snapshot.json',root),'utf8'));
 let history;try{history=JSON.parse(await readFile(new URL('price-history.json',root),'utf8'));}catch{}
 const output={version:1,generatedAt:new Date(now).toISOString(),coins:Object.fromEntries(allTokens(snapshot).map(a=>[a.id,Object.fromEntries(CHART_PERIODS.map(d=>[d,chartDisplay(history?.coins?.[a.id],d,{now})]))]))};
 if(!validChartDisplay(output))throw new Error('Invalid chart display');
 await writeFile(new URL('price-charts.json',root),JSON.stringify(output)+'\n');return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))buildPriceCharts().then(d=>console.log('Price charts prepared for '+Object.keys(d.coins).length+' profiles')).catch(e=>{console.error(e.message);process.exitCode=1;});
