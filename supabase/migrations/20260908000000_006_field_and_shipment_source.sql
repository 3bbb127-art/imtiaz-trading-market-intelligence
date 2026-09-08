-- Backwards-compatible additions for field provenance and shipment source.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_data' AND column_name = 'trader_company') THEN
    ALTER TABLE market_data ADD COLUMN trader_company text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'source') THEN
    ALTER TABLE shipments ADD COLUMN source text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_market_data_trader_company ON market_data (trader_company);
CREATE INDEX IF NOT EXISTS idx_shipments_source ON shipments (source);
