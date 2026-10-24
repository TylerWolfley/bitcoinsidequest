# Market Map and token profiles

## Page responsibilities

- **Activity (`/`)**: notice up to three measured changes, then open a coin. All ten alt and five stable tiles are profile links.
- **Market Map (`/market-map.html`)**: compare the current ten alts at a glance. Stablecoins sit below in a separate dollar-target strip. Bitcoin is a reference link.
- **Token (`/token.html?coin=solana`)**: current price, market cap, reported volume, measured vibe, daily price history, then the existing trading diagram and evidence tools.
- **Temperature**: the fixed-sample market reading and its explanation. The small monitor remains in every page header.
- **Journal**: immutable daily notes and explicitly separate volatility scenarios. Token names open profiles; dropdowns select scenarios.

The navigation is Activity / Market Map / Temperature / Journal. Profiles are destinations within that system, not another navigation category. Old homepage `?coin=` links redirect into profiles and preserve their trading filters. Profile return links retain the originating page and filters, restricted to known local pages.

## Comparison rules

`lib/market-map.js` is the shared admission and description layer. The map and profile vibe call the same `marketReading`; they do not invent independent scores.

1. Identity is a canonical CoinGecko ID, never a ticker match. The snapshot supplies the changing ranked universe. Missing mappings remain visible outside the plot.
2. Horizontal position is the provider's 24-hour dollar price return. Against Bitcoin uses `(1 + coinReturn/100) / (1 + btcReturn/100) - 1`, expressed as a percentage. Both price observations must be fresh and aligned within five minutes.
3. Vertical position is last-hour reported trading volume divided by the preceding five-hour hourly average, for the same selected markets. A log scale spreads ratios around 1×. A measured zero gets a separately labeled 0× band; absent data never becomes zero.
4. Use existing source selection: eligible on-chain sample first, otherwise the reviewed exchange sample. Explicit on-chain/exchange choices stay explicit. USD and USDT amounts are never pooled; only within-source ratios are compared across assets.
5. Admission requires a snapshot and price no older than 30 minutes, complete and synchronized activity periods, fresh activity, a positive baseline and at least 10,000 source units in the comparison. Failed eligibility is shown next to the coin outside the plot.
6. The two axes cover different periods. Position describes two observations together; it is not evidence that activity caused, predicted or confirmed the price movement. Hover labels, method text and headings identify the windows.
7. Rectangular labels have equal size and show both the signed price return and activity ratio. Size is not market cap or confidence. Displaced labels keep a leader and original coordinate marker, and cannot cross the zero-return or 1× activity boundary. Plot height expands to make room for crowded quadrants. Motion only transitions measured positions and respects the site preference/reduced motion.
8. On narrow screens, the same readings become aligned price bars and explicit pace values. Reading and opening a coin does not require hover, dragging or interpreting a crowded plot.

## Map quick previews

Hovering or keyboard-focusing any map token opens a compact preview; the token itself remains a normal profile link. The preview shows the current quote, the selected 24-hour price comparison, activity pace and two bars comparing the preceding five-hour hourly average with the last hour. Both bars use the same scale and selected-market units. On touch screens, a separate information button opens the card so tapping a token still opens its profile. Escape, Close and clicking outside dismiss the card; a touch/keyboard dismissal returns focus to its trigger. The card stays open while moving the pointer into it and is refreshed from the same reading when the data or filters change.

`lib/map-preview.js` supplies the testable explanation rules. Pace at least 1.5× or at most two-thirds is highlighted first. Otherwise, a buying-share change of at least 10 percentage points is highlighted only with at least 10,000 current source units. Other readings explicitly say there is no standout trading shift. These are the existing descriptive highlight thresholds, not statistical confidence. Price direction follows the selected dollar/BTC benchmark. The text does not attribute a price move to trading activity, news or investor intent. Missing/stale data, measured zero, stablecoins and the Bitcoin reference retain their distinct meanings.

## Profile vibe

Vibe is a short description of measured conditions, not a proprietary sentiment score. Price direction uses the 24-hour return. Activity at least 1.5× is described as having picked up; at most two-thirds is described as slowed. The intermediate band is near its recent pace. These are provisional descriptive thresholds, not optimized predictions. An expandable receipt shows the underlying values and scope.

Missing/stale inputs have explicit states. Stablecoins describe distance from the dollar target, without implying reserve quality or redemption safety. Bitcoin has market-price context but no invented trading sample. Reported buying is directional volume in the selected sample, not unique buyers or new capital.

## Price history

The existing free daily collector now covers the ten alts, five stables and BTC. It retains canonical identities, once-per-UTC-day collection, paced requests and rate-limit backoff. It archives underlying observations privately with the existing encrypted research system.

`scripts/build-price-charts.mjs` derives the public `data/price-charts.json`. It contains rounded SVG drawing geometry and display summaries, not the raw research price arrays. This is a display minimization choice, not a claim of exemption from provider terms. Existing attribution and rights limitations still apply.

7D, 30D and 1Y views use completed daily UTC observations, so the latest chart point differs from the current quote. Both dates are labeled. Gaps start new line segments; partial histories are labeled. Fewer than two observations produces an unavailable state, not an estimated line. The axis is fit to the displayed values; precise dollar labels make small stablecoin deviations visible.

## Adding coins later

Ranking changes automatically feed the map, profiles and daily-history collector. To add trading coverage, follow `coverage-system.md`: verify identity, admit a supported source, validate units and complete periods, and test failure cases. Do not bypass eligibility to fill the plot. A newly ranked coin can have a price/profile/chart while its activity is explicitly unavailable. Temperature membership remains governed separately by its reviewed, versioned sample.

## Remaining limits

Activity is a bounded sample, not market-wide flows. The two time windows are intentionally distinct. Charts are daily, not intraday or execution tools. Ranking departures currently leave a clear outside-lineup page rather than a historical token directory. Free-source outages can pause comparisons. No AI explanation, valuation claim, new alert service or prediction is added by this feature.
