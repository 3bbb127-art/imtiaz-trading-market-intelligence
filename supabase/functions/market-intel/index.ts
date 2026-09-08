// Market Intelligence edge function.
// Proxies free FX APIs and optional AI/research providers so the browser never
// holds API keys. Designed to degrade gracefully: if an optional provider is
// unavailable, we return what we have plus a clear error envelope.
//
// Routes (all POST unless noted):
//   GET  /functions/v1/market-intel/health   -> { ok: true }
//   POST /functions/v1/market-intel/fx        -> { rates: [...], source, status }
//   POST /functions/v1/market-intel/research  -> { query, results, source, status }
//
// FX uses the free open.er-api.com (no key required).
// Research uses Tavily (server-side key) when TAVILY_API_KEY is set, otherwise
// returns a structured "no provider" envelope so the client can show a clear
// state instead of fabricating data.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Vary": "Origin",
};

interface FxRequest {
  base: string;
  targets?: string[];
}

interface FxRateResult {
  base_currency: string;
  quote_currency: string;
  rate: number;
  previous_rate: number | null;
  change: number | null;
  change_pct: number | null;
  source: string;
  source_type: string;
  data_status: string;
  confidence: string;
  observation_date: string;
}

interface ResearchRequest {
  query: string;
  max_results?: number;
}

interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  source_type: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error: message, ...extra }, status);
}

async function handleFx(req: Request): Promise<Response> {
  let body: FxRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!body.base || typeof body.base !== "string") {
    return errorResponse("Missing 'base' currency", 400);
  }
  const base = body.base.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) {
    return errorResponse("Invalid base currency", 400);
  }

  const rawTargets = body.targets ?? [];
  if (!Array.isArray(rawTargets)) {
    return errorResponse("'targets' must be an array", 400);
  }
  const targets = rawTargets
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z]{3}$/.test(t))
    .slice(0, 20);

  const url = `https://open.er-api.com/v6/latest/${base}`;
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    return errorResponse(`FX provider unreachable: ${(err as Error).message}`, 502, {
      provider: "open.er-api.com",
    });
  }
  if (!resp.ok) {
    return errorResponse(`FX provider returned ${resp.status}`, 502, {
      provider: "open.er-api.com",
    });
  }
  const data = await resp.json();
  if (!data || !data.rates) {
    return errorResponse("FX provider returned no rates", 502, { provider: "open.er-api.com" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const rates: FxRateResult[] = [];
  const pairs = targets.length > 0 ? targets : Object.keys(data.rates);
  for (const quote of pairs) {
    const rate = data.rates[quote];
    if (typeof rate !== "number") continue;
    rates.push({
      base_currency: base,
      quote_currency: quote,
      rate,
      previous_rate: null,
      change: null,
      change_pct: null,
      source: "open.er-api.com",
      source_type: "fx-aggregator",
      data_status: "VERIFIED",
      confidence: "HIGH",
      observation_date: today,
    });
  }

  return jsonResponse({
    rates,
    source: "open.er-api.com",
    source_type: "fx-aggregator",
    status: "OK",
    base,
    updated: data.time_last_update_utc ?? null,
  });
}

async function handleResearch(req: Request): Promise<Response> {
  let body: ResearchRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!body.query || typeof body.query !== "string") {
    return errorResponse("Missing 'query'", 400);
  }

  const query = body.query.trim();
  if (query.length < 2) {
    return errorResponse("Query is too short", 400);
  }
  if (query.length > 1000) {
    return errorResponse("Query is too long", 400);
  }

  const requestedMaxResults = Number(body.max_results ?? 8);
  const maxResults = Number.isFinite(requestedMaxResults)
    ? Math.min(Math.max(Math.floor(requestedMaxResults), 1), 10)
    : 8;

  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  if (!tavilyKey) {
    // No provider configured — return a clear envelope, never fabricate.
    return jsonResponse({
      query,
      results: [],
      source: "none",
      status: "NO_PROVIDER",
      message:
        "No web research provider is configured. Set TAVILY_API_KEY to enable live web research. The agent will continue with locally stored data and clearly label any gaps.",
    }, 200);
  }

  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: maxResults,
        search_depth: "advanced",
      }),
    });
    if (!resp.ok) {
      return errorResponse(`Research provider returned ${resp.status}`, 502, {
        provider: "tavily",
      });
    }
    const data = await resp.json();
    const results: ResearchResult[] = (data.results ?? []).map((r: Record<string, unknown>) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      snippet: String(r.content ?? ""),
      source_type: "web",
    }));
    return jsonResponse({
      query,
      results,
      source: "tavily",
      status: "OK",
    });
  } catch {
    return errorResponse("Research provider error", 502, {
      provider: "tavily",
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  // The Supabase runtime may deliver the path with or without the
  // /functions/v1/ prefix. Strip either form so we're left with the
  // sub-route (e.g. "fx", "research", "health", or "").
  const path = url.pathname
    .replace(/^\/functions\/v1\/market-intel\/?/i, "")
    .replace(/^\/market-intel\/?/i, "")
    .toLowerCase();

  try {
    if (path === "" || path === "health") {
      return jsonResponse({ ok: true, service: "market-intel" });
    }
    if (path === "fx") {
      if (req.method !== "POST") return errorResponse("Use POST", 405);
      return await handleFx(req);
    }
    if (path === "research") {
      if (req.method !== "POST") return errorResponse("Use POST", 405);
      return await handleResearch(req);
    }
    return errorResponse("Unknown route: " + path, 404);
  } catch {
    return errorResponse("Unexpected server error", 500);
  }
});
