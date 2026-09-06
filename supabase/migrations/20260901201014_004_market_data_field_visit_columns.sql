/*
# Field Market Data Collection — Additional Columns

## Overview
Adds missing columns to the existing `market_data` table so it can serve as
a complete field-visit record for Imtiaz Trading. The table already covers
commodity, market/location, price, supply, demand, stock, competitor_info,
source, notes, etc. This migration adds only what's not already present:
buying/selling behavior, new arrivals, market sentiment, risks/problems,
and collector (who recorded the observation).

## Modified Table
- `market_data` — new nullable text columns (all optional, backwards-compatible):
  - `buying_selling_behavior` (text) — observed buyer/seller dynamics
  - `new_arrivals` (text) — newly arrived goods/shipments at the market
  - `market_sentiment` (text) — overall sentiment (Positive/Neutral/Cautious/Negative/Uncertain)
  - `risks_problems` (text) — observed risks or problems
  - `collector` (text) — name of the person who collected the observation

## Security
- No policy changes — existing RLS policies already cover all CRUD on
  `market_data` for `anon, authenticated`.

## Important Notes
1. All new columns are nullable — existing rows are unaffected.
2. No destructive operations — purely additive.
3. Idempotent — uses DO $$ ... IF NOT EXISTS ... END $$ guards.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_data' AND column_name = 'buying_selling_behavior') THEN
    ALTER TABLE market_data ADD COLUMN buying_selling_behavior text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_data' AND column_name = 'new_arrivals') THEN
    ALTER TABLE market_data ADD COLUMN new_arrivals text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_data' AND column_name = 'market_sentiment') THEN
    ALTER TABLE market_data ADD COLUMN market_sentiment text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_data' AND column_name = 'risks_problems') THEN
    ALTER TABLE market_data ADD COLUMN risks_problems text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'market_data' AND column_name = 'collector') THEN
    ALTER TABLE market_data ADD COLUMN collector text;
  END IF;
END $$;
