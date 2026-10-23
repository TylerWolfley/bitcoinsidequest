export const WINDOWS = ['h1', 'h6', 'h24'];
export const NETWORKS = { ethereum: 'eth', solana: 'solana', 'binance-smart-chain': 'bsc', tron: 'tron', hyperevm: 'hyperevm', 'arbitrum-one': 'arbitrum', base: 'base' };
export const NATIVE_WRAPPERS = {
  ethereum: ['weth', 'ethereum'], binancecoin: ['wbnb', 'binance-smart-chain'],
  solana: ['wrapped-solana', 'solana'], tron: ['wrapped-tron', 'tron'],
  hyperliquid: ['wrapped-hype', 'hyperevm'],
};
export const numberOrNull = v => !['string','number'].includes(typeof v) || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
export const addressKey = (network, address) => network + '_' + (String(address).startsWith('0x') ? String(address).toLowerCase() : address);
export function selectUniverse(markets, stableAssets) {
  if (!Array.isArray(markets) || !Array.isArray(stableAssets) || stableAssets.length < 5) throw new Error('Ranking or stablecoin classification unavailable');
  const stableIds = new Set(stableAssets.map(a => a.gecko_id).filter(Boolean));
  const usdIds = new Set(stableAssets.filter(a => a.pegType === 'peggedUSD').map(a => a.gecko_id));
  const derivatives = new Set([...Object.values(NATIVE_WRAPPERS).map(a => a[0]), 'wrapped-bitcoin', 'staked-ether', 'wrapped-steth', 'ethena-staked-usde']);
  const ranked = [...markets].filter(a => Number.isFinite(a.market_cap) && a.market_cap > 0).sort((a, b) => b.market_cap - a.market_cap || a.id.localeCompare(b.id));
  const alts = ranked.filter(a => a.id !== 'bitcoin' && !stableIds.has(a.id) && !derivatives.has(a.id) && !/\b(wrapped|bridged|staked|restaked)\b/i.test(a.name)).slice(0, 10);
  const stables = ranked.filter(a => usdIds.has(a.id)).slice(0, 5);
  if (alts.length !== 10 || stables.length !== 5) throw new Error('Insufficient ranked assets; retaining previous snapshot');
  return { alts, stables, bitcoin: markets.find(a => a.id === 'bitcoin') ?? null };
}
export function identityRegistry(assets, catalog) {
  const catalogMap = new Map(catalog.map(a => [a.id, a]));
  const registry = new Map(), discovery = [];
  for (const asset of assets) {
    const wrapper = NATIVE_WRAPPERS[asset.id], identity = catalogMap.get(wrapper?.[0] ?? asset.id);
    const platforms = wrapper ? [wrapper[1]] : Object.keys(NETWORKS);
    const identities = [];
    for (const platform of platforms) {
      const address = identity?.platforms?.[platform];
      if (!address) continue;
      const network = NETWORKS[platform];
      const entry = { assetId: asset.id, network, address, wrapped: Boolean(wrapper), representation: identity.name };
      registry.set(addressKey(network, address), entry);
      identities.push(entry);
    }
    discovery.push(...identities.slice(0, asset.kind === 'stable' ? 2 : 1));
  }
  return { registry, discovery };
}
export function poolIdentity(pool, registry, network) {
  const normalize = key => typeof key === 'string' && key.startsWith(network + '_') ? addressKey(network, key.slice(network.length + 1)) : '';
  const base = registry.get(normalize(pool.relationships?.base_token?.data?.id));
  const quote = registry.get(normalize(pool.relationships?.quote_token?.data?.id));
  if (!base || !quote || base.assetId === quote.assetId) return null;
  const liquidity = numberOrNull(pool.attributes?.reserve_in_usd);
  if (liquidity === null || liquidity < 50_000) return null;
  return { base, quote, liquidity };
}
export function normalizePool(pool, registry, network, checkedAt) {
  const identity = poolIdentity(pool, registry, network);
  if (!identity) return null;
  const a = pool.attributes, windows = {};
  for (const window of WINDOWS) {
    const buy = numberOrNull(a.buy_volume_usd?.[window]), sell = numberOrNull(a.sell_volume_usd?.[window]), total = numberOrNull(a.volume_usd?.[window]);
    // Counts never substitute for dollars; reject missing or inconsistent amounts.
    if (buy === null || sell === null || total === null || Math.min(buy, sell, total) < 0) continue;
    if (Math.abs(buy + sell - total) > Math.max(1, total * 0.01)) continue;
    windows[window] = { buy, sell, total: buy + sell };
  }
  if (!Object.keys(windows).length) return null;
  return { id: addressKey(network, a.address), network, address: a.address, name: a.name,
    dex: pool.relationships?.dex?.data?.id ?? 'unknown', base: identity.base.assetId, quote: identity.quote.assetId,
    baseRepresentation: identity.base.representation, quoteRepresentation: identity.quote.representation,
    baseTokenAddress: pool.relationships.base_token.data.id.slice(network.length + 1),
    quoteTokenAddress: pool.relationships.quote_token.data.id.slice(network.length + 1),
    sourceInputs: { baseTokenId: pool.relationships.base_token.data.id, quoteTokenId: pool.relationships.quote_token.data.id,
      buy: Object.fromEntries(WINDOWS.map(w => [w, a.buy_volume_usd?.[w] ?? null])),
      sell: Object.fromEntries(WINDOWS.map(w => [w, a.sell_volume_usd?.[w] ?? null])),
      volume: Object.fromEntries(WINDOWS.map(w => [w, a.volume_usd?.[w] ?? null])), reserve: a.reserve_in_usd },
    wrapped: identity.base.wrapped || identity.quote.wrapped, liquidity: identity.liquidity, windows, checkedAt,
    url: 'https://www.geckoterminal.com/' + encodeURIComponent(network) + '/pools/' + encodeURIComponent(a.address) };
}
export function routesForAsset(snapshot, assetId, window) {
  const grouped = new Map(), seen = new Set();
  for (const pool of snapshot.pools ?? []) {
    if (seen.has(pool.id) || (pool.base !== assetId && pool.quote !== assetId)) continue;
    seen.add(pool.id);
    const amounts = pool.windows[window];
    if (!amounts) continue;
    const isBase = pool.base === assetId, otherId = isBase ? pool.quote : pool.base;
    const route = grouped.get(otherId) ?? { otherId, incoming: 0, outgoing: 0, liquidity: 0, pools: [] };
    // Provider buy = buy of its base token. Reverse for a quote-token selection.
    route.incoming += isBase ? amounts.buy : amounts.sell;
    route.outgoing += isBase ? amounts.sell : amounts.buy;
    route.liquidity += pool.liquidity;
    route.pools.push(pool);
    grouped.set(otherId, route);
  }
  return [...grouped.values()].map(r => ({ ...r, total: r.incoming + r.outgoing, net: r.incoming - r.outgoing })).sort((a, b) => b.total - a.total || a.otherId.localeCompare(b.otherId));
}
export function summarizeRoutes(routes) {
  if (!routes.length) return null;
  const incoming = routes.reduce((s, r) => s + r.incoming, 0), outgoing = routes.reduce((s, r) => s + r.outgoing, 0);
  return { incoming, outgoing, total: incoming + outgoing, net: incoming - outgoing, buyShare: incoming + outgoing > 0 ? incoming / (incoming + outgoing) : null };
}
export function ageMinutes(time, now = Date.now()) {
  const timestamp = Date.parse(time);
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 60_000) : Infinity;
}
