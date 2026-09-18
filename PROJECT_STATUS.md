# PROJECT STATUS

## Project
Global Market Intelligence Officer AI

Repository:
3bbb127-art/imtiaz-trading-market-intelligence

## Current Phase
Command Parser / Global Market Scope QA

## Current Task
Audit and fix the Command Parser → Global Market Scope flow.

## Known Current Issue
Recent testing showed that Research can execute while the displayed scope may contain incorrect or `n/a` values for:
- Commodity
- Origin
- Destination
- City / Market

Comparison queries may also inherit context that the user did not explicitly provide.

## Verified Existing Areas
Existing project records/history indicate that the following exist or were previously tested:
- App UI and main navigation
- Supabase backend / Edge Function
- Research flow
- FX flow
- Price engine
- Supply engine
- Demand engine
- Typecheck / lint / production build at earlier checkpoints

These historical results are NOT current PASS until the current Agent re-runs the relevant checks.

## In Progress
- Command Parser QA
- Global Market Scope correctness
- Comparison-query scope handling

## Completed
Only add items here after current evidence confirms them.

## Known Bugs / Risks
- Global Market Scope may lose or fail to display parsed fields.
- Comparison queries may incorrectly inherit a destination/context.
- Downstream intelligence depends on correct scope.

## Last Successful Test
Historical only. Re-run before treating as current verification.

## Last Failed Test
Historical Global Market Scope failure where Research ran while scope fields remained incomplete or `n/a`.

## Files Changed
Update after real changes.

## Last Commit
Record the actual relevant commit.

## Next Action
1. Inspect the current parser and scope code.
2. Reproduce the issue with global test cases.
3. Identify the root cause.
4. Apply the smallest correct fix.
5. Run relevant tests.
6. Run regression tests.
7. Update this file with evidence.
8. Commit the verified change.

## Blocked By
None known.

## Verification Status
`NOT VERIFIED`

## Deployment Status
Current deployment state must be checked before release claims.

## Regression Status
`NOT VERIFIED`

## Current Active Agent
Set by the active Agent.

## Previous Agent
Record on handoff.

## Agent Status
Use the controlled states from `AGENTS.md`.

## Handoff Reason
Record only when a handoff occurs.

## User Approval Required
`NO` for the current focused parser/scope audit unless a major architecture/scope change is required.

## Reactivation Status
`N/A` unless a previously exhausted Agent becomes available again.

## Rule
Never mark work complete without real evidence.
