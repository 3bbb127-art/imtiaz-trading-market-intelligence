// Autonomous global market-intelligence workflow executor.
//
// Core architecture rules:
// 1. Import Route != Comparison.
// 2. Comparison markets are first-class entities.
// 3. Market context is separate from comparison markets.
// 4. Global-first: never force Afghanistan unless the command/context says so.
// 5. Stored market data is scope-filtered for comparisons.
// 6. Pure comparison workflows do not generate import-opportunity evaluations.
// 7. FX normalization uses USD for global comparison workflows.
// 8. Existing ParsedIntent fields remain backward-compatible.
// 9. Comparison metadata is preserved in research/report scope.
// 10. The executor must not invent routes, prices, locations, or entities.

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

import {
  buildFindings,
  evaluationEngine,
  type RawMarketRow,
  type EngineInput,
} from './engines';

import { generateReport } from './report';

export interface RunOptions {
  onStep?: (step: WorkflowStep) => void;
  signal?: AbortSignal;
}

/**
 * Parser adds comparison metadata without breaking the existing
 * ParsedIntent type until the shared type definition is upgraded.
 */
type ExtendedIntent = ParsedIntent & {
  comparisonMarkets?: string[];
  comparisonContext?: string | null;
};

/**
 * Extended raw market-row view used only for safe scope filtering.
 *
 * The underlying RawMarketRow schema may vary between versions.
 * We intentionally inspect optional location fields defensively.
 */
