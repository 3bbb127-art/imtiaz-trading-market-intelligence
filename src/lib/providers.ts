// Provider abstraction. Each provider has a clear interface and degrades
// gracefully — a failure returns a clear envelope, never fabricated data.
// The browser talks to the edge function (server-side) for FX and research so
// no API keys are ever exposed in frontend code.

import { EDGE_FUNCTION_BASE, supabase } from './supabase';
import type {
  FxProviderResponse,
  FxRate,
  ResearchProviderResponse,
  ResearchProviderResult,
} from './types';

export interface FxProvider {
  fetchRates(base: string, targets?: string[]): Promise<FxProviderResponse>;
}

export interface ResearchProvider {
  search(query: string, maxResults?: number): Promise<ResearchProviderResponse>;
}

// ---- Edge-function-backed providers ----

export const edgeFxProvider: FxProvider = {
  async fetchRates(base: string, targets: string[] = []): Promise<FxProviderResponse> {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_BASE}/fx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base, targets }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`FX provider failed (${resp.status}): ${txt}`);
      }
      const data = (await resp.json()) as FxProviderResponse;
      return data;
    } catch (err) {
      // Degrade: return empty with clear status, never fabricate rates.
      return {
        rates: [],
        source: 'none',
        status: 'ERROR',
        base,
        message: `FX provider unavailable: ${(err as Error).message}`,
      } as FxProviderResponse & { message: string };
    }
  },
};

export const edgeResearchProvider: ResearchProvider = {
  async search(query: string, maxResults = 8): Promise<ResearchProviderResponse> {
    try {
      const resp = await fetch(`${EDGE_FUNCTION_BASE}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, max_results: maxResults }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Research provider failed (${resp.status}): ${txt}`);
      }
      const data = (await resp.json()) as ResearchProviderResponse;
      return data;
    } catch (err) {
      return {
        query,
        results: [],
        source: 'none',
        status: 'ERROR',
        message: `Research provider unavailable: ${(err as Error).message}`,
      };
    }
  },
};

// ---- Stored-data "providers" (read from Supabase tables) ----

export const storedMarketDataProvider = {
  async listRecent(limit = 50): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .order('observation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async listForCommodity(commodity: string, limit = 50): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .ilike('commodity', commodity)
      .order('observation_date', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('market_data').insert(row);
    return { error: error?.message ?? null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('market_data').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};

export const storedFxProvider = {
  async listRecent(limit = 50): Promise<{ data: FxRate[]; error: string | null }> {
    const { data, error } = await supabase
      .from('fx_rates')
      .select('*')
      .order('observation_date', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as FxRate[], error: null };
  },

  async insertBatch(rates: FxRate[]): Promise<{ error: string | null }> {
    if (rates.length === 0) return { error: null };
    const { error } = await supabase.from('fx_rates').insert(rates);
    return { error: error?.message ?? null };
  },
};

export const researchMemoryProvider = {
  async listRecent(limit = 50): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('research_memory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from('research_memory')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  },
};

export const reportsProvider = {
  async listRecent(limit = 50): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from('reports')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  },
};

export const alertsProvider = {
  async listActive(): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async acknowledge(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
    return { error: error?.message ?? null };
  },

  async insert(row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('alerts').insert(row);
    return { error: error?.message ?? null };
  },
};

export const locationProfilesProvider = {
  async list(): Promise<{ data: unknown[]; error: string | null }> {
    const { data, error } = await supabase
      .from('location_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('location_profiles').insert(row);
    return { error: error?.message ?? null };
  },

  async update(id: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('location_profiles').update(row).eq('id', id);
    return { error: error?.message ?? null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('location_profiles').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};

export type { ResearchProviderResult };

export const evaluationProvider = {
  async listRecent(limit = 100): Promise<{ data: import('./types').CommodityEvaluation[]; error: string | null }> {
    const { data, error } = await supabase
      .from('commodity_evaluations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as import('./types').CommodityEvaluation[], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ id: string | null; error: string | null }> {
    const { data, error } = await supabase
      .from('commodity_evaluations')
      .insert(row)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('commodity_evaluations').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};

export const stockProvider = {
  async listRecent(limit = 200): Promise<{ data: import('./types').StockRecord[]; error: string | null }> {
    const { data, error } = await supabase
      .from('stock_records')
      .select('*')
      .order('update_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as import('./types').StockRecord[], error: null };
  },

  async listForCommodity(commodity: string, limit = 200): Promise<{ data: import('./types').StockRecord[]; error: string | null }> {
    if (!commodity) return this.listRecent(limit);
    const { data, error } = await supabase
      .from('stock_records')
      .select('*')
      .ilike('commodity', commodity)
      .order('update_date', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as import('./types').StockRecord[], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('stock_records').insert(row);
    return { error: error?.message ?? null };
  },

  async update(id: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('stock_records').update(row).eq('id', id);
    return { error: error?.message ?? null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('stock_records').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};

export const shipmentsProvider = {
  async listRecent(limit = 200): Promise<{ data: import('./types').Shipment[]; error: string | null }> {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as import('./types').Shipment[], error: null };
  },

  async listForCommodity(commodity: string, limit = 200): Promise<{ data: import('./types').Shipment[]; error: string | null }> {
    if (!commodity) return this.listRecent(limit);
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .ilike('commodity', commodity)
      .order('expected_arrival', { ascending: true })
      .limit(limit);
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as import('./types').Shipment[], error: null };
  },

  async insert(row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('shipments').insert(row);
    return { error: error?.message ?? null };
  },

  async update(id: string, row: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabase.from('shipments').update(row).eq('id', id);
    return { error: error?.message ?? null };
  },

  async remove(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('shipments').delete().eq('id', id);
    return { error: error?.message ?? null };
  },
};
