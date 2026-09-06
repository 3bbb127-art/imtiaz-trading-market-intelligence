/*
# Stock / In-Transit Intelligence Table

## Overview
Creates the persistence layer for tracking warehouse stock levels per commodity
for Imtiaz Trading — available stock, reserved stock, in-transit stock, expected
incoming, with update date, source, and notes. Enables summary cards for current
available, reserved, in-transit, expected incoming, total stock + incoming, and
shortage/excess indication.

## New Table
- `stock_records` — one row per commodity per warehouse/location:
  - `commodity` (text, not null)
  - `warehouse` (text, warehouse/location name)
  - `available_stock` (numeric, currently available quantity)
  - `reserved_stock` (numeric, allocated/reserved quantity)
  - `in_transit_stock` (numeric, stock currently in transit)
  - `expected_incoming` (numeric, expected to arrive)
  - `unit` (text, kg/ton/mt/bag/litre/lb)
  - `update_date` (date, when this record was last updated)
  - `source` (text, where the data came from)
  - `notes` (text, optional)
  - `created_at` (timestamptz, auto)

## Security
- RLS enabled on `stock_records`.
- All CRUD open to `anon, authenticated` — single-tenant app, no sign-in,
  data is intentionally shared/public.

## Important Notes
1. No user_id columns — no auth in this app.
2. Indexes on commodity, warehouse, update_date for fast queries.
3. Idempotent — safe to re-run.
*/

CREATE TABLE IF NOT EXISTS stock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text NOT NULL,
  warehouse text,
  available_stock numeric,
  reserved_stock numeric,
  in_transit_stock numeric,
  expected_incoming numeric,
  unit text,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stock_records" ON stock_records;
CREATE POLICY "anon_select_stock_records" ON stock_records
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_stock_records" ON stock_records;
CREATE POLICY "anon_insert_stock_records" ON stock_records
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_stock_records" ON stock_records;
CREATE POLICY "anon_update_stock_records" ON stock_records
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_stock_records" ON stock_records;
CREATE POLICY "anon_delete_stock_records" ON stock_records
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_stock_records_commodity ON stock_records (commodity);
CREATE INDEX IF NOT EXISTS idx_stock_records_warehouse ON stock_records (warehouse);
CREATE INDEX IF NOT EXISTS idx_stock_records_update_date ON stock_records (update_date);