type MarketRowView = RawMarketRow & {
  location?: string | null;
  country?: string | null;
  market?: string | null;
  city?: string | null;
  source?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getExtendedIntent(
  intent: ParsedIntent,
): ExtendedIntent {
  return intent as ExtendedIntent;
}

function normalizeEntity(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Converts "Russia", "Russian", etc. into a comparable normalized form.
 *
 * Parser normally gives canonical names, but stored market rows may use
 * different capitalization or simple textual variants.
 */
function entityVariants(entity: string): string[] {
  const normalized = normalizeEntity(entity);

  const variants = new Set<string>();

  if (normalized) {
    variants.add(normalized);
  }

  if (normalized === 'russia') {
    variants.add('russian');
  }

  if (normalized === 'kazakhstan') {
    variants.add('kazakh');
    variants.add('kazakhstani');
  }

  if (normalized === 'united states') {
    variants.add('usa');
    variants.add('us');
    variants.add('u.s.');
  }

  if (normalized === 'united arab emirates') {
    variants.add('uae');
  }

  if (normalized === 'united kingdom') {
    variants.add('uk');
    variants.add('gb');
  }

  return [...variants];
}

function entityMatchesValue(
  entity: string,
  value: unknown,
): boolean {
  const candidate = normalizeEntity(value);

  if (!candidate) {
    return false;
  }

  return entityVariants(entity).some(
    (variant) =>
      candidate === variant ||
      candidate.startsWith(`${variant},`) ||
      candidate.endsWith(`, ${variant}`) ||
      candidate.includes(` ${variant} `),
  );
}

/**
 * Determine whether a stored market row belongs to one of the comparison
 * markets.
 *
 * We deliberately do NOT match the destination/context here.
 * That is the key protection against Kabul/Afghanistan leaking into
 * a Russia-vs-Kazakhstan comparison.
 */
function isComparisonMarketRow(
  row: RawMarketRow,
  comparisonMarkets: string[],
): boolean {
  if (comparisonMarkets.length < 2) {
    return true;
  }

  const view = row as MarketRowView;

  const values = [
    view.location,
    view.country,
    view.market,
    view.city,
  ].filter(Boolean);

  return comparisonMarkets.some(
    (market) =>
      values.some((value) =>
        entityMatchesValue(market, value),
      ),
  );
}

/**
 * Scope stored market observations.
 *
 * For pure comparisons:
 *   Russia + Kazakhstan = accepted
 *   Kabul + Afghanistan = excluded
 *
 * For other workflows:
 *   Keep the existing dataset behaviour.
 */
function scopeMarketRows(
  rows: RawMarketRow[],
  intent: ExtendedIntent,
): RawMarketRow[] {
  const comparisonMarkets =
    intent.comparisonMarkets ?? [];

  if (
    intent.objective !== 'compare' ||
    comparisonMarkets.length < 2
  ) {
    return rows;
  }

  const filtered = rows.filter(
    (row) =>
      isComparisonMarketRow(
        row,
        comparisonMarkets,
      ),
  );

  return filtered;
}

/**
 * Global research query builder.
 *
 * Important:
 * We never blindly append Afghanistan.
 *
 * Comparison:
 *   compare Russia vs Kazakhstan
 *
 * Import:
 *   source -> destination
 *
 * City:
 *   city + country
 *
 * Global fallback:
 *   commodity + global market
 */
function buildResearchQuery(
  command: string,
  intent: ExtendedIntent,
): string {
  const year =
    new Date().getFullYear();

  const commodity =
    intent.commodity ??
    '';

  const comparisonMarkets =
    intent.comparisonMarkets ?? [];

  const comparisonContext =
    intent.comparisonContext ??
    null;

  /**
   * Pure comparison workflow.
   */
  if (
    intent.objective === 'compare' &&
    comparisonMarkets.length >= 2
  ) {
    const pair = comparisonMarkets
      .slice(0, 2)
      .join(' vs ');

    const contextText =
      comparisonContext
        ? ` Market context: ${comparisonContext}.`
        : '';

    return [
      commodity,
      'commodity price comparison',
      pair,
      'market price',
      'wholesale price',
      'export price',
      'producer price',
      'benchmark price',
      'supply',
      'demand',
      'trade',
      'exports',
      'imports',
      'logistics',
      'competitors',
      'market sentiment',
      contextText,
      `${year}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Explicit import route.
   */
  if (
    intent.objective === 'import_research' ||
    intent.objective === 'import_feasibility'
  ) {
    const routeParts = [
      intent.origin
        ? `from ${intent.origin}`
        : '',
      intent.destination
        ? `to ${intent.destination}`
        : '',
      intent.city
        ? `city ${intent.city}`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return [
      commodity,
      routeParts,
      'import price',
      'export price',
      'freight',
      'customs',
      'tariff',
      'tax',
      'border',
      'logistics',
      'supply',
      'demand',
      'competitors',
      'regulation',
      `${year}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * City-level market analysis.
   */
  if (intent.city) {
    return [
      commodity,
      `${intent.city} market`,
      intent.destination
        ? intent.destination
        : '',
      'price',
      'supply',
      'demand',
      'arrivals',
      'wagons',
      'stock',
      'inventory',
      'customs',
      'tariff',
      'border',
      'logistics',
      'competitors',
      'market sentiment',
      `${year}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Country-specific market analysis.
   */
  if (intent.destination) {
    return [
      commodity,
      `${intent.destination} market`,
      'price',
      'supply',
      'demand',
      'trade',
      'imports',
      'exports',
      'logistics',
      'competitors',
      'market sentiment',
      `${year}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Explicit origin without destination.
   */
  if (intent.origin) {
    return [
      commodity,
      `${intent.origin} market`,
      'price',
      'exports',
      'supply',
      'demand',
      'trade',
      'logistics',
      `${year}`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Global fallback.
   *
   * Never insert an arbitrary country.
   */
  return [
    commodity || command,
    'global commodity market',
    'international price',
    'benchmark',
    'supply',
    'demand',
    'trade',
    'exports',
    'imports',
    'logistics',
    'competitors',
    'market sentiment',
    `${year}`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * FX strategy.
 *
 * For global comparisons, USD is the common normalization currency.
 * For explicitly requested FX analysis, respect the parser's ordering.
 */
function buildFxRequest(
  intent: ExtendedIntent,
): {
  base: string;
  targets: string[];
} {
  const currencies = [
    ...new Set(
      (intent.currencies ?? [])
        .filter(
          (currency) =>
            typeof currency === 'string' &&
            currency.length === 3,
        )
        .map((currency) =>
          currency.toUpperCase(),
        ),
    ),
  ];

  /**
   * Global comparison:
   * normalize every comparison-market currency into USD space.
   */
  if (
    intent.objective === 'compare'
  ) {
    const targets = currencies.filter(
      (currency) =>
        currency !== 'USD',
    );

    return {
      base: 'USD',
      targets:
        targets.length > 0
          ? targets
          : ['USD'],
    };
  }

  /**
   * Explicit FX command:
   * preserve parser-selected base when possible.
   */
  const base =
    currencies[0] ??
    'USD';

  const targets = currencies
    .filter(
      (currency) =>
        currency !== base,
    );

  return {
    base,
    targets:
      targets.length > 0
        ? targets
        : ['USD'],
  };
}

/**
 * Converts provider FX records into engine input shape.
 */
function engineFxRates(
  rates: FxRate[],
) {
  return rates.map((rate) => ({
    base_currency:
      rate.base_currency,

    quote_currency:
      rate.quote_currency,

    rate: rate.rate,

    source:
      rate.source ??
      'fx',

    data_status:
      rate.data_status,

    confidence:
      rate.confidence,

    observation_date:
      rate.observation_date,
  }));
}

/**
 * Comparison-aware workflow scope for persistence/reporting.
 */
function buildScope(
  intent: ExtendedIntent,
) {
  return {
    commodity:
      intent.commodity,

    origin:
      intent.origin,

    destination:
      intent.destination,

    city:
      intent.city,

    objective:
      intent.objective,

    comparisonMarkets:
      intent.comparisonMarkets ??
      [],

    comparisonContext:
      intent.comparisonContext ??
      null,
  };
}

/**
 * Compare workflows do not automatically create
 * opportunity/import evaluations.
 *
 * Evaluation is designed for "Should we enter/import this market?"
 * rather than "Which market is cheaper?"
 */
function shouldRunEvaluation(
  intent: ExtendedIntent,
): boolean {
  if (
    !intent.commodity
  ) {
    return false;
  }

  if (
    intent.objective === 'compare'
  ) {
    return false;
  }

  return true;
}

export async function runAgent(
  command: string,
  opts: RunOptions = {},
): Promise<AgentResult> {
  const steps: WorkflowStep[] = [];

  const onStep =
    opts.onStep ??
    (() => {});

  const emit = (
    step: string,
    status: WorkflowStep['status'],
    detail?: string,
  ) => {
    const workflowStep: WorkflowStep = {
      step,
      status,
      detail,

      started_at:
        status === 'running'
          ? nowIso()
          : undefined,

      completed_at:
        status === 'done' ||
        status === 'error' ||
        status === 'skipped'
          ? nowIso()
          : undefined,
    };

    steps.push(
      workflowStep,
    );

    onStep(
      workflowStep,
    );
  };

  /* ---------------------------------------------------------------------- */
  /* STEP 1 — UNDERSTAND                                                     */
  /* ---------------------------------------------------------------------- */

  emit(
    'Understand command',
    'running',
  );

  const intent: ParsedIntent =
    parseCommand(command);

  const extendedIntent =
    getExtendedIntent(intent);

  const comparisonMarkets =
    extendedIntent.comparisonMarkets ??
    [];

  const comparisonContext =
    extendedIntent.comparisonContext ??
    null;

  const understandDetail =
    extendedIntent.objective === 'compare' &&
    comparisonMarkets.length >= 2
      ? [
          `Commodity: ${extendedIntent.commodity ?? 'n/a'}`,
          'Origin: n/a',
          `Destination: ${extendedIntent.destination ?? 'n/a'}`,
          `City: ${extendedIntent.city ?? 'n/a'}`,
          'Objective: compare',
          `Comparison: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}`,
          `Context: ${comparisonContext ?? 'global'}`,
        ].join(' | ')
      : [
          `Commodity: ${extendedIntent.commodity ?? 'n/a'}`,
          `Origin: ${extendedIntent.origin ?? 'n/a'}`,
          `Destination: ${extendedIntent.destination ?? 'n/a'}`,
          `City: ${extendedIntent.city ?? 'n/a'}`,
          `Objective: ${extendedIntent.objective}`,
        ].join(' | ');

  emit(
    'Understand command',
    'done',
    understandDetail,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 2 — INFER                                                          */
  /* ---------------------------------------------------------------------- */

  emit(
    'Infer missing parameters',
    'done',
    extendedIntent.assumptions.length
      ? extendedIntent.assumptions.join('; ')
      : 'No assumptions needed.',
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 3 — PLAN                                                            */
  /* ---------------------------------------------------------------------- */

  let planDetail =
    `Objective: ${extendedIntent.objective}`;

  if (
    extendedIntent.objective === 'compare' &&
    comparisonMarkets.length >= 2
  ) {
    planDetail = [
      'Objective: compare',
      `Markets: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}`,
      `Context: ${comparisonContext ?? 'global'}`,
      'Import route: none',
      'Price scope: comparison markets only',
    ].join(' | ');
  }

  emit(
    'Plan research workflow',
    'done',
    planDetail,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 4 — WEB RESEARCH                                                   */
  /* ---------------------------------------------------------------------- */

  emit(
    'Web research',
    'running',
  );

  const researchQuery =
    buildResearchQuery(
      command,
      extendedIntent,
    );

  const researchResp =
    await edgeResearchProvider.search(
      researchQuery,
      8,
    );

  emit(
    'Web research',
    researchResp.status === 'OK'
      ? 'done'
      : 'skipped',
    researchResp.status === 'OK'
      ? `${researchResp.results.length} results`
      : (
          researchResp.message ??
          researchResp.status
        ),
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 5 — STORED MARKET DATA                                             */
  /* ---------------------------------------------------------------------- */

  emit(
    'Collect stored market data',
    'running',
  );

  let rawMarketRows: RawMarketRow[] =
    [];

  if (
    extendedIntent.commodity
  ) {
    const result =
      await storedMarketDataProvider.listForCommodity(
        extendedIntent.commodity,
        100,
      );

    rawMarketRows =
      result.data as RawMarketRow[];
  } else {
    const result =
      await storedMarketDataProvider.listRecent(
        100,
      );

    rawMarketRows =
      result.data as RawMarketRow[];
  }

  /**
   * CRITICAL:
   * For comparisons, remove destination/context observations
   * such as Kabul when they are not one of the comparison markets.
   */
  const marketRows =
    scopeMarketRows(
      rawMarketRows,
      extendedIntent,
    );

  const removedRows =
    rawMarketRows.length -
    marketRows.length;

  const marketDetail =
    extendedIntent.objective === 'compare' &&
    comparisonMarkets.length >= 2
      ? `${marketRows.length} comparison observation(s); ${removedRows} out-of-scope observation(s) excluded`
      : `${marketRows.length} observation(s)`;

  emit(
    'Collect stored market data',
    'done',
    marketDetail,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 6 — STOCK & SHIPMENT INTELLIGENCE                                  */
  /* ---------------------------------------------------------------------- */

  emit(
    'Collect stock & shipment intelligence',
    'running',
  );

  const [
    stockResp,
    shipmentResp,
  ] = await Promise.all([
    stockProvider.listForCommodity(
      extendedIntent.commodity ?? '',
      200,
    ),

    shipmentsProvider.listForCommodity(
      extendedIntent.commodity ?? '',
      200,
    ),
  ]);

  const stockRows =
    stockResp.data;

  const shipmentRows =
    shipmentResp.data;

  emit(
    'Collect stock & shipment intelligence',
    'done',
    `${stockRows.length} stock record(s), ${shipmentRows.length} shipment/wagon record(s)`,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 7 — FX                                                              */
  /* ---------------------------------------------------------------------- */

  emit(
    'Collect FX rates',
    'running',
  );

  const fxRequest =
    buildFxRequest(
      extendedIntent,
    );

  const fxResp =
    await edgeFxProvider.fetchRates(
      fxRequest.base,
      fxRequest.targets,
    );

  const liveFx: FxRate[] =
    fxResp.rates;

  if (
    liveFx.length > 0
  ) {
    await storedFxProvider.insertBatch(
      liveFx,
    );
  }

  const fxMsg =
    (
      fxResp as {
        message?: string;
      }
    ).message;

  emit(
    'Collect FX rates',
    fxResp.status === 'OK'
      ? 'done'
      : 'skipped',
    fxResp.status === 'OK'
      ? `${liveFx.length} rates; base ${fxRequest.base}`
      : (
          fxMsg ??
          fxResp.status
        ),
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 8 — VERIFY                                                          */
  /* ---------------------------------------------------------------------- */

  emit(
    'Verify sources & freshness',
    'done',
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 9 — NORMALIZE / COMPARE / ANALYZE                                  */
  /* ---------------------------------------------------------------------- */

  emit(
    'Normalize & analyze',
    'running',
  );

  const commonEngineInput:
    EngineInput = {
      commodity:
        extendedIntent.commodity,

      origin:
        extendedIntent.origin,

      destination:
        extendedIntent.destination,

      city:
        extendedIntent.city,

      currencies:
        extendedIntent.currencies,

      marketRows,

      fxRates:
        engineFxRates(
          liveFx,
        ),

      researchResults:
        researchResp.results,

      stockRows,

      shipmentRows,

      researchStatus:
        researchResp.status as
          EngineInput['researchStatus'],

      researchMessage:
        researchResp.message,

      /**
       * Comparison metadata is passed through at runtime.
       *
       * Older EngineInput definitions may not declare these fields yet,
       * so they are attached using a narrow structural cast.
       */
    };

  const comparisonEngineInput =
    commonEngineInput as EngineInput & {
      comparisonMarkets?: string[];
      comparisonContext?: string | null;
      objective?: string;
    };

  comparisonEngineInput.comparisonMarkets =
    comparisonMarkets;

  comparisonEngineInput.comparisonContext =
    comparisonContext;

  comparisonEngineInput.objective =
    extendedIntent.objective;

  const findings: ResearchFindings =
    buildFindings(
      comparisonEngineInput,
    );

  emit(
    'Normalize & analyze',
    'done',
    `Sentiment: ${findings.sentiment} | Recommendation: ${findings.recommendation}`,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 10 — RECOMMEND                                                      */
  /* ---------------------------------------------------------------------- */

  emit(
    'Generate recommendation',
    'done',
    findings.recommendation,
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 11 — REPORT                                                          */
  /* ---------------------------------------------------------------------- */

  emit(
    'Generate report',
    'running',
  );

  let evaluation:
    EvaluationResult | null =
      null;

  /**
   * IMPORTANT:
   * Pure comparisons should not receive an import/opportunity score.
   *
   * "Which market is cheaper?"
   * is not the same question as
   * "Should we import this commodity?"
   */
  if (
    shouldRunEvaluation(
      extendedIntent,
    )
  ) {
    evaluation =
      evaluationEngine(
        comparisonEngineInput,
        findings,
      );
  }

  const reportMarkdown =
    generateReport(
      intent,
      findings,
      evaluation,
    );

  emit(
    'Generate report',
    'done',
  );

  /* ---------------------------------------------------------------------- */
  /* STEP 12 — SAVE                                                           */
  /* ---------------------------------------------------------------------- */

  emit(
    'Save research & report',
    'running',
  );

  const scope =
    buildScope(
      extendedIntent,
    );

  const ins =
    await researchMemoryProvider.insert({
      command:
        extendedIntent.raw,

      parsed_intent:
        extendedIntent,

      workflow_steps:
        steps.map(
          (step) => ({
            step:
              step.step,

            status:
              step.status,

            detail:
              step.detail,
          }),
        ),

      findings,

      recommendation:
        findings.recommendation,

      language:
        'en',
    });

  const researchId =
    ins.id ??
    undefined;

  let reportId:
    string | undefined;

  if (
    researchId
  ) {
    const repIns =
      await reportsProvider.insert({
        report_type:
          reportTypeForObjective(
            extendedIntent.objective,
          ),

        title:
          reportTitle(
            extendedIntent,
          ),

        scope,

        content_markdown:
          reportMarkdown,

        content_json:
          {
            findings,

            objective:
              extendedIntent.objective,

            comparisonMarkets,
            comparisonContext,

            scope,
          } as Record<
            string,
            unknown
          >,

        language:
          'en',

        research_id:
          researchId,
      });

    reportId =
      repIns.id ??
      undefined;
  }

  /* ---------------------------------------------------------------------- */
  /* ALERTS                                                                   */
  /* ---------------------------------------------------------------------- */

  for (
    const anomaly
    of findings.anomalies
  ) {
    await alertsProvider.insert({
      alert_type:
        anomaly.type,

      severity:
        anomaly.severity,

      title:
        anomaly.type,

      detail:
        anomaly.description,

      commodity:
        extendedIntent.commodity ??
        null,

      /**
       * For comparison alerts there is no fictional
       * single country. Use context only when available.
       */
      country:
        extendedIntent.objective === 'compare'
          ? (
              comparisonContext ??
              null
            )
          : (
              extendedIntent.destination ??
              extendedIntent.origin ??
              null
            ),

      city:
        extendedIntent.city ??
        null,

      acknowledged:
        false,
    });
  }

  for (
    const conflict
    of findings.conflicts
  ) {
    await alertsProvider.insert({
      alert_type:
        'Conflicting sources',

      severity:
        'MEDIUM',

      title:
        'Conflicting Sources Detected',

      detail:
        conflict,

      commodity:
        extendedIntent.commodity ??
        null,

      country:
        extendedIntent.objective === 'compare'
          ? (
              comparisonContext ??
              null
            )
          : (
              extendedIntent.destination ??
              extendedIntent.origin ??
              null
            ),

      city:
        extendedIntent.city ??
        null,

      acknowledged:
        false,
    });
  }

  emit(
    'Save research & report',
    'done',
    researchId
      ? 'Saved'
      : 'Save failed',
  );

  /* ---------------------------------------------------------------------- */
  /* EVALUATION SAVE                                                         */
  /* ---------------------------------------------------------------------- */

  if (
    evaluation
  ) {
    await evaluationProvider.insert({
      commodity:
        evaluation.commodity,

      origin:
        evaluation.origin,

      destination:
        evaluation.destination,

      city:
        evaluation.city,

      opportunity_score:
        evaluation.opportunity_score,

      demand_assessment:
        evaluation.demand_assessment,

      supply_assessment:
        evaluation.supply_assessment,

      competition_assessment:
        evaluation.competition_assessment,

      price_attractiveness:
        evaluation.price_attractiveness,

      logistics_feasibility:
        evaluation.logistics_feasibility,

      market_sentiment:
        evaluation.market_sentiment,

      risk_assessment:
        evaluation.risk_assessment,

      confidence_level:
        evaluation.confidence_level,

      recommendation:
        evaluation.recommendation,

      key_reasons:
        evaluation.key_reasons,

      data_gaps:
        evaluation.data_gaps,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* STEP 13 — DELIVER                                                        */
  /* ---------------------------------------------------------------------- */

  emit(
    'Deliver intelligence',
    'done',
  );

  return {
    intent,
    steps,
    findings,
    reportMarkdown,
    researchId,
    reportId,
    evaluation:
      evaluation ??
      undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* REPORT HELPERS                                                             */
/* -------------------------------------------------------------------------- */

function reportTypeForObjective(
  objective: string,
): string {
  switch (objective) {
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

function reportTitle(
  intent: ExtendedIntent,
): string {
  const comparisonMarkets =
    intent.comparisonMarkets ??
    [];

  if (
    intent.objective === 'compare' &&
    comparisonMarkets.length >= 2
  ) {
    return [
      intent.commodity ??
        'Market',

      'Comparison',

      `${comparisonMarkets[0]} vs ${comparisonMarkets[1]}`,
    ].join(' — ');
  }

  return [
    intent.commodity ??
      'Market',

    'Intelligence',

    new Date().toLocaleDateString(),
  ].join(' — ');
}
