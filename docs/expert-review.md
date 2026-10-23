# Bitcoin Side Quest: expert review and priorities

Reviewed 23 October 2026. These are hypothetical professional perspectives, based on the running site, collector, calculation code and provider documentation. They are not interviews, an independent security audit, or evidence of product demand.

## The decision

Keep the product focused on a useful question: **What trading activity deserves a closer look, and how much can I trust the picture?**

The site can become a good visual investigation tool. It cannot currently establish where all capital is flowing, why investors acted, or what someone should trade. Trying to satisfy every expert by adding panels would bury its main advantage: a quick, understandable view.

The inspected snapshot, completed at 20:10 UTC, contained 35 pools covering four of ten alts and all five stables. ETH had five pools; one supplied approximately 59.7% of its sampled volume. These are observations of that snapshot, not permanent coverage figures. The previous “9 of 15” headline concealed how limited the altcoin coverage was. Pool count is not the percentage of market activity captured.

Priority definitions: **P0** prevents misleading conclusions or blocks a planned expansion; **P1** improves repeat usefulness and operational quality; **P2** requires a larger data capability. Effort is relative to this small, dependency-free site, not a delivery estimate.

## All ten additional angles

| Perspective | Biggest weakness and practical consequence | Smallest useful response | Priority / effort |
|---|---|---|---|
| Market microstructure researcher | Gross swap legs can include arbitrage, bots, wash activity and multi-hop routing. A large positive difference is not evidence of fresh capital, unique buyers or investor conviction. | Lead with buy/sell balance and measured activity. Put intent and causality outside the claim. Show the underlying pools; avoid “smart money,” whale or demand labels without transaction-level evidence. | P0 / small for wording; P2 / large for attribution |
| Statistician | This is a selected, nonrandom sample. Both endpoints must be in the displayed fifteen, so important outside counterparties disappear. The sample favors discovered high-volume pools and changes as rankings or discovery change. Cross-coin totals are not comparable market inflows. | Expose alt and stable coverage separately, allow network scope, show largest-pool share and the result without that pool. Say that market-wide coverage is unknown. Establish stable pool cohorts before adding trends. | P0 / medium |
| Data engineer | Price, ranking, catalog, discovery and pool observations have different ages. A snapshot completion time can hide older components. Rolling windows across pools are not synchronized block boundaries. | Show oldest pool retrieval time and quote time separately; expose retrieval spread. Use the same pools for pace comparisons. Record identity and source fields. Never join on ticker alone. | P0 / medium |
| Reliability engineer | “Live” is best-effort polling through free providers and scheduled publishing. An outage, delayed schedule or schema change can silently weaken coverage while the page remains available. | Keep last valid data with its original timestamp. Distinguish old, partial and absent data. Reject malformed snapshots, version the pool API request, and keep failure details. Next add scheduled-run failure notification, a last-attempt status and a tested rollback. | P0 now; P1 operations / medium |
| Beginner UX researcher | “Pools,” “DEX,” a large dollar balance and fifteen connected circles require prior knowledge. Users may infer that missing lines mean no trading, or that an arrow explains a price move. More expert controls would increase this problem. | Keep one map, one selected-coin card and one short observed explanation. Put comparisons, identifiers and verification behind a single disclosure. Use “trading between coins” and clearly label incomplete coverage. Validate with people who are new to crypto. | P0 / small, then user testing |
| Accessibility specialist | Faded unselected coins and tiny labels reduce readability. Color-only distinctions would fail some users; a graph must also work without a mouse. Existing arrow direction and text help but do not make the whole site accessible. | Use solid incoming and dashed outgoing lines, readable unselected labels, darker essential text, keyboard tab navigation and larger controls. Keep the route list as a text alternative. Next test zoom, screen readers, touch targets and the complete contrast palette. | P0 basics; P1 full audit / medium |
| Product strategist | A one-time attractive snapshot does not establish a recurring reason to return. “Why” is the most valuable promised answer, yet the data supports descriptions, not causal explanations. | Make the repeat task “find activity worth investigating.” Add a same-pool short-window comparison now. Next validate demand for a small “changed since your last visit” view before building alerts, accounts or a large history system. | P1 / medium; demand untested |
| Stablecoin risk analyst | A shared stablecoin column can imply interchangeable cash. Near-$1 pricing does not establish backing quality, redemption access, issuer solvency or bridge safety. Circulating USD value is not net issuance. | Keep price deviation visible and add a concise distinction between peg and safety. Next provide source-dated backing/redemption descriptions, provenance and sustained deviation history. Unknown/newly ranked coins must remain unclassified until checked; do not invent a composite safety score. | P0 language; P1 profiles / medium |
| Security engineer | Malformed or malicious data can create misleading numbers or unsafe links. Frontend validation was shallow; third-party workflow actions use mutable major tags. No wallet reduces transaction risk but does not protect publication integrity. | Validate identities and finite numeric amounts, build provider links from trusted origins, escape labels and accept only requested pool responses. Next pin reviewed workflow actions, review branch controls, add a restrictive content policy and practice recovery. | P0 input checks; P1 publishing / medium |
| Data licensing specialist | Free technical access is not a permanent right to monetize, redistribute or offer reusable downloads. The planned evidence download would expand use beyond an on-screen chart. Reverse-engineering an interface does not supply a data license or make collection cost-free. | Retain attribution and ordinary provider links; withhold reusable exports. Record the endpoints and intended display/cache use, confirm rights before monetization/history export, and evaluate explicitly permitted free alternatives. Do not assume that selected fields or cached responses are exempt. | P0 before those expansions / external dependency |

