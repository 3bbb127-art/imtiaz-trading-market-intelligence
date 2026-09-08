# Imtiaz Trading Market Intelligence Agent — Supabase Production Connection

## Production Supabase
- Project URL: `https://iiuiyyszbkgjxwlbxlxb.supabase.co`
- Edge Function: `market-intel`
- Function endpoint: `https://iiuiyyszbkgjxwlbxlxb.supabase.co/functions/v1/market-intel`

## Frontend environment
The project `.env` is configured for the production Supabase project.

Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The current Supabase publishable key is used by the frontend in `VITE_SUPABASE_ANON_KEY` because the existing application expects that variable name. No service-role secret is included.

## Provider flow
- FX: browser → `market-intel/fx` → `open.er-api.com`
- Research: browser → `market-intel/research` → Tavily
- Supabase data: browser → Supabase tables via `@supabase/supabase-js`

## Verified manually in Supabase Dashboard
- `GET /market-intel/health` → `ok: true`
- `POST /market-intel` with `{ "base": "USD", "targets": ["AFN", "EUR"] }` → `status: "OK"`
- `POST /market-intel` with `{ "query": "Afghanistan food commodity prices" }` → `source: "tavily"`, `status: "OK"`

## Important
Do not replace the Supabase URL with the previous project URL. The frontend and Edge Function must point to the same production Supabase project.
