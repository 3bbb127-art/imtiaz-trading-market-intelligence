import type {
  PricePoint,
  LandedCostBreakdown,
  LandedCostComponent,
  ResearchFindings,
  Forecast,
  Anomaly,
  DataSource,
  DemandIntelligence,
  DemandSignal,
  EvaluationResult,
  SupplyLevel,
  DemandLevel,
  SentimentLevel,
  Confidence,
  Freshness,
  DataStatus,
  Recommendation,
  ResearchProviderResult,
  MarketData,
  Shipment,
  StockRecord,
} from '../lib/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const INSUFFICIENT =
  'INSUFFICIENT VERIFIED DATA — analysis limited by data gaps.';

const RESEARCH_CURRENCIES = new Set([
  'USD',
  'AFN',
  'PKR',
  'INR',
  'RUB',
  'EUR',
  'CNY',
  'VND',
  'THB',
  'KZT',
  'TRY',
  'IRR',
  'AED',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'SAR',
  'QAR',
]);

const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1,
  AFN: 0.014,
  PKR: 0.0036,
  INR: 0.012,
  RUB: 0.011,
  EUR: 1.08,
  CNY: 0.14,
  VND: 0.00004,
  THB: 0.028,
  KZT: 0.0022,
  TRY: 0.031,
  IRR: 0.000024,
  AED: 0.27,
  GBP: 1.27,
  JPY: 0.0068,
  CAD: 0.74,
  AUD: 0.66,
  CHF: 1.12,
  SAR: 0.267,
  QAR: 0.274,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RawMarketRow extends MarketData {
  buying_selling_behavior?: string | null;
  new_arrivals?: string | null;
  market_sentiment?: string | null;
  risks_problems?: string | null;
  collector?: string | null;
}

export interface EngineInput {
  commodity: string | null;
  origin: string | null;
  destination: string | null;
  city: string | null;

  /**
   * Comparison metadata is optional for backward compatibility.
   */
  comparisonMarkets?: string[];
  comparisonContext?: string | null;

  /**
   * The executor can pass the objective explicitly.
   */
  objective?: string;

  currencies: string[];

  marketRows: RawMarketRow[];

  fxRates: {
    base_currency: string;
    quote_currency: string;
    rate: number;
    source: string;
    data_status: DataStatus;
    confidence: Confidence;
    observation_date: string;
  }[];

  researchResults: ResearchProviderResult[];
  stockRows: StockRecord[];
  shipmentRows: Shipment[];

  researchStatus:
    | 'OK'
    | 'ERROR'
    | 'NO_PROVIDER';

  researchMessage?: string;
}

// -----------------------------------------------------------------------------
// Generic helpers
// -----------------------------------------------------------------------------

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeEntity(value: unknown): string {
  return normalizeText(value);
}

function escapeRegex(value: string): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function titleCase(value: string): string {
  return value.replace(
    /\b\w/g,
    (char) => char.toUpperCase(),
  );
}

function confidenceRank(
  confidence: Confidence,
): number {
  return CONFIDENCE_RANK[
    confidence
  ] ?? 0;
}

// -----------------------------------------------------------------------------
// Comparison scope helpers
// -----------------------------------------------------------------------------

function getComparisonMarkets(
  input: EngineInput,
): string[] {
  return [
    ...new Set(
      (input.comparisonMarkets ?? [])
        .map(normalizeText)
        .filter(Boolean),
    ),
  ];
}

function isComparisonWorkflow(
  input: EngineInput,
): boolean {
  return (
    input.objective === 'compare' &&
    getComparisonMarkets(input).length >= 2
  );
}

function entityVariants(
  entity: string,
): string[] {
  const normalized =
    normalizeEntity(entity);

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
    variants.add('u.s.a.');
  }

  if (normalized === 'united arab emirates') {
    variants.add('uae');
    variants.add('emirates');
  }

  if (normalized === 'united kingdom') {
    variants.add('uk');
    variants.add('gb');
    variants.add('britain');
  }

  if (normalized === 'vietnam') {
    variants.add('vietnamese');
  }

  return [...variants];
}

function entityMatchesText(
  entity: string,
  text: string,
): boolean {
  const normalizedText =
    normalizeEntity(text);

  if (!normalizedText) {
    return false;
  }

  return entityVariants(entity).some(
    (variant) => {
      const pattern = new RegExp(
        `\\b${escapeRegex(variant)}\\b`,
        'i',
      );

      return pattern.test(
        normalizedText,
      );
    },
  );
}

function rowMatchesComparisonMarket(
  row: RawMarketRow,
  comparisonMarkets: string[],
): boolean {
  if (
    comparisonMarkets.length < 2
  ) {
    return true;
  }

  const values = [
    row.country,
    row.origin,
    row.city,
    row.market,
  ].filter(Boolean);

  return comparisonMarkets.some(
    (market) =>
      values.some(
        (value) =>
          entityMatchesText(
            market,
            String(value),
          ),
      ),
  );
}

function scopeMarketRowsForComparison(
  rows: RawMarketRow[],
  input: EngineInput,
): RawMarketRow[] {
  if (
    !isComparisonWorkflow(input)
  ) {
    return rows;
  }

  const markets =
    getComparisonMarkets(input);

  return rows.filter(
    (row) =>
      rowMatchesComparisonMarket(
        row,
        markets,
      ),
  );
}

function researchResultMatchesComparison(
  result: ResearchProviderResult,
  comparisonMarkets: string[],
): boolean {
  const text =
    `${result.title} ${result.snippet}`;

  return comparisonMarkets.some(
    (market) =>
      entityMatchesText(
        market,
        text,
      ),
  );
}

function scopeResearchResults(
  input: EngineInput,
): ResearchProviderResult[] {
  if (
    !isComparisonWorkflow(input)
  ) {
    return input.researchResults;
  }

  const comparisonMarkets =
    getComparisonMarkets(input);

  const scoped =
    input.researchResults.filter(
      (result) =>
        researchResultMatchesComparison(
          result,
          comparisonMarkets,
        ),
    );

  /**
   * Never invent scope.
   *
   * If no result can be directly tied to a
   * comparison market, return zero scoped results
   * instead of treating unrelated global research
   * as comparison evidence.
   */
  return scoped;
}

// -----------------------------------------------------------------------------
// Research unit and FX normalization
// -----------------------------------------------------------------------------

function normalizeResearchUnit(
  raw: string,
): string | null {
  const unit =
    raw.toLowerCase().trim();

  if (
    unit === 'kg' ||
    unit === 'kilo' ||
    unit === 'kilogram'
  ) {
    return 'kg';
  }

  if (
    unit === 'ton' ||
    unit === 'tonne' ||
    unit === 'mt' ||
    unit === 'metric ton'
  ) {
    return 'MT';
  }

  if (unit === 'bag') {
    return 'bag';
  }

  if (
    unit === 'lb' ||
    unit === 'pound'
  ) {
    return 'lb';
  }

  if (
    unit === 'litre' ||
    unit === 'liter'
  ) {
    return 'litre';
  }

  return null;
}

function getUsdFxRate(
  currency: string,
  fxRates: EngineInput['fxRates'],
): {
  rate: number | null;
  estimated: boolean;
} {
  const code =
    currency.toUpperCase();

  if (code === 'USD') {
    return {
      rate: 1,
      estimated: false,
    };
  }

  const direct =
    fxRates.find(
      (fx) =>
        fx.base_currency.toUpperCase() ===
          code &&
        fx.quote_currency.toUpperCase() ===
          'USD' &&
        fx.rate > 0,
    );

  if (direct) {
    return {
      rate: direct.rate,
      estimated: false,
    };
  }

  const inverse =
    fxRates.find(
      (fx) =>
        fx.base_currency.toUpperCase() ===
          'USD' &&
        fx.quote_currency.toUpperCase() ===
          code &&
        fx.rate > 0,
    );

  if (inverse) {
    return {
      rate: 1 / inverse.rate,
      estimated: false,
    };
  }

  const fallback =
    FALLBACK_USD_RATES[code];

  if (
    fallback != null &&
    fallback > 0
  ) {
    return {
      rate: fallback,
      estimated: true,
    };
  }

  return {
    rate: null,
    estimated: false,
  };
}

function normalizeToUsdPerMt(
  price: number | null,
  currency: string | null,
  unit: string | null,
): number | null {
  if (
    price == null ||
    !currency ||
    !unit
  ) {
    return null;
  }

  const fx =
    getUsdFxRate(
      currency,
      [],
    ).rate;

  if (
    fx == null ||
    !Number.isFinite(fx)
  ) {
    return null;
  }

  const usd =
    price * fx;

  switch (
    unit.toLowerCase()
  ) {
    case 'kg':
    case 'kilo':
    case 'kilogram':
      return usd * 1000;

    case 'ton':
    case 'tonne':
    case 'mt':
    case 'metric ton':
      return usd;

    case 'lb':
    case 'pound':
      return usd * 2204.62;

    case 'bag':
    case 'litre':
    case 'liter':
      return null;

    default:
      return null;
  }
}

