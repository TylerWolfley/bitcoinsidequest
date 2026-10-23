import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectUniverse, identityRegistry, poolIdentity, normalizePool, addressKey, numberOrNull } from '../lib/model.js';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SNAPSHOT = path.join(ROOT, 'data/snapshot.json');
const CG = 'https://api.coingecko.com/api/v3', GT = 'https://api.geckoterminal.com/api/v2';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function readJSON(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
async function json(url) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'BitcoinSideQuest/1.0' }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) {
    const error = new Error(new URL(url).hostname + ': HTTP ' + response.status);
    error.status = response.status;
    const retry = response.headers.get('retry-after');
    error.retryMs = retry && Number.isFinite(Number(retry)) ? Number(retry) * 1000 : retry ? Math.max(0, Date.parse(retry) - Date.now()) : 60_000;
    throw error;
  }
  return response.json();
}
function assetRecord(coin, kind, stable) {
  const supply = numberOrNull(stable?.circulating?.peggedUSD), previous = numberOrNull(stable?.circulatingPrevDay?.peggedUSD);
  return { id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase(), kind, image: coin.image, rank: coin.market_cap_rank,
    price: numberOrNull(coin.current_price), marketCap: numberOrNull(coin.market_cap), volume24h: numberOrNull(coin.total_volume),
    priceChange24h: numberOrNull(coin.price_change_percentage_24h), priceUpdatedAt: coin.last_updated,
    supplyValue: supply, supplyChange24h: supply !== null && previous > 0 ? (supply / previous - 1) * 100 : null,
    supplySource: stable ? 'DefiLlama circulating value in USD' : null };
}
export async function collect({ log = console.log } = {}) {
  const startedAt = new Date().toISOString();
  await mkdir(path.join(ROOT, 'data'), { recursive: true });
  await mkdir(path.join(ROOT, '.cache'), { recursive: true });
  const previous = await readJSON(SNAPSHOT);
  // Classification is required; failures must not move stablecoins into alts.
  const [markets, stableResponse] = await Promise.all([
    json(CG + '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false'),
    json('https://stablecoins.llama.fi/stablecoins?includePrices=true'),
  ]);
  const stableAssets = stableResponse.peggedAssets, selected = selectUniverse(markets, stableAssets);
  const stableMap = new Map(stableAssets.map(a => [a.gecko_id, a]));
  const assets = [...selected.alts.map(a => assetRecord(a, 'alt')), ...selected.stables.map(a => assetRecord(a, 'stable', stableMap.get(a.id)))];
  log('Rankings: ' + assets.map(a => a.symbol).join(', '));
  const catalogPath = path.join(ROOT, '.cache/catalog.json');
  let cached = await readJSON(catalogPath);
  if (!cached || Date.now() - Date.parse(cached.at) > 86_400_000) {
    cached = { at: new Date().toISOString(), coins: await json(CG + '/coins/list?include_platform=true') };
    await writeFile(catalogPath, JSON.stringify(cached));
  }
  const { registry, discovery } = identityRegistry(assets, cached.coins);
  const candidates = new Map(), diagnostics = [], discoveredAssets = new Set();
  let lastGTCall = 0;
  async function gecko(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, 8500 - (Date.now() - lastGTCall)));
      lastGTCall = Date.now();
      try { return await json(url); } catch (error) {
        if (error.status !== 429 || attempt === 2) throw error;
        log('Pool feed requested a cooldown; retaining the last data while waiting.');
        await sleep(Math.max(60_000, error.retryMs || 0));
      }
    }
  }
  for (const entry of discovery) {
    try {
      const cachePath = path.join(ROOT, '.cache', 'pools-' + entry.network + '-' + encodeURIComponent(entry.address) + '.json');
      let saved = await readJSON(cachePath);
      if (!saved || Date.now() - Date.parse(saved.at) > 6 * 60 * 60_000) {
        saved = { at: new Date().toISOString(), response: await gecko(GT + '/networks/' + entry.network + '/tokens/' + encodeURIComponent(entry.address) + '/pools?page=1') };
        await writeFile(cachePath, JSON.stringify(saved));
      }
      const response = saved.response;
      discoveredAssets.add(entry.assetId);
      const eligible = (response.data ?? []).filter(p => poolIdentity(p, registry, entry.network));
      eligible.sort((a, b) => Number(b.attributes.volume_usd?.h24 ?? 0) - Number(a.attributes.volume_usd?.h24 ?? 0));
      for (const pool of eligible.slice(0, 4)) candidates.set(addressKey(entry.network, pool.attributes.address), { pool, network: entry.network });
      diagnostics.push({ assetId: entry.assetId, network: entry.network, checkedAt: saved.at, returned: response.data?.length ?? 0, eligible: eligible.length, status: 'ok' });
    } catch (error) {
      diagnostics.push({ assetId: entry.assetId, network: entry.network, checkedAt: new Date().toISOString(), status: 'unavailable', error: error.message });
    }
  }
  const groups = new Map();
  for (const candidate of candidates.values()) {
    const group = groups.get(candidate.network) ?? [];
    group.push(candidate.pool.attributes.address);
    groups.set(candidate.network, group);
  }
  const pools = [], poolErrors = [];
  for (const [network, addresses] of groups) {
    for (let offset = 0; offset < addresses.length; offset += 10) {
      try {
        const requested = addresses.slice(offset, offset + 10);
        const response = await gecko(GT + '/networks/' + network + '/pools/multi/' + requested.map(encodeURIComponent).join(',') + '?include_volume_breakdown=true');
        const checkedAt = new Date().toISOString();
        const accepted = new Set();
        for (const pool of response.data ?? []) {
          const normalized = normalizePool(pool, registry, network, checkedAt);
          if (normalized) { pools.push(normalized); accepted.add(normalized.id); }
        }
        const omitted = requested.filter(address => !accepted.has(addressKey(network, address))).length;
        if (omitted) poolErrors.push({ network, error: omitted + ' requested pools were absent or failed current liquidity/dollar validation.' });
      } catch (error) { poolErrors.push({ network, error: error.message }); }
    }
  }
  await writeFile(path.join(ROOT, '.cache/coverage-attempt.json'), JSON.stringify({ startedAt, candidates: candidates.size, diagnostics, poolErrors, pools: pools.length }, null, 2));
  if (!pools.length) throw new Error('No validated pool dollar volumes available; previous snapshot retained');
  const uniquePools = [...new Map(pools.map(p => [p.id, p])).values()];
  for (const asset of assets) {
    const covered = uniquePools.filter(p => p.base === asset.id || p.quote === asset.id);
    const attempted = discovery.filter(d => d.assetId === asset.id);
    asset.coverage = {
      status: covered.length ? 'sample' : attempted.length ? 'no-pairs' : 'price-only',
      pools: covered.length, networks: [...new Set(covered.map(p => p.network))],
      reason: covered.length ? 'Selected DEX pools only; excludes centralized exchanges and untracked pairs.' : attempted.length
        ? 'No validated dollar-volume pools within this asset set were available in the sampled feeds.'
        : 'Live market price available. Native trading flows are not covered by this version.',
      discoveryFailed: attempted.length > 0 && !discoveredAssets.has(asset.id),
    };
  }
  const snapshot = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), startedAt, rankingCheckedAt: startedAt, refreshMinutes: 15,
    assets, bitcoin: selected.bitcoin ? assetRecord(selected.bitcoin, 'reference') : null, pools: uniquePools, diagnostics, poolErrors,
    membershipChanged: previous ? assets.map(a => a.id).join() !== previous.assets.map(a => a.id).join() : false,
    policy: {
      ranking: 'CoinGecko circulating market capitalization',
      stablecoins: 'Top five USD-pegged assets classified by DefiLlama, ranked by CoinGecko market cap',
      exclusions: 'Bitcoin, classified stablecoins, known wrapped/staked/bridged duplicates are excluded from the ten alts. Other asset types are included.',
      poolSample: 'Up to four mapped pools per discovered contract, among the first twenty returned. Minimum $50,000 liquidity. Only pairs connecting displayed assets. No market-wide flow estimate.',
      semantics: 'Gross trader-side swaps in sampled pools. Buy refers to the pool base token. Net is buy dollars minus sell dollars, not new capital. Routes can include arbitrage or multi-hop legs.',
    },
    sources: [
      { name: 'CoinGecko', url: 'https://www.coingecko.com/en/api', use: 'Rankings, prices, contract identities' },
      { name: 'GeckoTerminal', url: 'https://www.geckoterminal.com/', use: 'Sampled pool buy/sell dollars and liquidity' },
      { name: 'DefiLlama', url: 'https://defillama.com/stablecoins', use: 'Stablecoin classification and circulating value' },
    ],
  };
  await writeFile(SNAPSHOT + '.tmp', JSON.stringify(snapshot, null, 2) + '\n');
  await rename(SNAPSHOT + '.tmp', SNAPSHOT);
  log('Saved ' + uniquePools.length + ' unique pools; ' + assets.filter(a => a.coverage.pools).length + '/15 assets with sampled routes.');
  return snapshot;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collect().catch(error => { console.error(error.message); process.exitCode = 1; });
}
