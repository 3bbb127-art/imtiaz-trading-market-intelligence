/*
# Market Intelligence Officer AI — Core Schema

## Overview
Creates the persistence layer for a single-tenant (no-auth) global market intelligence application.
The browser talks to Supabase with the anon key for its entire lifetime, so every policy lists
`anon, authenticated` and uses `USING (true)` / `WITH CHECK (true)` — the data is intentionally
shared/public within this single-tenant app.

## New Tables
1. `location_profiles` — reusable geographic/market profiles (country, city, currency, sources,
   trade routes, notes). Used to seed the Agent with context for a given market.
2. `market_data` — structured commodity market observations (commodity, country, city, market,
   origin, destination, price, currency, unit, date, source, source type, supply, demand, stock,
   import/export/logistics status, competitor info, notes, data status, confidence). The core
   evidence store the Agent reasons over.
3. `fx_rates` — exchange-rate observations (currency pair, rate, previous rate, change, change %,
   date, source, source type, status, confidence). Feeds the FX Intelligence Engine.
4. `research_memory` — dated snapshots of completed research sessions (command, parsed intent,
   workflow steps, findings JSON, recommendation, language). Preserves history for comparison
   (today vs yesterday, etc.) without overwriting prior observations.
5. `reports` — generated intelligence reports (type, title, scope, period, content JSON/Markdown,
   language, related research id).
6. `alerts` — dashboard alerts (type, severity, title, detail, related commodity/country/city,
   created_at, acknowledged).

## Security
- RLS enabled on every table.
- All CRUD open to `anon, authenticated` because this is a single-tenant app with no sign-in.
  The data is intentionally shared/public.

## Important Notes
1. All tables use `gen_random_uuid()` primary keys with `created_at` defaults.
2. JSON columns store flexible structured payloads (findings, content, parsed intent) so the
   schema can evolve without destructive migrations.
3. Indexes added on the most common filter columns (commodity, country, city, date, report type).
4. No `user_id` columns — no auth in this app.
*/

-- ===========================================================================
-- 1. location_profiles
-- ===========================================================================
CREATE TABLE IF NOT EXISTS location_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL,
  region text,
  city text,
  market text,
  currency text NOT NULL DEFAULT 'USD',
  relevant_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  customs_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  trade_routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE location_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_location_profiles" ON location_profiles;
CREATE POLICY "anon_select_location_profiles" ON location_profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_location_profiles" ON location_profiles;
CREATE POLICY "anon_insert_location_profiles" ON location_profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_location_profiles" ON location_profiles;
CREATE POLICY "anon_update_location_profiles" ON location_profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_location_profiles" ON location_profiles;
CREATE POLICY "anon_delete_location_profiles" ON location_profiles
  FOR DELETE TO anon, authenticated USING (true);

-- ===========================================================================
-- 2. market_data
-- ===========================================================================
CREATE TABLE IF NOT EXISTS market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text NOT NULL,
  commodity_category text,
  country text NOT NULL,
  city text,
  market text,
  origin text,
  destination text,
  price numeric,
  currency text,
  unit text,
  observation_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  source_type text,
  supply text,
  demand text,
  stock text,
  import_status text,
  export_status text,
  logistics_status text,
  competitor_info text,
  notes text,
  data_status text NOT NULL DEFAULT 'REPORTED',
  confidence text NOT NULL DEFAULT 'MEDIUM',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_market_data" ON market_data;
CREATE POLICY "anon_select_market_data" ON market_data
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_market_data" ON market_data;
CREATE POLICY "anon_insert_market_data" ON market_data
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_market_data" ON market_data;
CREATE POLICY "anon_update_market_data" ON market_data
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_market_data" ON market_data;
CREATE POLICY "anon_delete_market_data" ON market_data
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_market_data_commodity ON market_data (commodity);
CREATE INDEX IF NOT EXISTS idx_market_data_country ON market_data (country);
CREATE INDEX IF NOT EXISTS idx_market_data_city ON market_data (city);
CREATE INDEX IF NOT EXISTS idx_market_data_date ON market_data (observation_date);

-- ===========================================================================
-- 3. fx_rates
-- ===========================================================================
CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  previous_rate numeric,
  change numeric,
  change_pct numeric,
  observation_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  source_type text,
  data_status text NOT NULL DEFAULT 'REPORTED',
  confidence text NOT NULL DEFAULT 'MEDIUM',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fx_rates" ON fx_rates;
CREATE POLICY "anon_select_fx_rates" ON fx_rates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fx_rates" ON fx_rates;
CREATE POLICY "anon_insert_fx_rates" ON fx_rates
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fx_rates" ON fx_rates;
CREATE POLICY "anon_update_fx_rates" ON fx_rates
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fx_rates" ON fx_rates;
CREATE POLICY "anon_delete_fx_rates" ON fx_rates
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fx_rates_pair ON fx_rates (base_currency, quote_currency);
CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON fx_rates (observation_date);

-- ===========================================================================
-- 4. research_memory
-- ===========================================================================
CREATE TABLE IF NOT EXISTS research_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL,
  parsed_intent jsonb NOT NULL DEFAULT '{}'::jsonb,
  workflow_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation text,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_research_memory" ON research_memory;
CREATE POLICY "anon_select_research_memory" ON research_memory
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_research_memory" ON research_memory;
CREATE POLICY "anon_insert_research_memory" ON research_memory
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_research_memory" ON research_memory;
CREATE POLICY "anon_update_research_memory" ON research_memory
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_research_memory" ON research_memory;
CREATE POLICY "anon_delete_research_memory" ON research_memory
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_research_memory_command ON research_memory (command);
CREATE INDEX IF NOT EXISTS idx_research_memory_created ON research_memory (created_at);

-- ===========================================================================
-- 5. reports
-- ===========================================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  title text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start date,
  period_end date,
  content_markdown text NOT NULL DEFAULT '',
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'en',
  research_id uuid REFERENCES research_memory(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reports_type ON reports (report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports (created_at);

-- ===========================================================================
-- 6. alerts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'MEDIUM',
  title text NOT NULL,
  detail text,
  commodity text,
  country text,
  city text,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alerts" ON alerts;
CREATE POLICY "anon_select_alerts" ON alerts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
CREATE POLICY "anon_insert_alerts" ON alerts
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
CREATE POLICY "anon_update_alerts" ON alerts
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;
CREATE POLICY "anon_delete_alerts" ON alerts
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts (acknowledged);
