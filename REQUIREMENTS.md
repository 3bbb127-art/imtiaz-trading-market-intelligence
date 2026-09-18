# REQUIREMENTS
# Global Commodity & International Trade Market Intelligence AI

## 1. Product Definition

The system is a GLOBAL COMMODITY AND INTERNATIONAL TRADE MARKET INTELLIGENCE PLATFORM.

It must understand and analyze any legitimate tradeable commodity and market context worldwide.

It is NOT limited to:
- food
- Afghanistan
- one company
- one country
- one commodity class

Examples are test data only.

## 2. Global Scope

Support generically:
- Any tradeable commodity
- Any commodity category
- Any country
- Any city
- Any local market
- Any currency
- Any origin
- Any destination
- Any international trade route
- Any date/time context

Examples may include agriculture, energy, metals, chemicals, food, industrial goods, raw materials, machinery, and other tradeable goods.

The implementation must not require a separate code path for each commodity or country.

## 3. Core Intelligence Flow

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
→ `DATA → EVIDENCE → INTELLIGENCE → DECISION`

## 4. Core Market Scope

Identify, when present:
- Commodity
- Category
- Country
- City / Market
- Origin
- Destination
- Comparison Markets
- Trade Route
- Date/time references

## 5. Semantic Rules

### City / Market
Represents local market scope.

Example:
`rice prices in Mumbai`
→ Commodity = Rice
→ City/Market = Mumbai

### Origin / Destination
Represent an import/export route.

Example:
`wheat from Russia to Iran`
→ Origin = Russia
→ Destination = Iran

### Comparison Markets
Represent independent comparison targets.

Example:
`compare rice prices in India and Pakistan`
→ Comparison Markets = India, Pakistan
→ Origin = null
→ Destination = null

### Important
Do not turn a market-analysis country into a trade destination.

Do not invent a route.

Do not inherit a destination from an unrelated previous command.

## 6. Geographic Resolution

Geographic resolution must be generic.

If a city/market can be resolved to a country using a reliable generic geographic mechanism, store that relationship separately where useful.

However:

`Country of City/Market ≠ Import Destination`

unless the user actually expresses an import/export relationship.

Never hard-code a city-country pair solely to make a test pass.

## 7. Parser Requirements

Support generic labeled/key-value input such as:

`Commodity: Rice`
`Origin: India`
`Destination: Afghanistan`
`Target City/Market: Mazar-e-Sharif`
`City: Mazar-e-Sharif`
`Market: Mazar Market`

Also support ordinary natural-language commands.

The parser must preserve semantic boundaries between local market, country, origin, destination and comparison markets.

## 8. Commodity-Agnostic Intelligence

All analysis engines must work on arbitrary tradeable commodities.

Do not create commodity-specific branches unless the rule is genuinely universal and documented.

## 9. Import / Export Intelligence

Where sufficient information exists, support:
- route
- price
- FX
- freight
- insurance
- customs/tariffs
- duties/taxes
- transport
- clearance/handling
- landed cost

Never invent customs/tariff values.

## 10. Data Integrity

Do not fabricate:
- prices
- shipment records
- stock
- demand
- supply
- market observations
- source evidence

Unknown or missing values must remain clearly unknown.

## 11. Code Quality

Keep the application:
`SIMPLE → CLEAN → MODULAR → TRACEABLE → TESTABLE → MAINTAINABLE`

Prefer small focused changes over broad rewrites.

## 12. Agent Continuity

Every Agent must use:
- `AGENTS.md`
- `PROJECT_STATUS.md`
- `REQUIREMENTS.md`
- `TEST_PLAN.md`

as the core project control documents.

## 13. Out of Scope Unless Explicitly Approved

- Building a separate autonomous app-builder product
- Unrelated UI redesign
- Unnecessary architecture replacement
- Provider-limit bypassing
- Fake or multiple accounts for bypassing limits

## 14. Definition of Success

The real system can take global commodity/trade questions, correctly identify scope, gather evidence, analyze it, and produce a traceable intelligence result without country- or commodity-specific hacks.
