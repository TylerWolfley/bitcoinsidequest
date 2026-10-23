import { readFile,writeFile,rename,mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validSnapshot } from '../lib/quality.js';
import { riskTemperature,validRiskHistory,recordRiskHistory } from '../lib/risk-temperature.js';
const root=new URL('../data/',import.meta.url),file=fileURLToPath(new URL('market-temperature.json',root));
export async function refreshRiskTemperature(){
  const snapshot=JSON.parse(await readFile(new URL('snapshot.json',root),'utf8'));
  if(!validSnapshot(snapshot))throw new Error('Invalid market snapshot');
  let previous=null;try{previous=JSON.parse(await readFile(file,'utf8'));}catch{}
  const model=riskTemperature(snapshot),result=recordRiskHistory(previous,model);
  if(!validRiskHistory(result))throw new Error('Invalid model history');
  await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(result)+'\n');await rename(file+'.tmp',file);
  console.log('Experimental market temperature: '+(model.score===null?'unavailable · '+model.reason:model.score+'/100')+' · '+result.points.length+' recorded snapshots');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))refreshRiskTemperature().catch(e=>{console.error(e.message);process.exitCode=1;});
