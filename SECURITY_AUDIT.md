# Security Audit — Imtiaz Trading Market Intelligence Agent

Audit date: 2026-09-07

## Findings

### 🔴 Critical — Public database write/delete access
All application tables currently grant `anon` and `authenticated` unrestricted SELECT/INSERT/UPDATE/DELETE via `USING (true)` / `WITH CHECK (true)`. This means anyone who obtains the public Supabase endpoint and browser key can read, modify, insert, or delete application data.

**Status:** Not automatically changed because adding authentication or ownership policies would change the application's current no-auth architecture and could block existing workflows. This requires an explicit product/security decision.

### 🔴 High — Edge Function JWT verification disabled
`supabase/config.toml` contains `verify_jwt = false`. The function therefore accepts unauthenticated calls. This is particularly important because `/research` can spend the server-side Tavily quota.

**Status:** Not automatically changed because enabling JWT verification may be incompatible with the current publishable-key/no-auth browser architecture and needs a controlled authentication design.

### 🟠 High — CORS wildcard on Edge Function
The function allows requests from every origin (`*`).

**Status:** Kept compatible with the current no-auth public browser architecture. Methods were narrowed to the actual GET/POST/OPTIONS routes.

### 🟠 High — Production Supabase configuration can crash the SPA
The original client passed empty strings to `createClient()` when environment variables were missing, causing the reported `Invalid supabaseUrl` startup crash.

**Status:** Fixed safely. The app now remains bootable and reports a configuration error instead of crashing. It supports `VITE_SUPABASE_PUBLISHABLE_KEY` while retaining the legacy `VITE_SUPABASE_ANON_KEY` fallback.

### 🟠 Medium — Unbounded/loosely validated Edge Function input
FX targets and research query size were not bounded sufficiently.

**Status:** Fixed safely. Currency inputs are validated, FX targets are capped at 20, research queries are limited to 1,000 characters, and result count is clamped to 1–10.

### 🟡 Medium — Provider error details could be returned to clients
Unexpected provider/server exception messages were exposed in JSON responses.

**Status:** Fixed safely for research/provider failures by returning generic server-side error messages while retaining a provider identifier.

### 🟡 Medium — No abuse/rate limiting
The current Edge Function has no application-level rate limiting. With JWT verification disabled and wildcard CORS, an attacker could repeatedly invoke research.

**Status:** Not changed automatically because reliable distributed rate limiting requires an explicit design (and usually a durable counter/service).

## Secrets review
No service-role key, Tavily key, or obvious provider secret was found in the repository source/configuration scanned during this audit. `TAVILY_API_KEY` is read only from the Edge Function environment.

## Client key model
`VITE_*` variables are bundled into the browser. Only Supabase's publishable/anon key should be placed there. A Supabase service-role key or Tavily key must never use a `VITE_*` variable.

## Safe changes made
- Hardened Supabase client initialization against missing/invalid production configuration.
- Added publishable-key environment variable support with backwards compatibility.
- Hardened Edge Function request validation.
- Reduced allowed HTTP methods to the routes actually implemented.
- Avoided returning raw unexpected exception messages from the Edge Function.

## Deliberately not changed
- RLS policies / no-auth data model.
- `verify_jwt = false`.
- Wildcard CORS origin.
- Database schema or existing data.
- Agent business logic.
- Provider selection logic.
- Any secret values.
