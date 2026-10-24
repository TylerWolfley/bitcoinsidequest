import { TEMPERATURE_POLICY } from './temperature-policy.js';

export const MODEL_VERSION = 2;
// Unfitted choices, held fixed to isolate the coverage and threshold repairs.
export const WEIGHTS = { participation: .4, leadership: .3, buying: .3 };
export const PRICE_SCALE = 3; // percentage points; not a significance threshold
export const fresh = (at, now) => Number.isFinite(Date.parse(at)) && Date.parse(at) <= now + 60_000 && now - Date.parse(at) <= 30 * 60_000;
export const directionScore = change => 50 + 50 * Math.tanh(change / PRICE_SCALE);
const mean = rows => rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : null;

export function riskTemperature(snapshot, { now = Date.now(), offline = false, policy = TEMPERATURE_POLICY } = {}) {
  const assets = (snapshot?.assets ?? []).filter(a => a.kind === 'alt');
  const live = !!snapshot && !offline && fresh(snapshot.checkedAt, now);
  const priced = live ? assets.filter(a => Number.isFinite(a.priceChange24h) && a.priceChange24h >= -100 && fresh(a.priceUpdatedAt, now)) : [];
  const btc = live && snapshot.bitcoin && fresh(snapshot.bitcoin.priceUpdatedAt, now) && Number.isFinite(snapshot.bitcoin.priceChange24h) && snapshot.bitcoin.priceChange24h > -100 ? snapshot.bitcoin : null;
  const participation = priced.map(a => ({ id: a.id, symbol: a.symbol, value: a.priceChange24h, score: directionScore(a.priceChange24h) }));
  const leadership = btc ? priced.filter(a => Math.abs(Date.parse(a.priceUpdatedAt) - Date.parse(btc.priceUpdatedAt)) <= 5 * 60_000).map(a => {
    const value = ((1 + a.priceChange24h / 100) / (1 + btc.priceChange24h / 100) - 1) * 100;
    return { id: a.id, symbol: a.symbol, value, score: directionScore(value) };
  }) : [];
  const unsupported = assets.filter(a => !policy.coins[a.id]).map(a => a.id);
  const excluded = assets.filter(a => policy.coins[a.id]?.source === 'price-only').map(a => ({ id: a.id, symbol: a.symbol, reason: policy.coins[a.id].reason }));
  const required = assets.filter(a => policy.coins[a.id] && policy.coins[a.id].source !== 'price-only');
  const buying = live ? required.map(a => {
    const entry = policy.coins[a.id];
    const pool = entry.source === 'exchange' ? snapshot.exchangeMarkets ?? [] : snapshot.pools ?? [];
    const records = entry.markets.map(e => pool.find(p => p.id === e.id && p.base === e.base && p.quote === e.quote));
    // A vanished market cannot change the denominator or silently switch venues.
    if (!records.length || records.some(p => !p?.windows?.h24 || !fresh(p.checkedAt, now))) return null;
    const ends = records.filter(p => p.kind === 'exchange').map(p => p.periodEnd);
    if (ends.some(t => !Number.isFinite(t) || t > now || now - t > 30 * 60_000 || t !== ends[0])) return null;
    let buy = 0, total = 0;
    for (const p of records) {
      const w = p.windows.h24;
      if (![w.buy, w.sell, w.total].every(Number.isFinite) || w.buy < 0 || w.sell < 0 || Math.abs(w.total - w.buy - w.sell) > Math.max(.01, w.total * 1e-6)) return null;
      buy += a.id === p.base ? w.buy : w.sell; total += w.total;
    }
    if (!Number.isFinite(total) || !Number.isFinite(buy) || total < 100_000) return null;
    const value = buy / total * 100;
    return { id: a.id, symbol: a.symbol, value, score: value, source: entry.source, unit: entry.source === 'dex' ? 'USD' : 'USDT', buy, total, markets: records.map(p => p.id).sort() };
  }).filter(Boolean) : [];
  const make = (rows, expected, key) => ({ rows, expected, score: rows.length === expected && expected > 0 ? mean(rows) : null, weight: WEIGHTS[key] });
  const parts = { participation: make(participation, 10, 'participation'), leadership: make(leadership, 10, 'leadership'), buying: make(buying, required.length, 'buying') };
  const enough = assets.length === 10 && new Set(assets.map(a => a.id)).size === 10 && unsupported.length === 0 && required.length >= 7 && Object.values(parts).every(p => p.score !== null);
  const score = enough ? Math.round(Object.values(parts).reduce((s, p) => s + p.score * p.weight, 0)) : null;
  const scope = JSON.stringify([MODEL_VERSION, policy.version, assets.map(a => a.id).sort(), required.map(a => [a.id, policy.coins[a.id].source, ...policy.coins[a.id].markets.map(m => m.id).sort()]).sort((a, b) => a[0].localeCompare(b[0]))]);
  const reason = !live ? 'Waiting for a fresh market snapshot.' : assets.length !== 10 ? 'The top-ten lineup is incomplete.' : unsupported.length ? 'A new coin needs its trading coverage reviewed.' : !enough ? 'Some required inputs are missing or old. We are holding the score, not changing the sample.' : null;
  return { modelVersion: MODEL_VERSION, policyVersion: policy.version, live, score, parts, scope, assets, excluded, unsupported, at: snapshot ? Date.parse(snapshot.checkedAt) : null, reason };
}

