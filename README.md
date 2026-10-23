# Bitcoin Side Quest

A small, visual crypto activity dashboard for **bitcoinsidequest.com**.

Ten automatically ranked non-stable assets, five USD stablecoins, and an optional BTC price reference. Select a coin, change the timeframe, then inspect a route and its supporting markets. This replaces the old QUEST memecoin site and artwork.

The coverage expansion adds free Binance spot activity for BNB/XRP/DOGE/ZEC and Kraken spot activity for XMR. The first expanded collection covered **9/10 alts and 5/5 stables**. See [the reusable coverage system](docs/coverage-system.md) for identity mappings, admission rules, calculation logic and the procedure for adding coins.

The visual field guide now leads with **What stands out**: up to three fresh, measured changes in pace or buying share. Coin tiles lead into a two-sided buying/selling diagram, a same-market comparison and, where recorded exchange intervals exist, an interactive hourly chart. See [the visual logic](docs/visual-logic.md) for eligibility thresholds, encodings, source scopes and motion behavior. Animations illustrate direction; they never simulate individual live trades.

## Run locally

Requires Node.js 22 or later. No packages, API keys, wallets, or paid services are required.

- `node server.mjs` — open http://localhost:4173.
- `node scripts/collect.mjs` — refresh the shared dataset manually.
- `node --test` — run the data-meaning and snapshot checks.

The checked-in snapshot contains real provider data normalized for this interface. The local server refreshes in the background approximately every five minutes and continues serving the last valid snapshot during outages. Browser tabs check the shared JSON once a minute. Node is only needed for collection and local development; the deployed frontend is static HTML, CSS, JavaScript, and JSON.

## What the map measures

- Arrows represent **gross trader-side swap dollars** in explicitly sampled DEX pools, for 1h, 6h, or 24h rolling windows.
- Exchange mode instead shows **reported spot-trading value in USDT** from reviewed active pairs. Complete fixed-boundary 1h/6h/24h windows are reconstructed from Binance candles or paginated Kraken trades. USDT is not assumed equal to USD; exchange and DEX values are never combined.
- Automatic chooses an available on-chain sample for the selected coin/window/network, then an exchange sample if none exists. Explicit On-chain only / Exchange only choices are preserved. The map subtitle identifies the actual source and unit.
- Provider buy/sell is relative to the pool's base token. Selecting the quote token reverses the directions.
- Net buying = buy dollars minus sell dollars in those pools. It is **not fresh capital entering crypto**, a wallet transfer, a forecast, or a cause of price movement.
- A pool is deduplicated by network plus address. Summing both directions across all coin nodes would double-count trades; no such market-wide total is displayed.
- Multi-hop trades and arbitrage can appear as individual trading legs. There is no claim to deduplicate an entire investor journey.
- No transaction-count-to-dollar inference, synthetic history, simulated arrows, news causality, or whale labels.
- Price-only assets remain visible; lack of coverage is not interpreted as zero trading.

The UI provides the coverage table, market links, retrieval times, source attribution, stale/offline notices, keyboard controls, reduced-motion support, mobile details access, and shareable source/coin/window/network/route state. Overview coverage counts coins with a sample across both source types and all networks, not a share of worldwide trading.

## Investigate a selection

Filter by network, then open **Understand this activity** for three optional views:

- **Read the activity:** the latest hour's reported volume divided by the preceding five hours' hourly average, on the same pools. The baseline is `(h6 - h1) / 5`, not `h6 / 6`. Missing or inconsistent windows are excluded; a zero baseline produces no ratio. This short-window comparison is not a normal-market baseline or forecast.
- **Inspect pools:** exact network and token identifiers, pool IDs, source links and liquidity. Pool IDs (including Uniswap v4 identifiers) are not always contract addresses. Reported liquidity is not executable depth or a safety audit.
- **Verify the numbers:** recompute the selected totals from collector-recorded buy/sell fields and token direction. This checks arithmetic consistency, not source authenticity, chain inclusion, finality or completeness. Inputs are recorded fields, not provider-signed responses.

Largest-pool volume share and the balance with that pool removed expose concentration. All comparisons respect the selected coin, network, route and available window. Coverage separates alts from stables; retrieval age uses the oldest covered market in the selected coin/network/timeframe. Quote and market retrieval times remain separate.

