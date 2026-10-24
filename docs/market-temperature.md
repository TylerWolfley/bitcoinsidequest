# Market temperature v2 and daily journal

## Product layout

The activity map remains the homepage. Its header has a compact temperature monitor linking to temperature.html. That page shows the current gauge, three component cards, exact coin coverage, actual reading history and expandable methodology. journal.html holds immutable daily notes and a separate current-price scenario explorer. The shared Activity / Temperature / Journal navigation works on phones and desktops.

## Formula and scope

Temperature = 40% price strength + 30% strength versus BTC + 30% buy-side activity, rounded once. These are provisional design weights, held fixed to isolate the coverage and discontinuity repairs. They have not been optimized or validated against future returns. The two price checks remain correlated.

- Each alt's 24h price return in percentage points maps to 50 + 50 × tanh(return / 3). The three-percentage-point scale is an explicit provisional choice. It removes the discontinuous v1 threshold; it is not a significance test or historically calibrated normalization.
- BTC-relative return is ((1 + alt / 100) / (1 + BTC / 100) − 1) × 100, mapped with the same function.
- Each declared coin's buy-side share is 100 × reported buying / total within its fixed market sample, reversing quote-token direction. Average those percentages equally across coins. Source units remain separate: DEX USD versus exchange USDT.
- All ten price inputs and ten aligned BTC comparisons are required. Every declared trading input is required, with at least seven declared trading coins. Currently nine trading coins qualify; Figure Heloc is explicitly price-only.
- Every quote and selected market must be no older than 30 minutes, with no more than one minute of future tolerance. BTC and alt quote times must align within five minutes. Exchange windows must be completed and internally aligned. The 100,000-source-unit minimum is unchanged.
- Never silently drop a missing market, shrink a denominator, substitute an exchange, insert 50, reweight components or smooth across an outage. The current score becomes unavailable. The monitor shows Waiting; the history still retains the previous recorded observations.
- Cold 0–24, Cool 25–44, Mixed 45–55, Warm 56–74, Hot 75–100. Higher means stronger measured conditions, not cheaper coins, investor psychology, a probability or a recommendation.

## Adding coins and changing coverage

lib/temperature-policy.js is the reviewed sampling contract, keyed by canonical CoinGecko identity and containing exact market IDs and base/quote identities. Known price-only exclusions are explicit. They are never inferred from a feed failure.

The map still follows market-cap rankings automatically. A new ranked coin without a reviewed policy pauses the aggregate until admitted. Follow coverage-system.md to establish identity and a valid source, specify its sample or explicit price-only exclusion, increment the policy version and validate complete windows. The collector continues fetching pinned pools even if discovery ordering changes, while still enforcing current identity, liquidity and counterparty checks.

Ranking membership, model version and the declared trading scope form the comparison scope. Changes break the chart line and suppress direct deltas. More discovered pools can still appear in the activity map without silently changing temperature inputs.

## Durable evidence and recovery

scripts/history-store.mjs captures the original per-coin price, 24h return, rank and membership; BTC reference; provider/retrieval/window timestamps; selected market identities, side values, units and source inputs; coverage diagnostics; model parameters, policy, source revision and result. Raw tick-by-tick trades and full five-minute bar arrays are not retained. This is sufficient to replay v2 and test different transformations of its measured inputs, not every possible future strategy.

Each actual snapshot is recorded once in a dated JSONL file, including incomplete readings. A SHA-256 binds the replay payload. Replay uses the original evaluation time and stored policy so later freshness changes cannot rewrite it. A checksum detects changes, not provider authenticity.

The plaintext research directory .history/ is local or ephemeral in the collector and is ignored by Git. Before durable storage, scripts/archive-sync.mjs compresses and encrypts each file with AES-256-GCM, binding the filename as authenticated data. The separate market-history branch contains encrypted envelopes only. The key is the repository Actions secret HISTORY_KEY. The ignored local .env.history is the owner's recovery backup: retain it securely and never commit it. Losing every copy of the key makes the archive unreadable.

Production restores the encrypted branch before collection, records observations and the daily note, runs tests, then commits and pushes the encrypted archive before deploying. A restore/decryption/push failure stops publication. Push is never forced; workflow concurrency serializes collectors. Source deployments therefore do not erase history. Git history provides recovery from accidental changes; repository deletion and key loss remain risks. Monitor branch size as collection grows.

