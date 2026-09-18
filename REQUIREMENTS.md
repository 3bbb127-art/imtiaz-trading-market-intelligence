# REQUIREMENTS — GLOBAL MARKET INTELLIGENCE OFFICER AI

## Product Goal
Autonomous commodity market intelligence — global to local.

Core principle:
`DATA → EVIDENCE → INTELLIGENCE → DECISION`

## Global-First
All logic must support any:
- country
- commodity
- origin
- destination
- city
- market
- currency
- trade route

Afghanistan, India, Pakistan, Kabul, Herat, etc. are test examples only and must not create country-specific hard-coded logic.

## Intended Intelligence Flow
`USER QUERY`
→ `COMMAND PARSER`
→ `GLOBAL MARKET SCOPE`
→ `RESEARCH`
→ `EVIDENCE`
→ `SOURCE VERIFICATION`
→ `NORMALIZATION`
→ `PRICE + FX`
→ `SUPPLY + DEMAND`
→ `STOCK + SHIPMENTS`
→ `RISK + COMPETITION`
→ `FORECAST`
→ `REPORT`

## Main Functional Areas
- Dashboard
- Ask Agent
- Market Data
- Import Cost
- Shipments
- Stock
- Research
- Report
- Locations
- New Commodity Evaluation

## Parser / Scope
When present, the system should identify:
- commodity
- category
- origin
- destination
- country
- city
- market
- comparison targets
- trade route
- relevant date/time references

Do not invent a destination or geography that the user did not specify.

## Intelligence
Research and downstream analysis must use the correct parsed scope.
Missing data must be shown honestly rather than fabricated.

## Data Areas
Support, where applicable:
- Price
- FX
- Supply
- Demand
- Market Sentiment
- Buying/Selling Behavior
- Stock
- Shipments
- Arrivals/Logistics
- Risk/Problems
- Competition
- Forecast
- Recommendations
- Reports

## Import Cost
Use configurable inputs. Do not invent tariff/customs rates. Distinguish user-entered assumptions from observed data.

## Code Quality
Keep the application clean, modular, understandable, easy to test, easy to debug, and easy for another Agent to continue.

Prefer small focused changes over broad rewrites.

## State and Handoff
Project state is maintained in `PROJECT_STATUS.md`. Every Agent must verify the repository before continuing.

## Verification
No feature is verified without actual execution. See `TEST_PLAN.md`.

## Out of Scope Unless Explicitly Approved
- A separate autonomous Builder for unrelated new apps
- Unrelated UI redesign
- Unnecessary architecture replacement
- Provider-policy bypasses
- Fake or multiple accounts to bypass limits