function normalizeToUsdPerMtWithFx(
  price: number | null,
  currency: string | null,
  unit: string | null,
  fxRates: EngineInput['fxRates'],
): number | null {
  if (
    price == null ||
    !currency ||
    !unit
  ) {
    return null;
  }

  const fx =
    getUsdFxRate(
      currency,
      fxRates,
    ).rate;

  if (
    fx == null ||
    !Number.isFinite(fx)
  ) {
    return null;
  }

  const usd =
    price * fx;

  switch (
    unit.toLowerCase()
  ) {
    case 'kg':
    case 'kilo':
    case 'kilogram':
      return usd * 1000;

    case 'ton':
    case 'tonne':
    case 'mt':
    case 'metric ton':
      return usd;

    case 'lb':
    case 'pound':
      return usd * 2204.62;

    case 'bag':
    case 'litre':
    case 'liter':
      return null;

    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Operational intelligence
// -----------------------------------------------------------------------------

function buildOperationalIntelligence(
  input: EngineInput,
) {
  const rows =
    input.commodity
      ? input.stockRows.filter(
          (row) =>
            row.commodity?.toLowerCase() ===
            input.commodity!.toLowerCase(),
        )
      : input.stockRows;

  const shipments =
    input.commodity
      ? input.shipmentRows.filter(
          (row) =>
            row.commodity?.toLowerCase() ===
            input.commodity!.toLowerCase(),
        )
      : input.shipmentRows;

  const sum = (
    field: keyof StockRecord,
  ) =>
    rows.reduce(
      (total, row) =>
        total +
        (Number(
          row[field] ?? 0,
        ) || 0),
      0,
    );

  const dates =
    rows
      .map(
        (row) =>
          row.update_date,
      )
      .filter(Boolean)
      .sort();

  const latest =
    dates.length > 0
      ? dates[dates.length - 1]
      : null;

  const unit =
    rows.find(
      (row) => row.unit,
    )?.unit ??
    shipments.find(
      (row) => row.unit,
    )?.unit ??
    null;

  const status =
    shipments.reduce(
      (acc, shipment) => {
        const key =
          (
            shipment.status ||
            'Planned'
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              '_',
            );

        if (
          key.includes('transit')
        ) {
          acc.in_transit += 1;
        } else if (
          key.includes('arriv')
        ) {
          acc.arrived += 1;
        } else if (
          key.includes('delay')
        ) {
          acc.delayed += 1;
        } else if (
          key.includes('cancel')
        ) {
          acc.cancelled += 1;
        } else {
          acc.planned += 1;
        }

        return acc;
      },
      {
        in_transit: 0,
        arrived: 0,
        delayed: 0,
        cancelled: 0,
        planned: 0,
      },
    );

  const nextEta =
    shipments
      .map(
        (shipment) =>
          shipment.expected_arrival,
      )
      .filter(Boolean)
      .sort()[0] ??
    null;

  const inTransitQty =
    shipments
      .filter(
        (shipment) =>
          /transit/i.test(
            shipment.status,
          ),
      )
      .reduce(
        (total, shipment) =>
          total +
          (
            Number(
              shipment.quantity ??
                0,
            ) || 0
          ),
        0,
      );

  const expectedQty =
    shipments
      .filter(
        (shipment) =>
          /planned|transit|delay/i.test(
            shipment.status,
          ),
      )
      .reduce(
        (total, shipment) =>
          total +
          (
            Number(
              shipment.quantity ??
                0,
            ) || 0
          ),
        0,
      );

  const summary = [
    `${rows.length} stock record(s)`,

    `available ${
      rows.length > 0
        ? `${sum('available_stock')}${
            unit ? ` ${unit}` : ''
          }`
        : 'UNKNOWN'
    }`,

    `in-transit stock ${
      rows.length > 0
        ? `${sum('in_transit_stock')}${
            unit ? ` ${unit}` : ''
          }`
        : 'UNKNOWN'
    }`,

    `expected incoming ${
      rows.length > 0
        ? `${sum('expected_incoming')}${
            unit ? ` ${unit}` : ''
          }`
        : 'UNKNOWN'
    }`,

    `${shipments.length} shipment/wagon record(s)`,

    `${status.in_transit} in transit`,

    `${status.delayed} delayed`,

    nextEta
      ? `next ETA ${nextEta}`
      : 'no ETA recorded',
  ].join('; ');

  return {
    stock: {
      available:
        sum('available_stock'),
      reserved:
        sum('reserved_stock'),
      in_transit:
        sum('in_transit_stock'),
      expected_incoming:
        sum('expected_incoming'),
      unit,
      record_count:
        rows.length,
      latest_update:
        latest,
    },

    shipments: {
      total:
        shipments.length,
      in_transit:
        status.in_transit,
      arrived:
        status.arrived,
      delayed:
        status.delayed,
      planned:
        status.planned,
      cancelled:
        status.cancelled,
      quantity_in_transit:
        inTransitQty,
      expected_quantity:
        expectedQty,
      unit,
      next_eta:
        nextEta,
    },

    summary,
  };
}

// -----------------------------------------------------------------------------
// Freshness
// -----------------------------------------------------------------------------

function freshnessOf(
  dateStr?: string | null,
): Freshness {
  if (!dateStr) {
    return 'UNKNOWN';
  }

  const date =
    new Date(dateStr);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'UNKNOWN';
  }

  const days =
    (
      Date.now() -
      date.getTime()
    ) /
    86400000;

  if (days <= 7) {
    return 'CURRENT';
  }

  if (days <= 30) {
    return 'RECENT';
  }

  return 'STALE';
}

// -----------------------------------------------------------------------------
// Supply / Demand mapping
// -----------------------------------------------------------------------------

function mapSupply(
  row: RawMarketRow,
): SupplyLevel | null {
  const supply =
    (
      row.supply ?? ''
    ).toLowerCase();

  if (!supply) {
    return null;
  }

  if (
    /critical|severe|acute|crisis|famine|starvation/.test(
      supply,
    )
  ) {
    return 'Critical';
  }

  if (
    /shortage|tight|disrupt|low|deplet|scarce|constrain|insufficient|fail|poor harvest|export ban|restriction/.test(
      supply,
    )
  ) {
    return 'Tight';
  }

  if (
    /abundant|surplus|oversupply|bumper|record|high production|excess|glut|ample|overproduction/.test(
      supply,
    )
  ) {
    return 'High';
  }

  if (
    /adequate|sufficient|normal|stable|steady|available|in stock/.test(
      supply,
    )
  ) {
    return 'Normal';
  }

  return null;
}

function mapDemand(
  row: RawMarketRow,
): DemandLevel | null {
  const demand =
    (
      row.demand ?? ''
    ).toLowerCase();

  if (!demand) {
    return null;
  }

  if (
    /surg|soaring|skyrocket|explosive|spike/.test(
      demand,
    )
  ) {
    return 'Surging';
  }

  if (
    /strong|robust|high|increasing|rising|growing|grew/.test(
      demand,
    )
  ) {
    return 'Strong';
  }

  if (
    /weak|low|declining|falling|dropping|sluggish|soft|reduced/.test(
      demand,
    )
  ) {
    return 'Weak';
  }

  if (
    /normal|stable|steady|moderate/.test(
      demand,
    )
  ) {
    return 'Normal';
  }

  return null;
}

// -----------------------------------------------------------------------------
// Web supply / demand classification
// -----------------------------------------------------------------------------

function classifySupplyFromText(
  text: string,
): SupplyLevel | null {
  const value =
    text.toLowerCase();

  if (
    /\b(severe shortage|critical shortage|acute shortage|supply crisis|humanitarian aid|emergency supplies|famine|starvation)\b/.test(
      value,
    )
  ) {
    return 'Critical';
  }

  if (
    /\b(shortage|tight supply|supply disruption|low stocks?|depleted|scarce|constrained|insufficient supply|supply shortfall|crop failure|failed harvest|poor harvest|reduced harvest|lower production|declining production|production decline|export ban|export restriction)\b/.test(
      value,
    )
  ) {
    return 'Tight';
  }

  if (
    /\b(abundant|surplus|oversupply|bumper harvest|record (?:production|harvest|crop)|high production|excess supply|glut|stocks? (?:high|rising|ample)|ample supplies|overproduction|increased production|rising production|higher production|good harvest|strong harvest)\b/.test(
      value,
    )
  ) {
    return 'High';
  }

  if (
    /\b(adequate suppl(?:y|ies)|supplies? (?:remained?|are|were) (?:adequate|sufficient|normal|stable)|normal supply|stable supply|sufficient supply|steady supply|ample|available|in stock|stocks? (?:normal|stable|adequate)|harvest (?:normal|on track|progressing))\b/.test(
      value,
    )
  ) {
    return 'Normal';
  }

  return null;
}

function classifyDemandFromText(
  text: string,
): DemandLevel | null {
  const value =
    text.toLowerCase();

  if (
    /\b(surg(?:e|ing)|soaring|explosive demand|skyrocket|surge in demand|sharp increase in demand|spike in demand)\b/.test(
      value,
    )
  ) {
    return 'Surging';
  }

  if (
    /\b(demand (?:increased|increasing|rising|grew|strong|robust|high)|strong demand|robust demand|high demand|rising consumption|increased consumption|growing consumption|buying activity (?:increased|strong|high)|import demand (?:increased|rising|strong)|household demand (?:increased|strong)|industrial demand (?:increased|strong|rising)|higher consumption|strong (?:purchases|buying))\b/.test(
      value,
    )
  ) {
    return 'Strong';
  }

  if (
    /\b(demand (?:decreased|declining|falling|weak|low|dropped)|weak demand|low demand|sluggish demand|soft demand|falling consumption|declining consumption|reduced consumption|lower demand|weak (?:purchases|buying)|decreased consumption)\b/.test(
      value,
    )
  ) {
    return 'Weak';
  }

  if (
    /\b(normal demand|stable demand|steady demand|moderate demand|demand (?:stable|steady|normal|remained? stable)|demand (?:remains?|is) (?:strong|steady|stable))\b/.test(
      value,
    )
  ) {
    return 'Normal';
  }

  if (
    /demand\b[^.]{0,40}\b(?:strong|robust|high|rising|increasing|growing)\b/.test(
      value,
    )
  ) {
    return 'Strong';
  }

  if (
    /demand\b[^.]{0,40}\b(?:weak|low|declining|falling|decreasing)\b/.test(
      value,
    )
  ) {
    return 'Weak';
  }

  return null;
}

interface ResearchSignal {
  level:
    | SupplyLevel
    | DemandLevel;

  source: string;
  url: string;
  confidence: Confidence;
}

function extractSupplyDemandFromResearch(
  input: EngineInput,
): {
  supplySignals: ResearchSignal[];
  demandSignals: ResearchSignal[];
} {
  const supplySignals:
    ResearchSignal[] = [];

  const demandSignals:
    ResearchSignal[] = [];

  const research =
    scopeResearchResults(input);

  for (
    const result of research
  ) {
    const text =
      `${result.title} ${result.snippet}`;

    const supply =
      classifySupplyFromText(
        text,
      );

    if (supply) {
      supplySignals.push({
        level: supply,

        source:
          result.title ||
          result.url,

        url:
          result.url,

        confidence:
          supply === 'Normal'
            ? 'MEDIUM'
            : 'LOW',
      });
    }

    const demand =
      classifyDemandFromText(
        text,
      );

    if (demand) {
      demandSignals.push({
        level: demand,

        source:
          result.title ||
          result.url,

        url:
          result.url,

        confidence:
          demand === 'Normal'
            ? 'MEDIUM'
            : 'LOW',
      });
    }
  }

  return {
    supplySignals,
    demandSignals,
  };
}

function resolveSignals(
  signals: ResearchSignal[],
  kind:
    | 'supply'
    | 'demand',
): {
  level:
    | SupplyLevel
    | DemandLevel;

  evidence: string[];
  conflict: boolean;
} {
  if (
    signals.length === 0
  ) {
    return {
      level: 'Unknown',
      evidence: [],
      conflict: false,
    };
  }

  const rank =
    (
      level:
        | SupplyLevel
        | DemandLevel,
    ): number => {
      switch (level) {
        case 'Critical':
          return 1;

        case 'Tight':
          return 2;

        case 'Weak':
          return 2;

        case 'Normal':
          return 3;

        case 'Strong':
          return 4;

        case 'Surging':
          return 5;

        case 'High':
          return 5;

        default:
          return 0;
      }
    };

  const grouped =
    new Map<
      string,
      ResearchSignal[]
    >();

  for (
    const signal of signals
  ) {
    const key =
      String(signal.level);

    const list =
      grouped.get(key) ??
      [];

    list.push(signal);

    grouped.set(
      key,
      list,
    );
  }

  const uniqueLevels =
    [...grouped.keys()];

  if (
    uniqueLevels.length > 1
  ) {
    return {
      level: 'Unknown',
      evidence:
        signals.map(
          (signal) =>
            `Conflicting ${kind} signals: ${signal.level} — ${signal.source} (${signal.url})`,
        ),
      conflict: true,
    };
  }

  const best =
    uniqueLevels.sort(
      (a, b) =>
        rank(
          b as SupplyLevel | DemandLevel,
        ) -
        rank(
          a as SupplyLevel | DemandLevel,
        ),
    )[0];

  const evidence =
    signals.map(
      (signal) =>
        `${kind.charAt(0).toUpperCase() + kind.slice(1)} (${best}): ${signal.source} (${signal.url})`,
    );

  return {
    level:
      best as SupplyLevel | DemandLevel,

    evidence,

    conflict: false,
  };
}

// -----------------------------------------------------------------------------
// Price extraction from web research
// -----------------------------------------------------------------------------

function detectResearchLocation(
  text: string,
): string | null {
  const normalized =
    text.toLowerCase();

  const knownCities: Record<
    string,
    string
  > = {
    'mazar-e-sharif':
      'Mazar-e-Sharif',
    'mazar-i-sharif':
      'Mazar-e-Sharif',
    mazar:
      'Mazar-e-Sharif',
    kabul: 'Kabul',
    herat: 'Herat',
    kandahar: 'Kandahar',
    jalalabad:
      'Jalalabad',
    kunduz: 'Kunduz',
    karachi: 'Karachi',
    lahore: 'Lahore',
    islamabad:
      'Islamabad',
    peshawar:
      'Peshawar',
    dubai: 'Dubai',
    almaty: 'Almaty',
    astana: 'Astana',
    moscow: 'Moscow',
    'saint petersburg':
      'Saint Petersburg',
    istanbul:
      'Istanbul',
    tehran: 'Tehran',
    delhi: 'Delhi',
    'new delhi':
      'New Delhi',
    mumbai: 'Mumbai',
    beijing: 'Beijing',
    shanghai: 'Shanghai',
    london: 'London',
    tokyo: 'Tokyo',
    singapore:
      'Singapore',
    'new york':
      'New York',
    chicago: 'Chicago',
    houston: 'Houston',
    frankfurt:
      'Frankfurt',
    hamburg: 'Hamburg',
    rotterdam:
      'Rotterdam',
    paris: 'Paris',
    milan: 'Milan',
    madrid: 'Madrid',
    nairobi: 'Nairobi',
    cairo: 'Cairo',
    lagos: 'Lagos',
    johannesburg:
      'Johannesburg',
    'cape town':
      'Cape Town',
    'sao paulo':
      'Sao Paulo',
    'buenos aires':
      'Buenos Aires',
  };

  const knownCountries:
    Record<
      string,
      string
    > = {
      afghanistan:
        'Afghanistan',
      india: 'India',
      vietnam: 'Vietnam',
      china: 'China',
      pakistan: 'Pakistan',
      thailand: 'Thailand',
      kazakhstan:
        'Kazakhstan',
      russia: 'Russia',
      turkey: 'Turkey',
      uae:
        'United Arab Emirates',
      'united arab emirates':
        'United Arab Emirates',
      iran: 'Iran',
      'united states':
        'United States',
      usa: 'United States',
      us: 'United States',
      indonesia:
        'Indonesia',
      malaysia:
        'Malaysia',
      philippines:
        'Philippines',
      japan: 'Japan',
      australia:
        'Australia',
      canada: 'Canada',
      brazil: 'Brazil',
      argentina:
        'Argentina',
      germany: 'Germany',
      ukraine: 'Ukraine',
      'united kingdom':
        'United Kingdom',
      uk: 'United Kingdom',
      france: 'France',
      italy: 'Italy',
      spain: 'Spain',
      netherlands:
        'Netherlands',
      singapore:
        'Singapore',
      nigeria: 'Nigeria',
      kenya: 'Kenya',
      south africa:
        'South Africa',
      saudi arabia:
        'Saudi Arabia',
      mexico: 'Mexico',
      poland: 'Poland',
      romania:
        'Romania',
      bulgaria:
        'Bulgaria',
      serbia: 'Serbia',
      georgia:
        'Georgia',
      azerbaijan:
        'Azerbaijan',
      uzbekistan:
        'Uzbekistan',
      turkmenistan:
        'Turkmenistan',
      tajikistan:
        'Tajikistan',
      kyrgyzstan:
        'Kyrgyzstan',
      belgium:
        'Belgium',
      austria:
        'Austria',
      switzerland:
        'Switzerland',
      norway: 'Norway',
      sweden: 'Sweden',
      denmark:
        'Denmark',
      finland:
        'Finland',
      portugal:
        'Portugal',
      greece: 'Greece',
      egypt: 'Egypt',
      morocco:
        'Morocco',
      colombia:
        'Colombia',
      chile: 'Chile',
      peru: 'Peru',
      ecuador:
        'Ecuador',
    };

  const cities =
    Object.entries(
      knownCities,
    ).sort(
      ([a], [b]) =>
        b.length -
        a.length,
    );

  for (
    const [
      city,
      display,
    ] of cities
  ) {
    if (
      new RegExp(
        `\\b${escapeRegex(city)}\\b`,
        'i',
      ).test(normalized)
    ) {
      return display;
    }
  }

  const countries =
    Object.entries(
      knownCountries,
    ).sort(
      ([a], [b]) =>
        b.length -
        a.length,
    );

  for (
    const [
      country,
      display,
    ] of countries
  ) {
    if (
      new RegExp(
        `\\b${escapeRegex(country)}\\b`,
        'i',
      ).test(normalized)
    ) {
      return display;
    }
  }

  return null;
}

function extractPricePointsFromResearch(
  input: EngineInput,
): PricePoint[] {
  const points:
    PricePoint[] = [];

  const research =
    scopeResearchResults(input);

  const comparisonMarkets =
    getComparisonMarkets(input);

  const comparison =
    isComparisonWorkflow(input);

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  /**
   * Supported styles:
   *
   * USD 420/MT
   * USD 420 per MT
   * $420/MT
   * €240/MT
   * £240 per tonne
   *
   * The engine deliberately does not guess a unit
   * when no unit is present.
   */
  const priceRegex =
    /(?:(USD|EUR|GBP|RUB|KZT|AFN|PKR|INR|CNY|VND|THB|TRY|IRR|AED|JPY|CAD|AUD|CHF|SAR|QAR)\s*([0-9][\d,]*(?:\.\d+)?)|(\$|€|£)\s*([0-9][\d,]*(?:\.\d+)?))(?:(?:\s*[–-]\s*)(?:([0-9][\d,]*(?:\.\d+)?)))?\s*(?:per\s+|\/\s*)(kg|kilo|kilogram|ton|tonne|mt|metric ton|bag|lb|pound|litre|liter)\b/gi;

  const symbolCurrency: Record<
    string,
    string
  > = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
  };

  for (
    const result of research
  ) {
    const text =
      `${result.title} ${result.snippet}`;

    const lower =
      text.toLowerCase();

    priceRegex.lastIndex = 0;

    let match:
      RegExpExecArray | null;

    while (
      (
        match =
          priceRegex.exec(
            text,
          )
      ) !== null
    ) {
      const currency =
        (
          match[1] ??
          symbolCurrency[
            match[3] ?? ''
          ]
        )?.toUpperCase();

      if (
        !currency ||
        !RESEARCH_CURRENCIES.has(
          currency,
        )
      ) {
        continue;
      }

      const rawPrice =
        match[2] ??
        match[4];

      if (!rawPrice) {
        continue;
      }

      const low =
        Number(
          rawPrice.replace(
            /,/g,
            '',
          ),
        );

      if (
        !Number.isFinite(low) ||
        low <= 0
      ) {
        continue;
      }

      const high =
        match[5]
          ? Number(
              match[5].replace(
                /,/g,
                '',
              ),
            )
          : null;

      const price =
        high != null &&
        Number.isFinite(high)
          ? (
              low +
              high
            ) / 2
          : low;

      const unit =
        normalizeResearchUnit(
          match[6],
        );

      if (!unit) {
        continue;
      }

      const contextBefore =
        lower.slice(
          Math.max(
            0,
            match.index - 220,
          ),
          match.index,
        );

      /**
       * Reject price-change amounts:
       *
       * "fell by USD 10 to USD 220/MT"
       *
       * but preserve a genuine final price if
       * the text structure clearly indicates it.
       */
      const isChangeAmount =
        /\b(?:fell|fallen|dropped|declined|decreased|reduced|down)\b[^.]{0,140}\bby\b[^.]{0,100}(?:usd|eur|gbp|rub|kzt|afn|pkr|inr|cny|vnd|thb|try|irr|aed|jpy|cad|aud|chf|sar|qar|\$|€|£)?\s*[0-9][\d,]*(?:\.\d+)?\s*$/i.test(
          contextBefore,
        );

      if (
        isChangeAmount
      ) {
        continue;
      }

      const locationContext =
        lower.slice(
          Math.max(
            0,
            match.index - 220,
          ),
          Math.min(
            lower.length,
            match.index + 220,
          ),
        );

      const location =
        detectResearchLocation(
          locationContext,
        );

      /**
       * COMPARISON SAFETY RULE:
       *
       * If this is a comparison, the price must
       * be attributable to one of the comparison
       * markets.
       *
       * Ambiguous global prices are rejected.
       */
      if (
        comparison
      ) {
        const attributable =
          location != null &&
          comparisonMarkets.some(
            (market) =>
              entityMatchesText(
                market,
                location,
              ) ||
              entityMatchesText(
                market,
                locationContext,
              ),
          );

        if (
          !attributable
        ) {
          continue;
        }
      }

      const normalized =
        normalizeToUsdPerMtWithFx(
          price,
          currency,
          unit,
          input.fxRates,
        );

      points.push({
        label:
          `${result.title || 'Web research'} — ${
            location ??
            'Web research (global)'
          }`,

        location:
          location ??
          'Web research (global)',

        price,

        currency,

        unit,

        normalized_price_usd:
          normalized,

        normalized_unit:
          'USD/MT',

        source:
          result.url ||
          result.title ||
          'web research',

        data_status:
          'REPORTED',

        confidence:
          'MEDIUM',

        freshness:
          'CURRENT',

        observation_date:
          today,

        note:
          `Extracted from web research${
            high != null
              ? ` (range ${low}–${high}, midpoint used)`
              : ''
          }. Source: ${result.url}`,
      });
    }
  }

  return points;
}

