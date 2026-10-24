# Sitewide layout and behavior audit — 2026-10-23

The pass follows the user routine: notice a change, compare the market, inspect a coin, then review context and recorded notes.

| Weakness | Resolution |
| --- | --- |
| Home combined discovery, selection and deep evidence | Home is the Activity overview; the deep trading workspace moves into profiles |
| No dedicated cross-coin visual comparison | Market Map gets its own navigation entry and page |
| Clicking a token could filter a route or choose a scenario | Token labels navigate to canonical profiles; separate filter buttons and scenario dropdowns make the other actions explicit |
| No single home for price, cap, vibe and chart | All sixteen current tokens share one profile template |
| Current quotes could be confused with historical closes | The current quote and last daily chart observation have separate dates and labels |
| Missing activity could appear as a weak market reading | Admission rules exclude it from positions and display the reason; the profile still works |
| Dollar-target assets do not fit a growth-asset map | Stablecoins have a separate peg/circulating-value strip and stable-specific profile description |
| Activity sources and periods can be confused | The same scope rules drive map and profile; controls and explanations expose source and period |
| Existing shared links would break after moving details | Homepage coin URLs redirect, preserving filters; return links preserve origin and comparison |
| Dense desktop plots are difficult on phones | Mobile shows aligned bars and explicit pace values, using identical data; desktop labels remain in their true quadrant and print both values |
| Research history could leak into a static deploy | The explicit public file allowlist is retained; raw histories and encryption keys remain excluded |
| Refresh can interrupt reading | Focus is retained and profile evidence disclosures preserve their open state |

## Verification

- Added semantic tests for stale/offline/future inputs, complete windows, small baselines, measured zero vs missing, BTC-relative returns, source isolation, stablecoin descriptions, canonical links, colliding labels and daily chart gaps/validation.
- Full suite: 70 tests passing, including a follow-up regression for clustered labels crossing a market quadrant. Browser checks cover desktop/phone layouts, range controls, scenario selection, old links and profile navigation. Publication is checked separately against the deployed revision.
- Current first collection: nine of ten alts have comparable activity; all sixteen current tokens have real daily chart history. Coverage is dynamic, not a permanent guarantee.

## Deferred deliberately

Intraday price charts, full-market flow attribution, an out-of-universe token archive, predictive validation, valuation models and AI explanations remain separate work. Temperature weights remain provisional; this layout change does not validate them. The existing scheduled collector remains best-effort on free services.
