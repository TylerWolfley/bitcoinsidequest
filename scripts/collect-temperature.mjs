import { readFile,writeFile,rename,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TEMPERATURE_API,normalizeTemperature,validTemperature } from '../lib/temperature.js';
const file=fileURLToPath(new URL('../data/temperature.json',import.meta.url));
export async function collectTemperature({previous=null,now=Date.now(),fetchJSON,force=false}={}) {
  const attemptedAt=new Date(now).toISOString();
  if(!force&&validTemperature(previous)&&previous.status==='ok'&&Date.parse(previous.checkedAt)<=now&&now-Date.parse(previous.checkedAt)<60*60_000&&previous.points[0].at<=now&&now-previous.points[0].at<24*3_600_000)return previous;
  try {
    const payload=await (fetchJSON??(async url=>{const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20_000)});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}))(TEMPERATURE_API);
    return normalizeTemperature(payload,attemptedAt);
  }catch{
    if(validTemperature(previous)&&previous.points.length&&Date.parse(previous.checkedAt)<=now)return {...previous,status:'cached',attemptedAt};
    return {schemaVersion:1,source:'alternative.me',checkedAt:null,attemptedAt,status:'unavailable',points:[]};
  }
}
export async function refreshTemperature(){
  let previous=null;try{previous=JSON.parse(await readFile(file,'utf8'));}catch{}
  const result=await collectTemperature({previous});
  if(!validTemperature(result))throw new Error('Temperature validation failed');
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(file+'.tmp',file);
  console.log('Market temperature: '+result.status+(result.points.length?' · '+result.points[0].value+'/100 · '+result.points.length+' daily observations':''));
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))refreshTemperature().catch(e=>{console.error(e.message);process.exitCode=1;});
