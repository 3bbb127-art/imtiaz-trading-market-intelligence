# AGENTS.md — Mandatory Agent Operating Rules

## Mission
Work on the existing Global Market Intelligence Officer AI without unnecessary rebuilds, scope expansion, or complexity.

## Before Any Work
Every Agent MUST:
1. Read this file.
2. Read `PROJECT_STATUS.md`.
3. Read `REQUIREMENTS.md`.
4. Read `TEST_PLAN.md`.
5. Run `git status`.
6. Review recent commits and relevant changed files.
7. Understand the exact current task and its dependencies.
8. Verify the relevant current state when possible.
9. Only then plan and implement.

Do not start unrelated work. Do not guess missing context.

## Truth Rule
Never claim DONE, COMPLETE, TESTED, PASS, VERIFIED, or READY FOR RELEASE without real execution and evidence.

Use:
- `NOT VERIFIED` — not actually tested
- `FAILED` — test ran and failed
- `BLOCKED` — genuine blocker prevents progress
- `NOT READY — VERIFICATION INCOMPLETE` — required verification is incomplete
- `PROJECT VERIFIED — READY FOR RELEASE` — only after all required release checks actually pass

Previous Agent claims are not evidence.

## Failure Cycle
`FAIL → DIAGNOSE ROOT CAUSE → FIX → TEST AGAIN → REGRESSION TEST`

## Global-First
All parsers, engines, functions, rules, and data logic must be generic for country, commodity, origin, destination, city, market, currency, and trade route.

Afghanistan, India, Pakistan, Kabul, Herat, etc. are test examples only. Never hard-code country-specific behavior when a generic rule is required.

## Clean Code
Keep the project:
`SIMPLE → CLEAN → MODULAR → TRACEABLE → TESTABLE → MAINTAINABLE`

- Prefer focused files and small testable functions.
- Avoid duplicate logic and giant monolithic files/functions.
- Avoid unnecessary abstractions, dependencies, and files.
- Do not mix unrelated business logic.
- Reuse stable existing code where appropriate.
- Do not broad-refactor healthy code to fix a focused bug.

When something fails, it should be possible to trace:
`PROBLEM → MODULE → FILE → FUNCTION → TEST → FIX`

## Minimal Change
Make the smallest correct change. Preserve working functionality. Do not rebuild the app or replace architecture without evidence.

## Scope Control
An Agent may fix the assigned task and strictly necessary supporting issues. Do not silently add unrelated features, redesign the product, replace architecture, change major flows, or perform destructive operations. Major changes require user approval unless already approved in project requirements.

## Project Memory
The control documents are:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `REQUIREMENTS.md`
- `TEST_PLAN.md`

Keep them synchronized with reality.

## GitHub
GitHub is the source of truth for code and history. Do not claim a commit exists unless it was actually created.

## Agent Handoff
A new Agent MUST repeat the initial-read/check process and verify the real current state. Never trust an earlier Agent report without checking.

## Multi-Agent Failover
If an active Agent reaches a legitimate quota, rate limit, provider outage, tool failure, or service limitation:
1. Save project state.
2. Update `PROJECT_STATUS.md`.
3. Record the reason and last verified state.
4. Hand off to another authorized Agent/Provider when available.

No fake accounts. No multiple accounts to bypass limits. No provider-policy bypass.

## Exhausted Agent Lock
When Agent A is exhausted and Agent B takes over:
- A = `EXHAUSTED + LOCKED`
- B = `ACTIVE`

A MUST NOT automatically resume if its quota later returns.

There must be no automatic `A → B → A`.

## User Approval for Reactivation
A previously exhausted/locked Agent can return only after explicit user approval.

When it becomes available again:
`REACTIVATION APPROVAL REQUIRED`

Show the user:
- Agent
- current task
- current phase
- current active Agent
- reason for lock
- availability
- what would be resumed

After approval, the returning Agent must repeat the normal handoff/current-state verification before changing anything.

## Active Agent
Project state must identify one `CURRENT ACTIVE AGENT`. An available or recovered Agent must not silently become active.

## Agent States
`AVAILABLE` `ACTIVE` `EXHAUSTED` `LOCKED` `BLOCKED` `FAILED` `AWAITING_USER_APPROVAL` `INACTIVE`

## Regression
After an important fix, test affected existing behavior and dependencies. Relevant areas include Parser, Global Market Scope, Research, Evidence, Price, FX, Supply, Demand, Stock, Shipments, Import Cost, Risk, Competition, Forecast, Reports, UI, and Navigation.

## Definition of Done
A task is `DONE` only when:
1. Required implementation is complete.
2. Relevant tests actually ran.
3. Required tests passed.
4. Relevant regression was checked.
5. Project state was updated.
6. Changes are traceable in Git.

Otherwise use `NOT VERIFIED`.

## Release Gate
If a required test fails:
`NOT READY — VERIFICATION INCOMPLETE`

If a required test was not run:
`NOT VERIFIED`

Only after required release verification genuinely passes:
`PROJECT VERIFIED — READY FOR RELEASE`
