import { numberOrNull, addressKey, summarizeRoutes } from './model.js';

export function scopedPools(snapshot, assetId, network = 'all', otherId = null) {
  return [...new Map((snapshot.pools ?? []).filter(p =>
    (network === 'all' || p.network === network) &&
    (p.base === assetId || p.quote === assetId) &&
    (!otherId || (p.base === assetId ? p.quote : p.base) === otherId)
  ).map(p => [p.id, p])).values()];
}

export function studyPools(pools, assetId, window) {
  const unique = [...new Map(pools.map(p => [p.id, p])).values()];
  const rows = unique.filter(p => p.windows[window]).map(p => {
    const v = p.windows[window], base = p.base === assetId;
    return { pool: p, incoming: base ? v.buy : v.sell, outgoing: base ? v.sell : v.buy, total: v.buy + v.sell };
  }).sort((a,b) => b.total - a.total || a.pool.id.localeCompare(b.pool.id));
  const summary = summarizeRoutes(rows);
  const largest = rows[0] ?? null;
  const withoutLargest = summarizeRoutes(rows.slice(1));
  // Compare disjoint periods using the SAME pools, from each pool's same response.
  const comparable = rows.map(r=>r.pool).filter(p => p.windows.h1 && p.windows.h6 && p.windows.h6.total >= p.windows.h1.total);
  const lastHour = comparable.reduce((n,p) => n + p.windows.h1.total, 0);
  const precedingHourly = comparable.reduce((n,p) => n + (p.windows.h6.total - p.windows.h1.total) / 5, 0);
  return { rows, summary, largest, withoutLargest, poolCount: unique.length,
    largestShare: summary?.total > 0 ? largest.total / summary.total : null,
    liquidity: rows.reduce((n,r) => n + r.pool.liquidity, 0),
    pace: { pools: comparable.length, lastHour, precedingHourly, ratio: precedingHourly > 0 ? lastHour / precedingHourly : null },
  };
}

export function sourceEndpoint(pool) {
  return 'https://api.geckoterminal.com/api/v2/networks/' + encodeURIComponent(pool.network) + '/pools/' + encodeURIComponent(pool.address) + '?include_volume_breakdown=true';
}

// A pool ID is not necessarily a contract address (notably Uniswap v4).
export function identifierKind(pool) {
  if (pool.network === 'solana') return 'Pool account';
  if (pool.network === 'tron') return 'Pool identifier';
  return /^0x[0-9a-f]{40}$/i.test(pool.address) ? 'Pool address' : 'Pool ID · not a contract address';
}

export function auditArithmetic(pools, assetId, window) {
  const rows = studyPools(pools, assetId, window).rows;
  const errors = [], missing = [];
  let incoming = 0, outgoing = 0;
  for (const {pool:p} of rows) {
    const s = p.sourceInputs;
    if (!s) { missing.push(p.id); continue; }
    const buy = numberOrNull(s.buy?.[window]), sell = numberOrNull(s.sell?.[window]), total = numberOrNull(s.volume?.[window]);
    const validIds = typeof s.baseTokenId==='string' && typeof s.quoteTokenId==='string' && s.baseTokenId.startsWith(p.network + '_') && s.quoteTokenId.startsWith(p.network + '_') &&
      addressKey(p.network, s.baseTokenId.slice(p.network.length + 1)) === addressKey(p.network, p.baseTokenAddress) &&
      addressKey(p.network, s.quoteTokenId.slice(p.network.length + 1)) === addressKey(p.network, p.quoteTokenAddress);
    const v = p.windows[window];
    if (!validIds || buy === null || sell === null || total === null || Math.min(buy,sell,total)<0 ||
        Math.abs(buy + sell - total) > Math.max(1,total * .01) || buy !== v.buy || sell !== v.sell || buy + sell !== v.total || numberOrNull(s.reserve) !== p.liquidity) {
      errors.push(p.id); continue;
    }
    incoming += p.base === assetId ? buy : sell;
    outgoing += p.base === assetId ? sell : buy;
  }
  return { status: errors.length ? 'mismatch' : missing.length ? 'missing-inputs' : rows.length ? 'reproduced' : 'no-data',
    checked: rows.length - errors.length - missing.length, expected: rows.length, errors, missing, incoming, outgoing, net: incoming-outgoing };
}

