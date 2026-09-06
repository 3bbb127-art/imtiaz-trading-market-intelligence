// New Commodity Evaluation — evaluates a proposed/new commodity using the
// market intelligence already collected. Produces a structured evaluation
// with opportunity score, assessments, recommendation, and data gaps.
// Reuses the existing engines, providers, and UI components.

import { useEffect, useState } from 'react';
import { Loader2, Trash2, Sparkles, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Badge, Button, Input, Field, EmptyState, StatCard } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { storedMarketDataProvider, edgeFxProvider, edgeResearchProvider, evaluationProvider, stockProvider, shipmentsProvider } from '@/lib/providers';
import { buildFindings, evaluationEngine, type RawMarketRow } from '@/agent/engines';
import { recommendationColor, confidenceColor } from '@/lib/format';
import type { CommodityEvaluation, EvaluationResult } from '@/lib/types';

export function CommodityEvaluationPage({ lang }: { lang: Language }) {
  const [saved, setSaved] = useState<CommodityEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [commodity, setCommodity] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [city, setCity] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await evaluationProvider.listRecent(100);
    setSaved(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    if (!commodity.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { data: marketData } = await storedMarketDataProvider.listForCommodity(commodity.trim(), 50);
      const marketRows = marketData as RawMarketRow[];
      const [stockResp, shipmentResp] = await Promise.all([
        stockProvider.listForCommodity(commodity.trim(), 200),
        shipmentsProvider.listForCommodity(commodity.trim(), 200),
      ]);

      const base = 'USD';
      const targets = ['AFN', 'EUR', 'PKR', 'INR', 'RUB'];
      const fxResp = await edgeFxProvider.fetchRates(base, targets);
      const liveFx = fxResp.rates;

      const researchQuery = `${commodity.trim()} Afghanistan Mazar-e-Sharif market price supply demand arrivals wagons stock inventory customs tariff import regulation border logistics competitors market sentiment ${new Date().getFullYear()}`;
      const researchResp = await edgeResearchProvider.search(researchQuery, 8);

      const findings = buildFindings({
        commodity: commodity.trim(),
        origin: origin.trim() || null,
        destination: destination.trim() || null,
        city: city.trim() || null,
        currencies: ['USD'],
        marketRows,
        fxRates: liveFx.map((f) => ({
          base_currency: f.base_currency, quote_currency: f.quote_currency, rate: f.rate,
          source: f.source ?? 'fx', data_status: f.data_status, confidence: f.confidence,
          observation_date: f.observation_date,
        })),
        researchResults: researchResp.results,
        stockRows: stockResp.data,
        shipmentRows: shipmentResp.data,
        researchStatus: researchResp.status,
        researchMessage: researchResp.message,
      });

      const evalResult = evaluationEngine({
        commodity: commodity.trim(),
        origin: origin.trim() || null,
        destination: destination.trim() || null,
        city: city.trim() || null,
        currencies: ['USD'],
        marketRows,
        fxRates: liveFx.map((f) => ({
          base_currency: f.base_currency, quote_currency: f.quote_currency, rate: f.rate,
          source: f.source ?? 'fx', data_status: f.data_status, confidence: f.confidence,
          observation_date: f.observation_date,
        })),
        researchResults: researchResp.results,
        stockRows: stockResp.data,
        shipmentRows: shipmentResp.data,
        researchStatus: researchResp.status,
        researchMessage: researchResp.message,
      }, findings);

      setResult(evalResult);

      await evaluationProvider.insert({
        commodity: evalResult.commodity,
        origin: evalResult.origin,
        destination: evalResult.destination,
        city: evalResult.city,
        opportunity_score: evalResult.opportunity_score,
        demand_assessment: evalResult.demand_assessment,
        supply_assessment: evalResult.supply_assessment,
        competition_assessment: evalResult.competition_assessment,
        price_attractiveness: evalResult.price_attractiveness,
        logistics_feasibility: evalResult.logistics_feasibility,
        market_sentiment: evalResult.market_sentiment,
        risk_assessment: evalResult.risk_assessment,
        confidence_level: evalResult.confidence_level,
        recommendation: evalResult.recommendation,
        key_reasons: evalResult.key_reasons,
        data_gaps: evalResult.data_gaps,
      });

      await load();
    } catch (err) {
      setError((err as Error).message || 'Evaluation failed.');
    } finally {
      setRunning(false);
    }
  };

  const remove = async (id: string) => {
    await evaluationProvider.remove(id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-600" />
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_evaluation')}</h1>
      </div>

      {/* Input form */}
      <Card className="p-5">
        <p className="mb-4 text-sm text-slate-500">{t(lang, 'evaluation_intro')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t(lang, 'commodity')}><Input value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="Wheat" disabled={running} /></Field>
          <Field label={t(lang, 'origin')}><Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Russia" disabled={running} /></Field>
          <Field label={t(lang, 'destination')}><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Afghanistan" disabled={running} /></Field>
          <Field label={t(lang, 'city')}><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mazar-e-Sharif" disabled={running} /></Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={run} disabled={running || !commodity.trim()} size="lg">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? t(lang, 'evaluating') : t(lang, 'run_evaluation')}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Live result */}
      {result && (
        <EvaluationResultView result={result} lang={lang} />
      )}

      {/* Saved evaluations */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(lang, 'saved_evaluations')}</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : saved.length === 0 ? (
          <EmptyState title={t(lang, 'no_evaluations')} subtitle={t(lang, 'run_evaluation')} />
        ) : (
          <div className="space-y-3">
            {saved.map((ev) => (
              <Card key={ev.id} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{ev.commodity}</span>
                    {ev.origin && <span className="text-xs text-slate-400">{ev.origin} → {ev.destination ?? '—'}</span>}
                    <Badge className={recommendationColor(ev.recommendation)}>{ev.recommendation}</Badge>
                    <Badge className={confidenceColor(ev.confidence_level as 'HIGH' | 'MEDIUM' | 'LOW')}>{ev.confidence_level}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-800">{ev.opportunity_score}</span>
                    {expanded === ev.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>
                {expanded === ev.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <SavedEvaluationDetail ev={ev} lang={lang} />
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => remove(ev.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EvaluationResultView({ result, lang }: { result: EvaluationResult; lang: Language }) {
  return (
    <Card className="p-5 space-y-4">
      {/* Score + recommendation */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t(lang, 'opportunity_score')} value={`${result.opportunity_score}/100`} accent={result.opportunity_score >= 60 ? 'text-emerald-700' : result.opportunity_score >= 35 ? 'text-amber-700' : 'text-rose-700'} />
        <StatCard label={t(lang, 'recommendation')} value={<Badge className={recommendationColor(result.recommendation)}>{result.recommendation}</Badge>} />
        <StatCard label={t(lang, 'confidence')} value={<Badge className={confidenceColor(result.confidence_level)}>{result.confidence_level}</Badge>} />
      </div>

      <AssessmentGrid result={result} lang={lang} />

      {/* Key reasons */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, 'key_reasons')}</h3>
        <ul className="space-y-1">
          {result.key_reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Data gaps */}
      {result.data_gaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {t(lang, 'data_gaps_warnings')}
          </h3>
          <ul className="space-y-1">
            {result.data_gaps.map((g, i) => (
              <li key={i} className="text-xs text-amber-700">• {g}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AssessmentGrid({ result, lang }: { result: EvaluationResult; lang: Language }) {
  const assessments: { label: string; value: string }[] = [
    { label: t(lang, 'demand_assessment'), value: result.demand_assessment },
    { label: t(lang, 'supply_assessment'), value: result.supply_assessment },
    { label: t(lang, 'competition_assessment'), value: result.competition_assessment },
    { label: t(lang, 'price_attractiveness'), value: result.price_attractiveness },
    { label: t(lang, 'logistics_feasibility'), value: result.logistics_feasibility },
    { label: t(lang, 'market_sentiment'), value: result.market_sentiment },
    { label: t(lang, 'risk_assessment'), value: result.risk_assessment },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {assessments.map((a) => (
        <div key={a.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{a.label}</p>
          <p className="text-sm text-slate-700">{a.value}</p>
        </div>
      ))}
    </div>
  );
}

function SavedEvaluationDetail({ ev, lang }: { ev: CommodityEvaluation; lang: Language }) {
  const assessments: { label: string; value: string }[] = [
    { label: t(lang, 'demand_assessment'), value: ev.demand_assessment },
    { label: t(lang, 'supply_assessment'), value: ev.supply_assessment },
    { label: t(lang, 'competition_assessment'), value: ev.competition_assessment },
    { label: t(lang, 'price_attractiveness'), value: ev.price_attractiveness },
    { label: t(lang, 'logistics_feasibility'), value: ev.logistics_feasibility },
    { label: t(lang, 'market_sentiment'), value: ev.market_sentiment },
    { label: t(lang, 'risk_assessment'), value: ev.risk_assessment },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {assessments.map((a) => (
          <div key={a.label} className="rounded border border-slate-100 bg-slate-50 p-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{a.label}</p>
            <p className="text-xs text-slate-600">{a.value}</p>
          </div>
        ))}
      </div>
      {ev.key_reasons && ev.key_reasons.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'key_reasons')}</p>
          <ul className="space-y-0.5">
            {ev.key_reasons.map((r, i) => (
              <li key={i} className="text-xs text-slate-600">• {r}</li>
            ))}
          </ul>
        </div>
      )}
      {ev.data_gaps && ev.data_gaps.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'data_gaps_warnings')}</p>
          <ul className="space-y-0.5">
            {ev.data_gaps.map((g, i) => (
              <li key={i} className="text-xs text-amber-600">• {g}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
