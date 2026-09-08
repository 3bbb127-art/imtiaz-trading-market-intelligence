// Dashboard — shows current market snapshot: selected market, commodity,
// FX, supply/demand, sentiment, risk, alerts, data freshness, recent reports.

import { useEffect, useState } from 'react';
import {
  Banknote, TrendingUp, AlertTriangle, FileText, Activity, Loader2,
} from 'lucide-react';
import { Card, SectionTitle, Badge, StatCard, EmptyState, Button } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import {
  storedMarketDataProvider, storedFxProvider, reportsProvider, alertsProvider,
  researchMemoryProvider, stockProvider, shipmentsProvider,
} from '@/lib/providers';
import {
  freshnessColor, confidenceColor, severityColor, classNames,
} from '@/lib/format';
import type { Alert, ReportRecord, ResearchFindings, StockRecord, Shipment } from '@/lib/types';

interface DashData {
  marketRows: Record<string, unknown>[];
  fxRows: { base_currency: string; quote_currency: string; rate: number; source?: string }[];
  reports: ReportRecord[];
  alerts: Alert[];
  research: { findings?: ResearchFindings; recommendation?: string | null }[];
  stock: StockRecord[];
  shipments: Shipment[];
}

export function DashboardPage({ lang, goTo }: { lang: Language; goTo: (p: 'ask' | 'reports' | 'market_data') => void }) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [m, f, r, a, r2, s2, sh2] = await Promise.all([
        storedMarketDataProvider.listRecent(20),
        storedFxProvider.listRecent(10),
        reportsProvider.listRecent(5),
        alertsProvider.listActive(),
        researchMemoryProvider.listRecent(1),
        stockProvider.listRecent(200),
        shipmentsProvider.listRecent(200),
      ]);
      if (!alive) return;
      setData({
        marketRows: m.data as Record<string, unknown>[],
        fxRows: f.data as { base_currency: string; quote_currency: string; rate: number; source?: string }[],
        reports: r.data as ReportRecord[],
        alerts: a.data as Alert[],
        research: r2.data as { findings?: ResearchFindings; recommendation?: string | null }[],
        stock: s2.data,
        shipments: sh2.data,
      });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const rows = data?.marketRows ?? [];
  const fx = data?.fxRows ?? [];
  const reports = data?.reports ?? [];
  const alerts = data?.alerts ?? [];

  const commodities = [...new Set(rows.map((r) => r.commodity).filter(Boolean))] as string[];
  const markets = [...new Set(rows.map((r) => r.market || r.city || r.country).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_dashboard')}</h1>
        <Button size="sm" onClick={() => goTo('ask')}>
          <TrendingUp className="h-4 w-4" /> {t(lang, 'ask_send')}
        </Button>
      </div>

      {rows.length === 0 && alerts.length === 0 && reports.length === 0 && (data?.research?.length ?? 0) === 0 && (data?.stock?.length ?? 0) === 0 && (data?.shipments?.length ?? 0) === 0 ? (
        <EmptyState title={t(lang, 'no_data')} subtitle={t(lang, 'landing_intro')} />
      ) : (
        <>
          {/* Top stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Commodities Tracked" value={commodities.length} sub={commodities.slice(0, 3).join(', ')} />
            <StatCard label="Markets" value={markets.length} sub={markets.slice(0, 3).join(', ')} accent="text-emerald-700" />
            <StatCard label="FX Pairs" value={fx.length} sub={fx.slice(0, 2).map((f) => `${f.base_currency}/${f.quote_currency}`).join(', ')} />
            <StatCard label="Reports" value={reports.length} sub={reports[0]?.title} />
          </div>

          {(() => {
            const latest = data?.research?.[0]?.findings;
            const stockRows = data?.stock ?? [];
            const shipmentRows = data?.shipments ?? [];
            const available = stockRows.filter((r) => r.available_stock != null).reduce((sum, r) => sum + (r.available_stock ?? 0), 0);
            const incoming = shipmentRows.filter((r) => (r.status === 'In Transit' || r.status === 'Planned') && r.quantity != null).reduce((sum, r) => sum + (r.quantity ?? 0), 0);
            const delayed = shipmentRows.filter((r) => r.status === 'Delayed').length;
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Supply / Demand" value={latest ? `${latest.supply} / ${latest.demand}` : 'UNKNOWN'} sub="Latest agent finding" />
                <StatCard label="Sentiment / Risk" value={latest ? `${latest.sentiment} / ${latest.forecast?.market_risk ?? 'UNKNOWN'}` : 'UNKNOWN'} sub="Latest agent finding" />
                <StatCard label="Stock / Incoming" value={`${available.toLocaleString()} / ${incoming.toLocaleString()}`} sub={stockRows.length || shipmentRows.length ? `${stockRows.length} stock · ${shipmentRows.length} shipments` : 'No operational records'} accent="text-sky-700" />
                <StatCard label="Recommendation" value={latest?.recommendation ?? 'UNKNOWN'} sub={latest?.forecast ? `Forecast ${latest.forecast.price_direction}` : (delayed > 0 ? `${delayed} delayed shipment(s)` : 'Latest agent finding')} accent="text-emerald-700" />
              </div>
            );
          })()}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Alerts */}
            <Card className="p-5 lg:col-span-1">
              <SectionTitle icon={<AlertTriangle className="h-4 w-4" />}>{t(lang, 'alerts')}</SectionTitle>
              <div className="mt-3 space-y-2">
                {alerts.length === 0 ? (
                  <p className="text-sm text-slate-400">{t(lang, 'no_alerts')}</p>
                ) : (
                  alerts.map((a) => (
                    <div key={a.id} className={classNames('rounded-lg border p-3 text-xs', severityColor(a.severity))}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{a.title}</span>
                        <Badge className={severityColor(a.severity)}>{a.severity}</Badge>
                      </div>
                      {a.detail && <p className="mt-1 opacity-80">{a.detail}</p>}
                      {a.commodity && <p className="mt-1 text-[10px] opacity-60">{a.commodity} · {a.country} · {a.city}</p>}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Recent market data */}
            <Card className="p-5 lg:col-span-2">
              <SectionTitle icon={<Activity className="h-4 w-4" />}>Recent Market Observations</SectionTitle>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-medium">Commodity</th>
                      <th className="py-2 pr-3 font-medium">Location</th>
                      <th className="py-2 pr-3 font-medium">Price</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-700">{String(r.commodity ?? '')}</td>
                        <td className="py-2 pr-3 text-slate-600">{[r.city, r.country].filter(Boolean).join(', ')}</td>
                        <td className="py-2 pr-3 text-slate-800">{r.price != null ? `${r.currency} ${r.price}/${r.unit}` : '—'}</td>
                        <td className="py-2 pr-3 text-slate-500">{String(r.observation_date).slice(0, 10)}</td>
                        <td className="py-2"><Badge className={confidenceColor((r.confidence as 'HIGH' | 'MEDIUM' | 'LOW') ?? 'MEDIUM')}>{(r.data_status as string) ?? 'REPORTED'}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button variant="ghost" size="sm" onClick={() => goTo('market_data')}>View all →</Button>
              </div>
            </Card>
          </div>

          {/* FX */}
          <Card className="p-5">
            <SectionTitle icon={<Banknote className="h-4 w-4" />}>{t(lang, 'fx_situation')}</SectionTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {fx.length === 0 ? (
                <p className="text-sm text-slate-400">{t(lang, 'insufficient_data')}</p>
              ) : (
                fx.slice(0, 8).map((f, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">{f.base_currency}/{f.quote_currency}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{f.rate.toFixed(4)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge className={freshnessColor('CURRENT')}>{f.source ?? 'fx'}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent reports */}
          <Card className="p-5">
            <SectionTitle icon={<FileText className="h-4 w-4" />}>{t(lang, 'recent_reports')}</SectionTitle>
            <div className="mt-3 space-y-2">
              {reports.length === 0 ? (
                <p className="text-sm text-slate-400">{t(lang, 'no_reports')}</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{r.title}</p>
                      <p className="text-xs text-slate-400">{r.report_type} · {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => goTo('reports')}>{t(lang, 'view')}</Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