Exchange selections have an equivalent collapsed evidence view: exact pair/venue, observed window, execution count, comparable activity pace and a calculation check from stored five-minute inputs. These are reported executions, not an audit of the exchange matching engine or on-chain proof. No order-book liquidity is inferred from trade volume.

The map keeps solid incoming and dashed outgoing lines, a text route list and keyboard controls. Essential labels have stronger contrast; a full accessibility certification and real beginner usability study remain outstanding.

## Ranking and identity rules

CoinGecko market capitalization determines both lists. DefiLlama's stablecoin catalog supplies classification; USD-pegged entries qualify for the five stables. Bitcoin, classified stablecoins, and known wrapped/staked/bridged duplicates are excluded from the ten alts. Other asset types are retained: for example, Figure Heloc appeared in the initial broad ranking. The eligibility policy is visible in the interface.

Native wrapped ETH, SOL, BNB, TRX and HYPE are explicitly mapped to their underlying coin on the native network, using CoinGecko contract identities. Other tokens are matched by verified network/address, never ticker search. Unrelated bridged versions are not silently merged. Newly ranked assets without a supported mapping get a price-only state.

Pool discovery considers the first 20 pools returned per queried contract, selecting up to four qualifying pools by reported 24h volume. Both ends must be in the displayed universe and liquidity must be at least $50,000. Stablecoins are discovered on up to two supported networks; native-asset discovery can add more networks. Additional discovered pools can raise a coin's count above four. This is a bounded sample, not exhaustive coverage.

DEX discovery is cached for six hours; contract identities for one day. Current dollar breakdowns and liquidity are rechecked on every successful collection. Exchange pair identities/status and complete trade windows are rechecked each refresh. Missing, negative, or inconsistent amounts are excluded. Individual failed networks or exchange markets produce a partial-coverage notice; a complete trading outage retains the previous snapshot. Ranking/classification failures also retain the previous snapshot.

## Free data and refresh operation

- [CoinGecko public API](https://www.coingecko.com/en/api): market rankings, prices, identity catalog.
- [GeckoTerminal public API](https://www.geckoterminal.com/): sampled pool buy/sell USD breakdowns.
- [DefiLlama stablecoins](https://defillama.com/stablecoins): classification and circulating value.
- [Binance market-data-only API](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only): reviewed spot candles, quote volume and taker-buy volume.
- [Kraken public trades](https://docs.kraken.com/api-reference/market-data/get-recent-trades): paginated spot execution prices, quantities and reported sides.

The collector spreads pool requests, honors rate-limit cooldowns, times out failed requests, and stores diagnostics. Provider limits and data freshness can change. Retrieval time is not a guarantee of upstream event freshness. DefiLlama's circulating value is denominated in USD, so price changes can affect it as well as issuance.

No paid feed or reverse-engineered private endpoint is used. Attribution is visible. These checks establish technical access, not an unrestricted license. Commercial use, reusable exports and expanded historical retention need an explicit rights decision under the applicable provider terms. The new public data-download feature is withheld; source links and on-screen calculation checks remain available. See the licensing findings in [the expert review](docs/expert-review.md).

## GitHub Pages

`.github/workflows/refresh-and-deploy.yml` collects data on pushes to main, manual runs, and a schedule targeting every 15 minutes. It caches the last valid dataset and discovery results, validates the snapshot, then publishes only public files through the official GitHub Pages actions.

Use GitHub Actions as the Pages publishing source, with the existing `bitcoinsidequest.com` custom domain. The workflow needs normal `pages: write` and `id-token: write` permissions and approval if the repository's Pages environment requires it. It does not write source commits or need a personal access token. A feature branch/PR does not activate scheduled production updates.

Schedules are best-effort and can be delayed or disabled after prolonged repository inactivity. The page displays the snapshot age and warns after 30 minutes. A failed refresh republishes the last valid snapshot with its original timestamp. If no valid snapshot exists, validation fails and prevents deployment.

## First-version limits

Untracked venues and counterparties, exchange deposits/withdrawals, complete cross-chain journeys, historical replay, alerts, and news-based explanations are outside this version. BTC is a market-price benchmark only. Comparing different coins' sampled net amounts is not a market-wide ranking of inflows.

See [the initial coverage audit](docs/coverage.md). Current coverage is always available in the running page and `data/snapshot.json`.

See [the review from thirteen expert perspectives and prioritized roadmap](docs/expert-review.md). It distinguishes implemented safeguards from unresolved data, product, accessibility and verification gaps.
