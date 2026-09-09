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

// ---- Constants ----

const INSUFFICIENT = 'INSUFFICIENT VERIFIED DATA — analysis limited by data gaps.';
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
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ---- Types ----

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
  researchStatus: 'OK' | 'ERROR' | 'NO_PROVIDER';
  researchMessage?: string;
}

// ---- Helpers ----

function normalizeResearchUnit(raw: string): string | null {
  const u = raw.toLowerCase().trim();

  if (u === 'kg' || u === 'kilo' || u === 'kilogram') return 'kg';
  if (
    u === 'ton' ||
    u === 'tonne' ||
    u === 'mt' ||
    u === 'metric ton'
  ) {
    return 'MT';
  }
  if (u === 'bag') return 'bag';
  if (u === 'lb' || u === 'pound') return 'lb';
  if (u === 'litre' || u === 'liter') return 'litre';

  return null;
}

function normalizeToUsdPerMt(
  price: number | null,
  currency: string | null,
  unit: string | null,
): number | null {
  if (price == null || !currency || !unit) return null;

  const rate = FALLBACK_USD_RATES[currency.toUpperCase()];
  if (rate == null) return null;

  const usd = price * rate;
  const u = unit.toLowerCase();

  if (u === 'kg' || u === 'kilo' || u === 'kilogram') return usd * 1000;

  if (
    u === 'ton' ||
    u === 'tonne' ||
    u === 'mt' ||
    u === 'metric ton'
  ) {
    return usd;
  }

  if (u === 'lb' || u === 'pound') return usd * 2204.62;

  // Do not invent bag weight or liquid density.
  if (u === 'bag') return null;
  if (u === 'litre' || u === 'liter') return null;

  return null;
}