// -----------------------------------------------------------------------------
// Price engine
// -----------------------------------------------------------------------------

export function pricePointEngine(
  input: EngineInput,
): PricePoint[] {
  const points:
    PricePoint[] = [];

  const commodity =
    input.commodity?.toLowerCase();

  const scopedMarketRows =
    scopeMarketRowsForComparison(
      input.marketRows,
      input,
    );

  for (
    const row of scopedMarketRows
  ) {
    if (
      commodity &&
      row.commodity?.toLowerCase() !==
        commodity
    ) {
      continue;
    }

    /**
     * In comparison mode, enforce market scope
     * again at the price-engine boundary.
     */
    if (
      isComparisonWorkflow(input) &&
      !rowMatchesComparisonMarket(
        row,
        getComparisonMarkets(input),
      )
    ) {
      continue;
    }

    const normalized =
      normalizeToUsdPerMtWithFx(
        row.price ?? null,
        row.currency ?? null,
        row.unit ?? null,
        input.fxRates,
      );

    const location =
      [
        row.city,
        row.market,
        row.country,
      ]
        .filter(Boolean)
        .join(', ') ||
      row.country ||
      'Unknown';

    points.push({
      label:
        row.origin
          ? `${row.origin} origin`
          : location,

      location,

      price:
        row.price ?? null,

      currency:
        row.currency ?? null,

      unit:
        row.unit ?? null,

      normalized_price_usd:
        normalized,

      normalized_unit:
        'USD/MT',

      source:
        row.source ??
        'Stored data',

      data_status:
        row.data_status,

      confidence:
        row.confidence,

      freshness:
        freshnessOf(
          row.observation_date,
        ),

      observation_date:
        row.observation_date,

      note:
        row.notes ??
        undefined,
    });
  }

  points.push(
    ...extractPricePointsFromResearch(
      input,
    ),
  );

  points.sort(
    (a, b) => {
      const date =
        (
          b.observation_date ??
          ''
        ).localeCompare(
          a.observation_date ??
          '',
        );

      if (date !== 0) {
        return date;
      }

      return (
        confidenceRank(
          b.confidence,
        ) -
        confidenceRank(
          a.confidence,
        )
      );
    },
  );

  return points;
}