data/market-temperature.json is a rebuildable last-30-days UI series, at most 3,000 observations. Null scores, gaps longer than an hour and scope changes break the line. Legacy v1 history is retained separately, never spliced into v2. Public pages receive derived volatility summaries rather than reusable raw historical prices. There is no new public bulk-download feature.

Recovery commands, from a clean checkout with the key supplied privately:
1. node scripts/archive-sync.mjs restore
2. node scripts/replay-history.mjs
3. node scripts/collect-risk-temperature.mjs

HISTORY_KEY must be supplied through the environment or Node's --env-file option pointing at the ignored owner backup. Restore refuses to replace an existing .archive worktree; inspect an existing working copy instead. Production runners start clean.

## Daily publication

The first fresh collection in each UTC day creates one journal note. Subsequent collections never silently rewrite that note. Missing days are not fabricated. Each note freezes the observation time, temperature, measured prices/returns/buy shares, coverage, source evidence checksum and both price scenarios as known at publication.

The website shows the latest 90 notes; all notes remain in the encrypted research archive. A post is an automatic factual market check-in, not a buy/sell call or AI-generated explanation of motives. Incomplete temperature coverage is stated explicitly. Current scenarios are a separate section with their own fresh anchor; they do not revise the old post.

## Price scenario v1

The free CoinGecko market_chart endpoint provides up to a year of completed daily UTC prices per canonical coin. Historical downloads occur at most once per successful UTC day and are spaced 20 seconds apart. A 429 ends that attempt; later scheduled runs resume missing assets. The collector never uses a partial current-day price as a daily close or fills a gap.

Compute daily log returns and their sample standard deviation σ. The scenario endpoints are current price × exp(±σ√h), with h = 30 or 365 days. There is zero assumed log-price drift and a width of one volatility step in each direction. This is not a stated confidence interval, a calibrated predictive probability, expected price, fair value or support/resistance.

The monthly view needs at least 60 complete daily returns; the year view needs at least 300. A gap, history older than three days or anchor older than 30 minutes disables the range. These minimums are design rules. The method assumes stationary volatility and independent daily returns; clustering, jumps, changing supply and structural breaks violate those assumptions, especially at a year. A narrow range does not imply safety. The temperature does not influence this calculation.

Saved notes preserve the source URL, observation window, return count, σ, anchor price/time, horizon, model version and endpoints. Raw prices remain in the encrypted research store for internal evaluation. The chart is an illustration of the scenario range, not an invented projected price path.

## Validation and future evaluation

Regression tests cover the old +0.24% → +0.26% jump, disappearing negative quotes, declared-market outages, source substitutions, ranking changes, freshness/alignment, unit arithmetic, complete-sample requirements, null history points, model-version comparisons, archive replay, immutable publication, encryption/tampering, scenario gaps and public-summary equivalence.

57 tests pass at this revision. Arithmetic correctness is not proof of usefulness. The next research step is prospective evaluation on non-overlapping decisions: compare v2 with simple breadth and equal-weight baselines, run weight/scale sensitivity, report coverage outages, keep historical constituents, and mark unavailable subsequent prices as censored. Do not optimize and evaluate on the same window or treat overlapping 15-minute observations of 24h returns as independent trials. A month/year scenario cannot be evaluated before its horizon has elapsed. Archive original inputs before any formula change; bump the version and compare separately.

## Sources and usage scope

[Alternative.me](https://alternative.me/crypto/fear-and-greed-index/) remains a separately attributed daily Bitcoin reference, never an input. Prices/identity/history come from [CoinGecko](https://www.coingecko.com/en/api), pool samples from [GeckoTerminal](https://www.geckoterminal.com/), reviewed exchange samples from Binance and Kraken.

The [CoinGecko API terms](https://www.coingecko.com/en/api_terms) describe caching/storage safeguards, including encryption; [its licensing explanation](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses) distinguishes display from redistribution and excludes commercial rights on free/keyless use. The new archive is encrypted internal research storage, not a public raw-data feed. This does not establish unrestricted retention or commercial rights. Monetization, white-label use and reusable historical exports still require a documented rights decision. Do not treat encryption or derived fields as an exemption from provider terms.
