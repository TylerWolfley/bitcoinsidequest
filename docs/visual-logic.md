# Visual activity system

The page has three steps: **notice a change → choose a coin → read its trades**. Price, gross trading activity and reported trade direction are separate measures. None establishes why a price changed or how much new capital entered crypto.

## Comparable activity

`lib/activity.js` is the shared calculation layer for highlights, coin tiles and the selected-coin panel. It uses the existing reviewed identity and source rules in [coverage-system.md](coverage-system.md); adding a ranked coin does not admit an unreviewed ticker or a fabricated feed.

- Select one source using the existing automatic / on-chain / exchange preference. Respect the network filter for on-chain pools. USD and USDT never enter the same sum.
- Deduplicate records by their canonical ID. Require both one-hour and six-hour windows with nonnegative, finite amounts; each six-hour side must contain its corresponding one-hour side.
- Use exactly the same records for both periods. The previous hourly average is `(six-hour total − one-hour total) / 5`. Dividing six hours by six would overlap the current hour and dilute the comparison.
- Activity pace is `last-hour total / previous hourly average`. A measured zero numerator is zero pace. A zero denominator is unavailable, never infinity.
- Buying-share change is last-hour buy share minus the preceding five-hour buy share, expressed in **percentage points**. Selecting the quote coin reverses buying and selling before calculating shares.
- Exclude incomplete records from the detail comparison and state the excluded count. Do not promote a highlight if any record in its scope lacks a valid comparison. Exchange windows must have matching observation ends. DEX windows are provider-reported rolling periods; retrieval does not prove exact event alignment.

## What stands out

Highlight eligibility is deliberately conservative:

1. Only ranked alts, at most one item per coin and three items overall.
2. The page must be online, snapshot and all compared record retrievals at most 30 minutes old. Exchange observation ends must also be at most 30 minutes old. Future clock values beyond a one-minute tolerance do not qualify.
3. Every scoped record must support the comparison. Previous hourly average must be at least 10,000 in that source's unit.
4. Pace qualifies at ≥1.5× or ≤2/3×. Buying-share movement qualifies at ≥10 percentage points, with at least 10,000 units traded in the latest hour.
5. Rank pace changes by `abs(log2(ratio))` (zero pace uses the finite sentinel 100); share changes by `abs(point change)/20`. Choose the stronger candidate per coin; break ties deterministically by type then coin ID. This is an editorial ordering of relative changes in samples, not an ordering of capital inflows or statistical significance.

The thresholds can be revised in this module with matching tests and method copy. They are not a claim that the last five hours represent normal market conditions. No eligible changes produces an explicit quiet/unavailable state. Missing activity never produces a zero or an invented highlight.

Highlights and tile comparisons follow Activity and Network filters, and always compare the last hour with the preceding five hours. Clicking a highlight selects its coin and the one-hour view, clearing a previously selected route. It does not change the user's explicit source or network choice.

## Visual encodings

| Visual | Meaning |
| --- | --- |
| Coin tile's two bars | Previous hourly average, then latest hour, scaled within that coin. Not cross-coin dollar magnitude. |
| Comparison panel's two bars | Same two disjoint periods, with their measured values and source units. |
| Left green routes | Reported trades buying the selected coin. |
| Right dashed copper routes | Reported trades selling the selected coin. These are separate executions from the left side, not the same money continuing through a journey. |
| Route thickness | Larger amount relative to the other visible routes; includes a minimum readable width, so not a linear ruler. |
| Center ring | Buying versus selling share over all scoped routes, or the isolated route. A missing/zero-volume sample uses a neutral ring. |
| Buying-share markers | Open marker: preceding five hours. Filled marker: latest hour. Position on a fixed 0–100% scale. |
| Price percentage | Market-wide 24-hour price movement, independent of activity direction and selected trading window. |
| Hourly chart | Only actual exchange observations: 12 recorded five-minute buckets per displayed hour, 24 hours, aligned to the explicit collection boundary. |

Only the three largest routes are initially drawn. All routes remain available in Sources & routes. Ring and summary cover all scoped routes; selecting a route narrows both the diagram and detail comparison. Coverage remains a bounded sample, not a global denominator.

## History and motion

On-chain rolling aggregates cannot produce an hourly timeline. The interface must not interpolate one, create decorative price sparklines or imply historical observations that were never collected. Exchange hourly charts require 288 contiguous recorded buckets and a common observation end. A missing bucket invalidates the timeline.

Route glints illustrate direction at a constant decorative speed, not individual trades, arrivals, timestamps, or a real-time stream. Bar entrances and hover/focus feedback make state changes easier to notice. Motion can be switched off and the choice is saved locally. Without an explicit preference, the operating system's reduced-motion setting wins. All values and controls remain available with motion off.

Keyboard-accessible coin, route and hourly-bar controls supplement the diagram. Missing coverage, old inputs, zero activity and failed refreshes retain explicit states. The evidence panel keeps exact markets, provider links, timestamps and reproducible recorded arithmetic separate from the simple main view. This is not a cryptographic proof of the providers' reports.

## Validation

`test/activity.test.js` checks disjoint-period arithmetic, reversed quote direction, duplicate IDs, changing membership, invalid nested sides, zero versus missing activity, stale/future clocks, highlight thresholds, source separation, aligned exchange periods and actual hourly aggregation. Existing model, research, exchange and snapshot tests remain required.
