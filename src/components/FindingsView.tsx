// FindingsView — renders structured research findings with data-quality labels.

import type { ResearchFindings, ParsedIntent, PricePoint, DataSource } from '@/lib/types';
import { type Language, t } from '@/lib/i18n';
import { Card, SectionTitle, Badge } from '@/components/ui';
import {
  freshnessColor, confidenceColor, severityColor, recommendationColor, sentimentColor,
  supplyDemandColor, classNames,
} from '@/lib/format';
import {
  TrendingUp, TrendingDown, Minus, HelpCircle, Globe2, Ship, Banknote, Users,
  Landmark, Truck, AlertTriangle, Lightbulb, FileSearch, LineChart, ShieldCheck,
} from 'lucide-react';

export function FindingsView({ findings, intent, lang }: { findings: ResearchFindings; intent: ParsedIntent; lang: Language }) {
  return (
    <div className="space-y-5">
      {/* Executive summary */}
      <Card className="p-5">
        <SectionTitle icon={<FileSearch className="h-4 w-4" />}>Executive Summary</SectionTitle>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{findings.executive_summary}</p>
        {intent.assumptions.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">{t(lang, 'assumptions')}</p>
            <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
              {intent.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </Card>

      {/* Grid: FX + Global + Origin + Target */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={<Banknote className="h-4 w-4" />} title={t(lang, 'fx_situation')} body={findings.fx_situation} />
        <InfoCard icon={<Globe2 className="h-4 w-4" />} title={t(lang, 'global_market')} body={findings.global_market} />
        <InfoCard icon={<Ship className="h-4 w-4" />} title={t(lang, 'origin_market')} body={findings.origin_market} />
        <InfoCard icon={<Globe2 className="h-4 w-4" />} title={t(lang, 'target_country')} body={findings.target_country} />
        <InfoCard icon={<Globe2 className="h-4 w-4" />} title={t(lang, 'target_city')} body={findings.target_city} />
        <InfoCard icon={<Landmark className="h-4 w-4" />} title="Government / Trade Updates" body={findings.government_trade_updates} />
      </div>

      {/* Price points table */}
      <Card className="p-5">
        <SectionTitle icon={<LineChart className="h-4 w-4" />}>{t(lang, 'commodity_prices')}</SectionTitle>
        <div className="mt-3 overflow-x-auto">
          {findings.price_points.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Price</th>
                  <th className="py-2 pr-3 font-medium">USD/MT</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Conf.</th>
                  <th className="py-2 pr-3 font-medium">Fresh</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {findings.price_points.map((p, i) => <PriceRow key={i} p={p} />)}
              </tbody>
            </table>
          ) : (
            <p className="py-4 text-sm text-slate-400">{t(lang, 'insufficient_data')}</p>
          )}
        </div>
      </Card>

      {/* Landed cost */}
      {findings.landed_cost && (
        <Card className="p-5">
          <SectionTitle icon={<Ship className="h-4 w-4" />}>Landed Cost Estimate</SectionTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Component</th>
                  <th className="py-2 pr-3 font-medium">Value</th>
                  <th className="py-2 pr-3 font-medium">Currency</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {findings.landed_cost.components.map((c, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">{c.label}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{c.value != null ? c.value.toFixed(2) : '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{c.currency ?? '—'}</td>
                    <td className="py-2 pr-3"><Badge className={confidenceColor(c.confidence)}>{c.data_status}</Badge></td>
                    <td className="py-2"><Badge className={confidenceColor(c.confidence)}>{c.confidence}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3">
              <span className="text-xs font-medium text-slate-600">Estimated Total</span>
              <span className="text-sm font-semibold text-slate-900">
                {findings.landed_cost.currency} {findings.landed_cost.total != null ? findings.landed_cost.total.toFixed(2) : '—'}
                {findings.landed_cost.unit ? ` / ${findings.landed_cost.unit}` : ''}
              </span>
            </div>
            <p className="mt-2 text-[11px] italic text-slate-400">{findings.landed_cost.note}</p>
          </div>
        </Card>
      )}

      {/* Supply / Demand / Sentiment / Risk */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <IndicatorCard label={t(lang, 'supply')} value={findings.supply} colorFn={supplyDemandColor} />
        <IndicatorCard label={t(lang, 'demand')} value={findings.demand} colorFn={supplyDemandColor} />
        <IndicatorCard label={t(lang, 'sentiment')} value={findings.sentiment} colorFn={sentimentColor} />
        <IndicatorCard label={t(lang, 'risk_level')} value={findings.forecast?.market_risk ?? 'Unknown'} colorFn={severityColor} />
      </div>

      {/* Demand Intelligence */}
      {findings.demand_intelligence && (
        <Card className="p-5">
          <SectionTitle icon={<Users className="h-4 w-4" />}>Demand Intelligence</SectionTitle>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{findings.demand_intelligence.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className={classNames('px-3 py-1', supplyDemandColor(findings.demand_intelligence.level))}>Level: {findings.demand_intelligence.level}</Badge>
            <Badge className={classNames('px-3 py-1', confidenceColor(findings.demand_intelligence.confidence))}>Score: {findings.demand_intelligence.score}/100</Badge>
            <Badge className={classNames('px-3 py-1', confidenceColor(findings.demand_intelligence.confidence))}>Trend: {findings.demand_intelligence.trend}</Badge>
            <Badge className={classNames('px-3 py-1', confidenceColor(findings.demand_intelligence.confidence))}>Confidence: {findings.demand_intelligence.confidence}</Badge>
          </div>
          {findings.demand_intelligence.signals.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">Level</th>
                    <th className="py-2 pr-3 font-medium">Trend</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Conf.</th>
                    <th className="py-2 pr-3 font-medium">Fresh</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.demand_intelligence.signals.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-700">
                        {s.source}
                        {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="ml-1 text-emerald-600 hover:underline">link</a>}
                      </td>
                      <td className="py-2 pr-3"><Badge className={supplyDemandColor(s.level)}>{s.level}</Badge></td>
                      <td className="py-2 pr-3 text-slate-600">{s.trend}</td>
                      <td className="py-2 pr-3"><Badge className={s.evidence_type === 'OBSERVED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-sky-700 bg-sky-50 border-sky-200'}>{s.evidence_type}</Badge></td>
                      <td className="py-2 pr-3"><Badge className={confidenceColor(s.confidence)}>{s.confidence}</Badge></td>
                      <td className="py-2 pr-3"><Badge className={freshnessColor(s.freshness)}>{s.freshness}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Competitor + logistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard icon={<Users className="h-4 w-4" />} title="Competitor Activity" body={findings.competitor_activity} />
        <InfoCard icon={<Truck className="h-4 w-4" />} title="Logistics / Border Risks" body={findings.logistics_risks} />
      </div>

      {/* Risks + Opportunities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <SectionTitle icon={<AlertTriangle className="h-4 w-4" />}>Key Risks</SectionTitle>
          <ListItems items={findings.key_risks} emptyText={t(lang, 'insufficient_data')} color="rose" />
        </Card>
        <Card className="p-5">
          <SectionTitle icon={<Lightbulb className="h-4 w-4" />}>Opportunities</SectionTitle>
          <ListItems items={findings.opportunities} emptyText="None identified in available data." color="emerald" />
        </Card>
      </div>

      {/* Anomalies */}
      {findings.anomalies.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<AlertTriangle className="h-4 w-4" />}>Anomalies Detected</SectionTitle>
          <ul className="mt-3 space-y-2">
            {findings.anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge className={severityColor(a.severity)}>{a.severity}</Badge>
                <span className="text-slate-700"><strong>{a.type}:</strong> {a.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Forecast */}
      {findings.forecast && (
        <Card className="p-5">
          <SectionTitle icon={<LineChart className="h-4 w-4" />}>{t(lang, 'forecast')}</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ForecastCell label="Horizon" value={findings.forecast.horizon} />
            <ForecastDir label="Price" dir={findings.forecast.price_direction} />
            <ForecastDir label="Supply" dir={findings.forecast.supply_direction} />
            <ForecastDir label="Demand" dir={findings.forecast.demand_direction} />
            <ForecastCell label="Risk" value={findings.forecast.market_risk} />
            <ForecastCell label="Confidence" value={findings.forecast.confidence} />
          </div>
          <p className="mt-3 text-xs text-slate-600">{findings.forecast.rationale}</p>
          <p className="mt-2 text-[11px] italic text-slate-400">Forecast Confidence: {findings.forecast.confidence} — estimates, not certainties.</p>
        </Card>
      )}

      {/* Recommendation */}
      <Card className="p-5">
        <SectionTitle icon={<ShieldCheck className="h-4 w-4" />}>{t(lang, 'recommendation')}</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge className={classNames('px-4 py-1.5 text-sm', recommendationColor(findings.recommendation))}>
            {findings.recommendation}
          </Badge>
          <p className="flex-1 text-sm text-slate-700">{findings.recommendation_rationale}</p>
        </div>
      </Card>

      {/* Conflicts */}
      {findings.conflicts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <SectionTitle icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>{t(lang, 'conflicts')}</SectionTitle>
          <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
            {findings.conflicts.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Card>
      )}

      {/* Data gaps */}
      {findings.data_gaps.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<HelpCircle className="h-4 w-4" />}>{t(lang, 'data_gaps')}</SectionTitle>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-500">
            {findings.data_gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </Card>
      )}

      {/* Sources */}
      <Card className="p-5">
        <SectionTitle icon={<FileSearch className="h-4 w-4" />}>{t(lang, 'sources')}</SectionTitle>
        {findings.sources.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {findings.sources.map((s, i) => <SourceRow key={i} s={s} />)}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-400">No sources recorded.</p>}
      </Card>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="p-5">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</p>
    </Card>
  );
}

function PriceRow({ p }: { p: PricePoint }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3 text-slate-700">{p.location}</td>
      <td className="py-2 pr-3 font-medium text-slate-800">{p.price != null ? `${p.currency} ${p.price} / ${p.unit}` : '—'}</td>
      <td className="py-2 pr-3 text-slate-600">{p.normalized_price_usd != null ? p.normalized_price_usd.toFixed(2) : '—'}</td>
      <td className="py-2 pr-3"><Badge className={confidenceColor(p.confidence)}>{p.data_status}</Badge></td>
      <td className="py-2 pr-3"><Badge className={confidenceColor(p.confidence)}>{p.confidence}</Badge></td>
      <td className="py-2 pr-3"><Badge className={freshnessColor(p.freshness)}>{p.freshness}</Badge></td>
      <td className="py-2 text-xs text-slate-500">{p.source}</td>
    </tr>
  );
}

function IndicatorCard({ label, value, colorFn }: { label: string; value: string; colorFn: (s: string) => string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2">
        <Badge className={classNames('px-3 py-1 text-sm', colorFn(value))}>{value}</Badge>
      </div>
    </Card>
  );
}

function ListItems({ items, emptyText, color }: { items: string[]; emptyText: string; color: 'rose' | 'emerald' }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-slate-400">{emptyText}</p>;
  const dot = color === 'rose' ? 'before:bg-rose-400' : 'before:bg-emerald-400';
  return (
    <ul className={classNames('mt-2 space-y-1.5 text-sm text-slate-700', 'list-none')}>
      {items.map((it, i) => (
        <li key={i} className={classNames('relative pl-4 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full', dot)}>{it}</li>
      ))}
    </ul>
  );
}

function ForecastCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ForecastDir({ label, dir }: { label: string; dir: string }) {
  const Icon = dir === 'UP' ? TrendingUp : dir === 'DOWN' ? TrendingDown : dir === 'FLAT' ? Minus : HelpCircle;
  const color = dir === 'UP' ? 'text-emerald-600' : dir === 'DOWN' ? 'text-rose-600' : dir === 'FLAT' ? 'text-slate-500' : 'text-slate-400';
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <div className={classNames('mt-1 flex items-center justify-center gap-1 text-sm font-semibold', color)}>
        <Icon className="h-4 w-4" /> {dir}
      </div>
    </div>
  );
}

function SourceRow({ s }: { s: DataSource }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-slate-700">{s.name}</span>
      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{s.url}</a>}
      <Badge className={confidenceColor(s.confidence)}>{s.source_type}</Badge>
      <Badge className={confidenceColor(s.confidence)}>{s.data_status}</Badge>
      <Badge className={freshnessColor(s.freshness)}>{s.freshness}</Badge>
    </li>
  );
}
