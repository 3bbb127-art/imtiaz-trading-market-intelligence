# TEST PLAN
# Global Commodity & International Trade Market Intelligence AI

## 1. Verification Principle

Testing must be real.

`NOT VERIFIED` = not actually tested.
`FAILED` = test executed and failed.
`NOT READY — VERIFICATION INCOMPLETE` = required verification incomplete.
`PROJECT VERIFIED — READY FOR RELEASE` = only after all required release checks genuinely pass.

## 2. Standard Checks

When supported:
- Type check
- Lint
- Production build

## 3. Automated Tests

When present/applicable:
- Unit tests
- Integration tests
- E2E tests
- Regression tests

## 4. Current Parser / Market Scope Tests

### Test 1 — Commodity + City
Input:
`wheat in Chicago`

Expected:
- Commodity = wheat
- City/Market = Chicago
- Origin = null
- Destination = null

If a reliable generic geographic mechanism separately resolves:
Chicago → United States
that is a country relationship, NOT an import destination.

### Test 2 — Import Route
Input:
`wheat Russia to Iran`

Expected:
- Commodity = wheat
- Origin = Russia
- Destination = Iran

### Test 3 — Route + City
Input:
`sunflower oil Russia to Afghanistan in Kabul`

Expected:
- Commodity = sunflower oil
- Origin = Russia
- Destination = Afghanistan
- City/Market = Kabul

### Test 4 — Country Comparison
Input:
`compare rice prices in India and Pakistan`

Expected:
- Commodity = rice
- Comparison Markets = India, Pakistan
- Origin = null
- Destination = null

### Test 5 — Global Comparison
Input:
`compare wheat prices in Russia and Kazakhstan`

Expected:
- Commodity = wheat
- Comparison Markets = Russia, Kazakhstan
- Origin = null
- Destination = null

### Test 6 — Commodity Only
Input:
`wheat price trend`

Expected:
- Commodity = wheat
- Origin = null
- Destination = null
- City/Market = null
- Comparison Markets = null/empty

### Test 7 — City / Market
Input:
`rice prices in Mumbai`

Expected:
- Commodity = rice
- City/Market = Mumbai
- Origin = null
- Destination = null

A generic geographic resolver may separately identify Mumbai's country, but that country must not become an import destination.

### Test 8 — Labeled Key-Value Input
Input:
`Commodity: Rice
Origin: India
Destination: Afghanistan
Target City/Market: Mazar-e-Sharif`

Expected:
- Commodity = Rice
- Origin = India
- Destination = Afghanistan
- City/Market = Mazar-e-Sharif

## 5. Additional Global Tests

Also test outside the main examples:

`corn Brazil to Egypt`
`copper Chile to China`
`crude oil Saudi Arabia to India`
`fertilizer prices in Brazil`
`compare steel prices in Germany and Turkey`

These are examples only. The implementation must remain generic.

## 6. Parser Verification

After parser changes:
1. Inspect the actual test file path in the repository.
2. Run the actual parser test command for that file.
3. Run `npm run typecheck`.
4. Run additional relevant tests if available.

Do not assume a historical test path.

## 7. Test Evidence

For every significant verification record:
- test/command
- actual result
- relevant output/evidence
- status
- date/commit

`read_file` or code inspection is NOT a substitute for executing a test.

## 8. Failure Process

If a required test fails:

`FAIL → DIAGNOSE → FIX → TEST AGAIN → REGRESSION`

Do not claim PASS after an unverified or failed run.

## 9. UI Verification

For affected features, verify where applicable:
- page opens
- navigation
- buttons
- forms
- validation
- loading state
- error state
- empty state

## 10. Backend Verification

Where applicable:
- API
- database read/write
- authentication/authorization
- permissions/security
- external integrations

## 11. Regression

After parser/scope fixes, verify the affected chain:

`Ask Agent`
→ `Parser`
→ `Global Market Scope`
→ `Research`
→ `Evidence`
→ `Normalization`
→ `Analysis`
→ `Report`

Do not break unrelated existing functionality.

## 12. Final Release Gate

If required verification is missing:
`NOT VERIFIED`

If required verification fails:
`NOT READY — VERIFICATION INCOMPLETE`

Only after all required checks pass:
`PROJECT VERIFIED — READY FOR RELEASE`

Android/iOS builds are not mandatory for the current web application unless a mobile target is explicitly introduced.
