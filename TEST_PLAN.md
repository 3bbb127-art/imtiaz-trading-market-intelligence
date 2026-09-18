# TEST PLAN

## Verification Principle
Real execution only.

`NOT VERIFIED` = not actually tested.
`FAILED` = test executed and failed.
`PROJECT VERIFIED — READY FOR RELEASE` = only after all required release checks actually pass.

## Standard Checks
When supported:
- Type check
- Lint
- Production build

## Automated Tests
When present/applicable:
- Unit tests
- Integration tests
- E2E tests
- Regression tests

## UI Verification
For affected pages/features:
- page opens
- navigation works
- buttons work
- forms work
- validation works
- loading states
- error states
- empty states
- relevant responsive behavior

## Backend Verification
When applicable:
- API request/response
- database read/write
- authentication/authorization
- permissions/security
- error handling
- external integrations

## Current Critical Path
`Ask Agent`
→ parse user query
→ generate Global Market Scope
→ research
→ collect stored observations
→ collect FX when needed
→ verify/normalize
→ analyze
→ report
→ save
→ deliver

## Parser / Scope Test Cases

### 1. Commodity + City
`wheat in Chicago`

Expected:
Commodity = wheat
City/Market = Chicago
No invented destination.

### 2. Route
`wheat Russia to Iran`

Expected:
Commodity = wheat
Origin = Russia
Destination = Iran

### 3. Route + City
`sunflower oil Russia to Afghanistan in Kabul`

Expected:
Commodity = sunflower oil
Origin = Russia
Destination = Afghanistan
City/Market = Kabul

### 4. Country Comparison
`compare rice prices in India and Pakistan`

Expected:
Commodity = rice
Comparison targets = India, Pakistan
Destination = unknown unless explicitly stated

### 5. Global Comparison
`compare wheat prices in Russia and Kazakhstan`

Expected:
Commodity = wheat
Comparison targets = Russia, Kazakhstan
Destination = unknown unless explicitly stated

### 6. No Geography
`wheat price trend`

Expected:
Commodity = wheat
Geography can be unknown
No invented country/city.

### 7. Local Market
`rice prices in Mumbai`

Expected:
Commodity = rice
City/Market = Mumbai
Country may be inferred only if the existing parser has a reliable generic geographic resolution rule.

## Release / Regression Gate
If a required check fails:
`NOT READY — VERIFICATION INCOMPLETE`

Then:
`DIAGNOSE → FIX → TEST AGAIN → REGRESSION`

Do not declare PASS from screenshots, code inspection, or previous Agent claims alone.

## Evidence
For each significant verification record:
- test/command
- actual result
- relevant output/evidence
- status
- date/commit

## Platform Tests
Android/iOS are not mandatory for the current web application unless a mobile target is explicitly introduced.

## Final Release
Before release, run the required end-to-end and deployment verification for the actual application.
