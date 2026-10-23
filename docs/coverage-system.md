# Coverage system

Decision record: 23 October 2026. The current snapshot and its coverage table take precedence over the point-in-time results below.

## What improved

The first expanded live collection returned **35 DEX pools and five exchange spot markets**, covering **9 of the ten alts and all five stables**. Exchange activity adds BNB, XRP, DOGE, ZEC and XMR. Figure Heloc remains price-only. Coverage means a validated sample exists, not that a known percentage of the worldwide market is captured.

| CoinGecko identity | Source | Reviewed venue identity | Unit | Input |
| --- | --- | --- | --- | --- |
| `binancecoin` | Binance | `BNBUSDT`, base `BNB`, quote `USDT` | USDT | Completed spot candles |
| `ripple` | Binance | `XRPUSDT`, base `XRP`, quote `USDT` | USDT | Completed spot candles |
| `dogecoin` | Binance | `DOGEUSDT`, base `DOGE`, quote `USDT` | USDT | Completed spot candles |
| `zcash` | Binance | `ZECUSDT`, base `ZEC`, quote `USDT` | USDT | Completed spot candles |
| `monero` | Kraken | `XMRUSDT`, base `XXMR`, quote `USDT`, display `XMR/USDT` | USDT | Paginated public trades |

The quote identity is CoinGecko `tether` in every case. Exchange identifiers describe the venue's spot instrument, not a token contract, proof of custody or an on-chain settlement event.

## The admission pipeline

1. **Select the universe independently of coverage.** Keep the existing CoinGecko/DefiLlama ranking policy. Do not replace an uncovered ranked asset with an easier coin. A newly ranked, unreviewed coin remains visible with price data and no invented routes.
2. **Resolve identity before looking at volume.** DEX records join by network/address with explicit native-wrapper mappings. Exchange records join through `EXCHANGE_MARKETS` in `lib/exchanges.js`, keyed by canonical coin ID plus venue and exact pair. A ticker match or search result alone is insufficient.
3. **Check today's instrument.** Binance metadata must match symbol, base and quote, `TRADING` status and spot permission. Kraken must match pair key, `altname`, `wsname`, internal base/quote and `online` status. Missing, delisted, renamed or changed instruments fail closed. Both ends must still belong to the selected 15 assets.
4. **Admit measured activity with explicit units.** DEX uses reported buy/sell USD values. Binance uses quote volume and taker-buy quote volume. Kraken uses executed price multiplied by quantity, classified by the reported `b`/`s` side. No price-change inference, trade-count-to-dollar conversion, or assumption that USDT equals USD.
5. **Require a complete bounded window.** Validate timestamps, amounts, count, duplicates and pagination before publishing. Never label the most recent 1,000 trades as a full day. Missing amounts are not zero; zero is allowed only within an admitted complete window.
6. **Preserve source boundaries.** Each record retains venue/pair, coin identities, quote unit, direction basis, check time, window start/end, page count and five-minute inputs. DEX pools and exchange markets occupy separate snapshot collections. No combined dollar-flow metric exists.
7. **Expose the result simply.** The existing map shows one source type at a time. Node captions identify availability; the map subtitle states the current source and unit. Coverage details and arithmetic evidence stay behind the existing disclosures.

## Source choice and direction

`activitySource()` implements a deterministic preference for each selected coin and timeframe:

- **Automatic:** use available on-chain pools in the selected network scope; otherwise use an admitted exchange market. If neither exists, show no sample. Changing coins can change source; the subtitle changes with it.
- **On-chain only:** preserve that explicit choice even if exchange activity exists.
- **Exchange only:** preserve that explicit choice even if on-chain activity exists. The network filter is hidden because an exchange book is not a blockchain network.

The preference is saved in the shareable URL. Overview coverage counts across sources and networks for the chosen timeframe, independently of the current map filter. It is labeled “across sources.”

Buy always refers to the instrument's base asset. Selecting its quote asset reverses incoming and outgoing values. Each record is counted once per selected view. Do not sum across coin nodes: the same trade is visible from both sides. Binance's direction is explicitly taker-side; Kraken's REST field is labeled provider-reported buy/sell. Neither establishes investor intent. Every exchange execution has a buyer and seller.

## Time, completeness and arithmetic

Exchange collection chooses the latest completed five-minute UTC boundary as `end`, and `start = end - 24h`. Provider clocks must be consistent with local time and already past `end`. Windows are `[start, end)`; the unfinished current candle is excluded. Display the actual ending time, not “live now.”

**Binance:** request `klines` with explicit `startTime`, `endTime=end-1`, `interval=5m` and a 300-row limit. Require exactly 288 unique contiguous closed bars, each closing at open + 299,999ms. Index 7 is quote volume, index 10 taker-buy quote volume, and index 8 executed trade count. Sell is quote volume minus buy. Negative, absent, conflicting or incomplete records reject the market. Current open bars cannot enter a window.

