# PROJECT STATUS

## Project
Global Commodity & International Trade Market Intelligence AI

## Repository
3bbb127-art/imtiaz-trading-market-intelligence

## Current Phase
Command Parser / Global Market Scope Verification

## Current Task
Verify and correctly complete the Command Parser → Global Market Scope flow.

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
Only add items after current evidence confirms them.

## Known Bugs / Risks
- Global Market Scope may lose or display incorrect fields.
- Comparison queries may inherit unrelated geography.
- Downstream intelligence depends on correct scope.

## Verification Status
`NOT VERIFIED` (Local verification passed; authoritative status remains NOT VERIFIED until independent GitHub CI passes)

## Current Active Agent
Jules

## Previous Agent
N/A

## Agent Status
ACTIVE

## Handoff Reason
N/A

## Last Successful Test
- `npm ci` (passed)
- `npm run typecheck` (passed, zero errors)
- `npm run lint` (passed, zero warnings/errors)
- `npm run build` (passed, bundle verified)
- `npx tsx src/agent/__test__/rice-demo.ts` (passed, all assertions passed)
- Comparison parser tests (`compare rice prices in India and Pakistan`, `compare wheat prices in Russia and Kazakhstan`, `compare steel prices in Germany and Turkey`, etc. - all passed)

## Last Failed Test
None in current run.

## Files Changed
- `.gitignore`
- `src/lib/types.ts`
- `src/agent/parser.ts`
- `src/agent/executor.ts`
- `src/agent/engines.ts`
- `PROJECT_STATUS.md`

## Last Commit
Pending submit

## Next Action
Re-verify current parser changes and tests before any additional feature work.

## Blocked By
None known.

## Deployment
Verify current deployment state before release claims.

## Rule
Never mark work complete without real evidence.
