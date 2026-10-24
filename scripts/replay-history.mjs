import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import { ARCHIVE,replayEvidence } from './history-store.mjs';
const directory=process.argv[2]??path.join(ARCHIVE,'observations');
let count=0,missing=0;
for(const name of (await readdir(directory)).filter(n=>n.endsWith('.jsonl')).sort()){
  for(const line of (await readFile(path.join(directory,name),'utf8')).trim().split('\n').filter(Boolean)){
    const record=JSON.parse(line),model=replayEvidence(record);
    if(model.score!==record.payload.result.score||model.scope!==record.payload.result.scope||JSON.stringify(model.parts)!==JSON.stringify(record.payload.result.parts))throw new Error('Replay mismatch in '+name);
    count++;if(model.score===null)missing++;
  }
}
console.log(JSON.stringify({verified:count,incomplete:missing,modelVersion:2,note:'Arithmetic replay only. Predictive usefulness is not established.'}));
