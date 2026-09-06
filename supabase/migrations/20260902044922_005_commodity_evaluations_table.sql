/*
# Commodity Evaluations Table

## Overview
Stores structured New Commodity Evaluations produced by the evaluation engine.
Each row captures the full evaluation result for a commodity/origin/destination
combination, including opportunity score, assessments, recommendation, and
data gaps.

## New Table
- `commodity_evaluations`:
  - commodity (text, not null)
  - origin (text, nullable)
  - destination (text, nullable)
  - city (text, nullable)
  - opportunity_score (int, 0-100)
  - demand_assessment (text)
  - supply_assessment (text)
  - competition_assessment (text)
  - price_attractiveness (text)
  - logistics_feasibility (text)
  - market_sentiment (text)
  - risk_assessment (text)
  - confidence_level (text: HIGH/MEDIUM/LOW)
  - recommendation (text: GO/NO-GO/NEED MORE DATA/HOLD/MONITOR)
  - key_reasons (text[], array of reason strings)
  - data_gaps (text[], array of gap strings)
  - notes (text, nullable)
  - created_at (timestamptz, auto)

## Security
- RLS enabled, all CRUD open to anon, authenticated (single-tenant, no-auth app).

## Important Notes
1. Idempotent — safe to re-run.
2. Indexes on commodity, recommendation, created_at.
*/

CREATE TABLE IF NOT EXISTS commodity_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text NOT NULL,
  origin text,
  destination text,
  city text,
  opportunity_score integer NOT NULL DEFAULT 0,
  demand_assessment text NOT NULL DEFAULT '',
  supply_assessment text NOT NULL DEFAULT '',
  competition_assessment text NOT NULL DEFAULT '',
  price_attractiveness text NOT NULL DEFAULT '',
  logistics_feasibility text NOT NULL DEFAULT '',
  market_sentiment text NOT NULL DEFAULT '',
  risk_assessment text NOT NULL DEFAULT '',
  confidence_level text NOT NULL DEFAULT 'LOW',
  recommendation text NOT NULL DEFAULT 'NEED MORE DATA',
  key_reasons text[] NOT NULL DEFAULT '{}',
  data_gaps text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commodity_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_commodity_evaluations" ON commodity_evaluations;
CREATE POLICY "anon_select_commodity_evaluations" ON commodity_evaluations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_commodity_evaluations" ON commodity_evaluations;
CREATE POLICY "anon_insert_commodity_evaluations" ON commodity_evaluations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_commodity_evaluations" ON commodity_evaluations;
CREATE POLICY "anon_delete_commodity_evaluations" ON commodity_evaluations
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_commodity_evaluations_commodity ON commodity_evaluations (commodity);
CREATE INDEX IF NOT EXISTS idx_commodity_evaluations_recommendation ON commodity_evaluations (recommendation);
CREATE INDEX IF NOT EXISTS idx_commodity_evaluations_created ON commodity_evaluations (created_at DESC);