**Kraken:** start `Trades` at the requested nanosecond timestamp, represented as a string/BigInt. Follow the returned `last` string without numeric rounding. Pages may overlap: deduplicate by venue/pair/trade ID and reject conflicting duplicates. Require valid positive execution price/quantity, a recognized side and chronological rows. Continue until the response crosses `end` or the requested history is exhausted. A stalled cursor, API error, malformed row or 40-page budget exhaustion rejects the market. Do not interpret trade-ID gaps as missing executions; sequence IDs need not be consecutive.

Kraken history is fetched afresh for the bounded day on each refresh. Requests are spaced at least 1.1 seconds apart; no account/key or persistent raw-trade archive is needed. After completing pagination, aggregate into five-minute buckets, including empty buckets in the completed interval. A short final page is trusted as the provider's end of available history; this is not an independent completeness proof. An outage or undocumented truncation at the provider cannot be cryptographically ruled out.

Store normalized five-minute inputs and derive 1h/6h/24h sums from the final 12/72/288 buckets. Counts describe executions, not distinct people or orders. The browser validator rebuilds every exchange window. “Reproduce this view” repeats those sums; it cannot verify the underlying source, exchange matching engine or cryptographic authenticity. Floating-point arithmetic is appropriate for these compact analytics, not financial settlement.

The activity pace remains `(last hour) / ((last 6 hours - last hour) / 5)` on the same market. No ratio is claimed when the preceding baseline is zero. DEX rolling windows and exchange fixed-boundary windows are not combined or advertised as synchronized.

## Failure and refresh policy

There is no exchange fallback through proxy hosts, region circumvention or undocumented endpoints. Per-venue identity/clock failures and per-market data failures produce explicit diagnostics. A failed market is omitted from the new snapshot; old amounts are not assigned a fresh timestamp. Other valid markets can publish. Complete trading failure or ranking/classification failure retains the last complete snapshot with its original time. Older schema-1 DEX snapshots remain readable if a collection fails during rollout.

The existing collector targets 15 minutes on GitHub Pages and five minutes locally. Free provider limits and schedules are best-effort. Each market retains its own retrieval time; fixed window ends remain visible. DEX discovery rules, network/address validation and minimum $50,000 reported pool liquidity are unchanged. No exchange liquidity number is fabricated from turnover.

## How to add the next coin

1. Record its canonical CoinGecko ID, asset type and eligible ranking status.
2. Check the existing DEX identity rules first. Do not silently treat a bridged or custodial representation as the underlying coin to improve coverage.
3. Find a documented, free public **spot** feed with exact identities and a usable side/amount breakdown. Record official documentation, unit, side semantics, pagination limits, freshness and reuse terms.
4. For the existing adapters, add a reviewed entry to `EXCHANGE_MARKETS` with exact expected metadata. The current quote policy is USDT/`tether`. A new quote currency, venue or data shape requires its own explicit handling and tests; do not just append another ticker.
5. Probe identity, status and a full day from the deployment environment. Verify smaller windows, quote inversion, missing versus zero, duplicate handling and a failure case. Check the browser source label, unit, clock and coverage row.
6. Update this decision record and tests. Keep the coin price-only if any essential identity, time, unit or side check is unresolved. Automatic rankings can change membership; admission of a new exchange identity is deliberately reviewed.

## Sources and access decisions

- [Binance market-data-only endpoint](https://developers.binance.com/en/docs/products/spot/faqs/market_data_only): documented public host, no API key or authentication. Requests succeeded directly during this check. [Spot market data fields](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market) define candle volume and taker-buy quote volume.
- [Kraken asset pairs](https://docs.kraken.com/api-reference/market-data/get-tradable-asset-pairs) and [recent trades](https://docs.kraken.com/api-reference/market-data/get-recent-trades): exact instrument metadata and public execution records. The [pagination FAQ](https://support.kraken.com/articles/advanced-api-faq) specifies advancing the `since` cursor. [Public rate limits](https://support.kraken.com/articles/206548367-what-are-the-api-rate-limits-?mode=consumerapp) support one request per second or less.
- [Binance Vision terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md), checked 23 October 2026, describe CC BY-NC-SA 4.0 conditions for their datasets and associated endpoints. Conservatively attribute the derived Binance figures accordingly and link those terms. This educational dashboard remains noncommercial; commercial use needs a separate rights decision. This is not a license grant for Kraken, other providers or the site's entire source code.
- Kraken is publicly accessible without an account, but technical access is not an unrestricted redistribution/commercial license. Keep attribution and [provider terms](https://www.kraken.com/legal/global-terms) separate. No bulk-download feature or paid feed is introduced.
- [Figure's business description](https://www.figure.com/about/) concerns lending and related markets. Loan origination, token supply, TVL or wallet transfers are not substituted for an eligible spot-trade feed. Figure Heloc stays in the broad ranking with no invented arrows.

The first version intentionally does not add every possible venue, stablecoin pair or bridged token. More markets should improve the sample without changing what its measurements mean.