function buildOperationalIntelligence(input: EngineInput) {
  const rows = input.commodity
    ? input.stockRows.filter(
        (r) =>
          r.commodity?.toLowerCase() === input.commodity!.toLowerCase(),
      )
    : input.stockRows;

  const shipments = input.commodity
    ? input.shipmentRows.filter(
        (r) =>
          r.commodity?.toLowerCase() === input.commodity!.toLowerCase(),
      )
    : input.shipmentRows;

  const sum = (field: keyof StockRecord) =>
    rows.reduce((n, r) => n + (Number(r[field] ?? 0) || 0), 0);

  const sortedDates = rows
    .map((r) => r.update_date)
    .filter(Boolean)
    .sort();

  const latest =
    sortedDates.length > 0
      ? sortedDates[sortedDates.length - 1]
      : null;

  const unit =
    rows.find((r) => r.unit)?.unit ??
    shipments.find((r) => r.unit)?.unit ??
    null;

  const status = shipments.reduce(
    (acc, s) => {
      const key = (s.status || 'Planned')
        .toLowerCase()
        .replace(/\s+/g, '_');

      if (key.includes('transit')) acc.in_transit += 1;
      else if (key.includes('arriv')) acc.arrived += 1;
      else if (key.includes('delay')) acc.delayed += 1;
      else if (key.includes('cancel')) acc.cancelled += 1;
      else acc.planned += 1;

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
    shipments.map((s) => s.expected_arrival).filter(Boolean).sort()[0] ??
    null;

  const inTransitQty = shipments
    .filter((s) => /transit/i.test(s.status))
    .reduce(
      (n, s) => n + (Number(s.quantity ?? 0) || 0),
      0,
    );

  const expectedQty = shipments
    .filter((s) => /planned|transit|delay/i.test(s.status))
    .reduce(
      (n, s) => n + (Number(s.quantity ?? 0) || 0),
      0,
    );

  const summaryParts = [
    `${rows.length} stock record(s)`,
    `available ${
      rows.length > 0
        ? `${sum('available_stock')}${unit ? ` ${unit}` : ''}`
        : 'UNKNOWN'
    }`,
    `in-transit stock ${
      rows.length > 0
        ? `${sum('in_transit_stock')}${unit ? ` ${unit}` : ''}`
        : 'UNKNOWN'
    }`,
    `expected incoming ${
      rows.length > 0
        ? `${sum('expected_incoming')}${unit ? ` ${unit}` : ''}`
        : 'UNKNOWN'
    }`,
    `${shipments.length} shipment/wagon record(s)`,
    `${status.in_transit} in transit`,
    `${status.delayed} delayed`,
    nextEta ? `next ETA ${nextEta}` : 'no ETA recorded',
  ];

  return {
    stock: {
  available: sum('available_stock'),
  reserved: sum('reserved_stock'),
  in_transit: sum('in_transit_stock'),
  expected_incoming: sum('expected_incoming'),
  unit,
  record_count: rows.length,
  latest_update: latest,
},
    shipments: {
      total: shipments.length,
      in_transit: status.in_transit,
      arrived: status.arrived,
      delayed: status.delayed,
      planned: status.planned,
      cancelled: status.cancelled,
      quantity_in_transit: inTransitQty,
      expected_quantity: expectedQty,
      unit,
      next_eta: nextEta,
    },
    summary: summaryParts.join('; '),
  };
}

function freshnessOf(dateStr?: string | null): Freshness {
  if (!dateStr) return 'UNKNOWN';

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'UNKNOWN';

  const days = (Date.now() - d.getTime()) / 86400000;

  if (days <= 7) return 'CURRENT';
  if (days <= 30) return 'RECENT';
  return 'STALE';
}

function mapSupply(row: RawMarketRow): SupplyLevel | null {
  const s = (row.supply ?? '').toLowerCase();

  if (!s) return null;

  if (
    /critical|severe|acute|crisis|famine|starvation/.test(s)
  ) {
    return 'Critical';
  }

  if (
    /shortage|tight|disrupt|low|deplet|scarce|constrain|insufficient|fail|poor harvest|export ban|restriction/.test(
      s,
    )
  ) {
    return 'Tight';
  }

  if (
    /abundant|surplus|oversupply|bumper|record|high production|excess|glut|ample|overproduction/.test(
      s,
    )
  ) {
    return 'High';
  }

  if (
    /adequate|sufficient|normal|stable|steady|available|in stock/.test(
      s,
    )
  ) {
    return 'Normal';
  }

  return null;
}

function mapDemand(row: RawMarketRow): DemandLevel | null {
  const d = (row.demand ?? '').toLowerCase();

  if (!d) return null;

  if (
    /surg|soaring|skyrocket|explosive|spike/.test(d)
  ) {
    return 'Surging';
  }

  if (
    /strong|robust|high|increasing|rising|growing|grew/.test(d)
  ) {
    return 'Strong';
  }

  if (
    /weak|low|declining|falling|dropping|sluggish|soft|reduced/.test(
      d,
    )
  ) {
    return 'Weak';
  }

  if (/normal|stable|steady|moderate/.test(d)) {
    return 'Normal';
  }

  return null;
}

// ---- Price extraction from web research ----

function extractPricePointsFromResearch(
  input: EngineInput,
): PricePoint[] {
  const points: PricePoint[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const priceRe =
    /([A-Z]{3})\s+(\d[\d,]*\.?\d+)\s*(?:[–-]\s*(\d[\d,]*\.?\d+))?\s*(?:per\s+|\/\s*)(kg|kilo|kilogram|ton|tonne|mt|metric ton|bag|lb|pound|litre|liter)/gi;

  const knownCountries: Record<string, string> = {
    india: 'India',
    vietnam: 'Vietnam',
    china: 'China',
    pakistan: 'Pakistan',
    thailand: 'Thailand',
    kazakhstan: 'Kazakhstan',
    russia: 'Russia',
    turkey: 'Turkey',
    uae: 'UAE',
    iran: 'Iran',
    afghanistan: 'Afghanistan',
    usa: 'USA',
    indonesia: 'Indonesia',
    malaysia: 'Malaysia',
    philippines: 'Philippines',
    japan: 'Japan',
    australia: 'Australia',
    canada: 'Canada',
    brazil: 'Brazil',
    argentina: 'Argentina',
    germany: 'Germany',
    ukraine: 'Ukraine',
  };

  const knownCities: Record<string, string> = {
    'mazar-e-sharif': 'Mazar-e-Sharif',
    'mazar-i-sharif': 'Mazar-e-Sharif',
    mazar: 'Mazar-e-Sharif',
    kabul: 'Kabul',
    herat: 'Herat',
    kandahar: 'Kandahar',
    jalalabad: 'Jalalabad',
    kunduz: 'Kunduz',
    karachi: 'Karachi',
    lahore: 'Lahore',
    islamabad: 'Islamabad',
    peshawar: 'Peshawar',
    dubai: 'Dubai',
    almaty: 'Almaty',
    moscow: 'Moscow',
    istanbul: 'Istanbul',
    tehran: 'Tehran',
    delhi: 'Delhi',
    mumbai: 'Mumbai',
    beijing: 'Beijing',
    shanghai: 'Shanghai',
  };

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  for (const res of input.researchResults) {
    const text = `${res.title} ${res.snippet}`;
    const lowerText = text.toLowerCase();

    priceRe.lastIndex = 0;

    let m: RegExpExecArray | null;

    while ((m = priceRe.exec(text)) !== null) {
      const currency = m[1].toUpperCase();

      if (!RESEARCH_CURRENCIES.has(currency)) continue;

      const unit = normalizeResearchUnit(m[4]);
      if (!unit) continue;

      const low = parseFloat(m[2].replace(/,/g, ''));
      const highStr = m[3];
      const high = highStr
        ? parseFloat(highStr.replace(/,/g, ''))
        : null;

      const price =
        high != null ? (low + high) / 2 : low;

      /*
       * Ignore a number when it is specifically the amount of a
       * price change, e.g.:
       *
       * "fell by approximately USD 10"
       * "down USD 15/MT"
       *
       * But keep the actual final price in:
       *
       * "fell by approximately USD 10 to USD 12/MT"
       *
       * because the second number is the final market price.
       */
      const contextBefore = lowerText.slice(
        Math.max(0, m.index - 180),
        m.index,
      );

      const isChangeAmountAtMatch =
        /\b(?:fell|fallen|dropped|declined|decreased|reduced)\s+by(?:\s+(?:approximately|about))?\s*$/i.test(
          contextBefore,
        ) ||
        /\bdown(?:\s+(?:by|approximately|about))?\s*$/i.test(
          contextBefore,
        );

      if (isChangeAmountAtMatch) continue;

      // Use local context around the matched price instead of
      // the entire article when determining location.
      const locationContext = lowerText.slice(
        Math.max(0, m.index - 180),
        Math.min(lowerText.length, m.index + 180),
      );

      let location = 'Web research (global)';
      let foundCity = false;

      for (const [cityKey, cityDisplay] of Object.entries(
        knownCities,
      )) {
        if (
          new RegExp(
            `\\b${escapeRegex(cityKey)}\\b`,
            'i',
          ).test(locationContext)
        ) {
          location = cityDisplay;
          foundCity = true;
          break;
        }
      }

      if (!foundCity) {
        for (const [
          countryKey,
          countryDisplay,
        ] of Object.entries(knownCountries)) {
          if (
            new RegExp(
              `\\b${escapeRegex(countryKey)}\\b`,
              'i',
            ).test(locationContext)
          ) {
            location = countryDisplay;
            break;
          }
        }
      }

      points.push({
        label: `${res.title || 'Web research'} — ${location}`,
        location,
        price,
        currency,
        unit,
        normalized_price_usd: normalizeToUsdPerMt(
          price,
          currency,
          unit,
        ),
        normalized_unit: 'USD/MT',
        source:
          res.url || res.title || 'web research',
        data_status: 'REPORTED',
        confidence: 'MEDIUM',
        freshness: 'CURRENT',
        observation_date: today,
        note:
          `Extracted from web research${
            high != null
              ? ` (range ${low}–${high}, midpoint used)`
              : ''
          }. Source: ${res.url}`,
      });
    }
  }

  return points;
}

export function pricePointEngine(
  input: EngineInput,
): PricePoint[] {
  const points: PricePoint[] = [];
  const commodity = input.commodity?.toLowerCase();

  for (const row of input.marketRows) {
    if (
      commodity &&
      row.commodity?.toLowerCase() !== commodity
    ) {
      continue;
    }

    const normalized = normalizeToUsdPerMt(
      row.price ?? null,
      row.currency ?? null,
      row.unit ?? null,
    );

    const loc =
      [row.city, row.market, row.country]
        .filter(Boolean)
        .join(', ') || row.country;

    points.push({
      label: row.origin
        ? `${row.origin} origin`
        : loc,
      location: loc,
      price: row.price ?? null,
      currency: row.currency ?? null,
      unit: row.unit ?? null,
      normalized_price_usd: normalized,
      normalized_unit: 'USD/MT',
      source: row.source ?? 'Stored data',
      data_status: row.data_status,
      confidence: row.confidence,
      freshness: freshnessOf(row.observation_date),
      observation_date: row.observation_date,
      note: row.notes ?? undefined,
    });
  }

  points.push(
    ...extractPricePointsFromResearch(input),
  );

  points.sort((a, b) => {
    const dateCompare =
      (b.observation_date ?? '').localeCompare(
        a.observation_date ?? '',
      );

    if (dateCompare !== 0) return dateCompare;

    return (
      (CONFIDENCE_RANK[b.confidence] ?? 0) -
      (CONFIDENCE_RANK[a.confidence] ?? 0)
    );
  });

  return points;
}

/*
 * Compare prices only when:
 * 1. they refer to the same location,
 * 2. both have valid normalized values,
 * 3. their observation dates are different.
 *
 * This prevents cross-source same-day prices from being
 * incorrectly reported as a temporal price movement.
 */
function comparablePriceChange(points: PricePoint[]): {
  recent: number;
  prior: number;
  change: number;
} | null {
  const valid = points.filter(
    (p) =>
      p.normalized_price_usd != null &&
      p.normalized_price_usd > 0 &&
      !!p.location &&
      !!p.observation_date,
  );

  if (valid.length < 2) return null;

  const byLocation = new Map<string, PricePoint[]>();

  for (const point of valid) {
    const key = point.location.trim().toLowerCase();

    const bucket = byLocation.get(key) ?? [];
    bucket.push(point);
    byLocation.set(key, bucket);
  }

  for (const bucket of byLocation.values()) {
    const sorted = [...bucket].sort(
      (a, b) =>
        (a.observation_date ?? '').localeCompare(
          b.observation_date ?? '',
        ),
    );

    if (sorted.length < 2) continue;

    const recent = sorted[sorted.length - 1];
    const prior = [...sorted]
      .reverse()
      .find(
        (p) =>
          p.observation_date !==
          recent.observation_date,
      );

    if (
      prior &&
      recent.normalized_price_usd != null &&
      prior.normalized_price_usd != null &&
      prior.normalized_price_usd > 0
    ) {
      const change =
        (recent.normalized_price_usd -
          prior.normalized_price_usd) /
        prior.normalized_price_usd;

      return {
        recent: recent.normalized_price_usd,
        prior: prior.normalized_price_usd,
        change,
      };
    }
  }

  return null;
}

interface ResearchSignal {
  level: SupplyLevel | DemandLevel;
  source: string;
  url: string;
  confidence: Confidence;
}

function classifySupplyFromText(
  text: string,
): SupplyLevel | null {
  const t = text.toLowerCase();

  if (
    /\b(severe shortage|critical shortage|acute shortage|supply crisis|humanitarian aid|emergency supplies|famine|starvation)\b/.test(
      t,
    )
  ) {
    return 'Critical';
  }

  if (
    /\b(shortage|tight supply|supply disruption|low stocks?|depleted|scarce|constrained|insufficient supply|supply shortfall|crop failure|failed harvest|poor harvest|reduced harvest|lower production|declining production|production decline|export ban|export restriction)\b/.test(
      t,
    )
  ) {
    return 'Tight';
  }

  if (
    /\b(abundant|surplus|oversupply|bumper harvest|record (?:production|harvest|crop)|high production|excess supply|glut|stocks? (?:high|rising|ample)|ample supplies|overproduction|increased production|rising production|higher production|good harvest|strong harvest)\b/.test(
      t,
    )
  ) {
    return 'High';
  }

  if (
    /\b(adequate suppl(?:y|ies)|supplies? (?:remained?|are|were) (?:adequate|sufficient|normal|stable)|normal supply|stable supply|sufficient supply|steady supply|ample|available|in stock|stocks? (?:normal|stable|adequate)|harvest (?:normal|on track|progressing))\b/.test(
      t,
    )
  ) {
    return 'Normal';
  }

  return null;
}

function classifyDemandFromText(
  text: string,
): DemandLevel | null {
  const t = text.toLowerCase();

  if (
    /\b(surg(?:e|ing)|soaring|explosive demand|skyrocket|surge in demand|sharp increase in demand|spike in demand)\b/.test(
      t,
    )
  ) {
    return 'Surging';
  }

  if (
    /\b(demand (?:increased|increasing|rising|grew|strong|robust|high)|strong demand|robust demand|high demand|rising consumption|increased consumption|growing consumption|buying activity (?:increased|strong|high)|import demand (?:increased|rising|strong)|household demand (?:increased|strong)|industrial demand (?:increased|strong|rising)|higher consumption|strong (?:purchases|buying))\b/.test(
      t,
    )
  ) {
    return 'Strong';
  }

  if (
    /\b(demand (?:decreased|declining|falling|weak|low|dropped)|weak demand|low demand|sluggish demand|soft demand|falling consumption|declining consumption|reduced consumption|lower demand|weak (?:purchases|buying)|decreased consumption)\b/.test(
      t,
    )
  ) {
    return 'Weak';
  }

  if (
    /\b(normal demand|stable demand|steady demand|moderate demand|demand (?:stable|steady|normal|remained? stable)|demand (?:remains?|is) (?:strong|steady|stable))\b/.test(
      t,
    )
  ) {
    return 'Normal';
  }

  if (
    /demand\b[^.]{0,40}\b(?:strong|robust|high|rising|increasing|growing)\b/.test(
      t,
    )
  ) {
    return 'Strong';
  }

  if (
    /demand\b[^.]{0,40}\b(?:weak|low|declining|falling|decreasing)\b/.test(
      t,
    )
  ) {
    return 'Weak';
  }

  return null;
}

function extractSupplyDemandFromResearch(
  input: EngineInput,
): {
  supplySignals: ResearchSignal[];
  demandSignals: ResearchSignal[];
} {
  const supplySignals: ResearchSignal[] = [];
  const demandSignals: ResearchSignal[] = [];

  for (const res of input.researchResults) {
    const text = `${res.title} ${res.snippet}`;

    const s = classifySupplyFromText(text);

    if (s) {
      supplySignals.push({
        level: s,
        source: res.title || res.url,
        url: res.url,
        confidence:
          s === 'Normal' ? 'MEDIUM' : 'LOW',
      });
    }

    const d = classifyDemandFromText(text);

    if (d) {
      demandSignals.push({
        level: d,
        source: res.title || res.url,
        url: res.url,
        confidence:
          d === 'Normal' ? 'MEDIUM' : 'LOW',
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
  kind: 'supply' | 'demand',
): {
  level: SupplyLevel | DemandLevel;
  evidence: string[];
  conflict: boolean;
} {
  if (signals.length === 0) {
    return {
      level: 'Unknown',
      evidence: [],
      conflict: false,
    };
  }

  const levels = signals.map((s) => s.level);
  const uniqueLevels = [...new Set(levels)];

  if (uniqueLevels.length > 1) {
    return {
      level: 'Unknown',
      evidence: signals.map(
        (s) =>
          `Conflicting ${kind} signals: ${s.level} — ${s.source} (${s.url})`,
      ),
      conflict: true,
    };
  }

  const level = uniqueLevels[0];

  const evidence = signals.map(
    (s) =>
      `${kind.charAt(0).toUpperCase() + kind.slice(1)} (${level}): ${s.source} (${s.url})`,
  );

  return {
    level,
    evidence,
    conflict: false,
  };
}

export function supplyDemandEngine(
  input: EngineInput,
): {
  supply: SupplyLevel;
  demand: DemandLevel;
  evidence: string;
  conflicts: string[];
} {
  let supply: SupplyLevel = 'Unknown';
  let demand: DemandLevel = 'Unknown';

  const evidence: string[] = [];
  const conflicts: string[] = [];

  const relevantMarketRows = input.commodity
    ? input.marketRows.filter(
        (row) =>
          row.commodity?.toLowerCase() ===
          input.commodity!.toLowerCase(),
      )
    : input.marketRows;

  // Stored market data first.
  for (const row of relevantMarketRows) {
    const s = mapSupply(row);

    if (s && supply === 'Unknown') {
      supply = s;
      evidence.push(
        `Supply (${row.country}): ${s} — ${row.source ?? 'stored'}`,
      );
    }

    const d = mapDemand(row);

    if (d && demand === 'Unknown') {
      demand = d;
      evidence.push(
        `Demand (${row.country}): ${d} — ${row.source ?? 'stored'}`,
      );
    }
  }

  const {
    supplySignals,
    demandSignals,
  } = extractSupplyDemandFromResearch(input);

  if (supply === 'Unknown') {
    const resolved = resolveSignals(
      supplySignals,
      'supply',
    );

    supply = resolved.level as SupplyLevel;
    evidence.push(...resolved.evidence);

    if (resolved.conflict) {
      conflicts.push(...resolved.evidence);
    }
  }

  if (demand === 'Unknown') {
    const resolved = resolveSignals(
      demandSignals,
      'demand',
    );

    demand = resolved.level as DemandLevel;
    evidence.push(...resolved.evidence);

    if (resolved.conflict) {
      conflicts.push(...resolved.evidence);
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
      evidence: INSUFFICIENT,
      conflicts: [],
    };
  }

  return {
    supply,
    demand,
    evidence:
      evidence.join('; ') || INSUFFICIENT,
    conflicts,
  };
}

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
  const t = text.toLowerCase();

  if (
    /\b(increas|rising|growing|surging|soaring|grew|boost|expanding|climbing)\b/.test(
      t,
    )
  ) {
    return 'UP';
  }

  if (
    /\b(decreas|declin|falling|dropping|weaker|lower|slowing|shrinking|contracting|reduced)\b/.test(
      t,
    )
  ) {
    return 'DOWN';
  }

  if (
    /\b(stable|steady|flat|unchanged|moderate)\b/.test(t)
  ) {
    return 'FLAT';
  }

  return null;
}

export function demandEngine(
  input: EngineInput,
): DemandIntelligence {
  const signals: DemandSignal[] = [];

  // OBSERVED: stored market data.
  for (const row of input.marketRows) {
    const d = mapDemand(row);

    if (d) {
      signals.push({
        level: d,
        trend: 'UNKNOWN',
        source: row.source ?? 'Stored data',
        url: '',
        snippet: row.demand ?? '',
        confidence: row.confidence,
        freshness: freshnessOf(row.observation_date),
        evidence_type: 'OBSERVED',
      });
    }
  }

  // INFERRED: web research.
  for (const res of input.researchResults) {
    const text = `${res.title} ${res.snippet}`;
    const d = classifyDemandFromText(text);

    if (d) {
      signals.push({
        level: d,
        trend:
          classifyDemandTrendFromText(text) ??
          'UNKNOWN',
        source: res.title || res.url,
        url: res.url,
        snippet: res.snippet.slice(0, 200),
        confidence:
          d === 'Normal' ? 'MEDIUM' : 'LOW',
        freshness: 'CURRENT',
        evidence_type: 'INFERRED',
      });
    }
  }

  const observed = signals.filter(
    (s) => s.evidence_type === 'OBSERVED',
  );

  const inferred = signals.filter(
    (s) => s.evidence_type === 'INFERRED',
  );

  let level: DemandLevel = 'Unknown';
  let confidence: Confidence = 'LOW';
  let trend:
    | 'UP'
    | 'DOWN'
    | 'FLAT'
    | 'UNKNOWN' = 'UNKNOWN';

  if (observed.length > 0) {
    level = observed[0].level;
    confidence = observed[0].confidence;
    trend = observed[0].trend;
  } else if (inferred.length > 0) {
    const levels = [
      ...new Set(
        inferred.map((s) => s.level),
      ),
    ];

    if (levels.length > 1) {
      level = 'Unknown';
      confidence = 'LOW';
    } else {
      level = levels[0];
      confidence = inferred[0].confidence;

      const trends = inferred
        .map((s) => s.trend)
        .filter(
          (tr) => tr !== 'UNKNOWN',
        );

      if (trends.length > 0) {
        const uniqueTrends = [
          ...new Set(trends),
        ];

        trend =
          uniqueTrends.length === 1
            ? uniqueTrends[0]
            : 'UNKNOWN';
      }
    }
  }

  const score = demandScore(level);

  let summary: string;

  if (
    level === 'Unknown' &&
    signals.length === 0
  ) {
    summary =
      'No demand evidence found in available data.';
  } else if (level === 'Unknown') {
    summary =
      `Conflicting demand signals from ${signals.length} source(s) — unable to determine clear demand level.`;
  } else {
    summary =
      `Demand assessed as ${level} (score: ${score}/100, trend: ${trend}). Based on ${observed.length} observed signal(s) and ${inferred.length} inferred signal(s) from web research.`;
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

export function sentimentEngine(
  input: EngineInput,
): {
  sentiment: SentimentLevel;
  rationale: string;
} {
  const { supply, demand } =
    supplyDemandEngine(input);

  const points = pricePointEngine(input);
  let signal = 0;
  const reasons: string[] = [];

  if (supply === 'High') {
    signal += 1;
    reasons.push(
      'Supply is high (price-easing)',
    );
  }

  if (supply === 'Tight') {
    signal -= 1;
    reasons.push(
      'Supply is tight (price-supportive)',
    );
  }

  if (supply === 'Critical') {
    signal -= 2;
    reasons.push(
      'Supply is critical (price-positive)',
    );
  }

  if (demand === 'Strong') {
    signal += 1;
    reasons.push('Demand is strong');
  }

  if (demand === 'Surging') {
    signal += 2;
    reasons.push('Demand is surging');
  }

  if (demand === 'Weak') {
    signal -= 1;
    reasons.push('Demand is weak');
  }

  const priceChange =
    comparablePriceChange(points);

  if (priceChange) {
    if (priceChange.change > 0.03) {
      signal += 1;
      reasons.push(
        `Prices up ${(priceChange.change * 100).toFixed(1)}% recently`,
      );
    } else if (priceChange.change < -0.03) {
      signal -= 1;
      reasons.push(
        `Prices down ${(
          priceChange.change * 100
        ).toFixed(1)}% recently`,
      );
    }
  }

  let sentiment: SentimentLevel = 'Neutral';

  if (signal >= 2) sentiment = 'Positive';
  else if (signal === 1) sentiment = 'Neutral';
  else if (signal === 0) sentiment = 'Cautious';
  else if (signal <= -2) sentiment = 'Negative';
  else if (signal < 0) sentiment = 'Cautious';

  if (reasons.length === 0) {
    return {
      sentiment: 'Highly Uncertain',
      rationale: INSUFFICIENT,
    };
  }

  return {
    sentiment,
    rationale: reasons.join('; '),
  };
}

export function landedCostEngine(
  input: EngineInput,
): LandedCostBreakdown | null {
  if (!input.commodity || !input.origin) {
    return null;
  }

  const originRows = input.marketRows.filter(
    (r) =>
      r.commodity?.toLowerCase() ===
        input.commodity!.toLowerCase() &&
      (
        r.origin?.toLowerCase() ===
          input.origin!.toLowerCase() ||
        r.country?.toLowerCase() ===
          input.origin!.toLowerCase()
      ),
  );

  const purchase = originRows[0];

  if (
    !purchase ||
    purchase.price == null ||
    !purchase.currency ||
    !purchase.unit
  ) {
    return {
      components: [
        {
          label: 'Purchase Price',
          value: null,
          currency: null,
          source: 'stored',
          data_status: 'ESTIMATED',
          confidence: 'LOW',
        },
      ],
      total: null,
      currency: null,
      unit: null,
      total_per_unit: null,
      note: `${INSUFFICIENT} for ${input.origin} ${input.commodity} purchase price.`,
    };
  }

  const liveFxRate =
    input.fxRates.find(
      (f) =>
        f.base_currency ===
          purchase.currency?.toUpperCase() &&
        f.quote_currency === 'USD',
    )?.rate;

  const usingFallbackFx =
    liveFxRate == null;

  const usdRate =
    liveFxRate ??
    (purchase.currency === 'USD'
      ? 1
      : FALLBACK_USD_RATES[
          purchase.currency.toUpperCase()
        ]);

  const purchaseUsd =
    usdRate != null
      ? purchase.price * usdRate
      : null;

  /*
   * Do NOT invent freight, customs, tax, transit, or handling
   * percentages. These must come from explicit user inputs or
   * verified source data before landed cost is calculated.
   */
  const components: LandedCostComponent[] = [
    {
      label: 'Purchase Price',
      value: purchaseUsd,
      currency: 'USD',
      source:
        purchase.source ?? 'stored',
      data_status:
        purchase.data_status,
      confidence:
        purchase.confidence,
    },
    {
      label: 'Freight',
      value: null,
      currency: 'USD',
      source: 'not provided',
      data_status: 'ESTIMATED',
      confidence: 'LOW',
    },
    {
      label: 'Transit & Handling',
      value: null,
      currency: 'USD',
      source: 'not provided',
      data_status: 'ESTIMATED',
      confidence: 'LOW',
    },
    {
      label: 'Customs / Tariff',
      value: null,
      currency: 'USD',
      source: 'not provided',
      data_status: 'ESTIMATED',
      confidence: 'LOW',
    },
    {
      label: 'Taxes',
      value: null,
      currency: 'USD',
      source: 'not provided',
      data_status: 'ESTIMATED',
      confidence: 'LOW',
    },
    {
      label: 'Handling & Storage',
      value: null,
      currency: 'USD',
      source: 'not provided',
      data_status: 'ESTIMATED',
      confidence: 'LOW',
    },
  ];

  return {
    components,
    total: null,
    currency: 'USD',
    unit: purchase.unit ?? null,
    total_per_unit: null,
    note:
      'Landed cost cannot be verified yet. Freight, transit, customs/tariff, taxes, and handling must be supplied as explicit inputs or verified data. No tariff rate is invented by the system.' +
      (
        usingFallbackFx
          ? ' FX rate is ESTIMATED (fallback) — not live.'
          : ''
      ),
  };
}

export function anomalyEngine(
  input: EngineInput,
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const points = pricePointEngine(input);

  const priceChange =
    comparablePriceChange(points);

  if (priceChange) {
    if (priceChange.change > 0.1) {
      anomalies.push({
        type: 'Sudden price increase',
        severity:
          priceChange.change > 0.25
            ? 'HIGH'
            : 'MEDIUM',
        description: `Price up ${(priceChange.change * 100).toFixed(1)}% vs prior observation.`,
      });
    }

    if (priceChange.change < -0.1) {
      anomalies.push({
        type: 'Sudden price decrease',
        severity:
          priceChange.change < -0.25
            ? 'HIGH'
            : 'MEDIUM',
        description: `Price down ${(
          -priceChange.change * 100
        ).toFixed(1)}% vs prior observation.`,
      });
    }
  }

  const { supply } =
    supplyDemandEngine(input);

  if (supply === 'Critical') {
    anomalies.push({
      type: 'Supply shortage',
      severity: 'CRITICAL',
      description:
        'Supply classified as Critical.',
    });
  }

  if (supply === 'Tight') {
    anomalies.push({
      type: 'Tight supply',
      severity: 'MEDIUM',
      description:
        'Supply classified as Tight.',
    });
  }

  const { demand } =
    supplyDemandEngine(input);

  if (demand === 'Surging') {
    anomalies.push({
      type: 'Demand surge',
      severity: 'HIGH',
      description:
        'Demand classified as Surging.',
    });
  }

  return anomalies;
}

export function forecastEngine(
  input: EngineInput,
): Forecast | null {
  const { supply, demand } =
    supplyDemandEngine(input);

  const { sentiment } =
    sentimentEngine(input);

  const points = pricePointEngine(input);

  let priceDir:
    Forecast['price_direction'] = 'UNCERTAIN';

  let confidence:
    Forecast['confidence'] = 'LOW';

  const rationale: string[] = [];

  const priceChange =
    comparablePriceChange(points);

  if (priceChange) {
    if (priceChange.change > 0.03) {
      priceDir = 'UP';
      rationale.push(
        `Recent prices up ${(priceChange.change * 100).toFixed(1)}%.`,
      );
    } else if (
      priceChange.change < -0.03
    ) {
      priceDir = 'DOWN';
      rationale.push(
        `Recent prices down ${(
          priceChange.change * 100
        ).toFixed(1)}%.`,
      );
    } else {
      priceDir = 'FLAT';
      rationale.push(
        'Prices roughly flat recently.',
      );
    }

    confidence =
      points[0]?.confidence === 'HIGH'
        ? 'MEDIUM'
        : 'LOW';
  }

  if (
    supply === 'Tight' ||
    supply === 'Critical'
  ) {
    priceDir =
      priceDir === 'DOWN'
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
    priceDir =
      priceDir === 'DOWN'
        ? 'FLAT'
        : 'UP';

    rationale.push(
      'Strong demand supports prices.',
    );
  }

  if (supply === 'High') {
    rationale.push(
      'High supply eases price pressure.',
    );
  }

  const risk: Forecast['market_risk'] =
    sentiment === 'Negative' ||
    supply === 'Critical'
      ? 'HIGH'
      : sentiment === 'Cautious' ||
        supply === 'Tight'
        ? 'MEDIUM'
        : 'LOW';

  if (rationale.length === 0) {
    return {
      horizon: '7 days',
      price_direction: 'UNCERTAIN',
      supply_direction: 'UNCERTAIN',
      demand_direction: 'UNCERTAIN',
      market_risk: 'MEDIUM',
      sentiment: 'Highly Uncertain',
      confidence: 'LOW',
      rationale: INSUFFICIENT,
    };
  }

  const supplyDir:
    Forecast['supply_direction'] =
      supply === 'High'
        ? 'UP'
        : supply === 'Tight' ||
            supply === 'Critical'
          ? 'DOWN'
          : 'FLAT';

  const demandDir:
    Forecast['demand_direction'] =
      demand === 'Strong' ||
      demand === 'Surging'
        ? 'UP'
        : demand === 'Weak'
          ? 'DOWN'
          : 'FLAT';

  return {
    horizon: '7 days',
    price_direction: priceDir,
    supply_direction: supplyDir,
    demand_direction: demandDir,
    market_risk: risk,
    sentiment,
    confidence,
    rationale: rationale.join(' '),
  };
}

export function recommendationEngine(
  input: EngineInput,
  landed: LandedCostBreakdown | null,
): {
  rec: Recommendation;
  rationale: string;
} {
  const points = pricePointEngine(input);

  const { supply, demand } =
    supplyDemandEngine(input);

  const anomalies =
    anomalyEngine(input);

  const hasData =
    points.length > 0 ||
    input.marketRows.length > 0;

  if (
    input.origin &&
    input.destination &&
    landed?.total != null
  ) {
    const destRows =
      input.marketRows.filter(
        (r) =>
          r.country?.toLowerCase() ===
            input.destination!.toLowerCase() ||
          r.city?.toLowerCase() ===
            input.city?.toLowerCase(),
      );

    const destPrice = destRows[0];

    if (
      destPrice &&
      destPrice.price != null &&
      destPrice.currency
    ) {
      const destPerMt =
        normalizeToUsdPerMt(
          destPrice.price,
          destPrice.currency,
          destPrice.unit ?? 'kg',
        );

      const landedPerMt =
        landed.unit
          ? normalizeToUsdPerMt(
              landed.total,
              'USD',
              landed.unit,
            )
          : null;

      if (
        landedPerMt != null &&
        destPerMt != null
      ) {
        const margin =
          (destPerMt - landedPerMt) /
          landedPerMt;

        if (margin > 0.1) {
          return {
            rec: 'GO',
            rationale: `Estimated landed cost is ${(margin * 100).toFixed(0)}% below destination market price — positive margin potential.`,
          };
        }

        if (margin > 0) {
          return {
            rec: 'MONITOR',
            rationale: `Margin thin (~${(margin * 100).toFixed(0)}%). Proceed only with verified cost quotes.`,
          };
        }

        return {
          rec: 'NO-GO',
          rationale: `Estimated landed cost exceeds destination price by ${(-margin * 100).toFixed(0)}% — negative margin.`,
        };
      }
    }

    return {
      rec: 'NEED MORE DATA',
      rationale:
        'Landed cost estimated but destination market price unavailable for margin comparison.',
    };
  }

  if (!hasData) {
    return {
      rec: 'NEED MORE DATA',
      rationale: INSUFFICIENT,
    };
  }

  if (
    anomalies.some(
      (a) => a.severity === 'CRITICAL',
    )
  ) {
    return {
      rec: 'HOLD',
      rationale:
        'Critical anomaly detected — avoid new commitments until conditions clarify.',
    };
  }

  if (
    supply === 'Critical' ||
    supply === 'Tight'
  ) {
    return {
      rec: 'MONITOR',
      rationale:
        'Tight supply creates price risk; monitor for stabilization before large commitments.',
    };
  }

  if (demand === 'Weak') {
    return {
      rec: 'HOLD',
      rationale:
        'Weak demand suggests limited near-term opportunity.',
    };
  }

  return {
    rec: 'MONITOR',
    rationale:
      'Market conditions balanced — continue monitoring for directional signals.',
  };
}

export function sourceEngine(
  input: EngineInput,
): {
  sources: DataSource[];
  conflicts: string[];
} {
  const sources: DataSource[] = [];
  const seen = new Set<string>();

  for (const r of input.marketRows) {
    const name = r.source ?? 'Stored data';

    if (seen.has(name)) continue;

    seen.add(name);

    sources.push({
      name,
      source_type:
        r.source_type ?? 'stored',
      data_status: r.data_status,
      confidence: r.confidence,
      freshness: freshnessOf(
        r.observation_date,
      ),
      observation_date:
        r.observation_date,
    });
  }

  for (const r of input.fxRates) {
    const name = r.source;

    if (seen.has(name)) continue;

    seen.add(name);

    sources.push({
      name,
      source_type: 'fx',
      data_status: r.data_status,
      confidence: r.confidence,
      freshness: freshnessOf(
        r.observation_date,
      ),
      observation_date:
        r.observation_date,
    });
  }

  for (const res of input.researchResults.slice(
    0,
    6,
  )) {
    if (seen.has(res.url)) continue;

    seen.add(res.url);

    sources.push({
      name: res.title || res.url,
      url: res.url,
      source_type: res.source_type,
      data_status: 'REPORTED',
      confidence: 'MEDIUM',
      freshness: 'CURRENT',
    });
  }

  const conflicts: string[] = [];
  const points = pricePointEngine(input);

  const byLoc: Record<
    string,
    number[]
  > = {};

  for (const p of points) {
    if (
      p.normalized_price_usd != null &&
      p.normalized_price_usd > 0
    ) {
      (byLoc[p.location] ??= []).push(
        p.normalized_price_usd,
      );
    }
  }

  for (const [loc, vals] of Object.entries(
    byLoc,
  )) {
    if (vals.length < 2) continue;

    const min = Math.min(...vals);
    const max = Math.max(...vals);

    if (
      min > 0 &&
      (max - min) / min > 0.15
    ) {
      conflicts.push(
        `Price spread for ${loc} exceeds 15% across sources — verify which reflects current market.`,
      );
    }
  }

  return {
    sources,
    conflicts,
  };
}

export function researchSummaryEngine(
  input: EngineInput,
): string {
  const results = input.researchResults;

  if (
    input.researchStatus === 'NO_PROVIDER' ||
    input.researchStatus === 'ERROR'
  ) {
    return (
      input.researchMessage ??
      'Web research provider unavailable. Analysis based on stored data only.'
    );
  }

  if (results.length === 0) {
    return 'No web research results returned.';
  }

  const top = results.slice(0, 4);

  return top
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}: ${r.snippet.slice(
          0,
          180,
        )}`,
    )
    .join('\n');
}

function isRelevantTradeUpdate(
  result: ResearchProviderResult,
): boolean {
  const text =
    `${result.title} ${result.snippet}`.toLowerCase();

  const clearlyIrrelevant =
    /\b(proxy|proxies|vpn|security verification|application testing|residential ip|datacenter|checkout testing|seo|hosting|ip address|anonymous browsing)\b/i.test(
      text,
    );

  if (clearlyIrrelevant) {
    return false;
  }

  return /\b(customs|tariff|trade|import|export|regulation|policy|border|transport|logistics|shipment|rail|wagon|quota|duties|tax|ban|restriction|food security)\b/i.test(
    text,
  );
}

export function dataGapsEngine(
  input: EngineInput,
): string[] {
  const gaps: string[] = [];

  if (input.marketRows.length === 0) {
    gaps.push(
      'No stored market observations for this commodity/location.',
    );
  }

  if (input.fxRates.length === 0) {
    gaps.push(
      'No live FX rates available — currency conversions use approximate fallback rates (ESTIMATED BY MODEL).',
    );
  }

  if (input.researchStatus !== 'OK') {
    gaps.push(
      'Live web research unavailable — findings limited to stored evidence.',
    );
  }

  if (input.stockRows.length === 0) {
    gaps.push(
      'No stock records available — warehouse/in-transit stock position cannot be verified.',
    );
  }

  if (input.shipmentRows.length === 0) {
    gaps.push(
      'No shipment/wagon records available — incoming rail/road volume and ETA cannot be verified.',
    );
  }

  if (
    input.city &&
    !input.marketRows.some(
      (r) =>
        r.city?.toLowerCase() ===
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
      (r) =>
        r.origin?.toLowerCase() ===
          input.origin!.toLowerCase() ||
        r.country?.toLowerCase() ===
          input.origin!.toLowerCase(),
    )
  ) {
    gaps.push(
      `No verified origin data for ${input.origin}.`,
    );
  }

  return gaps;
}

export function buildFindings(
  input: EngineInput,
): ResearchFindings {
  const commodity =
    input.commodity ??
    'the requested commodity';

  const points = pricePointEngine(input);

  const {
    supply,
    demand,
    conflicts: sdConflicts,
  } = supplyDemandEngine(input);

  const demandIntel =
    demandEngine(input);

  const { sentiment } =
    sentimentEngine(input);

  const landed =
    landedCostEngine(input);

  const anomalies =
    anomalyEngine(input);

  const {
    sources,
    conflicts: srcConflicts,
  } = sourceEngine(input);

  const conflicts = [
    ...srcConflicts,
    ...sdConflicts,
  ];

  const {
    rec,
    rationale: recRationale,
  } = recommendationEngine(
    input,
    landed,
  );

  const forecast =
    forecastEngine(input);

  const researchSummary =
    researchSummaryEngine(input);

  const gaps =
    dataGapsEngine(input);

  const operational =
    buildOperationalIntelligence(input);

  const exactDestinationCountryPoints =
    input.destination
      ? points.filter(
          (p) =>
            p.location.trim().toLowerCase() ===
            input.destination!
              .trim()
              .toLowerCase(),
        )
      : [];

  const exactCityPoints = input.city
    ? points.filter(
        (p) =>
          p.location.trim().toLowerCase() ===
          input.city!.trim().toLowerCase(),
      )
    : [];

  const targetCountry =
    input.destination
      ? (
          exactDestinationCountryPoints
            .map(
              (p) =>
                `${p.label}: ${
                  p.price ?? '—'
                } ${p.currency ?? ''}/${p.unit ?? ''}`,
            )
            .join('; ') ||
          'No direct country-level price observation — city-level data kept separate.'
        )
      : 'No destination specified.';

  const targetCity =
    input.city
      ? (
          exactCityPoints
            .map(
              (p) =>
                `${p.label}: ${
                  p.price ?? '—'
                } ${p.currency ?? ''}/${p.unit ?? ''}`,
            )
            .join('; ') ||
          INSUFFICIENT
        )
      : 'No city specified.';

  const relevantTradeUpdate =
    input.researchResults.find(
      isRelevantTradeUpdate,
    );

  const executiveSummary =
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
      sentiment !== 'Highly Uncertain'
        ? `Market sentiment: ${sentiment}.`
        : 'Market sentiment: HIGHLY UNCERTAIN.'
    } Operational position: ${
      operational.summary
    }. Recommendation: ${rec}.`;

  const supplyText =
    operational.stock.record_count > 0
      ? (
          operational.stock.available !=
            null &&
          operational.stock.in_transit !=
            null &&
          operational.stock.expected_incoming !=
            null
            ? `Operational stock: ${operational.stock.available.toLocaleString()} ${
                operational.stock.unit ?? ''
              } available, ${operational.stock.in_transit.toLocaleString()} ${
                operational.stock.unit ?? ''
              } in transit, ${operational.stock.expected_incoming.toLocaleString()} ${
                operational.stock.unit ?? ''
              } expected incoming.`
            : 'Operational stock data is partially incomplete.'
        )
      : 'Operational stock: UNKNOWN — no stock records available.';

  const shipmentText =
    operational.shipments.total > 0
      ? ` Shipments/wagons: ${operational.shipments.total} total, ${operational.shipments.in_transit} in transit, ${operational.shipments.delayed} delayed.`
      : ' Shipments/wagons: UNKNOWN — no shipment records available.';

  const fieldCompetitor =
    input.marketRows.find(
      (r) => r.competitor_info,
    )?.competitor_info;

  const fieldLogistics =
    input.marketRows.find(
      (r) => r.logistics_status,
    )?.logistics_status;

  const logisticsRiskParts = [
    fieldLogistics,
    operational.shipments.delayed > 0
      ? `${operational.shipments.delayed} delayed shipment(s) recorded.`
      : null,
    operational.shipments.next_eta
      ? `Next recorded ETA: ${operational.shipments.next_eta}.`
      : null,
  ].filter(Boolean);

  const adjustedSupply =
    operational.stock.record_count > 0 &&
    operational.stock.in_transit != null &&
    operational.stock.expected_incoming != null &&
    operational.stock.available != null &&
    operational.stock.in_transit +
      operational.stock.expected_incoming >
      operational.stock.available
      ? 'Tight'
      : supply;

  return {
    commodity,
    objective: input.commodity
      ? `${commodity} market intelligence`
      : 'Market intelligence',

    executive_summary:
      executiveSummary,

    global_market:
      researchSummary ||
      (points.length > 0
        ? 'See price observations below.'
        : INSUFFICIENT),

    origin_market: input.origin
      ? (
          points
            .filter((p) =>
              p.label
                .toLowerCase()
                .includes(
                  input.origin!.toLowerCase(),
                ),
            )
            .map(
              (p) =>
                `${p.label}: ${
                  p.price ?? '—'
                } ${p.currency ?? ''}/${p.unit ?? ''}`,
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
            .slice(0, 6)
            .map(
              (f) =>
                `${f.base_currency}/${f.quote_currency}: ${f.rate.toFixed(4)} (${f.source})`,
            )
            .join('; ')
        : 'FX provider unavailable. Currency conversions use approximate fallback rates (ESTIMATED BY MODEL). These are NOT live/verified rates — landed cost accuracy is reduced.',

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
      relevantTradeUpdate?.snippet ??
      'No relevant government/trade updates identified in available sources.',

    logistics_risks:
      logisticsRiskParts.join(' ') ||
      'No logistics disruption signals in stored data.',

    key_risks:
      anomalies.map(
        (a) =>
          `${a.type}: ${a.description}`,
      ),

    opportunities:
      supply === 'High'
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
      recRationale,

    forecast,

    anomalies,

    sources,

    conflicts,

    data_gaps:
      gaps,
  };
}

// ---- New Commodity Evaluation Engine ----

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
  s: SentimentLevel,
): number {
  switch (s) {
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

  const rec =
    findings.recommendation;

  const reasons: string[] = [];
  const warnings: string[] = [];

  const dScore =
    demandScore(demand);

  const sScore =
    scoreSupply(supply);

  const sentScore =
    scoreSentiment(sentiment);

  let demandText: string;

  if (demand === 'Unknown') {
    demandText =
      'UNKNOWN — no demand evidence found.';

    warnings.push(
      'Demand level unknown — no observed or inferred signals.',
    );
  } else {
    demandText =
      `${demand} (score: ${dScore}/100). ${
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

    if (demand === 'Weak') {
      reasons.push(
        'Weak demand limits opportunity.',
      );
    }
  }

  const behaviorRaw =
    input.marketRows.find(
      (r) =>
        r.buying_selling_behavior,
    )?.buying_selling_behavior;

  if (behaviorRaw) {
    demandText +=
      ` Field behavior: ${behaviorRaw}.`;
  }

  let supplyText: string;

  if (supply === 'Unknown') {
    supplyText =
      'UNKNOWN — no supply evidence found.';

    warnings.push(
      'Supply level unknown — no observed or inferred signals.',
    );
  } else {
    supplyText =
      `${supply} (score: ${sScore}/100). ${
        supply === 'High'
          ? 'Ample supply — potential buying advantage.'
          : supply === 'Tight' ||
              supply === 'Critical'
            ? 'Constrained supply — price risk and sourcing difficulty.'
            : 'Stable supply conditions.'
      }`;

    if (supply === 'High') {
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
      (r) => r.stock,
    )?.stock;

  if (stockRaw) {
    supplyText +=
      ` Field-reported stock availability: ${stockRaw}.`;

    if (/depleted|low/i.test(stockRaw)) {
      reasons.push(
        'Low/depleted stock availability reported in field data.',
      );
    }
  }

  const arrivalsRaw =
    input.marketRows.find(
      (r) => r.new_arrivals,
    )?.new_arrivals;

  if (arrivalsRaw) {
    supplyText +=
      ` Field-reported new arrivals: ${arrivalsRaw}.`;
  }

  const operational =
    buildOperationalIntelligence(input);

  if (
    operational.stock.record_count > 0
  ) {
    supplyText +=
      ` Operational stock: ${(
        operational.stock.available ?? 0
      ).toLocaleString()} ${
        operational.stock.unit ?? ''
      } available, ${(
        operational.stock.in_transit ?? 0
      ).toLocaleString()} ${
        operational.stock.unit ?? ''
      } in transit, ${(
        operational.stock.expected_incoming ?? 0
      ).toLocaleString()} ${
        operational.stock.unit ?? ''
      } expected incoming.`;
  } else {
    supplyText +=
      ' Operational stock: UNKNOWN — no stock records available.';
  }

  if (
    operational.shipments.total > 0
  ) {
    supplyText +=
      ` Shipments/wagons: ${operational.shipments.total} total, ${operational.shipments.in_transit} in transit, ${operational.shipments.delayed} delayed.`;

    if (
      operational.shipments.delayed > 0
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
      (r) => r.competitor_info,
    )?.competitor_info;

  let competitionText: string;

  if (competitorRaw) {
    competitionText = `${competitorRaw}`;
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

  let priceText: string;

  if (points.length === 0) {
    priceText =
      'UNKNOWN — no price observations available.';

    warnings.push(
      'No price data for attractiveness assessment.',
    );
  } else if (
    landed?.total != null
  ) {
    const destRows =
      input.marketRows.filter(
        (r) =>
          r.country?.toLowerCase() ===
            input.destination?.toLowerCase() ||
          r.city?.toLowerCase() ===
            input.city?.toLowerCase(),
      );

    const destPrice =
      destRows[0];

    if (destPrice?.price != null) {
      const landedPerMt =
        normalizeToUsdPerMt(
          landed.total,
          'USD',
          landed.unit ?? 'kg',
        );

      const destPerMt =
        normalizeToUsdPerMt(
          destPrice.price,
          destPrice.currency ??
            'USD',
          destPrice.unit ??
            'kg',
        );

      if (
        landedPerMt != null &&
        destPerMt != null
      ) {
        const margin =
          (destPerMt -
            landedPerMt) /
          landedPerMt;

        if (margin > 0.1) {
          priceText =
            `Attractive — estimated margin ~${(
              margin * 100
            ).toFixed(0)}% above landed cost.`;

          reasons.push(
            `Price margin ~${(
              margin * 100
            ).toFixed(
              0,
            )}% — attractive.`,
          );
        } else if (
          margin > 0
        ) {
          priceText =
            `Thin margin (~${(
              margin * 100
            ).toFixed(
              0,
            )}%) — proceed with caution.`;
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
      (r) => r.logistics_status,
    )?.logistics_status;

  const importRaw =
    input.marketRows.find(
      (r) => r.import_status,
    )?.import_status;

  const exportRaw =
    input.marketRows.find(
      (r) => r.export_status,
    )?.export_status;

  let logisticsText: string;

  const logisticsParts: string[] =
    [];

  if (importRaw) {
    logisticsParts.push(
      `Import: ${importRaw}`,
    );
  }

  if (exportRaw) {
    logisticsParts.push(
      `Export: ${exportRaw}`,
    );
  }

  if (logisticsRaw) {
    logisticsParts.push(
      `Logistics: ${logisticsRaw}`,
    );
  }

  if (logisticsParts.length > 0) {
    logisticsText =
      logisticsParts.join(' | ');

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

  let sentimentText: string;

  const fieldSentiment =
    input.marketRows.find(
      (r) => r.market_sentiment,
    )?.market_sentiment;

  if (
    sentiment === 'Highly Uncertain'
  ) {
    sentimentText =
      'HIGHLY UNCERTAIN — insufficient data for sentiment assessment.';

    warnings.push(
      'Market sentiment uncertain.',
    );
  } else {
    sentimentText =
      `${sentiment} (score: ${sentScore}/100).`;

    if (fieldSentiment) {
      sentimentText +=
        ` Field sentiment: ${fieldSentiment}.`;
    }

    if (sentiment === 'Positive') {
      reasons.push(
        'Positive market sentiment.',
      );
    }

    if (sentiment === 'Negative') {
      reasons.push(
        'Negative market sentiment — caution advised.',
      );
    }
  }

  const criticalAnomalies =
    anomalies.filter(
      (a) =>
        a.severity === 'CRITICAL' ||
        a.severity === 'HIGH',
    );

  let riskText: string;

  if (
    criticalAnomalies.length > 0
  ) {
    riskText =
      `ELEVATED — ${criticalAnomalies.length} critical/high anomaly/anomalies: ${criticalAnomalies
        .map((a) => a.type)
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
      (r) => r.risks_problems,
    )?.risks_problems;

  if (risksRaw) {
    riskText +=
      ` Field risks: ${risksRaw}.`;

    reasons.push(
      'Field-reported risks noted.',
    );
  }

  let logisticsPenalty = 0;

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
    competitorRaw ? -3 : 0;

  const opportunityScore =
    Math.round(
      dScore * 0.25 +
        sScore * 0.15 +
        sentScore * 0.15 +
        (
          rec === 'GO'
            ? 25
            : rec === 'MONITOR'
              ? 15
              : rec === 'HOLD'
                ? 5
                : rec === 'NO-GO'
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

  let confidence: Confidence = 'LOW';

  const dataPoints =
    points.length +
    input.marketRows.length +
    input.researchResults.length +
    input.stockRows.length +
    input.shipmentRows.length;

  if (
    dataPoints >= 5 &&
    findings.conflicts.length === 0
  ) {
    confidence = 'HIGH';
  } else if (dataPoints >= 2) {
    confidence = 'MEDIUM';
  }

  const hasLocalData =
    input.marketRows.some(
      (r) =>
        r.city?.toLowerCase() ===
          input.city?.toLowerCase() ||
        r.country?.toLowerCase() ===
          input.destination?.toLowerCase(),
    );

  if (!hasLocalData && input.city) {
    confidence =
      confidence === 'HIGH'
        ? 'MEDIUM'
        : 'LOW';

    warnings.push(
      `No verified local market data for ${input.city} — evaluation based on external/estimated sources only.`,
    );
  }

  if (
    input.fxRates.length === 0 &&
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
    Math.max(
      0,
      Math.min(
        100,
        opportunityScore,
      ),
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
      rec,

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
