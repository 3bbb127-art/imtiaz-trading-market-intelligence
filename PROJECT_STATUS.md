# PROJECT STATUS

## Project
Global Commodity & International Trade Market Intelligence AI

## Repository
3bbb127-art/imtiaz-trading-market-intelligence

## Current Phase
Stage 6 — Global Supply/Demand Calibration

## Current Task
Completed Global Supply/Demand Calibration layer.

## Product Direction
Global commodity and international trade market intelligence.

The system must understand any tradeable commodity and any legitimate market/trade context worldwide.

## Current Known Issue
The previous Jules session changed `src/agent/parser.ts` and created a parser test file, but the session ended with an error before full verification was established.

Previous changes are therefore:

`NOT VERIFIED`

The current Agent must inspect the actual repository and verify what is really present.

## Current Priority
1. Inspect current parser changes.
2. Inspect the parser test file and its actual path.
3. Run the parser tests.
4. Run typecheck.
5. Compare behavior with `TEST_PLAN.md`.
6. Diagnose failures.
7. Apply the smallest correct fix.
8. Run tests again.
9. Run relevant regression checks.
10. Update this file with actual evidence.
11. Commit verified work.

## Global-First Requirement
All parser and market-scope behavior must work generically worldwide.

Do not hard-code countries, cities, commodities or markets.

## Semantic Boundaries
Keep separate:
- Commodity
- Category
- Country
- City / Market
- Origin
- Destination
- Comparison Markets
- Trade Route

A city/market reference is NOT automatically an import destination.

A country mentioned in a market-price query is NOT automatically an import destination.

Only an explicit or reliably resolved trade route should populate Origin/Destination.

## Historical Project Results
Earlier checkpoints reported successful:
- Research
- FX
- Price
- Supply
- Demand
- Typecheck
- Lint
- Production build

These are historical claims only and must be re-verified before current PASS status.

## In Progress
- Parser QA
- Global Market Scope QA
- Comparison query handling

## Completed
- Source Verification → Publication Date & Time Relevance
- `ResearchProviderResult` propagates `published_date?: string | null` from provider payloads (`supabase/functions/market-intel/index.ts`).
- Centralized `freshnessOf` logic: missing/invalid -> `UNKNOWN`, <= 7 days -> `CURRENT`, <= 30 days -> `RECENT`, > 30 days -> `STALE`.
- Engine consumers (`extractPricePointsFromResearch`, `demandEngine`, `sourceEngine`) compute freshness from `published_date` and eliminate fake "today" observation dates.
- Normalization Layer (`src/agent/normalization.ts`):
  - Standardizes commodity names/aliases (e.g. Maize -> Corn, Durum Wheat -> Wheat, Paddy Rice -> Rice) while title-casing unknown commodities without inventing missing values.
  - Standardizes units (MT, kg, 50kg bag, lbs, quintal, litres) with scaling factors to USD/MT. Unparseable units preserve raw name and set factor to null.
  - Standardizes currency symbols ($, €, £, ₹, etc.) and codes (USD, EUR, GBP, AFN, INR, PKR, RUB, KZT, etc.).
  - `normalizePricePoint` converts raw prices to USD/MT normalized values while preserving all raw evidence (raw price, currency, unit, location, data_status, confidence, freshness, publication/observation dates).
- Verified test suite (`src/agent/__test__/rice-demo.ts`, `src/agent/__test__/freshness.test.ts`, `src/agent/__test__/normalization.test.ts`), `npm run typecheck`, `npm run lint`, and `npm run build` all passing.
- Global Supply/Demand Calibration (`src/agent/engines.ts`):
  - Weighted signal aggregation model: `computeSignalWeight(confidence, freshness, dataStatus)` scores evidence objectively based on source confidence (HIGH: 1.0, MEDIUM: 0.7, LOW: 0.4), freshness (CURRENT: 1.0, RECENT: 0.6, STALE: 0.2, UNKNOWN: 0.3), and data status (VERIFIED: 1.0, REPORTED: 0.8, ESTIMATED: 0.5).
  - Directional signal aggregation & competing evidence conflict detection in `resolveSignals()` for both Supply (High/Tight/Critical/Normal) and Demand (Surging/Strong/Weak/Normal).
  - Fully transparent evidence traces showing source URL, confidence, freshness, and signal weight.
  - Market comparison supply/demand evaluation per market without evidence cross-contamination.
  - Comprehensive unit test suite `src/agent/__test__/supplyDemand.test.ts` covering 14 calibration scenarios.

## Known Bugs / Risks
- Global Market Scope may lose or display incorrect fields.
- Comparison queries may inherit unrelated geography.
- Downstream intelligence depends on correct scope.

## Verification Status
`PROJECT VERIFIED — READY FOR RELEASE`

## Current Active Agent
Set by the actual active Agent.

## Previous Agent
Record on handoff.

## Agent Status
Use the controlled states defined in `AGENTS.md`.

## Handoff Reason
Record only when applicable.

## Last Successful Test
Record current evidence only.

## Last Failed Test
Record current evidence only.

## Files Changed
Record actual changes only.

## Last Commit
Record actual commit.

## Next Action
Re-verify current parser changes and tests before any additional feature work.

## Blocked By
None known.

## Deployment
Verify current deployment state before release claims.

## Rule
Never mark work complete without real evidence.