The accessibility recommendations follow [W3C guidance on conveying meaning beyond color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). They are not a claim of WCAG conformance.

Stablecoin mechanisms need individual treatment: for example, [Ethena describes funding, custody, exchange and liquidation risks for USDe](https://docs.ethena.fi/protocol-overview/risks.md). This source supports distinguishing risk mechanisms; it does not rate USDe against the other displayed coins.

Provider constraints are concrete. [GeckoTerminal documents a beta API, caching and variable public limits](https://api.geckoterminal.com/docs/index.html). [CoinGecko's licensing explanation](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses) distinguishes commercial display from redistribution and says free/keyless use does not include commercial rights. [GeckoTerminal's terms](https://www.geckoterminal.com/terms-conditions) subject its free API to the API terms. Our exact display, cache, retention and future commercial use still need a documented rights decision; this review does not declare them cleared.

## The original three expert perspectives

**Smart contract author:** A market visualization is useful for locating candidate pools, not for deciding that a contract or integration is safe. The revised pool inspector exposes the network, token addresses, representation, pool identifier and provider link. It explicitly distinguishes a pool ID from a deployed contract address. Uniswap v4's [PoolManager design](https://developers.uniswap.org/docs/protocols/v4/concepts/poolmanager) makes that distinction necessary. Bytecode, proxy controls, hooks, oracle manipulation resistance and deployment verification remain outside scope.

**Experienced trader:** A big net figure alone supplies little decision context. The revision adds recent trading pace, concentration, network filtering and sensitivity to the largest pool. Pool liquidity remains a reported pool total, not an executable quote: [Uniswap explains that price impact depends on trade size and available liquidity](https://support.uniswap.org/hc/en-us/articles/8671539602317-What-is-price-impact). Venue depth, fees, slippage, order execution, latency guarantees and predictive validation remain absent. This is a place to begin investigation, not an execution terminal.

**Cryptographer:** A provider link or locally computed hash cannot prove that trades happened or that a dataset is complete. Recorded input fields now allow the displayed arithmetic and token direction to be checked. The interface separately says that source authenticity, chain inclusion, finality and completeness are not verified. [Ethereum block documentation](https://ethereum.org/developers/docs/blocks) describes the commitments involved in real chain evidence. Adding a hash beside a mutable payload would not close this gap; no “cryptographically verified” badge is used.

## Implementation order

### First: make the existing view honest and legible

Implemented in this revision:

- Buy share takes the main position; the dollar imbalance is subordinate and labeled as sampled buying minus selling.
- The coverage card separates alts from stables and respects the selected network and time window.
- The map shows oldest pool retrieval age and degraded feed states. Detailed evidence distinguishes quote age and collection spread.
- Network filtering, same-pool pace, largest-pool share, and largest-pool removal answer concrete investigation questions.
- Exact identities and calculation reproduction are available below the map, behind “Understand this activity.” They do not claim chain verification.
- Solid/dashed routes and stronger essential label contrast preserve a visual interface without relying only on color.
- Stablecoin selection explains that a dollar target is not a safety assessment.
- Structural validation and fixed-origin links harden feed handling. The collector requests a documented API version and excludes unrequested pool records.
- Reusable data downloads and AI-generated causes are not included.

### Next: prove the utility and improve continuity

1. **Test comprehension with five crypto beginners.** After ten seconds, ask what is trading, which direction is larger, whether all markets are covered, and whether the map proves a cause. Target four out of five correct interpretations. This target is proposed; no user test has happened.
2. **Improve coverage deliberately.** Keep the automatically ranked top ten visible, including price-only states. Prioritize a supported missing alt or one important excluded counterparty based on measured gaps, with explicit scope. Do not replace missing top-ten assets with convenient tokens and still call it “top ten.”
3. **Create a small comparable history.** Store membership, pool cohort, window boundaries and schema version. Show changes only on matched pools; label additions/removals separately. Do not subtract two overlapping 24h totals and call the difference an interval inflow. Resolve retention/display rights before rollout.
4. **Add operational recovery.** Report failed update attempts independently of last successful data. Notify the maintainer on actionable failures using existing hosting controls; test restoration of a known-good deployment. No recurring notification was created by this audit.
5. **Add stablecoin context on selection.** Source-dated mechanism, redemption conditions and provenance, plus a peg history once a suitable feed exists. Keep details collapsed and avoid pretending one price point measures solvency.

### Later: evidence-rich explanations

Consider transaction-level deduplication, independently checked chain evidence, executable depth and carefully sourced event context only after coverage and repeat usefulness justify the work. These require additional engineering and may exceed free infrastructure limits.

AI can later turn the selected evidence into a short explanation with clickable sources and explicit unknowns. It must separate an observation from a possible explanation and say when evidence is insufficient. It should never convert volume into invented buyer motives, assign confidence percentages without calibration, or certify contracts. Provider terms must also allow the intended processing. The current deterministic explanations are an appropriate starting point.

## Design rule

Default screen: **map → selected coin → one observed explanation**. Optional detail: **activity comparison → pools → calculation checks**. One useful question per addition; no ten-panel expert dashboard and no single “trust score” that hides different kinds of uncertainty.

The unresolved issues are still real: most alts have price-only coverage, market-wide coverage is unknown, activity attribution is absent, provider evidence is not chain proof, licensing for expansion is unresolved, and retention has not been established with users. The revision reduces misleading presentation; it does not erase those limitations.
