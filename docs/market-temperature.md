# Market Temperature v1

The product job is a repeatable, quick check: how broad is altcoin strength, what is contributing to the reading, and what changed since a visit? The temperature is an experimental description of observed conditions, not a validated measure of investor psychology or a trading recommendation.

## Calculation

The current automatically ranked ten alts are the universe. BTC is the benchmark; the five stables remain available in the trading map. All three components use provider-reported 24-hour evidence.

| Component | Per-coin measurement | Weight |
| --- | --- | --- |
| Price participation | 100 if price return exceeds +0.25%, 0 below -0.25%, otherwise 50; equal mean across qualifying coins | 40% |
| Strength versus BTC | Relative return `(1 + alt return) / (1 + BTC return) - 1`, scored with the same +/-0.25% neutral band; equal mean | 30% |
| Buy-side activity | Reported buying value / total value * 100 within each coin's automatic trading sample; equal mean across coins | 30% |

Multiply component scores by weights, sum, then round once to an integer. Cold: 0–24; Cool: 25–44; Balanced: 45–55; Warm: 56–74; Hot: 75–100. Higher means stronger conditions in this model, not a more attractive entry or lower risk.

The weights, neutral band, minimum sample amount and display labels are explicit editorial choices. They have not been fitted or validated against future returns. Price participation and relative strength are correlated. Buying-share values often remain near 50 even in strong markets; the model intentionally does not stretch small imbalances into extreme readings.

## Admission rules for today's and future coins

1. Reuse the canonical identity and reviewed source rules in [coverage-system.md](coverage-system.md). Never discover a score input by ticker alone.
2. Require the full ranked ten-asset universe. Each component independently needs at least seven fresh qualifying coins; its own denominator remains visible. Missing measurements are excluded, never zero, and component weights never change to conceal a missing component.
3. Market and individual price checks must be no older than 30 minutes and no more than one minute in the future. Relative-return quote timestamps must be within five minutes of each other, and BTC's return must exceed -100%.
4. Automatic trading scope means available DEX pools first, otherwise a reviewed exchange market, over all sampled networks. Every selected record must have a valid, fresh 24h window. Exchange window ends must be aligned, completed and within 30 minutes. An incomplete selected scope is not silently narrowed to get a score.
5. Require at least 100,000 units of 24h sampled value for each coin's buy-share component. DEX units are USD; exchange units are USDT. Compute a percentage within one source type, then average coin percentages. Never add USD and USDT trading values.
6. Deduplicate market IDs and reverse buy/sell direction when the selected coin is the quote token. A coin's markets are volume weighted internally; coins are equally weighted externally. One large asset cannot dominate by market capitalization or notional volume alone.
7. Per-coin buying dots use >55% for stronger, <45% for weaker, and otherwise mixed. These visual bins do not change the numeric buying component. Other dots use the same neutral band as their price component.

The score can change when the tracked lineup or sampling coverage changes. The stored scope records component membership and trading-market IDs. The UI suppresses a direct score-change claim across a scope change, and breaks the history line there. Changed windows, incomplete feeds, ranking changes and price-only assets remain explicit limitations. Pool rolling windows and closed exchange windows can end at different times. Some coins share a pool, so their directional readings are also correlated; these are not independent votes from investors.

## History, continuity and independence

`scripts/collect-risk-temperature.mjs` records only fresh computed readings from valid snapshots. Each distinct snapshot check time appears once. `data/market-temperature.json` preserves component scores, counts, scope and model version for up to 30 days, with a 3,000-point bound. The workflow caches this derived series independently of source commits. No synthetic prelaunch history is created. Cache loss can lose history; this first version is not a durable database.

History is calendar spaced. Missing intervals over an hour or a scope change break the line. The warming/cooling comparison uses the preceding actual reading only when within an hour and scope matches. Historical inspection never changes the current gauge or current component cards. A future formula change must increment the model version and start a separate series rather than silently mix formulas.

Last-visit storage stays in the browser. Price comparisons use canonical IDs shared by both visits; a changed lineup is labeled. Temperature differences require matching model version and scope. The previous baseline stays fixed in memory for the visit, while fresh snapshots update the saved baseline for the next visit. Baselines older than 30 days expire. Blocked storage does not break the calculator.

## Traditional Fear & Greed reference

[Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) permits attributed display, including commercial use, with attribution beside the reading. Its methodology describes a daily Bitcoin-focused index. The separate reference card preserves its score and classification. It is never an input to our calculation. The public feed lacks daily factor contributions; we do not invent those explanations.

`scripts/collect-temperature.mjs` checks the free endpoint at most hourly when the latest daily observation is current. Failure preserves the last valid reading with its original observation/retrieval dates, or produces an explicit unavailable envelope. Old/offline status is separate from the altcoin calculator. No keys, paid endpoints, or reverse-engineered private services are used.

## Known limits and validation priorities

This first model omits derivatives leverage, funding, executable order-book depth, crowd surveys and social data. It does not prove capital inflows, causality, intent, source authenticity or representative global coverage. Small price changes crossing a neutral-band boundary can move a component; the neutral band is not a significance test.

Before calling this a better predictor than existing indices, collect a stable versioned history, test sensitivity to weights and coverage, assess redundant signals, and compare prospective usefulness with the reference index. Start with whether users can correctly explain the reading and notice meaningful changes, not claims of higher returns. AI can later explain recorded inputs, but must not invent missing causes or adjust the numeric score invisibly.