export function riskBand(score) {
  if (!Number.isInteger(score) || score < 0 || score > 100) return null;
  return score < 25 ? { label: 'Cold', text: 'Measured conditions are broadly weak.', color: '#3978ca' } : score < 45 ? { label: 'Cool', text: 'Measured conditions lean weaker.', color: '#519fb4' } : score <= 55 ? { label: 'Mixed', text: 'Measured conditions are close to balanced.', color: '#998229' } : score < 75 ? { label: 'Warm', text: 'Measured conditions lean stronger.', color: '#b27532' } : { label: 'Hot', text: 'Measured conditions are broadly strong.', color: '#c6543e' };
}

export function validRiskHistory(data, { now = Date.now() } = {}) {
  try {
    return data?.modelVersion === MODEL_VERSION && Array.isArray(data.points) && data.points.length <= 3000 && data.points.every((p, i) => Number.isSafeInteger(p.at) && p.at >= Date.UTC(2026, 0, 1) && p.at <= now + 60_000 && (!i || p.at > data.points[i - 1].at) && typeof p.scope === 'string' && p.scope.length > 0 && p.scope.length < 40000 && (p.score === null || (p.parts && Object.keys(WEIGHTS).every(k => Number.isFinite(p.parts[k]?.score) && p.parts[k].score >= 0 && p.parts[k].score <= 100 && Number.isInteger(p.parts[k].count) && p.parts[k].count >= 7 && p.parts[k].count <= 10) && p.score === Math.round(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + p.parts[k].score * w, 0)))));
  } catch { return false; }
}

export function recordRiskHistory(history, model, { now = Date.now(), evidence = null } = {}) {
  const points = (validRiskHistory(history, { now }) ? history.points : []).filter(p => p.at <= now + 60_000 && now - p.at <= 30 * 86_400_000);
  // Incomplete observations are explicit gaps, not interpolated scores.
  if (Number.isSafeInteger(model.at) && model.at <= now + 60_000 && now - model.at <= 30 * 60_000 && !points.some(p => p.at === model.at)) points.push({ at: model.at, score: model.score, scope: model.scope, reason: model.reason, evidence, parts: Object.fromEntries(Object.entries(model.parts).map(([k, p]) => [k, { score: p.score, count: p.rows.length, expected: p.expected }])) });
  return { modelVersion: MODEL_VERSION, points: points.sort((a, b) => a.at - b.at).slice(-3000) };
}
export function riskChange(history, model) {
  if (!validRiskHistory(history) || model.score === null) return null;
  const previous = history.points.filter(p => p.at < model.at).at(-1);
  if (!previous || previous.score === null || model.at - previous.at > 60 * 60_000) return null;
  return { value: model.score - previous.score, at: previous.at, comparable: previous.scope === model.scope };
}
