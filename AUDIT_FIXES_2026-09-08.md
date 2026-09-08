# Imtiaz Trading Market Intelligence — Audit Fixes

Base: security-fixed archive. The original reference archive is not modified.

## Fixed
- Removed the stale `/vite.svg` reference and default Vite title from `index.html`.
- Corrected import-cost purchase total: purchase price is per unit, so it is multiplied by quantity before landed-cost totals and margin are calculated.
- Added optional `trader_company` provenance to market field observations.
- Added shipment `source` provenance and UI capture/display.
- Expanded the dashboard to surface the latest Agent supply/demand, sentiment/risk, stock/incoming shipments, recommendation and forecast direction.
- Corrected Dashboard market counting to count market/city/country locations rather than only countries.
- Added a production-build guard that fails a deployment if an unresolved standalone `ts;` statement appears before the next variable declaration in a generated JS bundle.
- Hardened shared provider response types so runtime statuses are constrained to OK/ERROR/NO_PROVIDER and research evidence can carry status/confidence/freshness metadata.
- Added backward-compatible Supabase migration `20260908000000_006_field_and_shipment_source.sql`.

## Verification
- Source audit: no standalone `ts;` exists in source files.
- Source audit: no `/vite.svg` reference remains.
- Merge-marker scan: clean.
- Full TypeScript/Vite build could not be completed in this environment because the local dependency tree was incomplete and network access to fetch missing npm packages was unavailable.

## Important
The production white-screen error was caused by the deployed bundle containing an unresolved `ts;` statement. The new build guard prevents such a bundle from being published through the normal `npm run build` path.
