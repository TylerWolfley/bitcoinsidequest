import { readFile, writeFile, mkdir, readdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { riskTemperature, recordRiskHistory, MODEL_VERSION, WEIGHTS, PRICE_SCALE, fresh } from '../lib/risk-temperature.js';
import { TEMPERATURE_POLICY } from '../lib/temperature-policy.js';
import { makeDailyNote } from '../lib/journal.js';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ARCHIVE = path.join(ROOT, '.history');
export const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
export async function readJSON(file, fallback = null) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; } }
export async function writeJSON(file, data) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file + '.tmp', JSON.stringify(data) + '\n'); await rename(file + '.tmp', file); }
const pick = (object, keys) => Object.fromEntries(keys.filter(k => object?.[k] !== undefined).map(k => [k, object[k]]));
export function captureEvidence(snapshot, { now = Date.now(), reference = null, policy = TEMPERATURE_POLICY } = {}) {
  const assetKeys = ['id','name','symbol','kind','rank','price','marketCap','volume24h','priceChange24h','priceUpdatedAt','coverage'];
  const marketKeys = ['id','kind','network','address','base','quote','name','venue','pair','unit','sideBasis','checkedAt','periodStart','periodEnd','liquidity','windows','sourceInputs','sourceEndpoint','url'];
  const input = { checkedAt: snapshot.checkedAt, rankingCheckedAt: snapshot.rankingCheckedAt, assets: snapshot.assets.map(a => pick(a,assetKeys)), bitcoin: pick(snapshot.bitcoin,assetKeys), pools: snapshot.pools.map(p=>pick(p,marketKeys)), exchangeMarkets: (snapshot.exchangeMarkets??[]).map(p=>pick(p,marketKeys)), diagnostics: snapshot.diagnostics, poolErrors: snapshot.poolErrors, exchangeDiagnostics: snapshot.exchangeDiagnostics };
  const model = riskTemperature(input,{now,policy});
  const payload = { schemaVersion: 1, modelVersion: MODEL_VERSION, evaluatedAt: now, parameters: { weights: WEIGHTS, priceScale: PRICE_SCALE, freshnessMinutes: 30, minimumSourceUnits: 100000 }, policy, sourceRevision: process.env.GITHUB_SHA ?? null, input, reference: reference?.points?.[0] ?? null, result: { score: model.score, scope: model.scope, parts: model.parts, reason: model.reason } };
  return { sha256: digest(payload), payload };
}
export function replayEvidence(record) {
  if (record?.sha256 !== digest(record?.payload)) throw new Error('Evidence checksum mismatch');
  const p = record.payload;
  if (p.modelVersion !== MODEL_VERSION || p.parameters.priceScale !== PRICE_SCALE || JSON.stringify(p.parameters.weights) !== JSON.stringify(WEIGHTS)) throw new Error('Use the archived model version to replay this observation');
  return riskTemperature(p.input, { now: p.evaluatedAt, policy: p.policy });
}
export async function saveObservation(snapshot, { now = Date.now(), directory = ARCHIVE, priceHistory = null, reference = null } = {}) {
  const current = path.join(directory,'current');
  await mkdir(current,{recursive:true});
  let history = await readJSON(path.join(current,'market-temperature.json'));
  let journal = await readJSON(path.join(current,'journal.json'), {version:1,posts:[]});
  let latest = await readJSON(path.join(current,'evidence-latest.json'));
  let index = await readJSON(path.join(directory,'index.json'), {version:1,days:{}});
  const model = riskTemperature(snapshot,{now});
  if (fresh(snapshot.checkedAt,now)) {
    const day = snapshot.checkedAt.slice(0,10), relative = 'observations/' + day + '.jsonl', file = path.join(directory,relative);
    let lines = []; try { lines = (await readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)); } catch(e) { if(e.code!=='ENOENT')throw e; }
    latest = lines.find(r => r.payload.input.checkedAt === snapshot.checkedAt && r.payload.modelVersion === MODEL_VERSION);
    if (!latest) {
      latest = captureEvidence(snapshot,{now,reference});
      lines.push(latest);
      await mkdir(path.dirname(file),{recursive:true});
      await writeFile(file+'.tmp',lines.map(r=>JSON.stringify(r)).join('\n')+'\n'); await rename(file+'.tmp',file);
    }
    const evidence = { file:relative, sha256:latest.sha256 };
    // Re-use the original evaluation, including the original freshness decision.
    const original = replayEvidence(latest);
    history = recordRiskHistory(history,original,{now,evidence});
    index.days[day] = { count:lines.length, first:lines[0].payload.input.checkedAt, last:lines.at(-1).payload.input.checkedAt };
    const note = makeDailyNote(snapshot,original,priceHistory,{now,evidence});
    if (note) {
      const notePath = path.join(directory,'notes',note.id+'.json');
      const existing = await readJSON(notePath);
      if (!existing) await writeJSON(notePath,note);
    }
  }
  if (!history || history.modelVersion !== MODEL_VERSION) history = {modelVersion:MODEL_VERSION,points:[]};
  const noteNames = await readdir(path.join(directory,'notes')).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
  journal = {version:1,posts:await Promise.all(noteNames.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse().slice(0,90).map(n=>readJSON(path.join(directory,'notes',n))))};
  await writeJSON(path.join(directory,'index.json'),index);
  await writeJSON(path.join(current,'market-temperature.json'),history);
  await writeJSON(path.join(current,'journal.json'),journal);
  if (latest) await writeJSON(path.join(current,'evidence-latest.json'),latest);
  if (priceHistory) await writeJSON(path.join(current,'price-history.json'),priceHistory);
  return {history,journal,latest,index,model};
}
