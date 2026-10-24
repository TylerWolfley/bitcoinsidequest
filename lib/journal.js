import { fresh, riskBand } from './risk-temperature.js?v=20261023-v2';
import { scenarioRange } from './scenarios.js';
export const JOURNAL_VERSION = 1;
export function makeDailyNote(snapshot, model, priceHistory, { now = Date.now(), evidence = null } = {}) {
  if (!snapshot || !fresh(snapshot.checkedAt, now)) return null;
  const assets = snapshot.assets.filter(a => a.kind === 'alt');
  const priced = assets.filter(a => Number.isFinite(a.priceChange24h) && fresh(a.priceUpdatedAt, now));
  const band = riskBand(model.score), up = priced.filter(a => a.priceChange24h > 0).length;
  const coins = assets.map(a => {
    const row = model.parts.buying.rows.find(r => r.id === a.id);
    return { id: a.id, symbol: a.symbol, price: fresh(a.priceUpdatedAt, now) ? a.price : null, priceAt: a.priceUpdatedAt, return24h: fresh(a.priceUpdatedAt, now) ? a.priceChange24h : null, buyShare: row?.value ?? null, source: row?.source ?? null, markets: row?.markets ?? [], scenarios: [30,365].map(h => scenarioRange(a, priceHistory?.coins?.[a.id], h, {now})) };
  });
  return { version: JOURNAL_VERSION, id: new Date(now).toISOString().slice(0,10), publishedAt: new Date(now).toISOString(), observedAt: snapshot.checkedAt, title: band ? band.label + ' conditions. ' + up + ' of ' + priced.length + ' alts higher.' : 'A partial picture. ' + up + ' of ' + priced.length + ' alts higher.', temperature: model.score, modelVersion: model.modelVersion, scope: model.scope, evidence, up, priced: priced.length, buyingCount: model.parts.buying.rows.length, buyingExpected: model.parts.buying.expected, reason: model.reason, coins };
}
export function validJournal(j) {
  try { return j?.version === JOURNAL_VERSION && Array.isArray(j.posts) && j.posts.length <= 90 && new Set(j.posts.map(p=>p.id)).size === j.posts.length && j.posts.every(p => /^\d{4}-\d{2}-\d{2}$/.test(p.id) && typeof p.title === 'string' && p.title.length < 300 && Number.isFinite(Date.parse(p.publishedAt)) && Number.isFinite(Date.parse(p.observedAt)) && (p.temperature === null || Number.isInteger(p.temperature) && p.temperature >= 0 && p.temperature <= 100) && Array.isArray(p.coins) && p.coins.length === 10 && p.coins.every(c => typeof c.id === 'string' && /^[a-z0-9-]+$/.test(c.id) && typeof c.symbol === 'string' && [c.price,c.return24h,c.buyShare].every(x => x === null || Number.isFinite(x)) && Array.isArray(c.scenarios) && c.scenarios.length === 2)); } catch { return false; }
}
