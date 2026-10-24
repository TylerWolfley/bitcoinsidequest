import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validSnapshot } from '../lib/quality.js';
import { validRiskHistory } from '../lib/risk-temperature.js';
import { ROOT, readJSON, writeJSON, saveObservation } from './history-store.mjs';
export async function refreshRiskTemperature() {
  const data = path.join(ROOT,'data'), snapshot = await readJSON(path.join(data,'snapshot.json'));
  if (!validSnapshot(snapshot)) throw new Error('Invalid market snapshot');
  const result = await saveObservation(snapshot,{priceHistory:await readJSON(path.join(data,'price-history.json')),reference:await readJSON(path.join(data,'temperature.json'))});
  if (!validRiskHistory(result.history)) throw new Error('Invalid model history');
  await writeJSON(path.join(data,'market-temperature.json'),result.history);
  await writeJSON(path.join(data,'journal.json'),result.journal);
  if (result.latest) await writeJSON(path.join(data,'evidence-latest.json'),result.latest);
  const days = Object.values(result.index.days);
  await writeJSON(path.join(data,'archive-status.json'),{version:1,durable:false,observations:days.reduce((s,d)=>s+d.count,0),days:days.length,lastAt:days.map(d=>d.last).sort().at(-1)??null,branch:'market-history'});
  console.log('Temperature v2: '+(result.model.score??'waiting')+' · '+result.history.points.length+' observations · '+result.journal.posts.length+' daily notes');
  return result.history;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) refreshRiskTemperature().catch(e=>{console.error(e.message);process.exitCode=1;});