// -----------------------------------------------------------------------------
// Price change
// -----------------------------------------------------------------------------

function comparablePriceChange(
  points: PricePoint[],
): {
  recent: number;
  prior: number;
  change: number;
} | null {
  const valid =
    points.filter(
      (point) =>
        point.normalized_price_usd != null &&
        point.normalized_price_usd > 0 &&
        !!point.location &&
        !!point.observation_date,
    );

  if (
    valid.length < 2
  ) {
    return null;
  }

  const byLocation =
    new Map<
      string,
      PricePoint[]
    >();

  for (
    const point of valid
  ) {
    const key =
      point.location
        .trim()
        .toLowerCase();

    const bucket =
      byLocation.get(key) ??
      [];

    bucket.push(point);

    byLocation.set(
      key,
      bucket,
    );
  }

  for (
    const bucket
    of byLocation.values()
  ) {
    const sorted =
      [...bucket].sort(
        (a, b) =>
          (
            a.observation_date ??
            ''
          ).localeCompare(
            b.observation_date ??
            '',
          ),
      );

    if (
      sorted.length < 2
    ) {
      continue;
    }

    const recent =
      sorted[
        sorted.length - 1
      ];

    const prior =
      [...sorted]
        .reverse()
        .find(
          (point) =>
            point.observation_date !==
            recent.observation_date,
        );

    if (
      prior &&
      recent.normalized_price_usd !=
        null &&
      prior.normalized_price_usd !=
        null &&
      prior.normalized_price_usd > 0
    ) {
      const change =
        (
          recent.normalized_price_usd -
          prior.normalized_price_usd
        ) /
        prior.normalized_price_usd;

      return {
        recent:
          recent.normalized_price_usd,

        prior:
          prior.normalized_price_usd,

        change,
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Supply / Demand engine
// -----------------------------------------------------------------------------

export function supplyDemandEngine(
  input: EngineInput,
): {
  supply: SupplyLevel;
  demand: DemandLevel;
  evidence: string;
  conflicts: string[];
} {
  let supply:
    SupplyLevel = 'Unknown';

  let demand:
    DemandLevel = 'Unknown';

  const evidence:
    string[] = [];

  const conflicts:
    string[] = [];

  const relevantMarketRows =
    input.commodity
      ? scopeMarketRowsForComparison(
          input.marketRows.filter(
            (row) =>
              row.commodity?.toLowerCase() ===
              input.commodity!.toLowerCase(),
          ),
          input,
        )
      : scopeMarketRowsForComparison(
          input.marketRows,
          input,
        );

  /**
   * Stored market evidence.
   */
  for (
    const row
    of relevantMarketRows
  ) {
    const mappedSupply =
      mapSupply(row);

    if (
      mappedSupply &&
      supply === 'Unknown'
    ) {
      supply =
        mappedSupply;

      evidence.push(
        `Supply (${row.country ?? row.market ?? 'market'}): ${mappedSupply} — ${row.source ?? 'stored'}`,
      );
    }

    const mappedDemand =
      mapDemand(row);

    if (
      mappedDemand &&
      demand === 'Unknown'
    ) {
      demand =
        mappedDemand;

      evidence.push(
        `Demand (${row.country ?? row.market ?? 'market'}): ${mappedDemand} — ${row.source ?? 'stored'}`,
      );
    }
  }

  const {
    supplySignals,
    demandSignals,
  } =
    extractSupplyDemandFromResearch(
      input,
    );

  if (
    supply === 'Unknown'
  ) {
    const resolved =
      resolveSignals(
        supplySignals,
        'supply',
      );

    supply =
      resolved.level as SupplyLevel;

    evidence.push(
      ...resolved.evidence,
    );

    if (
      resolved.conflict
    ) {
      conflicts.push(
        ...resolved.evidence,
      );
    }
  }

  if (
    demand === 'Unknown'
  ) {
    const resolved =
      resolveSignals(
        demandSignals,
        'demand',
      );

    demand =
      resolved.level as DemandLevel;

    evidence.push(
      ...resolved.evidence,
    );

    if (
      resolved.conflict
    ) {
      conflicts.push(
        ...resolved.evidence,
      );
    }
  }

  if (
    supply === 'Unknown' &&
    demand === 'Unknown' &&
    conflicts.length === 0
  ) {
    return {
      supply,
      demand,
      evidence:
        INSUFFICIENT,
      conflicts: [],
    };
  }

  return {
    supply,
    demand,
    evidence:
      evidence.join(
        '; ',
      ) ||
      INSUFFICIENT,

    conflicts,
  };
}

// -----------------------------------------------------------------------------
// Demand intelligence
// -----------------------------------------------------------------------------

function demandScore(
  level: DemandLevel,
): number {
  switch (level) {
    case 'Surging':
      return 95;

    case 'Strong':
      return 75;

    case 'Normal':
      return 50;

    case 'Weak':
      return 20;

    default:
      return 0;
  }
}

function classifyDemandTrendFromText(
  text: string,
): 'UP' | 'DOWN' | 'FLAT' | null {
  const value =
    text.toLowerCase();

  if (
    /\b(increas|rising|growing|surging|soaring|grew|boost|expanding|climbing)\b/.test(
      value,
    )
  ) {
    return 'UP';
  }

  if (
    /\b(decreas|declin|falling|dropping|weaker|lower|slowing|shrinking|contracting|reduced)\b/.test(
      value,
    )
  ) {
    return 'DOWN';
  }

  if (
    /\b(stable|steady|flat|unchanged|moderate)\b/.test(
      value,
    )
  ) {
    return 'FLAT';
  }

  return null;
}

export function demandEngine(
  input: EngineInput,
): DemandIntelligence {
  const signals:
    DemandSignal[] = [];

  const marketRows =
    scopeMarketRowsForComparison(
      input.marketRows,
      input,
    );

  /**
   * OBSERVED signals.
   */
  for (
    const row of marketRows
  ) {
    const demand =
      mapDemand(row);

    if (!demand) {
      continue;
    }

    signals.push({
      level: demand,
      trend: 'UNKNOWN',
      source:
        row.source ??
        'Stored data',
      url: '',
      snippet:
        row.demand ??
        '',
      confidence:
        row.confidence,
      freshness:
        freshnessOf(
          row.observation_date,
        ),
      evidence_type:
        'OBSERVED',
    });
  }

  /**
   * INFERRED signals.
   *
   * Comparison workflows use only
   * comparison-relevant research.
   */
  const research =
    scopeResearchResults(input);

  for (
    const result of research
  ) {
    const text =
      `${result.title} ${result.snippet}`;

    const demand =
      classifyDemandFromText(
        text,
      );

    if (!demand) {
      continue;
    }

    signals.push({
      level: demand,

      trend:
        classifyDemandTrendFromText(
          text,
        ) ??
        'UNKNOWN',

      source:
        result.title ||
        result.url,

      url:
        result.url,

      snippet:
        result.snippet.slice(
          0,
          200,
        ),

      confidence:
        demand === 'Normal'
          ? 'MEDIUM'
          : 'LOW',

      freshness:
        'CURRENT',

      evidence_type:
        'INFERRED',
    });
  }

  const observed =
    signals.filter(
      (signal) =>
        signal.evidence_type ===
        'OBSERVED',
    );

  const inferred =
    signals.filter(
      (signal) =>
        signal.evidence_type ===
        'INFERRED',
    );

  let level:
    DemandLevel = 'Unknown';

  let confidence:
    Confidence = 'LOW';

  let trend:
    | 'UP'
    | 'DOWN'
    | 'FLAT'
    | 'UNKNOWN' =
    'UNKNOWN';

  if (
    observed.length > 0
  ) {
    const observedLevels =
      [
        ...new Set(
          observed.map(
            (signal) =>
              signal.level,
          ),
        ),
      ];

    if (
      observedLevels.length === 1
    ) {
      level =
        observedLevels[0];

      confidence =
        observed.reduce(
          (
            best,
            signal,
          ) =>
            confidenceRank(
              signal.confidence,
            ) >
            confidenceRank(
              best,
            )
              ? signal.confidence
              : best,
          'LOW' as Confidence,
        );

      trend =
        observed[0].trend;
    } else {
      level =
        'Unknown';

      confidence =
        'LOW';
    }
  } else if (
    inferred.length > 0
  ) {
    const levels =
      [
        ...new Set(
          inferred.map(
            (signal) =>
              signal.level,
          ),
        ),
      ];

    if (
      levels.length > 1
    ) {
      level =
        'Unknown';

      confidence =
        'LOW';
    } else {
      level =
        levels[0];

      confidence =
        inferred.reduce(
          (
            best,
            signal,
          ) =>
            confidenceRank(
              signal.confidence,
            ) >
            confidenceRank(
              best,
            )
              ? signal.confidence
              : best,
          'LOW' as Confidence,
        );

      const trends =
        inferred
          .map(
            (signal) =>
              signal.trend,
          )
          .filter(
            (
              value,
            ) =>
              value !==
              'UNKNOWN',
          );

      const uniqueTrends =
        [
          ...new Set(
            trends,
          ),
        ];

      if (
        uniqueTrends.length === 1
      ) {
        trend =
          uniqueTrends[0];
      } else if (
        uniqueTrends.length > 1
      ) {
        trend =
          'UNKNOWN';
      }
    }
  }

  const score =
    demandScore(level);

  let summary:
    string;

  if (
    level === 'Unknown' &&
    signals.length === 0
  ) {
    summary =
      'No demand evidence found in available data.';
  } else if (
    level === 'Unknown'
  ) {
    summary =
      `Conflicting demand signals from ${signals.length} source(s) — unable to determine clear demand level.`;
  } else {
    summary =
      `Demand assessed as ${level} (score: ${score}/100, trend: ${trend}). Based on ${observed.length} observed signal(s) and ${inferred.length} inferred signal(s) from scoped research.`;
  }

  return {
    level,
    score,
    trend,
    confidence,
    signals,
    summary,
  };
}

// -----------------------------------------------------------------------------
// Sentiment
// -----------------------------------------------------------------------------

export function sentimentEngine(
  input: EngineInput,
): {
  sentiment: SentimentLevel;
  rationale: string;
} {
  const {
    supply,
    demand,
  } =
    supplyDemandEngine(
      input,
    );

  const points =
    pricePointEngine(
      input,
    );

  let signal =
    0;

  const reasons:
    string[] = [];

  if (
    supply === 'High'
  ) {
    signal += 1;

    reasons.push(
      'Supply is high (price-easing).',
    );
  }

  if (
    supply === 'Tight'
  ) {
    signal -= 1;

    reasons.push(
      'Supply is tight (price-supportive).',
    );
  }

  if (
    supply === 'Critical'
  ) {
    signal -= 2;

    reasons.push(
      'Supply is critical (price-positive).',
    );
  }

  if (
    demand === 'Strong'
  ) {
    signal += 1;

    reasons.push(
      'Demand is strong.',
    );
  }

  if (
    demand === 'Surging'
  ) {
    signal += 2;

    reasons.push(
      'Demand is surging.',
    );
  }

  if (
    demand === 'Weak'
  ) {
    signal -= 1;

    reasons.push(
      'Demand is weak.',
    );
  }

  const priceChange =
    comparablePriceChange(
      points,
    );

  if (
    priceChange
  ) {
    if (
      priceChange.change >
      0.03
    ) {
      signal += 1;

      reasons.push(
        `Prices up ${(priceChange.change * 100).toFixed(1)}% recently.`,
      );
    } else if (
      priceChange.change <
      -0.03
    ) {
      signal -= 1;

      reasons.push(
        `Prices down ${(
          priceChange.change *
          100
        ).toFixed(1)}% recently.`,
      );
    }
  }

  if (
    reasons.length === 0
  ) {
    return {
      sentiment:
        'Highly Uncertain',

      rationale:
        INSUFFICIENT,
    };
  }

  let sentiment:
    SentimentLevel;

  if (
    signal >= 2
  ) {
    sentiment =
      'Positive';
  } else if (
    signal === 1
  ) {
    sentiment =
      'Neutral';
  } else if (
    signal === 0
  ) {
    sentiment =
      'Cautious';
  } else {
    sentiment =
      'Negative';
  }

  return {
    sentiment,
    rationale:
      reasons.join(
        '; ',
      ),
  };
}

// -----------------------------------------------------------------------------
// Landed cost
// -----------------------------------------------------------------------------

export function landedCostEngine(
  input: EngineInput,
): LandedCostBreakdown | null {
  /**
   * No import origin means no defensible purchase price.
   */
  if (
    !input.commodity ||
    !input.origin
  ) {
    return null;
  }

  /**
   * Comparison is never a landed-cost workflow.
   */
  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    return null;
  }

  const origin =
    normalizeText(
      input.origin,
    );

  const commodity =
    normalizeText(
      input.commodity,
    );

  const originRows =
    input.marketRows.filter(
      (row) =>
        normalizeText(
          row.commodity,
        ) === commodity &&
        (
          normalizeText(
            row.origin,
          ) === origin ||
          normalizeText(
            row.country,
          ) === origin
        ),
    );

  const purchase =
    originRows[0];

  if (
    !purchase ||
    purchase.price == null ||
    !purchase.currency ||
    !purchase.unit
  ) {
    return {
      components: [
        {
          label:
            'Purchase Price',

          value:
            null,

          currency:
            null,

          source:
            'stored',

          data_status:
            'ESTIMATED',

          confidence:
            'LOW',
        },
      ],

      total:
        null,

      currency:
        null,

      unit:
        null,

      total_per_unit:
        null,

      note:
        `${INSUFFICIENT} for ${input.origin} ${input.commodity} purchase price.`,
    };
  }

  const liveFx =
    getUsdFxRate(
      purchase.currency,
      input.fxRates,
    );

  const purchaseUsd =
    liveFx.rate != null
      ? purchase.price *
        liveFx.rate
      : null;

  const components:
    LandedCostComponent[] = [
      {
        label:
          'Purchase Price',

        value:
          purchaseUsd,

        currency:
          'USD',

        source:
          purchase.source ??
          'stored',

        data_status:
          purchase.data_status,

        confidence:
          purchase.confidence,
      },

      {
        label:
          'Freight',

        value:
          null,

        currency:
          'USD',

        source:
          'not provided',

        data_status:
          'ESTIMATED',

        confidence:
          'LOW',
      },

      {
        label:
          'Transit & Handling',

        value:
          null,

        currency:
          'USD',

        source:
          'not provided',

        data_status:
          'ESTIMATED',

        confidence:
          'LOW',
      },

      {
        label:
          'Customs / Tariff',

        value:
          null,

        currency:
          'USD',

        source:
          'not provided',

        data_status:
          'ESTIMATED',

        confidence:
          'LOW',
      },

      {
        label:
          'Taxes',

        value:
          null,

        currency:
          'USD',

        source:
          'not provided',

        data_status:
          'ESTIMATED',

        confidence:
          'LOW',
      },

      {
        label:
          'Handling & Storage',

        value:
          null,

        currency:
          'USD',

        source:
          'not provided',

        data_status:
          'ESTIMATED',

        confidence:
          'LOW',
      },
    ];

  return {
    components,

    total:
      null,

    currency:
      'USD',

    unit:
      purchase.unit,

    total_per_unit:
      null,

    note:
      'Landed cost cannot be verified yet. Freight, transit, customs/tariff, taxes, and handling must be supplied as explicit inputs or verified data. No tariff rate is invented by the system.' +
      (
        liveFx.estimated
          ? ' FX rate is ESTIMATED (fallback) — not live.'
          : ''
      ),
  };
}

// -----------------------------------------------------------------------------
// Anomalies
// -----------------------------------------------------------------------------

export function anomalyEngine(
  input: EngineInput,
): Anomaly[] {
  const anomalies:
    Anomaly[] = [];

  const points =
    pricePointEngine(
      input,
    );

  const priceChange =
    comparablePriceChange(
      points,
    );

  if (
    priceChange
  ) {
    if (
      priceChange.change >
      0.1
    ) {
      anomalies.push({
        type:
          'Sudden price increase',

        severity:
          priceChange.change >
          0.25
            ? 'HIGH'
            : 'MEDIUM',

        description:
          `Price up ${(priceChange.change * 100).toFixed(1)}% vs prior observation.`,
      });
    }

    if (
      priceChange.change <
      -0.1
    ) {
      anomalies.push({
        type:
          'Sudden price decrease',

        severity:
          priceChange.change <
          -0.25
            ? 'HIGH'
            : 'MEDIUM',

        description:
          `Price down ${(
            -priceChange.change *
            100
          ).toFixed(1)}% vs prior observation.`,
      });
    }
  }

  const {
    supply,
  } =
    supplyDemandEngine(
      input,
    );

  if (
    supply === 'Critical'
  ) {
    anomalies.push({
      type:
        'Supply shortage',

      severity:
        'CRITICAL',

      description:
        'Supply classified as Critical.',
    });
  }

  if (
    supply === 'Tight'
  ) {
    anomalies.push({
      type:
        'Tight supply',

      severity:
        'MEDIUM',

      description:
        'Supply classified as Tight.',
    });
  }

  const {
    demand,
  } =
    supplyDemandEngine(
      input,
    );

  if (
    demand === 'Surging'
  ) {
    anomalies.push({
      type:
        'Demand surge',

      severity:
        'HIGH',

      description:
        'Demand classified as Surging.',
    });
  }

  return anomalies;
}

// -----------------------------------------------------------------------------
// Forecast
// -----------------------------------------------------------------------------

export function forecastEngine(
  input: EngineInput,
): Forecast | null {
  const {
    supply,
    demand,
  } =
    supplyDemandEngine(
      input,
    );

  const {
    sentiment,
  } =
    sentimentEngine(
      input,
    );

  const points =
    pricePointEngine(
      input,
    );

  let priceDirection:
    Forecast['price_direction'] =
    'UNCERTAIN';

  let confidence:
    Forecast['confidence'] =
    'LOW';

  const rationale:
    string[] = [];

  const priceChange =
    comparablePriceChange(
      points,
    );

  if (
    priceChange
  ) {
    if (
      priceChange.change >
      0.03
    ) {
      priceDirection =
        'UP';

      rationale.push(
        `Recent prices up ${(priceChange.change * 100).toFixed(1)}%.`,
      );
    } else if (
      priceChange.change <
      -0.03
    ) {
      priceDirection =
        'DOWN';

      rationale.push(
        `Recent prices down ${(
          priceChange.change *
          100
        ).toFixed(1)}%.`,
      );
    } else {
      priceDirection =
        'FLAT';

      rationale.push(
        'Prices roughly flat recently.',
      );
    }

    confidence =
      points.some(
        (point) =>
          point.confidence ===
          'HIGH',
      )
        ? 'MEDIUM'
        : 'LOW';
  }

  if (
    supply === 'Tight' ||
    supply === 'Critical'
  ) {
    priceDirection =
      priceDirection ===
      'DOWN'
        ? 'FLAT'
        : 'UP';

    rationale.push(
      'Tight supply pressures prices upward.',
    );
  }

  if (
    demand === 'Strong' ||
    demand === 'Surging'
  ) {
    priceDirection =
      priceDirection ===
      'DOWN'
        ? 'FLAT'
        : 'UP';

    rationale.push(
      'Strong demand supports prices.',
    );
  }

  if (
    supply === 'High'
  ) {
    rationale.push(
      'High supply eases price pressure.',
    );
  }

  const risk:
    Forecast['market_risk'] =
    sentiment === 'Negative' ||
    supply === 'Critical'
      ? 'HIGH'
      : sentiment ===
            'Cautious' ||
          supply === 'Tight'
        ? 'MEDIUM'
        : 'LOW';

  if (
    rationale.length === 0
  ) {
    return {
      horizon:
        '7 days',

      price_direction:
        'UNCERTAIN',

      supply_direction:
        'UNCERTAIN',

      demand_direction:
        'UNCERTAIN',

      market_risk:
        'MEDIUM',

      sentiment:
        'Highly Uncertain',

      confidence:
        'LOW',

      rationale:
        INSUFFICIENT,
    };
  }

  const supplyDirection:
    Forecast['supply_direction'] =
    supply === 'High'
      ? 'UP'
      : supply === 'Tight' ||
          supply === 'Critical'
        ? 'DOWN'
        : 'FLAT';

  const demandDirection:
    Forecast['demand_direction'] =
    demand === 'Strong' ||
    demand === 'Surging'
      ? 'UP'
      : demand === 'Weak'
        ? 'DOWN'
        : 'FLAT';

  return {
    horizon:
      '7 days',

    price_direction:
      priceDirection,

    supply_direction:
      supplyDirection,

    demand_direction:
      demandDirection,

    market_risk:
      risk,

    sentiment,

    confidence,

    rationale:
      rationale.join(
        ' ',
      ),
  };
}

// -----------------------------------------------------------------------------
// Recommendation
// -----------------------------------------------------------------------------

export function recommendationEngine(
  input: EngineInput,
  landed: LandedCostBreakdown | null,
): {
  rec: Recommendation;
  rationale: string;
} {
  const points =
    pricePointEngine(
      input,
    );

  const {
    supply,
    demand,
  } =
    supplyDemandEngine(
      input,
    );

  const anomalies =
    anomalyEngine(
      input,
    );

  const hasData =
    points.length > 0 ||
    input.marketRows.length > 0;

  /**
   * Comparison recommendation:
   *
   * This is not an import decision.
   */
  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    const markets =
      getComparisonMarkets(
        input,
      );

    if (
      points.length < 2
    ) {
      return {
        rec:
          'NEED MORE DATA',

        rationale:
          `Insufficient directly attributable price data to compare ${markets[0]} vs ${markets[1]}.`,
      };
    }

    if (
      anomalies.some(
        (anomaly) =>
          anomaly.severity ===
          'CRITICAL',
      )
    ) {
      return {
        rec:
          'HOLD',

        rationale:
          'Critical market anomaly detected; comparison should not be used for immediate commitment decisions.',
      };
    }

    if (
      supply === 'Critical'
    ) {
      return {
        rec:
          'HOLD',

        rationale:
          'Critical supply conditions materially increase market risk.',
      };
    }

    return {
      rec:
        'MONITOR',

      rationale:
        `Comparison data is available for ${markets[0]} vs ${markets[1]}; continue monitoring verified price and supply signals.`,
    };
  }

  /**
   * Import-route recommendation.
   */
  if (
    input.origin &&
    input.destination &&
    landed?.total != null
  ) {
    const destination =
      normalizeText(
        input.destination,
      );

    const city =
      normalizeText(
        input.city,
      );

    const destinationRows =
      input.marketRows.filter(
        (row) =>
          normalizeText(
            row.country,
          ) === destination ||
          (
            city &&
            normalizeText(
              row.city,
            ) === city
          ),
      );

    const destinationPrice =
      destinationRows[0];

    if (
      destinationPrice &&
      destinationPrice.price != null &&
      destinationPrice.currency
    ) {
      const destinationPerMt =
        normalizeToUsdPerMtWithFx(
          destinationPrice.price,
          destinationPrice.currency,
          destinationPrice.unit ??
            'kg',
          input.fxRates,
        );

      const landedPerMt =
        landed.unit
          ? normalizeToUsdPerMtWithFx(
              landed.total,
              'USD',
              landed.unit,
              input.fxRates,
            )
          : null;

      if (
        landedPerMt != null &&
        destinationPerMt != null
      ) {
        const margin =
          (
            destinationPerMt -
            landedPerMt
          ) /
          landedPerMt;

        if (
          margin >
          0.1
        ) {
          return {
            rec:
              'GO',

            rationale:
              `Estimated landed cost is ${(margin * 100).toFixed(0)}% below destination market price — positive margin potential.`,
          };
        }

        if (
          margin > 0
        ) {
          return {
            rec:
              'MONITOR',

            rationale:
              `Margin thin (~${(margin * 100).toFixed(0)}%). Proceed only with verified cost quotes.`,
          };
        }

        return {
          rec:
            'NO-GO',

          rationale:
            `Estimated landed cost exceeds destination price by ${(-margin * 100).toFixed(0)}% — negative margin.`,
        };
      }
    }

    return {
      rec:
        'NEED MORE DATA',

      rationale:
        'Landed cost estimated but destination market price unavailable for margin comparison.',
    };
  }

  if (
    !hasData
  ) {
    return {
      rec:
        'NEED MORE DATA',

      rationale:
        INSUFFICIENT,
    };
  }

  if (
    anomalies.some(
      (anomaly) =>
        anomaly.severity ===
        'CRITICAL',
    )
  ) {
    return {
      rec:
        'HOLD',

      rationale:
        'Critical anomaly detected — avoid new commitments until conditions clarify.',
    };
  }

  if (
    supply === 'Critical' ||
    supply === 'Tight'
  ) {
    return {
      rec:
        'MONITOR',

      rationale:
        'Tight supply creates price risk; monitor for stabilization before large commitments.',
    };
  }

  if (
    demand === 'Weak'
  ) {
    return {
      rec:
        'HOLD',

      rationale:
        'Weak demand suggests limited near-term opportunity.',
    };
  }

  return {
    rec:
      'MONITOR',

    rationale:
      'Market conditions balanced — continue monitoring for directional signals.',
  };
}

// -----------------------------------------------------------------------------
// Sources
// -----------------------------------------------------------------------------

export function sourceEngine(
  input: EngineInput,
): {
  sources: DataSource[];
  conflicts: string[];
} {
  const sources:
    DataSource[] = [];

  const seen =
    new Set<string>();

  for (
    const row
    of scopeMarketRowsForComparison(
      input.marketRows,
      input,
    )
  ) {
    const name =
      row.source ??
      'Stored data';

    if (
      seen.has(name)
    ) {
      continue;
    }

    seen.add(name);

    sources.push({
      name,

      source_type:
        row.source_type ??
        'stored',

      data_status:
        row.data_status,

      confidence:
        row.confidence,

      freshness:
        freshnessOf(
          row.observation_date,
        ),

      observation_date:
        row.observation_date,
    });
  }

  for (
    const fx
    of input.fxRates
  ) {
    const name =
      fx.source;

    if (
      seen.has(name)
    ) {
      continue;
    }

    seen.add(name);

    sources.push({
      name,

      source_type:
        'fx',

      data_status:
        fx.data_status,

      confidence:
        fx.confidence,

      freshness:
        freshnessOf(
          fx.observation_date,
        ),

      observation_date:
        fx.observation_date,
    });
  }

  for (
    const result
    of scopeResearchResults(
      input,
    ).slice(0, 8)
  ) {
    const key =
      result.url ||
      result.title;

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    sources.push({
      name:
        result.title ||
        result.url,

      url:
        result.url,

      source_type:
        result.source_type,

      data_status:
        'REPORTED',

      confidence:
        'MEDIUM',

      freshness:
        'CURRENT',
    });
  }

  const conflicts:
    string[] = [];

  const points =
    pricePointEngine(
      input,
    );

  const byLocation:
    Record<
      string,
      number[]
    > = {};

  for (
    const point
    of points
  ) {
    if (
      point.normalized_price_usd !=
        null &&
      point.normalized_price_usd > 0
    ) {
      const location =
        point.location ||
        'Unknown';

      (
        byLocation[
          location
        ] ??= []
      ).push(
        point.normalized_price_usd,
      );
    }
  }

  for (
    const [
      location,
      values,
    ] of Object.entries(
      byLocation,
    )
  ) {
    if (
      values.length < 2
    ) {
      continue;
    }

    const min =
      Math.min(
        ...values,
      );

    const max =
      Math.max(
        ...values,
      );

    if (
      min > 0 &&
      (
        max - min
      ) /
        min >
        0.15
    ) {
      conflicts.push(
        `Price spread for ${location} exceeds 15% across sources — verify which reflects current market.`,
      );
    }
  }

  return {
    sources,
    conflicts,
  };
}

// -----------------------------------------------------------------------------
// Research summary
// -----------------------------------------------------------------------------

export function researchSummaryEngine(
  input: EngineInput,
): string {
  if (
    input.researchStatus ===
      'NO_PROVIDER' ||
    input.researchStatus ===
      'ERROR'
  ) {
    return (
      input.researchMessage ??
      'Web research provider unavailable. Analysis based on stored data only.'
    );
  }

  const results =
    scopeResearchResults(
      input,
    );

  if (
    results.length === 0
  ) {
    return isComparisonWorkflow(
      input,
    )
      ? 'No web research result was directly attributable to the requested comparison markets.'
      : 'No web research results returned.';
  }

  const top =
    results.slice(0, 6);

  return top
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}: ${result.snippet.slice(0, 220)}`,
    )
    .join('\n');
}

// -----------------------------------------------------------------------------
// Trade updates
// -----------------------------------------------------------------------------

function isRelevantTradeUpdate(
  result: ResearchProviderResult,
): boolean {
  const text =
    `${result.title} ${result.snippet}`.toLowerCase();

  const irrelevant =
    /\b(proxy|proxies|vpn|security verification|application testing|residential ip|datacenter|checkout testing|seo|hosting|ip address|anonymous browsing)\b/i.test(
      text,
    );

  if (
    irrelevant
  ) {
    return false;
  }

  return /\b(customs|tariff|trade|import|export|regulation|policy|border|transport|logistics|shipment|rail|wagon|quota|duties|tax|ban|restriction|food security)\b/i.test(
    text,
  );
}

// -----------------------------------------------------------------------------
// Data gaps
// -----------------------------------------------------------------------------

export function dataGapsEngine(
  input: EngineInput,
): string[] {
  const gaps:
    string[] = [];

  const comparisonMarkets =
    getComparisonMarkets(
      input,
    );

  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    if (
      input.marketRows.length ===
      0
    ) {
      gaps.push(
        `No stored market observations for comparison markets: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`,
      );
    }

    const comparisonPrices =
      pricePointEngine(
        input,
      );

    if (
      comparisonPrices.length <
      2
    ) {
      gaps.push(
        `Fewer than two directly attributable price observations are available for ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`,
      );
    }

    if (
      input.researchResults.length >
        0 &&
      scopeResearchResults(
        input,
      ).length === 0
    ) {
      gaps.push(
        `Web research returned results, but none could be directly attributed to ${comparisonMarkets[0} or ${comparisonMarkets[1]}.`,
      );
    }
  } else if (
    input.marketRows.length ===
    0
  ) {
    gaps.push(
      'No stored market observations for the requested market scope.',
    );
  }

  if (
    input.fxRates.length ===
    0
  ) {
    gaps.push(
      'No live FX rates available — currency conversions may require approximate fallback rates (ESTIMATED).',
    );
  }

  if (
    input.researchStatus !==
    'OK'
  ) {
    gaps.push(
      'Live web research unavailable — findings limited to stored evidence.',
    );
  }

  if (
    input.stockRows.length ===
    0
  ) {
    gaps.push(
      'No stock records available — warehouse/in-transit stock position cannot be verified.',
    );
  }

  if (
    input.shipmentRows.length ===
    0
  ) {
    gaps.push(
      'No shipment/wagon records available — incoming rail/road volume and ETA cannot be verified.',
    );
  }

  if (
    input.city &&
    !input.marketRows.some(
      (row) =>
        row.city?.toLowerCase() ===
        input.city!.toLowerCase(),
    )
  ) {
    gaps.push(
      `No verified local data for ${input.city} — city-level prices not available.`,
    );
  }

  if (
    input.origin &&
    !input.marketRows.some(
      (row) =>
        row.origin?.toLowerCase() ===
          input.origin!.toLowerCase() ||
        row.country?.toLowerCase() ===
          input.origin!.toLowerCase(),
    )
  ) {
    gaps.push(
      `No verified origin data for ${input.origin}.`,
    );
  }

  return gaps;
}

// -----------------------------------------------------------------------------
// Findings
// -----------------------------------------------------------------------------

export function buildFindings(
  input: EngineInput,
): ResearchFindings {
  const commodity =
    input.commodity ??
    'the requested commodity';

  const points =
    pricePointEngine(
      input,
    );

  const {
    supply,
    demand,
    conflicts:
      supplyDemandConflicts,
  } =
    supplyDemandEngine(
      input,
    );

  const demandIntel =
    demandEngine(
      input,
    );

  const {
    sentiment,
  } =
    sentimentEngine(
      input,
    );

  const landed =
    landedCostEngine(
      input,
    );

  const anomalies =
    anomalyEngine(
      input,
    );

  const {
    sources,
    conflicts:
      sourceConflicts,
  } =
    sourceEngine(
      input,
    );

  const conflicts = [
    ...sourceConflicts,
    ...supplyDemandConflicts,
  ];

  const {
    rec,
    rationale:
      recommendationRationale,
  } =
    recommendationEngine(
      input,
      landed,
    );

  const forecast =
    forecastEngine(
      input,
    );

  const researchSummary =
    researchSummaryEngine(
      input,
    );

  const gaps =
    dataGapsEngine(
      input,
    );

  const operational =
    buildOperationalIntelligence(
      input,
    );

  const comparison =
    isComparisonWorkflow(
      input,
    );

  const comparisonMarkets =
    getComparisonMarkets(
      input,
    );

  /**
   * Target price views.
   *
   * For comparison workflows these remain context-oriented.
   */
  const destinationCountryPoints =
    input.destination
      ? points.filter(
          (point) =>
            normalizeText(
              point.location,
            ) ===
            normalizeText(
              input.destination,
            ),
        )
      : [];

  const cityPoints =
    input.city
      ? points.filter(
          (point) =>
            normalizeText(
              point.location,
            ) ===
            normalizeText(
              input.city,
            ),
        )
      : [];

  const targetCountry =
    comparison
      ? (
          comparisonMarkets.length >=
          2
            ? `Comparison context: ${
                input.comparisonContext ??
                input.destination ??
                'global'
              }. Prices are scoped to ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}; context-market prices are not comparison observations.`
            : INSUFFICIENT
        )
      : input.destination
        ? (
            destinationCountryPoints
              .map(
                (point) =>
                  `${point.label}: ${
                    point.price ??
                    '—'
                  } ${
                    point.currency ??
                    ''
                  }/${point.unit ?? ''}`,
              )
              .join('; ') ||
            'No direct country-level price observation — city-level data kept separate.'
          )
        : 'No destination specified.';

  const targetCity =
    input.city
      ? (
          cityPoints
            .map(
              (point) =>
                `${point.label}: ${
                  point.price ??
                  '—'
                } ${
                  point.currency ??
                  ''
                }/${point.unit ?? ''}`,
            )
            .join('; ') ||
          INSUFFICIENT
        )
      : 'No city specified.';

  const relevantTradeResult =
    scopeResearchResults(
      input,
    ).find(
      isRelevantTradeUpdate,
    );

  const comparisonSummary =
    comparison &&
    comparisonMarkets.length >=
      2
      ? `Comparison: ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}${
          input.comparisonContext
            ? ` | Market context: ${input.comparisonContext}`
            : ''
        }.`
      : null;

  const standardSummary =
    `Analysis for ${commodity}${
      input.origin
        ? ` from ${input.origin}`
        : ''
    }${
      input.destination
        ? ` to ${input.destination}`
        : ''
    }${
      input.city
        ? ` in ${input.city}`
        : ''
    }. ${
      points.length > 0
        ? `${points.length} price observation(s) found.`
        : 'No usable price observations found.'
    } ${
      input.fxRates.length > 0
        ? 'FX rates available.'
        : 'FX rates unavailable.'
    } ${
      sentiment !==
      'Highly Uncertain'
        ? `Market sentiment: ${sentiment}.`
        : 'Market sentiment: HIGHLY UNCERTAIN.'
    } Operational position: ${
      operational.summary
    }. Recommendation: ${rec}.`;

  const executiveSummary =
    comparison
      ? `${comparisonSummary ?? 'Comparison requested.'} ${
          points.length >= 2
            ? `${points.length} directly attributable comparison price observation(s) found.`
            : 'Insufficient directly attributable comparison price observations found.'
        } ${
          input.fxRates.length > 0
            ? 'Live FX rates available for normalization.'
            : 'FX rates unavailable.'
        } ${
          sentiment !==
          'Highly Uncertain'
            ? `Market sentiment: ${sentiment}.`
            : 'Market sentiment: HIGHLY UNCERTAIN.'
        } Recommendation: ${rec}.`
      : standardSummary;

  const fieldCompetitor =
    input.marketRows.find(
      (row) =>
        row.competitor_info,
    )?.competitor_info;

  const fieldLogistics =
    input.marketRows.find(
      (row) =>
        row.logistics_status,
    )?.logistics_status;

  const logisticsRiskParts =
    [
      fieldLogistics,

      operational.shipments
        .delayed > 0
        ? `${operational.shipments.delayed} delayed shipment(s) recorded.`
        : null,

      operational.shipments
        .next_eta
        ? `Next recorded ETA: ${operational.shipments.next_eta}.`
        : null,
    ].filter(Boolean);

  const adjustedSupply =
    operational.stock
      .record_count > 0 &&
    operational.stock
      .in_transit != null &&
    operational.stock
      .expected_incoming != null &&
    operational.stock
      .available != null &&
    operational.stock
      .in_transit +
      operational.stock
      .expected_incoming >
      operational.stock
      .available
      ? 'Tight'
      : supply;

  return {
    commodity,

    objective:
      input.objective ??
      (
        input.commodity
          ? `${commodity} market intelligence`
          : 'Market intelligence'
      ),

    executive_summary:
      executiveSummary,

    global_market:
      researchSummary ||
      (
        points.length > 0
          ? 'See price observations below.'
          : INSUFFICIENT
      ),

    origin_market:
      comparison
        ? (
            comparisonMarkets.length >=
            2
              ? `No import origin is assigned. Comparison is ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`
              : 'No comparison origin assigned.'
          )
        : input.origin
          ? (
              points
                .filter(
                  (point) =>
                    point.label
                      .toLowerCase()
                      .includes(
                        input.origin!.toLowerCase(),
                      ),
                )
                .map(
                  (point) =>
                    `${point.label}: ${
                      point.price ??
                      '—'
                    } ${
                      point.currency ??
                      ''
                    }/${point.unit ?? ''}`,
                )
                .join('; ') ||
              INSUFFICIENT
            )
          : 'No origin specified.',

    target_country:
      targetCountry,

    target_city:
      targetCity,

    operational_intelligence:
      operational,

    fx_situation:
      input.fxRates.length > 0
        ? input.fxRates
            .slice(0, 8)
            .map(
              (fx) =>
                `${fx.base_currency}/${fx.quote_currency}: ${fx.rate.toFixed(4)} (${fx.source})`,
            )
            .join('; ')
        : 'FX provider unavailable. Currency conversions may use approximate fallback rates (ESTIMATED).',

    price_points:
      points,

    landed_cost:
      landed,

    supply:
      adjustedSupply,

    demand,

    demand_intelligence:
      demandIntel,

    sentiment,

    competitor_activity:
      fieldCompetitor ??
      INSUFFICIENT,

    government_trade_updates:
      relevantTradeResult?.snippet ??
      'No relevant government/trade updates identified in available sources.',

    logistics_risks:
      logisticsRiskParts.join(
        ' ',
      ) ||
      'No logistics disruption signals in scoped data.',

    key_risks:
      anomalies.map(
        (anomaly) =>
          `${anomaly.type}: ${anomaly.description}`,
      ),

    opportunities:
      comparison
        ? points.length >=
            2
          ? [
              `Verified comparison evidence available for ${comparisonMarkets[0]} vs ${comparisonMarkets[1]}.`,
            ]
          : []
        : supply === 'High'
          ? [
              'Supply is ample — potential buying opportunity.',
            ]
          : demand === 'Strong' ||
              demand === 'Surging'
            ? [
                'Strong demand supports sales/positioning.',
              ]
            : [],

    short_term_outlook:
      forecast
        ? `7-day outlook: prices ${forecast.price_direction.toLowerCase()}, risk ${forecast.market_risk.toLowerCase()} (${forecast.confidence} confidence).`
        : 'Outlook uncertain.',

    recommendation:
      rec,

    recommendation_rationale:
      recommendationRationale,

    forecast,

    anomalies,

    sources,

    conflicts,

    data_gaps:
      gaps,
  };
}

// -----------------------------------------------------------------------------
// New Commodity Evaluation Engine
// -----------------------------------------------------------------------------

function scoreSupply(
  level: SupplyLevel,
): number {
  switch (level) {
    case 'High':
      return 80;

    case 'Normal':
      return 60;

    case 'Tight':
      return 30;

    case 'Critical':
      return 10;

    default:
      return 0;
  }
}

function scoreSentiment(
  sentiment: SentimentLevel,
): number {
  switch (
    sentiment
  ) {
    case 'Positive':
      return 80;

    case 'Neutral':
      return 55;

    case 'Cautious':
      return 35;

    case 'Negative':
      return 15;

    default:
      return 0;
  }
}

export function evaluationEngine(
  input: EngineInput,
  findings: ResearchFindings,
): EvaluationResult {
  /**
   * Evaluation is an opportunity/import decision.
   *
   * A pure comparison does not represent market-entry
   * feasibility, so we keep this path defensive.
   */
  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    /**
     * The executor currently avoids calling this function
     * for compare workflows. This fallback exists so that
     * accidental future calls cannot create a fake
     * import/opportunity interpretation.
     */
    return {
      commodity:
        input.commodity ??
        'Unknown',

      origin:
        null,

      destination:
        input.comparisonContext ??
        input.destination ??
        null,

      city:
        input.city,

      opportunity_score:
        0,

      demand_assessment:
        'Comparison workflow — no import opportunity score assigned.',

      supply_assessment:
        'Comparison workflow — no import opportunity score assigned.',

      competition_assessment:
        'Comparison workflow — competition assessed separately from import opportunity.',

      price_attractiveness:
        'Comparison workflow — no landed-cost margin calculation assigned.',

      logistics_feasibility:
        'Comparison workflow — import-route feasibility not evaluated.',

      market_sentiment:
        `${findings.sentiment}.`,

      risk_assessment:
        findings.anomalies.length > 0
          ? `${findings.anomalies.length} anomaly/anomalies detected.`
          : 'No significant anomalies detected in available data.',

      confidence_level:
        'LOW',

      recommendation:
        findings.recommendation,

      key_reasons:
        [
          'Pure market comparison — not an import opportunity evaluation.',
        ],

      data_gaps:
        findings.data_gaps,
    };
  }

  const {
    supply,
    demand,
    sentiment,
  } = findings;

  const points =
    findings.price_points;

  const anomalies =
    findings.anomalies;

  const gaps =
    findings.data_gaps;

  const landed =
    findings.landed_cost;

  const recommendation =
    findings.recommendation;

  const reasons:
    string[] = [];

  const warnings:
    string[] = [];

  const demandScoreValue =
    demandScore(demand);

  const supplyScore =
    scoreSupply(
      supply,
    );

  const sentimentScore =
    scoreSentiment(
      sentiment,
    );

  let demandText:
    string;

  if (
    demand === 'Unknown'
  ) {
    demandText =
      'UNKNOWN — no demand evidence found.';

    warnings.push(
      'Demand level unknown — no observed or inferred signals.',
    );
  } else {
    demandText =
      `${demand} (score: ${demandScoreValue}/100). ${
        demand === 'Surging' ||
        demand === 'Strong'
          ? 'Favorable for positioning.'
          : demand === 'Weak'
            ? 'Unfavorable — limited near-term opportunity.'
            : 'Balanced conditions.'
      }`;

    if (
      demand === 'Strong' ||
      demand === 'Surging'
    ) {
      reasons.push(
        `Demand is ${demand} — supports market entry.`,
      );
    }

    if (
      demand === 'Weak'
    ) {
      reasons.push(
        'Weak demand limits opportunity.',
      );
    }
  }

  const behaviorRaw =
    input.marketRows.find(
      (row) =>
        row.buying_selling_behavior,
    )?.buying_selling_behavior;

  if (
    behaviorRaw
  ) {
    demandText +=
      ` Field behavior: ${behaviorRaw}.`;
  }

  let supplyText:
    string;

  if (
    supply === 'Unknown'
  ) {
    supplyText =
      'UNKNOWN — no supply evidence found.';

    warnings.push(
      'Supply level unknown — no observed or inferred signals.',
    );
  } else {
    supplyText =
      `${supply} (score: ${supplyScore}/100). ${
        supply === 'High'
          ? 'Ample supply — potential buying advantage.'
          : supply === 'Tight' ||
              supply === 'Critical'
            ? 'Constrained supply — price risk and sourcing difficulty.'
            : 'Stable supply conditions.'
      }`;

    if (
      supply === 'High'
    ) {
      reasons.push(
        'Ample supply — potential buying opportunity.',
      );
    }

    if (
      supply === 'Critical' ||
      supply === 'Tight'
    ) {
      reasons.push(
        `Supply is ${supply} — sourcing risk.`,
      );
    }
  }

  const stockRaw =
    input.marketRows.find(
      (row) =>
        row.stock,
    )?.stock;

  if (
    stockRaw
  ) {
    supplyText +=
      ` Field-reported stock availability: ${stockRaw}.`;

    if (
      /depleted|low/i.test(
        stockRaw,
      )
    ) {
      reasons.push(
        'Low/depleted stock availability reported in field data.',
      );
    }
  }

  const arrivalsRaw =
    input.marketRows.find(
      (row) =>
        row.new_arrivals,
    )?.new_arrivals;

  if (
    arrivalsRaw
  ) {
    supplyText +=
      ` Field-reported new arrivals: ${arrivalsRaw}.`;
  }

  const operational =
    buildOperationalIntelligence(
      input,
    );

  if (
    operational.stock
      .record_count > 0
  ) {
    supplyText +=
      ` Operational stock: ${(
        operational.stock.available ??
        0
      ).toLocaleString()} ${
        operational.stock.unit ??
        ''
      } available, ${(
        operational.stock.in_transit ??
        0
      ).toLocaleString()} ${
        operational.stock.unit ??
        ''
      } in transit, ${(
        operational.stock.expected_incoming ??
        0
      ).toLocaleString()} ${
        operational.stock.unit ??
        ''
      } expected incoming.`;
  } else {
    supplyText +=
      ' Operational stock: UNKNOWN — no stock records available.';
  }

  if (
    operational.shipments
      .total > 0
  ) {
    supplyText +=
      ` Shipments/wagons: ${operational.shipments.total} total, ${operational.shipments.in_transit} in transit, ${operational.shipments.delayed} delayed.`;

    if (
      operational.shipments
        .delayed > 0
    ) {
      reasons.push(
        `${operational.shipments.delayed} delayed shipment(s)/wagon(s) increase logistics risk.`,
      );
    }
  } else {
    supplyText +=
      ' Shipments/wagons: UNKNOWN — no shipment records available.';
  }

  const competitorRaw =
    input.marketRows.find(
      (row) =>
        row.competitor_info,
    )?.competitor_info;

  let competitionText:
    string;

  if (
    competitorRaw
  ) {
    competitionText =
      `${competitorRaw}`;

    reasons.push(
      'Competitor activity noted in field data.',
    );
  } else {
    competitionText =
      'UNKNOWN — no competitor intelligence available.';

    warnings.push(
      'No competitor intelligence available.',
    );
  }

  let priceText:
    string;

  if (
    points.length === 0
  ) {
    priceText =
      'UNKNOWN — no price observations available.';

    warnings.push(
      'No price data for attractiveness assessment.',
    );
  } else if (
    landed?.total != null
  ) {
    const destinationRows =
      input.marketRows.filter(
        (row) =>
          normalizeText(
            row.country,
          ) ===
            normalizeText(
              input.destination,
            ) ||
          normalizeText(
            row.city,
          ) ===
            normalizeText(
              input.city,
            ),
      );

    const destinationPrice =
      destinationRows[0];

    if (
      destinationPrice?.price !=
      null
    ) {
      const landedPerMt =
        normalizeToUsdPerMtWithFx(
          landed.total,
          'USD',
          landed.unit ??
            'kg',
          input.fxRates,
        );

      const destinationPerMt =
        normalizeToUsdPerMtWithFx(
          destinationPrice.price,
          destinationPrice.currency ??
            'USD',
          destinationPrice.unit ??
            'kg',
          input.fxRates,
        );

      if (
        landedPerMt != null &&
        destinationPerMt != null
      ) {
        const margin =
          (
            destinationPerMt -
            landedPerMt
          ) /
          landedPerMt;

        if (
          margin > 0.1
        ) {
          priceText =
            `Attractive — estimated margin ~${(
              margin * 100
            ).toFixed(0)}% above landed cost.`;

          reasons.push(
            `Price margin ~${(
              margin * 100
            ).toFixed(0)}% — attractive.`,
          );
        } else if (
          margin > 0
        ) {
          priceText =
            `Thin margin (~${(
              margin * 100
            ).toFixed(0)}%) — proceed with caution.`;
        } else {
          priceText =
            `Unattractive — landed cost exceeds destination price by ${(
              -margin * 100
            ).toFixed(0)}%.`;

          reasons.push(
            'Negative margin — price unattractive.',
          );
        }
      } else {
        priceText =
          `${points.length} price observation(s) available but cannot compare to landed cost.`;
      }
    } else {
      priceText =
        `${points.length} price observation(s) available but destination price missing for margin comparison.`;

      warnings.push(
        'Destination price missing — cannot assess margin.',
      );
    }
  } else {
    priceText =
      `${points.length} price observation(s) available. No verified landed cost estimate for comparison.`;

    warnings.push(
      'Landed cost unavailable — freight/customs/tax inputs are not verified.',
    );
  }

  const logisticsRaw =
    input.marketRows.find(
      (row) =>
        row.logistics_status,
    )?.logistics_status;

  const importRaw =
    input.marketRows.find(
      (row) =>
        row.import_status,
    )?.import_status;

  const exportRaw =
    input.marketRows.find(
      (row) =>
        row.export_status,
    )?.export_status;

  let logisticsText:
    string;

  const logisticsParts:
    string[] = [];

  if (
    importRaw
  ) {
    logisticsParts.push(
      `Import: ${importRaw}`,
    );
  }

  if (
    exportRaw
  ) {
    logisticsParts.push(
      `Export: ${exportRaw}`,
    );
  }

  if (
    logisticsRaw
  ) {
    logisticsParts.push(
      `Logistics: ${logisticsRaw}`,
    );
  }

  if (
    logisticsParts.length > 0
  ) {
    logisticsText =
      logisticsParts.join(
        ' | ',
      );

    if (
      logisticsRaw &&
      /disrupt|blocked|constrain/i.test(
        logisticsRaw,
      )
    ) {
      reasons.push(
        'Logistics disruption detected.',
      );
    }

    if (
      importRaw &&
      /restrict|ban/i.test(
        importRaw,
      )
    ) {
      reasons.push(
        'Import restrictions detected.',
      );
    }
  } else {
    logisticsText =
      'No logistics or trade status data — UNKNOWN.';

    warnings.push(
      'No logistics/import/export status data.',
    );
  }

  let sentimentText:
    string;

  const fieldSentiment =
    input.marketRows.find(
      (row) =>
        row.market_sentiment,
    )?.market_sentiment;

  if (
    sentiment ===
    'Highly Uncertain'
  ) {
    sentimentText =
      'HIGHLY UNCERTAIN — insufficient data for sentiment assessment.';

    warnings.push(
      'Market sentiment uncertain.',
    );
  } else {
    sentimentText =
      `${sentiment} (score: ${sentimentScore}/100).`;

    if (
      fieldSentiment
    ) {
      sentimentText +=
        ` Field sentiment: ${fieldSentiment}.`;
    }

    if (
      sentiment ===
      'Positive'
    ) {
      reasons.push(
        'Positive market sentiment.',
      );
    }

    if (
      sentiment ===
      'Negative'
    ) {
      reasons.push(
        'Negative market sentiment — caution advised.',
      );
    }
  }

  const criticalAnomalies =
    anomalies.filter(
      (anomaly) =>
        anomaly.severity ===
          'CRITICAL' ||
        anomaly.severity ===
          'HIGH',
    );

  let riskText:
    string;

  if (
    criticalAnomalies.length >
    0
  ) {
    riskText =
      `ELEVATED — ${criticalAnomalies.length} critical/high anomaly/anomalies: ${criticalAnomalies
        .map(
          (anomaly) =>
            anomaly.type,
        )
        .join(', ')}.`;

    reasons.push(
      `${criticalAnomalies.length} critical/high risk(s) detected.`,
    );
  } else if (
    anomalies.length > 0
  ) {
    riskText =
      `MODERATE — ${anomalies.length} anomaly/anomalies detected (all medium/low).`;
  } else {
    riskText =
      'No significant risks detected in available data.';
  }

  const risksRaw =
    input.marketRows.find(
      (row) =>
        row.risks_problems,
    )?.risks_problems;

  if (
    risksRaw
  ) {
    riskText +=
      ` Field risks: ${risksRaw}.`;

    reasons.push(
      'Field-reported risks noted.',
    );
  }

  let logisticsPenalty =
    0;

  if (
    logisticsRaw &&
    /disrupt|blocked|constrain/i.test(
      logisticsRaw,
    )
  ) {
    logisticsPenalty -= 5;
  }

  if (
    importRaw &&
    /restrict|ban/i.test(
      importRaw,
    )
  ) {
    logisticsPenalty -= 5;
  }

  const competitionPenalty =
    competitorRaw
      ? -3
      : 0;

  const opportunityScore =
    Math.round(
      demandScoreValue *
        0.25 +
        supplyScore *
        0.15 +
        sentimentScore *
        0.15 +
        (
          recommendation ===
          'GO'
            ? 25
            : recommendation ===
                'MONITOR'
              ? 15
              : recommendation ===
                  'HOLD'
                ? 5
                : recommendation ===
                    'NO-GO'
                  ? 0
                  : 10
        ) +
        (
          criticalAnomalies.length >
          0
            ? -10
            : 0
        ) +
        logisticsPenalty +
        competitionPenalty,
    );

  const dataPoints =
    points.length +
    input.marketRows.length +
    input.researchResults.length +
    input.stockRows.length +
    input.shipmentRows.length;

  let confidence:
    Confidence = 'LOW';

  if (
    dataPoints >= 5 &&
    findings.conflicts.length ===
      0
  ) {
    confidence =
      'HIGH';
  } else if (
    dataPoints >= 2
  ) {
    confidence =
      'MEDIUM';
  }

  const hasLocalData =
    input.marketRows.some(
      (row) =>
        (
          input.city &&
          row.city?.toLowerCase() ===
            input.city.toLowerCase()
        ) ||
        (
          input.destination &&
          row.country?.toLowerCase() ===
            input.destination.toLowerCase()
        ),
    );

  if (
    !hasLocalData &&
    input.city
  ) {
    confidence =
      confidence === 'HIGH'
        ? 'MEDIUM'
        : 'LOW';

    warnings.push(
      `No verified local market data for ${input.city} — evaluation based on external/estimated sources only.`,
    );
  }

  if (
    input.fxRates.length ===
      0 &&
    landed?.total != null
  ) {
    confidence =
      confidence === 'HIGH'
        ? 'MEDIUM'
        : 'LOW';

    warnings.push(
      'FX rates are ESTIMATED (fallback) — landed cost accuracy is reduced.',
    );
  }

  let cappedScore =
    clamp(
      opportunityScore,
      0,
      100,
    );

  if (
    confidence === 'LOW' &&
    !hasLocalData
  ) {
    cappedScore =
      Math.min(
        cappedScore,
        30,
      );
  }

  const allGaps = [
    ...gaps,
    ...warnings,
  ];

  return {
    commodity:
      input.commodity ??
      'Unknown',

    origin:
      input.origin,

    destination:
      input.destination,

    city:
      input.city,

    opportunity_score:
      cappedScore,

    demand_assessment:
      demandText,

    supply_assessment:
      supplyText,

    competition_assessment:
      competitionText,

    price_attractiveness:
      priceText,

    logistics_feasibility:
      logisticsText,

    market_sentiment:
      sentimentText,

    risk_assessment:
      riskText,

    confidence_level:
      confidence,

    recommendation:
      recommendation,

    key_reasons:
      reasons.length > 0
        ? reasons
        : [
            'No positive or negative signals strong enough to highlight.',
          ],

    data_gaps:
      allGaps,
  };
}
