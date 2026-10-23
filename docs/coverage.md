# Initial free-data coverage audit

Historical baseline. For the later 9/10-alt coverage expansion and rules for future coins, see [Coverage system](coverage-system.md).

Verified against live public responses on **23 October 2026**. This records a point-in-time check, not a promise of continuous or comprehensive coverage. The running page's coverage table is authoritative for its current snapshot.

## What worked

The first successful collection completed at **19:00:48 UTC**: prices for all 15 selected assets, **35 unique eligible pools**, and sampled routes involving **9 of the 15 assets**. All displayed dollar flows came from the provider's buy/sell USD breakdown, not transaction counts or synthetic values.

| Asset | Eligible pools in initial snapshot | Networks | Result |
| --- | ---: | --- | --- |
| ETH | 5 | Ethereum | Sampled routes, native WETH representation |
| BNB | 0 | — | Price only; no eligible counterparties in this sample |
| XRP | 0 | — | Price only; native network outside this collector |
| SOL | 5 | Solana | Sampled routes, native wrapped SOL representation |
| TRX | 2 | TRON | Sampled routes, native wrapped TRX representation |
| FIGR_HELOC | 0 | — | Price only; no mapped route |
| ZEC | 0 | — | Price only; native network outside this collector |
| HYPE | 4 | HyperEVM | Sampled routes, native wrapped HYPE representation |
| DOGE | 0 | — | Price only; native network outside this collector |
| XMR | 0 | — | Price only; native network outside this collector |
| USDT | 16 | Ethereum, Solana, TRON | Sampled routes |
| USDC | 23 | Ethereum, Solana, HyperEVM | Sampled routes |
| USDS | 3 | Ethereum, Solana | Sampled routes |
| USDE | 7 | Ethereum, Solana | Sampled routes |
| DAI | 5 | Ethereum | Sampled routes |

Each pool appears under both of its assets. Do not add these rows to infer a unique pool count or a total capital flow. Wrapped native representations are explicit; ticker lookalikes and unrelated bridged versions are not substituted to improve apparent coverage. The broad ranking includes tokenized assets such as Figure Heloc, with that eligibility rule disclosed.

## Outages observed and handled

An early rapid discovery pass encountered HTTP 429 rate limits. Collection now spaces GeckoTerminal requests at least 8.5 seconds apart, caches discovery for six hours, and respects a cooldown of at least 60 seconds on a rate-limit response. This does not guarantee availability.

A later collection at **19:04:34 UTC** encountered a TRON timeout. It produced 33 validated pools covering 8 assets and an explicit partial-feed notice. TRX became price-only; no stale TRON numbers were silently blended into the new pool snapshot. A complete pool, classification, or ranking failure retains the previous snapshot with its original time. Missing or invalid individual pool responses are recorded as partial coverage.

## Source and meaning checks

- [CoinGecko markets API](https://docs.coingecko.com/reference/coins-markets): automatic capitalization ranking, prices and 24h price changes. Public requests succeeded without a key during this audit. Both top lists use this single ranking basis.
- [CoinGecko coin list](https://docs.coingecko.com/reference/coins-list): network/address identities. No symbol-based identity joins.
- [DefiLlama stablecoin data](https://stablecoins.llama.fi/stablecoins?includePrices=true): classification joined by CoinGecko ID, USD peg filtering, and circulating value. Circulating USD value is not a token count or a measure of purchases.
- [GeckoTerminal public API](https://apiguide.geckoterminal.com/): token-pool discovery and pool batches with `include_volume_breakdown=true`. The collector requires numeric buy, sell and total USD values, rejects negative amounts, and checks buy + sell against total within 1% or $1. No guessed dollar amounts.
- [TradingView heatmap](https://www.tradingview.com/heatmap/crypto/), [DEX Screener](https://dexscreener.com/), and [Bubblemaps](https://bubblemaps.io/) informed the visual distinction between price, trading activity, and ownership relationships. Their displayed charts are not scraped as data feeds.

GeckoTerminal buy/sell is relative to the **pool's base token**. Selecting the quote token reverses the directions. Tests verify this inversion, pool deduplication, missing versus zero amounts, address identity, automatic ranking and snapshot integrity.

## Deliberate boundaries

The sample excludes centralized exchanges, pairs outside the displayed asset set, pools below $50,000 liquidity, and undiscovered pools. Discovery queries the first 20 pools per contract and retains up to four eligible pools ranked by reported 24h volume. Only a bounded set of networks is queried. Multi-hop legs and arbitrage can appear separately.

Consequently the site answers **“What was traded in these observed markets?”** It cannot establish how much new money entered crypto, reconstruct an investor's full journey, or prove why a price moved. The explanation panel reports measured activity and states that causes are not established. Improving actual coverage is the next useful data expansion; adding dramatic arrows without evidence would weaken the product.

GitHub Pages collection targets 15 minutes; local collection targets five minutes. Both are snapshots, not tick-by-tick streaming. The page labels retrieval age, individual quote/pool times, partial failures and stale snapshots. Free provider limits and scheduled-run delays remain operational constraints.
