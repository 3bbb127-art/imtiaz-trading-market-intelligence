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

  comparisonMarkets?: string[];
  comparisonContext?: string | null;

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

function confidenceRank(
  confidence: Confidence,
): number {
  return CONFIDENCE_RANK[confidence] ?? 0;
}

function isComparisonWorkflow(
  input: EngineInput,
): boolean {
  return (
    input.objective === 'compare' &&
    (input.comparisonMarkets?.length ?? 0) >= 2
  );
}

function comparisonMarkets(
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

function entityVariants(
  entity: string,
): string[] {
  const normalized = normalizeText(entity);
  const variants = new Set<string>();

  if (!normalized) {
    return [];
  }

  variants.add(normalized);

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
  const normalized = normalizeText(text);

  if (!normalized) {
    return false;
  }

  return entityVariants(entity).some((variant) => {
    const pattern = new RegExp(
      `\\b${escapeRegex(variant)}\\b`,
      'i',
    );

    return pattern.test(normalized);
  });
}

// -----------------------------------------------------------------------------
// Global market location dictionary
// -----------------------------------------------------------------------------

const KNOWN_COUNTRIES: Record<string, string> = {
  afghanistan: 'Afghanistan',
  albania: 'Albania',
  algeria: 'Algeria',
  argentina: 'Argentina',
  armenia: 'Armenia',
  australia: 'Australia',
  austria: 'Austria',
  azerbaijan: 'Azerbaijan',
  bangladesh: 'Bangladesh',
  belarus: 'Belarus',
  belgium: 'Belgium',
  brazil: 'Brazil',
  bulgaria: 'Bulgaria',
  cambodia: 'Cambodia',
  canada: 'Canada',
  chile: 'Chile',
  china: 'China',
  colombia: 'Colombia',
  croatia: 'Croatia',
  'czech republic': 'Czech Republic',
  denmark: 'Denmark',
  egypt: 'Egypt',
  estonia: 'Estonia',
  france: 'France',
  georgia: 'Georgia',
  germany: 'Germany',
  greece: 'Greece',
  hungary: 'Hungary',
  india: 'India',
  indonesia: 'Indonesia',
  iran: 'Iran',
  iraq: 'Iraq',
  ireland: 'Ireland',
  israel: 'Israel',
  italy: 'Italy',
  japan: 'Japan',
  jordan: 'Jordan',
  kazakhstan: 'Kazakhstan',
  kenya: 'Kenya',
  kuwait: 'Kuwait',
  kyrgyzstan: 'Kyrgyzstan',
  lebanon: 'Lebanon',
  malaysia: 'Malaysia',
  mexico: 'Mexico',
  moldova: 'Moldova',
  mongolia: 'Mongolia',
  morocco: 'Morocco',
  nepal: 'Nepal',
  netherlands: 'Netherlands',
  'new zealand': 'New Zealand',
  nigeria: 'Nigeria',
  norway: 'Norway',
  oman: 'Oman',
  pakistan: 'Pakistan',
  philippines: 'Philippines',
  poland: 'Poland',
  portugal: 'Portugal',
  qatar: 'Qatar',
  romania: 'Romania',
  russia: 'Russia',
  'saudi arabia': 'Saudi Arabia',
  serbia: 'Serbia',
  singapore: 'Singapore',
  'south africa': 'South Africa',
  'south korea': 'South Korea',
  spain: 'Spain',
  'sri lanka': 'Sri Lanka',
  sudan: 'Sudan',
  sweden: 'Sweden',
  switzerland: 'Switzerland',
  syria: 'Syria',
  tajikistan: 'Tajikistan',
  thailand: 'Thailand',
  tunisia: 'Tunisia',
  turkey: 'Turkey',
  turkmenistan: 'Turkmenistan',
  ukraine: 'Ukraine',
  'united arab emirates': 'United Arab Emirates',
  'united kingdom': 'United Kingdom',
  'united states': 'United States',
  uzbekistan: 'Uzbekistan',
  venezuela: 'Venezuela',
  vietnam: 'Vietnam',
  yemen: 'Yemen',
  zambia: 'Zambia',
  zimbabwe: 'Zimbabwe',
  'european union': 'European Union',
  usa: 'United States',
  us: 'United States',
  uae: 'United Arab Emirates',
  uk: 'United Kingdom',
};

const KNOWN_CITIES: Record<string, string> = {
  kabul: 'Kabul',
  'mazar-e-sharif': 'Mazar-e-Sharif',
  'mazar-i-sharif': 'Mazar-e-Sharif',
  mazar: 'Mazar-e-Sharif',
  herat: 'Herat',
  kandahar: 'Kandahar',
  jalalabad: 'Jalalabad',
  kunduz: 'Kunduz',
  karachi: 'Karachi',
  lahore: 'Lahore',
  islamabad: 'Islamabad',
  peshawar: 'Peshawar',
  delhi: 'Delhi',
  'new delhi': 'New Delhi',
  mumbai: 'Mumbai',
  chennai: 'Chennai',
  kolkata: 'Kolkata',
  almaty: 'Almaty',
  astana: 'Astana',
  moscow: 'Moscow',
  'saint petersburg': 'Saint Petersburg',
  novosibirsk: 'Novosibirsk',
  tashkent: 'Tashkent',
  samarkand: 'Samarkand',
  dubai: 'Dubai',
  'abu dhabi': 'Abu Dhabi',
  tehran: 'Tehran',
  mashhad: 'Mashhad',
  istanbul: 'Istanbul',
  ankara: 'Ankara',
  beijing: 'Beijing',
  shanghai: 'Shanghai',
  guangzhou: 'Guangzhou',
  shenzhen: 'Shenzhen',
  london: 'London',
  'new york': 'New York',
  chicago: 'Chicago',
  houston: 'Houston',
  singapore: 'Singapore',
  jakarta: 'Jakarta',
  bangkok: 'Bangkok',
  'ho chi minh': 'Ho Chi Minh',
  hanoi: 'Hanoi',
  seoul: 'Seoul',
  tokyo: 'Tokyo',
  osaka: 'Osaka',
  frankfurt: 'Frankfurt',
  hamburg: 'Hamburg',
  rotterdam: 'Rotterdam',
  paris: 'Paris',
  milan: 'Milan',
  madrid: 'Madrid',
  cairo: 'Cairo',
  lagos: 'Lagos',
  nairobi: 'Nairobi',
  johannesburg: 'Johannesburg',
  'cape town': 'Cape Town',
  'sao paulo': 'Sao Paulo',
  'buenos aires': 'Buenos Aires',
};

// -----------------------------------------------------------------------------
// Comparison scope
// -----------------------------------------------------------------------------

function rowMatchesComparisonMarket(
  row: RawMarketRow,
  markets: string[],
): boolean {
  if (markets.length < 2) {
    return true;
  }

  const fields = [
    row.country,
    row.origin,
    row.city,
    row.market,
  ];

  return markets.some((market) =>
    fields.some(
      (field) =>
        field != null &&
        entityMatchesText(
          market,
          String(field),
        ),
    ),
  );
}

function scopeMarketRows(
  input: EngineInput,
): RawMarketRow[] {
  if (
    !isComparisonWorkflow(input)
  ) {
    return input.marketRows;
  }

  const markets =
    comparisonMarkets(input);

  return input.marketRows.filter(
    (row) =>
      rowMatchesComparisonMarket(
        row,
        markets,
      ),
  );
}

function researchResultMatchesMarket(
  result: ResearchProviderResult,
  market: string,
): boolean {
  const text =
    `${result.title} ${result.snippet}`;

  return entityMatchesText(
    market,
    text,
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

  const markets =
    comparisonMarkets(input);

  return input.researchResults.filter(
    (result) =>
      markets.some((market) =>
        researchResultMatchesMarket(
          result,
          market,
        ),
      ),
  );
}

// -----------------------------------------------------------------------------
// Research units / FX
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

  if (
    inverse &&
    inverse.rate > 0
  ) {
    return {
      rate:
        1 / inverse.rate,
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
      ? dates[
          dates.length - 1
        ]
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
        const value =
          (
            shipment.status ??
            'planned'
          )
            .toLowerCase()
            .replace(
              /\s+/g,
              '_',
            );

        if (
          value.includes(
            'transit',
          )
        ) {
          acc.in_transit +=
            1;
        } else if (
          value.includes(
            'arriv',
          )
        ) {
          acc.arrived +=
            1;
        } else if (
          value.includes(
            'delay',
          )
        ) {
          acc.delayed +=
            1;
        } else if (
          value.includes(
            'cancel',
          )
        ) {
          acc.cancelled +=
            1;
        } else {
          acc.planned +=
            1;
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

  const quantityInTransit =
    shipments
      .filter(
        (shipment) =>
          /transit/i.test(
            shipment.status ??
              '',
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

  const expectedQuantity =
    shipments
      .filter(
        (shipment) =>
          /planned|transit|delay/i.test(
            shipment.status ??
              '',
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

  const summary =
    [
      `${rows.length} stock record(s)`,

      `available ${
        rows.length > 0
          ? `${sum(
              'available_stock',
            )}${
              unit
                ? ` ${unit}`
                : ''
            }`
          : 'UNKNOWN'
      }`,

      `in-transit stock ${
        rows.length > 0
          ? `${sum(
              'in_transit_stock',
            )}${
              unit
                ? ` ${unit}`
                : ''
            }`
          : 'UNKNOWN'
      }`,

      `expected incoming ${
        rows.length > 0
          ? `${sum(
              'expected_incoming',
            )}${
              unit
                ? ` ${unit}`
                : ''
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
        sum(
          'available_stock',
        ),
      reserved:
        sum(
          'reserved_stock',
        ),
      in_transit:
        sum(
          'in_transit_stock',
        ),
      expected_incoming:
        sum(
          'expected_incoming',
        ),
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
        quantityInTransit,
      expected_quantity:
        expectedQuantity,
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
// Supply / Demand classification
// -----------------------------------------------------------------------------
function mapSupply(
  row: RawMarketRow,
): SupplyLevel | null {
  const value =
    normalizeText(
      row.supply,
    );

  if (!value) {
    return null;
  }

  if (
    /\b(critical supply|severe supply shortage|acute supply shortage|supply crisis|critical shortage|severe shortage|acute shortage|famine|starvation)\b/i.test(
      value,
    )
  ) {
    return 'Critical';
  }

  if (
    /\b(shortage|supply shortage|tight supply|constrained supply|supply disruption|depleted stocks?|depleted supply|scarce supply|insufficient supply|supply shortfall|supply constraint|constrained availability|limited availability|crop failure|failed harvest|poor harvest|reduced harvest|lower production|declining production|production decline|export ban|export restriction|supply restriction)\b/i.test(
      value,
    )
  ) {
    return 'Tight';
  }

  if (
    /\b(abundant supply|abundant supplies|surplus supply|supply surplus|oversupply|excess supply|ample supply|ample supplies|high supply|strong supply availability|bumper harvest|record production|record harvest|record crop|high production|excess production|overproduction|increased production|rising production|higher production|good harvest|strong harvest|large stocks?|high stocks?|rising stocks?|ample stocks?)\b/i.test(
      value,
    )
  ) {
    return 'High';
  }

  if (
    /\b(adequate supply|adequate supplies|sufficient supply|sufficient supplies|normal supply|stable supply|steady supply|balanced supply|supply remains stable|supply is stable|supply is normal|supply is adequate|supply is sufficient|normal availability|stable availability|steady availability|adequate availability|sufficient availability|available stocks?|stocks? (?:normal|stable|adequate|sufficient))\b/i.test(
      value,
    )
  ) {
    return 'Normal';
  }

  return null;
}

function mapDemand(
  row: RawMarketRow,
): DemandLevel | null {
  const value =
    normalizeText(
      row.demand,
    );

  if (!value) {
    return null;
  }

  if (
    /\b(surging demand|surge in demand|demand surge|soaring demand|explosive demand|sky-high demand|exceptionally strong demand|sharp increase in demand|spike in demand|demand is surging|demand is soaring|demand surged|demand spiked)\b/i.test(
      value,
    )
  ) {
    return 'Surging';
  }

  if (
    /\b(strong demand|robust demand|high demand|rising demand|increasing demand|growing demand|increased demand|demand is strong|demand is robust|demand remains strong|demand increased|demand rising|demand grew|demand growth|rising consumption|increasing consumption|growing consumption|increased consumption|higher consumption|strong buying|strong purchases|increased buying activity|stronger buying activity|increased import demand|rising import demand|strong import demand|increased household demand|strong household demand|rising household demand|increased industrial demand|strong industrial demand|rising industrial demand)\b/i.test(
      value,
    )
  ) {
    return 'Strong';
  }

  if (
    /\b(weak demand|low demand|declining demand|falling demand|dropping demand|reduced demand|weaker demand|sluggish demand|soft demand|demand is weak|demand is low|demand remains weak|demand declined|demand decreased|demand fell|demand dropped|lower demand|falling consumption|declining consumption|reduced consumption|lower consumption|weak buying|weak purchases|reduced buying activity|weaker buying activity|reduced import demand|falling import demand)\b/i.test(
      value,
    )
  ) {
    return 'Weak';
  }

  if (
    /\b(normal demand|stable demand|steady demand|moderate demand|balanced demand|demand is normal|demand is stable|demand is steady|demand remains stable|demand remains steady|demand stayed stable|demand stayed steady|stable consumption|steady consumption|moderate consumption)\b/i.test(
      value,
    )
  ) {
    return 'Normal';
  }

  return null;
}
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
    /\b(adequate suppl(?:y|ies)|normal supply|stable supply|sufficient supply|steady supply|ample|available|in stock|stocks? (?:normal|stable|adequate)|harvest (?:normal|on track|progressing))\b/.test(
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

  const uniqueLevels = [
    ...new Set(
      signals.map(
        (signal) =>
          signal.level,
      ),
    ),
  ];

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

  const level =
    uniqueLevels[0];

  return {
    level,
    evidence:
      signals.map(
        (signal) =>
          `${kind.charAt(0).toUpperCase() + kind.slice(1)} (${level}): ${signal.source} (${signal.url})`,
      ),
    conflict: false,
  };
} 
// -----------------------------------------------------------------------------
// Price location extraction
// -----------------------------------------------------------------------------

interface ResearchLocation {
  name: string;
  kind: 'city' | 'country';
  index: number;
}

function locationsInText(
  text: string,
): ResearchLocation[] {
  const results: ResearchLocation[] = [];

  const lower =
    text.toLowerCase();

  const cityEntries =
    Object.entries(
      KNOWN_CITIES,
    ).sort(
      ([a], [b]) =>
        b.length - a.length,
    );

  for (
    const [key, display]
    of cityEntries
  ) {
    const pattern =
      new RegExp(
        `\\b${escapeRegex(key)}\\b`,
        'i',
      );

    const match =
      pattern.exec(lower);

    if (match) {
      results.push({
        name: display,
        kind: 'city',
        index: match.index,
      });
    }
  }

  const countryEntries =
    Object.entries(
      KNOWN_COUNTRIES,
    ).sort(
      ([a], [b]) =>
        b.length - a.length,
    );

  for (
    const [key, display]
    of countryEntries
  ) {
    const pattern =
      new RegExp(
        `\\b${escapeRegex(key)}\\b`,
        'i',
      );

    const match =
      pattern.exec(lower);

    if (match) {
      results.push({
        name: display,
        kind: 'country',
        index: match.index,
      });
    }
  }

  return results.sort(
    (a, b) =>
      a.index - b.index,
  );
}

function locationNearPrice(
  text: string,
  priceIndex: number,
): ResearchLocation | null {
  const locations =
    locationsInText(text);

  if (
    locations.length === 0
  ) {
    return null;
  }

  /**
   * Prefer a country/city directly associated with the price.
   * Examples:
   *   India stood at $376/ton
   *   Pakistan $353/ton
   *   Pakistan 5% broken WR prices ... $452/mt FOB
   */
  const directCandidates =
    locations
      .filter(
        (location) =>
          location.index <
          priceIndex,
      )
      .map(
        (location) => {
          const between =
            text.slice(
              location.index +
                location.name.length,
              priceIndex,
            );

          return {
            location,
            between,
          };
        },
      )
      .filter(
        ({
          between,
        }) =>
          /^[\s'’,-]*(?:stood\s+at|was\s+at|were\s+at|is\s+at|are\s+at|at|quoted\s+at|priced\s+at|traded\s+at|have\s+also\s+slumped\s+to|slumped\s+to)?[\s'’,-]*$/i.test(
            between,
          ),
      )
      .sort(
        (a, b) =>
          priceIndex -
          a.location.index -
          (
            priceIndex -
            b.location.index
          ),
      );

  if (
    directCandidates.length > 0
  ) {
    return directCandidates[0]
      .location;
  }

  /**
   * Conservative fallback:
   * only accept a preceding location when it is very close.
   * This prevents one country from leaking into later prices.
   */
  const nearby =
    locations
      .filter(
        (location) =>
          location.index <
            priceIndex &&
          priceIndex -
            location.index <=
            45,
      )
      .sort(
        (a, b) =>
          (
            priceIndex -
            a.index
          ) -
          (
            priceIndex -
            b.index
          ),
      );

  return nearby[0] ?? null;
}
function priceIsAttributableToComparisonMarket(
  location: ResearchLocation | null,
  text: string,
  priceIndex: number,
  markets: string[],
): boolean {
  if (
    markets.length < 2
  ) {
    return false;
  }

  /**
   * Strongest signal:
   * the directly associated location is one of the requested markets.
   */
  if (
    location &&
    markets.some(
      (market) =>
        entityMatchesText(
          market,
          location.name,
        ),
    )
  ) {
    return true;
  }

  /**
   * Conservative local attribution.
   *
   * Do not inspect a large paragraph. A price can only inherit
   * comparison-market attribution from a narrow sentence-level window.
   */
  const localWindow =
    text.slice(
      Math.max(
        0,
        priceIndex - 70,
      ),
      Math.min(
        text.length,
        priceIndex + 45,
      ),
    );

  /**
   * Reject local text that mentions multiple comparison markets.
   * Example:
   *   "India ... Pakistan ... $353"
   *
   * Without a direct location immediately attached to the price,
   * attribution is ambiguous and must not be invented.
   */
  const matchedMarkets =
    markets.filter(
      (market) =>
        entityMatchesText(
          market,
          localWindow,
        ),
    );

  if (
    matchedMarkets.length !==
    1
  ) {
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Price extraction
// -----------------------------------------------------------------------------

function extractPricePointsFromResearch(
  input: EngineInput,
): PricePoint[] {
  const points: PricePoint[] = [];

  const research =
    scopeResearchResults(input);

  const isComparison =
    isComparisonWorkflow(input);

  const markets =
    comparisonMarkets(input);

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const symbolCurrency: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
  };

  const addPoint = (
    result: ResearchProviderResult,
    location: string,
    price: number,
    currency: string,
    unit: string,
    note: string,
  ) => {
    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return;
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
        `${result.title || 'Web research'} — ${location}`,

      location,

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

      note,
    });
  };

  /**
   * Global country aliases used only for structured market-price tables.
   */
  const tableCountryAliases: Record<string, string> = {
    argentina: 'Argentina',
    australia: 'Australia',
    canada: 'Canada',
    china: 'China',
    'european union': 'European Union',
    eu: 'European Union',
    france: 'France',
    germany: 'Germany',
    hungary: 'Hungary',
    india: 'India',
    iran: 'Iran',
    italy: 'Italy',
    japan: 'Japan',
    kazakhstan: 'Kazakhstan',
    malaysia: 'Malaysia',
    mexico: 'Mexico',
    netherlands: 'Netherlands',
    pakistan: 'Pakistan',
    poland: 'Poland',
    romania: 'Romania',
    russia: 'Russia',
    russian: 'Russia',
    serbia: 'Serbia',
    singapore: 'Singapore',
    'south africa': 'South Africa',
    spain: 'Spain',
    thailand: 'Thailand',
    turkey: 'Turkey',
    ukraine: 'Ukraine',
    'united kingdom': 'United Kingdom',
    'united states': 'United States',
    usa: 'United States',
    us: 'United States',
    uzbekistan: 'Uzbekistan',
    vietnam: 'Vietnam',
  };

  const countryKeys =
    Object.keys(
      tableCountryAliases,
    ).sort(
      (a, b) =>
        b.length -
        a.length,
    );

  const countryPattern =
    countryKeys
      .map(escapeRegex)
      .join('|');

  /**
   * Explicit price forms:
   *
   * USD 420/MT
   * $420/MT
   * €240 per tonne
   * $233-236/MT
   */
  const explicitPriceRegex =
    /(?:(USD|EUR|GBP|RUB|KZT|AFN|PKR|INR|CNY|VND|THB|TRY|IRR|AED|JPY|CAD|AUD|CHF|SAR|QAR)\s*([0-9][\d,]*(?:\.\d+)?)|(\$|€|£)\s*([0-9][\d,]*(?:\.\d+)?))(?:(?:\s*[–-]\s*)([0-9][\d,]*(?:\.\d+)?))?\s*(?:per\s+|\/\s*)(kg|kilo|kilogram|ton|tonne|mt|metric ton|bag|lb|pound|litre|liter)\b/gi;

  for (
    const result of research
  ) {
    const text =
      `${result.title} ${result.snippet}`;

    const lower =
      text.toLowerCase();

    // -------------------------------------------------------------------------
    // A. Explicitly formatted prices
    // -------------------------------------------------------------------------

    explicitPriceRegex.lastIndex = 0;

    let match:
      RegExpExecArray | null;

    while (
      (
        match =
          explicitPriceRegex.exec(text)
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
            match.index - 180,
          ),
          match.index,
        );

      /**
       * Ignore numeric amounts that are clearly describing a change
       * rather than a market price.
       */
      const changeAmount =
        /\b(?:fell|fallen|dropped|declined|decreased|reduced|down)\b[^.]{0,140}\bby\b[^.]{0,100}(?:usd|eur|gbp|rub|kzt|afn|pkr|inr|cny|vnd|thb|try|irr|aed|jpy|cad|aud|chf|sar|qar|\$|€|£)?\s*[0-9][\d,]*(?:\.\d+)?\s*$/i.test(
          contextBefore,
        );

      if (changeAmount) {
        continue;
      }

      const location =
        locationNearPrice(
          text,
          match.index,
        );

      /**
       * Comparison safety:
       * Afghanistan/context is never enough.
       */
      if (
        isComparison &&
        !priceIsAttributableToComparisonMarket(
          location,
          text,
          match.index,
          markets,
        )
      ) {
        continue;
      }

      addPoint(
        result,
        location?.name ??
          'Web research (global)',
        price,
        currency,
        unit,
        `Explicit price extracted from web research. Source: ${result.url}${
          high != null
            ? ` Range ${low}–${high}; midpoint used.`
            : ''
        }`,
      );
    }

    // -------------------------------------------------------------------------
    // B. Structured country → price table extraction
    //
    // Example:
    //
    // Argentina Australia Canada EU Russia United States
    // $239 $291 $292 $262 $224 $321
    //
    // The table is accepted only when:
    //   1. It is clearly a price/FOB table.
    //   2. At least two countries are found.
    //   3. The country count equals the price count.
    //   4. Comparison mode emits only requested comparison markets.
    //   5. The unit is supported by surrounding text.
    // -------------------------------------------------------------------------

    const hasPriceTableContext =
      /\b(?:fob|export bids?|export prices?|price assessments?|daily fob|international daily fob)\b/i.test(
        text,
      ) &&
      /(?:\$\s*\/\s*mt|usd\s*\/\s*mt|usd\s*per\s*mt|dollars?\s*\/\s*mt)/i.test(
        text,
      );

    if (!hasPriceTableContext) {
      continue;
    }

    const tableRegex =
      new RegExp(
        `((?:\\b(?:${countryPattern})\\b[\\s,|]*){2,})((?:\\$\\s*[0-9][\\d,]*(?:\\.\\d+)?[\\s,|]*){2,})`,
        'gi',
      );

    tableRegex.lastIndex = 0;

    let tableMatch:
      RegExpExecArray | null;

    while (
      (
        tableMatch =
          tableRegex.exec(text)
      ) !== null
    ) {
      const countryBlock =
        tableMatch[1];

      const priceBlock =
        tableMatch[2];

      const countries =
        Array.from(
          countryBlock.matchAll(
            new RegExp(
              `\\b(${countryPattern})\\b`,
              'gi',
            ),
          ),
        ).map(
          (item) =>
            tableCountryAliases[
              item[1].toLowerCase()
            ],
        );

      const prices =
        Array.from(
          priceBlock.matchAll(
            /\$\s*([0-9][\d,]*(?:\.\d+)?)/g,
          ),
        ).map(
          (item) =>
            Number(
              item[1].replace(
                /,/g,
                '',
              ),
            ),
        );

      if (
        countries.length < 2 ||
        countries.length !==
          prices.length
      ) {
        continue;
      }

      for (
        let i = 0;
        i < countries.length;
        i += 1
      ) {
        const country =
          countries[i];

        const price =
          prices[i];

        if (
          !country ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          continue;
        }

        /**
         * In comparison mode only emit the requested markets.
         * Context country is never treated as a comparison market.
         */
        if (
          isComparison &&
          !markets.some(
            (market) =>
              normalizeText(
                market,
              ) ===
                normalizeText(
                  country,
                ) ||
              entityMatchesText(
                market,
                country,
              ),
          )
        ) {
          continue;
        }

        addPoint(
          result,
          country,
          price,
          'USD',
          'MT',
          `Structured FOB country-price table extracted from ${result.url}. Country-to-price position matched from the published table; not inferred from market context.`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // De-duplicate identical observations.
  // ---------------------------------------------------------------------------

  const unique =
    new Map<
      string,
      PricePoint
    >();

  for (
    const point of points
  ) {
    const key = [
      point.source,
      point.location,
      point.price,
      point.currency,
      point.unit,
      point.observation_date,
    ].join('|');

    if (
      !unique.has(key)
    ) {
      unique.set(
        key,
        point,
      );
    }
  }

  return [
    ...unique.values(),
  ];
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

  const storedRows =
    scopeMarketRows(input);

  for (
    const row of storedRows
  ) {
    if (
      commodity &&
      row.commodity?.toLowerCase() !==
        commodity
    ) {
      continue;
    }

    if (
      isComparisonWorkflow(input) &&
      !rowMatchesComparisonMarket(
        row,
        comparisonMarkets(input),
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
      const dateCompare =
        (
          b.observation_date ??
          ''
        ).localeCompare(
          a.observation_date ??
          '',
        );

      if (
        dateCompare !== 0
      ) {
        return dateCompare;
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
        point.normalized_price_usd !=
          null &&
        point.normalized_price_usd >
          0 &&
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
      prior.normalized_price_usd >
        0
    ) {
      return {
        recent:
          recent.normalized_price_usd,

        prior:
          prior.normalized_price_usd,

        change:
          (
            recent.normalized_price_usd -
            prior.normalized_price_usd
          ) /
          prior.normalized_price_usd,
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Supply / demand engine
// -----------------------------------------------------------------------------

export function supplyDemandEngine(
  input: EngineInput,
): {
  supply: SupplyLevel;
  demand: DemandLevel;
  evidence: string;
  conflicts: string[];
} {
  const evidence: string[] = [];
  const conflicts: string[] = [];

  const comparison =
    isComparisonWorkflow(input);

  const markets =
    comparison
      ? comparisonMarkets(input)
      : [];

  /**
   * ---------------------------------------------------------------------------
   * Helper: classify research signals only for one specific market.
   *
   * A comparison market must have its own evidence. Evidence mentioning
   * another country must not automatically become evidence for this market.
   * ---------------------------------------------------------------------------
   */
  const signalsForMarket = (
    market: string,
    results: ResearchProviderResult[],
  ): {
    supplySignals: ResearchSignal[];
    demandSignals: ResearchSignal[];
  } => {
    const supplySignals: ResearchSignal[] = [];
    const demandSignals: ResearchSignal[] = [];

    for (
      const result of results
    ) {
      const text =
        `${result.title} ${result.snippet}`;

      const locations =
        locationsInText(text);

      const marketLocation =
        locations.find(
          (location) =>
            entityMatchesText(
              market,
              location.name,
            ),
        );

      if (!marketLocation) {
        continue;
      }

      /**
       * Only inspect a local evidence window around the market mention.
       * This reduces cross-country contamination in multi-country articles.
       */
      const start =
        Math.max(
          0,
          marketLocation.index - 180,
        );

      const end =
        Math.min(
          text.length,
          marketLocation.index + 320,
        );

      const localText =
        text.slice(
          start,
          end,
        );

      const supply =
        classifySupplyFromText(
          localText,
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
          localText,
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
  };

  /**
   * ---------------------------------------------------------------------------
   * Comparison mode
   * ---------------------------------------------------------------------------
   *
   * For comparisons we deliberately keep the final public engine contract
   * backward-compatible (one supply + one demand value), but the evidence is
   * resolved per market first.
   *
   * This prevents a statement about India from being copied into Pakistan,
   * or vice versa.
   * ---------------------------------------------------------------------------
   */
  if (
    comparison &&
    markets.length >= 2
  ) {
    const marketAssessments =
      markets.map(
        (market) => {
          const scopedResults =
            input.researchResults.filter(
              (result) =>
                researchResultMatchesMarket(
                  result,
                  market,
                ),
            );

          const {
            supplySignals,
            demandSignals,
          } =
            signalsForMarket(
              market,
              scopedResults,
            );

          const supplyResolved =
            resolveSignals(
              supplySignals,
              'supply',
            );

          const demandResolved =
            resolveSignals(
              demandSignals,
              'demand',
            );

          return {
            market,
            supply:
              supplyResolved.level as SupplyLevel,
            demand:
              demandResolved.level as DemandLevel,
            supplyEvidence:
              supplyResolved.evidence,
            demandEvidence:
              demandResolved.evidence,
            supplyConflict:
              supplyResolved.conflict,
            demandConflict:
              demandResolved.conflict,
          };
        },
      );

    /**
     * Build market-specific evidence first.
     */
    for (
      const assessment
      of marketAssessments
    ) {
      evidence.push(
        `${assessment.market} — Supply: ${assessment.supply}.`,
      );

      evidence.push(
        `${assessment.market} — Demand: ${assessment.demand}.`,
      );

      evidence.push(
        ...assessment.supplyEvidence,
      );

      evidence.push(
        ...assessment.demandEvidence,
      );

      if (
        assessment.supplyConflict
      ) {
        conflicts.push(
          `${assessment.market}: conflicting supply evidence.`,
        );
      }

      if (
        assessment.demandConflict
      ) {
        conflicts.push(
          `${assessment.market}: conflicting demand evidence.`,
        );
      }
    }

    /**
     * We only publish a single aggregate supply/demand value when both
     * comparison markets agree.
     *
     * This is conservative and avoids pretending one market represents both.
     */
    const supplyLevels =
      marketAssessments.map(
        (assessment) =>
          assessment.supply,
      );

    const demandLevels =
      marketAssessments.map(
        (assessment) =>
          assessment.demand,
      );

    const uniqueSupply =
      [
        ...new Set(
          supplyLevels,
        ),
      ];

    const uniqueDemand =
      [
        ...new Set(
          demandLevels,
        ),
      ];

    const supply =
      uniqueSupply.length ===
        1 &&
      uniqueSupply[0] !==
        'Unknown'
        ? uniqueSupply[0]
        : 'Unknown';

    const demand =
      uniqueDemand.length ===
        1 &&
      uniqueDemand[0] !==
        'Unknown'
        ? uniqueDemand[0]
        : 'Unknown';

    if (
      uniqueSupply.length > 1
    ) {
      conflicts.push(
        `Comparison markets have different supply assessments: ${markets[0]} vs ${markets[1]}. Aggregate supply is therefore reported as Unknown.`,
      );
    }

    if (
      uniqueDemand.length > 1
    ) {
      conflicts.push(
        `Comparison markets have different demand assessments: ${markets[0]} vs ${markets[1]}. Aggregate demand is therefore reported as Unknown.`,
      );
    }

    return {
      supply,
      demand,
      evidence:
        evidence.length > 0
          ? evidence.join('; ')
          : INSUFFICIENT,
      conflicts,
    };
  }

  /**
   * ---------------------------------------------------------------------------
   * Standard non-comparison mode
   * ---------------------------------------------------------------------------
   */

  let supply:
    SupplyLevel = 'Unknown';

  let demand:
    DemandLevel = 'Unknown';

  const relevantRows =
    input.commodity
      ? scopeMarketRows(
          input,
        ).filter(
          (row) =>
            row.commodity?.toLowerCase() ===
            input.commodity!.toLowerCase(),
        )
      : scopeMarketRows(
          input,
        );

  for (
    const row of relevantRows
  ) {
    const rowSupply =
      mapSupply(row);

    if (
      rowSupply &&
      supply === 'Unknown'
    ) {
      supply =
        rowSupply;

      evidence.push(
        `Supply (${row.country ?? row.market ?? 'market'}): ${rowSupply} — ${row.source ?? 'stored'}`,
      );
    }

    const rowDemand =
      mapDemand(row);

    if (
      rowDemand &&
      demand === 'Unknown'
    ) {
      demand =
        rowDemand;

      evidence.push(
        `Demand (${row.country ?? row.market ?? 'market'}): ${rowDemand} — ${row.source ?? 'stored'}`,
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

  return {
    supply,
    demand,
    evidence:
      evidence.join('; ') ||
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

  for (
    const row of scopeMarketRows(
      input,
    )
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

  for (
    const result
    of scopeResearchResults(
      input,
    )
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
      observedLevels.length ===
      1
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
    }
  } else if (
    inferred.length > 0
  ) {
    const inferredLevels =
      [
        ...new Set(
          inferred.map(
            (signal) =>
              signal.level,
          ),
        ),
      ];

    if (
      inferredLevels.length ===
      1
    ) {
      level =
        inferredLevels[0];

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
        [
          ...new Set(
            inferred
              .map(
                (signal) =>
                  signal.trend,
              )
              .filter(
                (value) =>
                  value !==
                  'UNKNOWN',
              ),
          ),
        ];

      if (
        trends.length === 1
      ) {
        trend =
          trends[0];
      }
    }
  }

  if (
    observed.length > 0
  ) {
    const conflict =
      new Set(
        observed.map(
          (signal) =>
            signal.level,
        ),
      ).size > 1;

    if (conflict) {
      level =
        'Unknown';

      confidence =
        'LOW';

      trend =
        'UNKNOWN';
    }
  } else if (
    inferred.length > 0
  ) {
    const conflict =
      new Set(
        inferred.map(
          (signal) =>
            signal.level,
        ),
      ).size > 1;

    if (conflict) {
      level =
        'Unknown';

      confidence =
        'LOW';

      trend =
        'UNKNOWN';
    }
  }

  const score =
    demandScore(level);

  let summary: string;

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
    priceChange &&
    priceChange.change >
      0.03
  ) {
    signal += 1;
    reasons.push(
      `Prices up ${(priceChange.change * 100).toFixed(1)}% recently.`,
    );
  }

  if (
    priceChange &&
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
      reasons.join('; '),
  };
}

// -----------------------------------------------------------------------------
// Landed cost
// -----------------------------------------------------------------------------

export function landedCostEngine(
  input: EngineInput,
): LandedCostBreakdown | null {
  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    return null;
  }

  if (
    !input.commodity ||
    !input.origin
  ) {
    return null;
  }

  const commodity =
    normalizeText(
      input.commodity,
    );

  const origin =
    normalizeText(
      input.origin,
    );

  const rows =
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
    rows[0];

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

  const fx =
    getUsdFxRate(
      purchase.currency,
      input.fxRates,
    );

  const purchaseUsd =
    fx.rate != null
      ? purchase.price *
        fx.rate
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
        fx.estimated
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
    priceChange &&
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
    priceChange &&
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

  const {
    supply,
    demand,
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

  const marketRisk:
    Forecast['market_risk'] =
    sentiment === 'Negative' ||
    supply === 'Critical'
      ? 'HIGH'
      : sentiment === 'Cautious' ||
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
      marketRisk,

    sentiment,

    confidence,

    rationale:
      rationale.join(' '),
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

  // ---------------------------------------------------------------------------
  // Comparison recommendation
  // ---------------------------------------------------------------------------

  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    const markets =
      comparisonMarkets(
        input,
      );

    const normalizedMarkets =
      markets.map(
        normalizeText,
      );

    const validPoints =
      points.filter(
        (point) =>
          point.price != null &&
          Number.isFinite(
            point.price,
          ) &&
          point.price > 0 &&
          !!point.location,
      );

    /**
     * Explicitly identify which requested comparison market has
     * at least one attributable price observation.
     */
    const marketCoverage =
      normalizedMarkets.map(
        (market) => {
          const matched =
            validPoints.filter(
              (point) =>
                normalizeText(
                  point.location,
                ) === market ||
                entityMatchesText(
                  market,
                  point.location,
                ),
            );

          return {
            market,
            count:
              matched.length,
          };
        },
      );

    const coveredMarkets =
      marketCoverage.filter(
        (item) =>
          item.count > 0,
      );

    /**
     * Both comparison markets must have direct price evidence.
     */
    if (
      coveredMarkets.length <
      2
    ) {
      const missingMarkets =
        marketCoverage
          .filter(
            (item) =>
              item.count === 0,
          )
          .map(
            (item) =>
              item.market,
          );

      return {
        rec:
          'NEED MORE DATA',

        rationale:
          `Direct price evidence is incomplete for the comparison. Missing attributable price data for: ${missingMarkets.join(', ')}.`,
      };
    }

    /**
     * Critical anomalies override a normal comparison recommendation.
     */
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
          `Critical market anomaly detected while comparing ${markets[0]} vs ${markets[1]}; do not use the comparison for immediate commitment decisions.`,
      };
    }

    /**
     * Comparison is informational, not an automatic import GO/NO-GO decision.
     */
    return {
      rec:
        'MONITOR',

      rationale:
        `Direct price evidence is available for both ${markets[0]} and ${markets[1]}; continue monitoring verified market signals and compare quality, specification, timing, and logistics before any purchase decision.`,
    };
  }

  // ---------------------------------------------------------------------------
  // Import-route recommendation
  // ---------------------------------------------------------------------------

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
      destinationPrice.price !=
        null &&
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
          margin > 0.1
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

  // ---------------------------------------------------------------------------
  // General market recommendation
  // ---------------------------------------------------------------------------

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
    const row of scopeMarketRows(
      input,
    )
  ) {
    const source =
      row.source ??
      'Stored data';

    if (
      seen.has(source)
    ) {
      continue;
    }

    seen.add(source);

    sources.push({
      name:
        source,

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
    const fx of input.fxRates
  ) {
    if (
      seen.has(fx.source)
    ) {
      continue;
    }

    seen.add(
      fx.source,
    );

    sources.push({
      name:
        fx.source,

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
    const point of points
  ) {
    if (
      point.normalized_price_usd !=
        null &&
      point.normalized_price_usd >
        0
    ) {
      (
        byLocation[
          point.location
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

  return results
    .slice(0, 6)
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

  if (
    /\b(proxy|proxies|vpn|security verification|application testing|residential ip|datacenter|checkout testing|seo|hosting|ip address|anonymous browsing)\b/i.test(
      text,
    )
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

  if (
    isComparisonWorkflow(
      input,
    )
  ) {
    const markets =
      comparisonMarkets(
        input,
      );

    const scopedRows =
      scopeMarketRows(input);

    if (
      scopedRows.length ===
      0
    ) {
      gaps.push(
        `No stored market observations for comparison markets: ${markets[0]} vs ${markets[1]}.`,
      );
    }

    const prices =
      pricePointEngine(
        input,
      );

    const priceLocations =
      new Set(
        prices
          .map(
            (point) =>
              normalizeText(
                point.location,
              ),
          )
          .filter(Boolean),
      );

    if (
      prices.length < 2 ||
      priceLocations.size < 2
    ) {
      gaps.push(
        `Fewer than two distinct directly attributable price observations are available for ${markets[0]} vs ${markets[1]}.`,
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
        `Web research returned results, but none could be directly attributed to ${markets[0]} or ${markets[1]}.`,
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

  return [
    ...new Set(gaps),
  ];
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

  const markets =
    comparisonMarkets(
      input,
    );

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
      ? `Comparison context: ${
          input.comparisonContext ??
          input.destination ??
          'global'
        }. Prices are scoped to ${markets[0]} vs ${markets[1]}; context-market prices are not comparison observations.`
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
    comparison
      ? `Comparison: ${markets[0]} vs ${markets[1]}${
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
            : 'No sufficient directly attributable comparison price observations found.'
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
      .available != null &&
    operational.stock
      .in_transit != null &&
    operational.stock
      .expected_incoming !=
      null &&
    (
      operational.stock
        .in_transit +
      operational.stock
        .expected_incoming
    ) >
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
        ? `No import origin is assigned. Comparison is ${markets[0]} vs ${markets[1]}.`
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
      logisticsRiskParts.join(' ') ||
      'No logistics disruption signals in scoped data.',

    key_risks:
      anomalies.map(
        (anomaly) =>
          `${anomaly.type}: ${anomaly.description}`,
      ),

    opportunities:
      comparison
        ? points.length >= 2
          ? [
              `Direct comparison evidence available for ${markets[0]} vs ${markets[1]}.`,
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
// Evaluation engine
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
  switch (sentiment) {
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
  if (
    isComparisonWorkflow(
      input,
    )
  ) {
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

  const supplyScoreValue =
    scoreSupply(supply);

  const sentimentScoreValue =
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
      `${supply} (score: ${supplyScoreValue}/100). ${
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
    operational.shipments.total >
    0
  ) {
    supplyText +=
      ` Shipments/wagons: ${operational.shipments.total} total, ${operational.shipments.in_transit} in transit, ${operational.shipments.delayed} delayed.`;

    if (
      operational.shipments.delayed >
      0
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

  const competitionText =
    competitorRaw
      ? `${competitorRaw}`
      : 'UNKNOWN — no competitor intelligence available.';

  if (
    competitorRaw
  ) {
    reasons.push(
      'Competitor activity noted in field data.',
    );
  } else {
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

  const logisticsText =
    logisticsParts.length > 0
      ? logisticsParts.join(
          ' | ',
        )
      : 'No logistics or trade status data — UNKNOWN.';

  const fieldSentiment =
    input.marketRows.find(
      (row) =>
        row.market_sentiment,
    )?.market_sentiment;

  let sentimentText:
    string;

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
      `${sentiment} (score: ${sentimentScoreValue}/100).`;

    if (
      fieldSentiment
    ) {
      sentimentText +=
        ` Field sentiment: ${fieldSentiment}.`;
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
  } else if (
    anomalies.length > 0
  ) {
    riskText =
      `MODERATE — ${anomalies.length} anomaly/anomalies detected.`;
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

  const logisticsPenalty =
    logisticsRaw &&
    /disrupt|blocked|constrain/i.test(
      logisticsRaw,
    )
      ? -5
      : 0;

  const competitionPenalty =
    competitorRaw
      ? -3
      : 0;

  const opportunityScore =
    Math.round(
      demandScoreValue *
        0.25 +
        supplyScoreValue *
        0.15 +
        sentimentScoreValue *
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

  let cappedScore =
    clamp(
      opportunityScore,
      0,
      100,
    );

  if (
    confidence === 'LOW' &&
    points.length === 0
  ) {
    cappedScore =
      Math.min(
        cappedScore,
        30,
      );
  }

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
      [
        ...gaps,
        ...warnings,
      ],
  };
}
