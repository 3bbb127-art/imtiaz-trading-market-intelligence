// Autonomous agent workflow executor.
// Steps: Understand -> Infer -> Plan -> Research -> Collect -> Verify ->
// Normalize -> Compare -> Calculate -> Analyze -> Forecast -> Recommend ->
// Report -> Save -> Deliver. Executes end-to-end without unnecessary questions.

import type {
  AgentResult,
  ParsedIntent,
  ResearchFindings,
  WorkflowStep,
  FxRate,
  EvaluationResult,
} from '../lib/types';
import { parseCommand } from './parser';
import {
  edgeFxProvider,
  edgeResearchProvider,
  storedMarketDataProvider,
  storedFxProvider,
  researchMemoryProvider,
  reportsProvider,
  alertsProvider,
  evaluationProvider,
  stockProvider,
  shipmentsProvider,
} from '../lib/providers';
import { buildFindings, evaluationEngine, type RawMarketRow, type EngineInput } from './engines';
import { generateReport } from './report';

export interface RunOptions {
  onStep?: (step: WorkflowStep) => void;
  signal?: AbortSignal;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function runAgent(command: string, opts: RunOptions = {}): Promise<AgentResult> {
  const steps: WorkflowStep[] = [];
  const onStep = opts.onStep ?? (() => {});

  const emit = (step: string, status: WorkflowStep['status'], detail?: string) => {
    const s: WorkflowStep = { step, status, detail, started_at: status === 'running' ? nowIso() : undefined, completed_at: status === 'done' || status === 'error' || status === 'skipped' ? nowIso() : undefined };
    steps.push(s);
    onStep(s);
  };

  // STEP 1 — Understand
  emit('Understand command', 'running');
  const intent: ParsedIntent = parseCommand(command);
  emit('Understand command', 'done', `Commodity: ${intent.commodity ?? 'n/a'} | Origin: ${intent.origin ?? 'n/a'} | Destination: ${intent.destination ?? 'n/a'} | City: ${intent.city ?? 'n/a'} | Objective: ${intent.objective}`);

  // STEP 2 — Infer (already done in parser; record assumptions)
  emit('Infer missing parameters', 'done', intent.assumptions.length ? intent.assumptions.join('; ') : 'No assumptions needed.');

  // STEP 3 — Plan
  emit('Plan research workflow', 'done', `Objective: ${intent.objective}`);

  // STEP 4 — Research (web)
  emit('Web research', 'running');
  const researchQuery = intent.commodity
    ? `${intent.commodity} Afghanistan Mazar-e-Sharif market price supply demand arrivals wagons stock inventory customs tariff import regulation border logistics competitors market sentiment ${new Date().getFullYear()}`
    : `${command} Afghanistan Mazar-e-Sharif prices supply demand wagons stock inventory customs tariff import regulations border logistics competitors market sentiment ${new Date().getFullYear()}`;
  const researchResp = await edgeResearchProvider.search(researchQuery, 8);
  emit('Web research', researchResp.status === 'OK' ? 'done' : 'skipped', researchResp.status === 'OK' ? `${researchResp.results.length} results` : (researchResp.message ?? researchResp.status));

  // STEP 5 — Collect (stored market data + operational supply chain records)
  emit('Collect stored market data', 'running');
  let marketRows: RawMarketRow[] = [];
  if (intent.commodity) {
    const { data } = await storedMarketDataProvider.listForCommodity(intent.commodity, 50);
    marketRows = data as RawMarketRow[];
  } else {
    const { data } = await storedMarketDataProvider.listRecent(50);
    marketRows = data as RawMarketRow[];
  }
  emit('Collect stored market data', 'done', `${marketRows.length} observation(s)`);

  emit('Collect stock & shipment intelligence', 'running');
  const [stockResp, shipmentResp] = await Promise.all([
    stockProvider.listForCommodity(intent.commodity ?? '', 200),
    shipmentsProvider.listForCommodity(intent.commodity ?? '', 200),
  ]);
  const stockRows = stockResp.data;
  const shipmentRows = shipmentResp.data;
  emit('Collect stock & shipment intelligence', 'done', `${stockRows.length} stock record(s), ${shipmentRows.length} shipment/wagon record(s)`);

  // Collect FX
  emit('Collect FX rates', 'running');
  const base = intent.currencies[0] ?? 'USD';
  const targets = intent.currencies.length > 1 ? intent.currencies.slice(1) : ['USD', 'AFN', 'EUR', 'PKR', 'INR', 'RUB'];
  const fxResp = await edgeFxProvider.fetchRates(base, targets);
  const liveFx: FxRate[] = fxResp.rates;
  // Persist FX rates
  if (liveFx.length > 0) {
    await storedFxProvider.insertBatch(liveFx);
  }
  const fxMsg = (fxResp as { message?: string }).message;
  emit('Collect FX rates', fxResp.status === 'OK' ? 'done' : 'skipped', fxResp.status === 'OK' ? `${liveFx.length} rates` : (fxMsg ?? fxResp.status));

  // STEP 6 — Verify (freshness + source checks done in engines)
  emit('Verify sources & freshness', 'done');

  // STEP 7-11 — Normalize, Compare, Calculate, Analyze, Forecast (engines)
  emit('Normalize & analyze', 'running');
  const findings: ResearchFindings = buildFindings({
    commodity: intent.commodity,
    origin: intent.origin,
    destination: intent.destination,
    city: intent.city,
    currencies: intent.currencies,
    marketRows,
    fxRates: liveFx.map((f) => ({ base_currency: f.base_currency, quote_currency: f.quote_currency, rate: f.rate, source: f.source ?? 'fx', data_status: f.data_status, confidence: f.confidence, observation_date: f.observation_date })),
    researchResults: researchResp.results,
    stockRows,
    shipmentRows,
    researchStatus: researchResp.status as EngineInput['researchStatus'],
    researchMessage: researchResp.message,
  });
  emit('Normalize & analyze', 'done', `Sentiment: ${findings.sentiment} | Recommendation: ${findings.recommendation}`);

  // STEP 12 — Recommend (already in findings)
  emit('Generate recommendation', 'done', findings.recommendation);

  // STEP 13 — Report
  emit('Generate report', 'running');
  let evaluation: EvaluationResult | null = null;
  if (intent.commodity) {
    evaluation = evaluationEngine({
      commodity: intent.commodity,
      origin: intent.origin,
      destination: intent.destination,
      city: intent.city,
      currencies: intent.currencies,
      marketRows,
      fxRates: liveFx.map((f) => ({ base_currency: f.base_currency, quote_currency: f.quote_currency, rate: f.rate, source: f.source ?? 'fx', data_status: f.data_status, confidence: f.confidence, observation_date: f.observation_date })),
      researchResults: researchResp.results,
      stockRows,
      shipmentRows,
      researchStatus: researchResp.status as EngineInput['researchStatus'],
      researchMessage: researchResp.message,
    }, findings);
  }
  const reportMarkdown = generateReport(intent, findings, evaluation);
  emit('Generate report', 'done');

  // STEP 14 — Save
  emit('Save research & report', 'running');
  const scope = { commodity: intent.commodity, origin: intent.origin, destination: intent.destination, city: intent.city };
  const ins = await researchMemoryProvider.insert({
    command: intent.raw,
    parsed_intent: intent,
    workflow_steps: steps.map((s) => ({ step: s.step, status: s.status, detail: s.detail })),
    findings,
    recommendation: findings.recommendation,
    language: 'en',
  });
  const researchId = ins.id ?? undefined;
  let reportId: string | undefined;
  if (researchId) {
    const repIns = await reportsProvider.insert({
      report_type: reportTypeForObjective(intent.objective),
      title: `${intent.commodity ?? 'Market'} Intelligence — ${new Date().toLocaleDateString()}`,
      scope,
      content_markdown: reportMarkdown,
      content_json: { findings } as Record<string, unknown>,
      language: 'en',
      research_id: researchId,
    });
    reportId = repIns.id ?? undefined;
  }

  // Save anomalies as alerts
  for (const a of findings.anomalies) {
    await alertsProvider.insert({
      alert_type: a.type,
      severity: a.severity,
      title: a.type,
      detail: a.description,
      commodity: intent.commodity ?? null,
      country: intent.destination ?? intent.origin ?? null,
      city: intent.city ?? null,
      acknowledged: false,
    });
  }
  // Save conflicts as alerts
  for (const c of findings.conflicts) {
    await alertsProvider.insert({
      alert_type: 'Conflicting sources',
      severity: 'MEDIUM',
      title: 'Conflicting Sources Detected',
      detail: c,
      commodity: intent.commodity ?? null,
      country: intent.destination ?? intent.origin ?? null,
      city: intent.city ?? null,
      acknowledged: false,
    });
  }
  emit('Save research & report', 'done', researchId ? 'Saved' : 'Save failed');

  // Save evaluation if produced
  if (evaluation) {
    await evaluationProvider.insert({
      commodity: evaluation.commodity,
      origin: evaluation.origin,
      destination: evaluation.destination,
      city: evaluation.city,
      opportunity_score: evaluation.opportunity_score,
      demand_assessment: evaluation.demand_assessment,
      supply_assessment: evaluation.supply_assessment,
      competition_assessment: evaluation.competition_assessment,
      price_attractiveness: evaluation.price_attractiveness,
      logistics_feasibility: evaluation.logistics_feasibility,
      market_sentiment: evaluation.market_sentiment,
      risk_assessment: evaluation.risk_assessment,
      confidence_level: evaluation.confidence_level,
      recommendation: evaluation.recommendation,
      key_reasons: evaluation.key_reasons,
      data_gaps: evaluation.data_gaps,
    });
  }

  // STEP 15 — Deliver
  emit('Deliver intelligence', 'done');

  return { intent, steps, findings, reportMarkdown, researchId, reportId, evaluation: evaluation ?? undefined };
}

function reportTypeForObjective(obj: string): string {
  switch (obj) {
    case 'compare':
      return 'market_comparison';
    case 'import_feasibility':
      return 'import_feasibility';
    case 'import_research':
      return 'commodity_research';
    case 'fx_impact':
      return 'fx_impact';
    case 'report':
      return 'daily';
    default:
      return 'commodity_research';
  }
}
