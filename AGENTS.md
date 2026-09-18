# AGENTS.md
# Global Commodity & International Trade Market Intelligence AI

This file is mandatory for every AI Agent working on this repository.

## 1. READ BEFORE WORK

An Agent MUST NOT start changing code immediately.

Before any work, the Agent must:
1. Read `AGENTS.md`.
2. Read `PROJECT_STATUS.md`.
3. Read `REQUIREMENTS.md`.
4. Read `TEST_PLAN.md`.
5. Run `git status`.
6. Review recent commits and relevant changed files.
7. Understand the exact assigned task and dependencies.
8. Verify the relevant current state when possible.
9. Create a concise plan.
10. Only then implement.

Do not guess missing context.
Do not start unrelated work.

## 2. USER CONTROL

The Agent may execute the approved task and small changes strictly required for it.

The Agent MUST NOT silently:
- expand product scope
- redesign architecture
- add unrelated features
- perform destructive changes
- rewrite healthy code

Major changes require user approval unless already explicitly approved in requirements.

## 3. TRUTH — NO FALSE CLAIMS

Never lie, guess, hide a failure, or present an assumption as fact.

Never claim:
DONE
COMPLETE
TESTED
PASS
VERIFIED
READY FOR RELEASE

unless the relevant work/test was actually executed and verified.

Use:
- `NOT VERIFIED` = not actually tested
- `FAILED` = test executed and failed
- `BLOCKED` = genuine blocker prevents continuation
- `NOT READY — VERIFICATION INCOMPLETE` = required verification incomplete
- `PROJECT VERIFIED — READY FOR RELEASE` = only after all required release checks actually pass

A previous Agent's claim is not evidence.

## 4. FAILURE LOOP

When a required test fails:

`FAIL → DIAGNOSE ROOT CAUSE → FIX → TEST AGAIN → REGRESSION TEST`

Do not declare success after a failed test.
Do not hide partial failure.

## 5. GLOBAL-FIRST — NON-NEGOTIABLE

Everything in this project must be generic and global-first.

The system must support any:
- tradeable commodity
- country
- city
- market
- currency
- origin
- destination
- trade route
- date/time context

Examples such as wheat, rice, Russia, Afghanistan, Kabul, India or Pakistan are test data only.

DO NOT create rules such as:
`if wheat`
`if Afghanistan`
`if Kabul`
`if Russia`

when the intended behavior is generic.

A solution is acceptable only when the underlying logic is reusable worldwide.

## 6. TRADE SEMANTICS MUST STAY SEPARATE

Keep these concepts distinct:
- Commodity
- Category
- Country
- City / Market
- Origin
- Destination
- Comparison Markets
- Trade Route

`City/Market` is local market scope.

`Origin` and `Destination` describe an import/export route only when the user expresses a route.

`Comparison Markets` are independent comparison targets.

Do not convert a city/country mentioned for market analysis into an import destination unless the user explicitly expresses an import/export relationship or a documented generic rule requires it.

## 7. CLEAN CODE

The project must remain:
`SIMPLE → CLEAN → MODULAR → TRACEABLE → TESTABLE → MAINTAINABLE`

Rules:
- Keep files focused.
- Prefer small testable functions.
- Avoid duplicate logic.
- Avoid huge files/functions.
- Avoid unnecessary abstractions.
- Avoid unnecessary dependencies.
- Avoid unnecessary new files.
- Keep business logic separate.
- Reuse stable code where appropriate.
- Do not broad-refactor healthy code for a focused bug.

When a problem occurs, it should be possible to trace:
`PROBLEM → MODULE → FILE → FUNCTION → TEST → FIX`

## 8. MINIMAL CHANGE

Make the smallest correct change that solves the assigned problem.

Do not rebuild the application or replace architecture without evidence.
Do not alter unrelated modules.

## 9. PROJECT MEMORY

Primary control documents:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `REQUIREMENTS.md`
- `TEST_PLAN.md`

Keep them aligned with the real repository.

Existing documents such as `FINAL_HANDOFF.md`, `AUDIT_FIXES_2026-09-08.md`, `DEPLOYMENT.md`, and `SECURITY_AUDIT.md` are supporting/historical records and should not be duplicated unnecessarily.

## 10. GITHUB SOURCE OF TRUTH

GitHub is the source of truth for code and history.

Never claim a commit exists unless it actually exists.

After meaningful work:
- update relevant project state
- keep changes traceable
- create a clear commit when appropriate

## 11. AGENT HANDOFF

Every new Agent must repeat the initial read/check process and verify the real current state.

Never continue solely because an earlier Agent said something is complete.

## 12. MULTI-AGENT FAILOVER

If the active Agent reaches a legitimate:
- quota
- rate limit
- provider outage
- tool failure
- service limitation

the task may be handed to another authorized Agent/Provider.

Before handoff:
1. Save project state.
2. Update `PROJECT_STATUS.md`.
3. Record the reason.
4. Record the last verified state.
5. Record the next action.
6. Hand off.

No fake accounts.
No multiple accounts to bypass limits.
No provider-policy bypass.

## 13. EXHAUSTED AGENT LOCK

When Agent A is exhausted and Agent B takes over:
- A = `EXHAUSTED + LOCKED`
- B = `ACTIVE`

When A later becomes available again, A MUST NOT automatically resume.

There must be no automatic `A → B → A`.

## 14. USER APPROVAL FOR REACTIVATION

A previously exhausted/locked Agent can return only after explicit user approval.

When available again:
`REACTIVATION APPROVAL REQUIRED`

Show the user:
- Agent
- current task
- current phase
- current active Agent
- reason for lock
- availability
- what would be resumed

Only after explicit approval may the Agent resume.

After approval, the returning Agent must repeat normal handoff/current-state verification.

## 15. ACTIVE AGENT

Project state must always identify one `CURRENT ACTIVE AGENT`.

An available or recovered Agent must never silently become active.

## 16. AGENT STATES

`AVAILABLE`
`ACTIVE`
`EXHAUSTED`
`LOCKED`
`BLOCKED`
`FAILED`
`AWAITING_USER_APPROVAL`
`INACTIVE`

## 17. REGRESSION

After an important fix, test the affected dependency chain and previously verified behavior where relevant.

Relevant areas:
Parser, Global Market Scope, Research, Evidence, Source Verification, Normalization, Price, FX, Supply, Demand, Stock, Shipments, Import Cost, Risk, Competition, Forecast, Report, UI, Navigation.

## 18. DEFINITION OF DONE

A task is DONE only when:
1. Required implementation is complete.
2. Relevant tests actually ran.
3. Required tests passed.
4. Relevant regression was checked.
5. Project state was updated.
6. Changes are traceable in Git.

Otherwise: `NOT VERIFIED`.

## 19. RELEASE GATE

If a required test fails:
`NOT READY — VERIFICATION INCOMPLETE`

If a required test was not run:
`NOT VERIFIED`

Only after required release verification genuinely passes:
`PROJECT VERIFIED — READY FOR RELEASE`

## 20. OPERATING PRINCIPLE

Follow:

`READ → UNDERSTAND → CHECK → PLAN → IMPLEMENT → TEST → FIX IF NEEDED → TEST AGAIN → REGRESSION → DOCUMENT`

Do not guess.
Do not hide failure.
Do not claim unexecuted tests.
Do not claim PASS without real PASS.
Do not start unrelated work.
Do not automatically reactivate a locked Agent.
