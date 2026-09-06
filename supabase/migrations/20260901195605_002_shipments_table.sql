/*
# Shipment / Wagon Intelligence Table

## Overview
Creates the persistence layer for tracking individual shipments/wagons that
Imtiaz Trading is monitoring — origin, commodity, quantity, dates, status, and
notes. This enables incoming-volume, expected-arrival, recent-arrival, and
delayed-shipment summaries without inventing data.

## New Table
- `shipments` — one row per shipment/wagon:
  - `shipment_id` (text, user-entered label like "WGN-001")
  - `origin` (text, departure country/location)
  - `destination` (text, arrival city/country)
  - `commodity` (text)
  - `quantity` (numeric, amount)
  - `unit` (text, kg/ton/mt/bag/litre/lb)
  - `departure_date` (date)
  - `expected_arrival` (date, user-estimated ETA)
  - `actual_arrival` (date, nullable — set when shipment arrives)
  - `status` (text: In Transit / Arrived / Delayed / Cancelled / Planned)
  - `notes` (text, optional source/notes)
  - `created_at` (timestamptz, auto)

## Security
- RLS enabled on `shipments`.
- All CRUD open to `anon, authenticated` — single-tenant app, no sign-in,
  data is intentionally shared/public.

## Important Notes
1. No user_id columns — no auth in this app.
2. Indexes on status, expected_arrival, commodity for fast summary queries.
3. Idempotent — safe to re-run.
*/

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  commodity text NOT NULL,
  quantity numeric,
  unit text,
  departure_date date,
  expected_arrival date,
  actual_arrival date,
  status text NOT NULL DEFAULT 'Planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_shipments" ON shipments;
CREATE POLICY "anon_select_shipments" ON shipments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_shipments" ON shipments;
CREATE POLICY "anon_insert_shipments" ON shipments
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_shipments" ON shipments;
CREATE POLICY "anon_update_shipments" ON shipments
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_shipments" ON shipments;
CREATE POLICY "anon_delete_shipments" ON shipments
  FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status);
CREATE INDEX IF NOT EXISTS idx_shipments_expected_arrival ON shipments (expected_arrival);
CREATE INDEX IF NOT EXISTS idx_shipments_commodity ON shipments (commodity);
CREATE INDEX IF NOT EXISTS idx_shipments_departure ON shipments (departure_date);
