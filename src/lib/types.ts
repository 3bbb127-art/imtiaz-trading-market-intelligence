// Domain types shared across the app. These mirror the database tables and the
// structured payloads the Agent engine produces.

export type DataStatus = 'VERIFIED' | 'REPORTED' | 'ESTIMATED' | 'FORECAST';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SupplyLevel = 'High' | 'Normal' | 'Tight' | 'Critical' | 'Unknown';
export type DemandLevel = 'Strong' | 'Normal' | 'Weak' | 'Surging' | 'Unknown';
export type SentimentLevel = 'Positive' | 'Neutral' | 'Cautious' | 'Negative' | 'Highly Uncertain';
export type Freshness = 'CURRENT' | 'RECENT' | 'STALE' | 'UNKNOWN';
export type Recommendation = 'GO' | 'NO-GO' | 'NEED MORE DATA' | 'HOLD' | 'MONITOR';
export type ForecastConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LocationProfile {
  id: string;
  name: string;
  country: string;
  region?: string | null;
  city?: string | null;
  market?: string | null;
  currency: string;
  relevant_sources: string[];
  customs_sources: string[];
  trade_routes: TradeRoute[];
  preferred_providers: string[];
  notes?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeRoute {
  route: string;
  mode: string;
}

export interface MarketData {
  id: string;
  commodity: string;
  commodity_category?: string | null;
  country: string;
  city?: string | null;
  market?: string | null;
  origin?: string | null;
  destination?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  observation_date: string;
  source?: string | null;
  source_type?: string | null;
  supply?: string | null;
  demand?: string | null;
  stock?: string | null;
  import_status?: string | null;
  export_status?: string | null;
  logistics_status?: string | null;
  competitor_info?: string | null;
  trader_company?: string | null;
  notes?: string | null;
  data_status: DataStatus;
  confidence: Confidence;
  created_at: string;
}

export interface FxRate {
  id?: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  previous_rate?: number | null;
  change?: number | null;
  change_pct?: number | null;
  observation_date: string;
  source?: string;
  source_type?: string;
  data_status: DataStatus;
  confidence: Confidence;
}

export interface ResearchMemory {
  id: string;
  command: string;
  parsed_intent: ParsedIntent;
  workflow_steps: WorkflowStep[];
  findings: ResearchFindings;
  recommendation?: string | null;
  language: string;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  report_type: string;
  title: string;
  scope: Record<string, unknown>;
  period_start?: string | null;
  period_end?: string | null;
  content_markdown: string;
  content_json: Record<string, unknown>;
  language: string;
  research_id?: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  severity: Severity;
  title: string;
  detail?: string | null;
  commodity?: string | null;
  country?: string | null;
  city?: string | null;
  acknowledged: boolean;
  created_at: string;
}

// ---- Agent engine types ----

export interface ParsedIntent {
  commodity: string | null;
  origin: string | null;
  destination: string | null;
  city: string | null;
  market: string | null;
  currencies: string[];
  period: string;
  objective: string;
  assumptions: string[];
  raw: string;
}

export interface WorkflowStep {
  step: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  detail?: string;
  started_at?: string;
  completed_at?: string;
}

export interface DataSource {
  name: string;
  url?: string;
  source_type: string;
  data_status: DataStatus;
  confidence: Confidence;
  freshness: Freshness;
  observation_date?: string;
}

export interface PricePoint {
  label: string;
  location: string;
  price: number | null;
  currency: string | null;
  unit: string | null;
  normalized_price_usd: number | null;
  normalized_unit: string;
  source: string;
  data_status: DataStatus;
  confidence: Confidence;
  freshness: Freshness;
  observation_date?: string;
  note?: string;
}

export interface LandedCostComponent {
  label: string;
  value: number | null;
  currency: string | null;
  source: string;
  data_status: DataStatus;
  confidence: Confidence;
}

export interface LandedCostBreakdown {
  components: LandedCostComponent[];
  total: number | null;
  currency: string | null;
  unit: string | null;
  total_per_unit: number | null;
  note: string;
}

export interface Forecast {
  horizon: string;
  price_direction: 'UP' | 'DOWN' | 'FLAT' | 'UNCERTAIN';
  supply_direction: 'UP' | 'DOWN' | 'FLAT' | 'UNCERTAIN';
  demand_direction: 'UP' | 'DOWN' | 'FLAT' | 'UNCERTAIN';
  market_risk: Severity;
  sentiment: SentimentLevel;
  confidence: ForecastConfidence;
  rationale: string;
}

export interface DemandSignal {
  level: DemandLevel;
  trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  source: string;
  url: string;
  snippet: string;
  confidence: Confidence;
  freshness: Freshness;
  evidence_type: 'OBSERVED' | 'INFERRED';
}

export interface DemandIntelligence {
  level: DemandLevel;
  score: number;
  trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  confidence: Confidence;
  signals: DemandSignal[];
  summary: string;
}

export interface OperationalIntelligence {
  stock: {
    available: number;
    reserved: number;
    in_transit: number;
    expected_incoming: number;
    unit: string | null;
    record_count: number;
    latest_update: string | null;
  };
  shipments: {
    total: number;
    in_transit: number;
    arrived: number;
    delayed: number;
    planned: number;
    cancelled: number;
    quantity_in_transit: number;
    expected_quantity: number;
    unit: string | null;
    next_eta: string | null;
  };
  summary: string;
}

export interface ResearchFindings {
  commodity: string;
  objective: string;
  executive_summary: string;
  global_market: string;
  origin_market: string;
  target_country: string;
  target_city: string;
  fx_situation: string;
  operational_intelligence: OperationalIntelligence;
  price_points: PricePoint[];
  landed_cost: LandedCostBreakdown | null;
  supply: SupplyLevel;
  demand: DemandLevel;
  demand_intelligence: DemandIntelligence;
  sentiment: SentimentLevel;
  competitor_activity: string;
  government_trade_updates: string;
  logistics_risks: string;
  key_risks: string[];
  opportunities: string[];
  short_term_outlook: string;
  recommendation: Recommendation;
  recommendation_rationale: string;
  forecast: Forecast | null;
  anomalies: Anomaly[];
  sources: DataSource[];
  conflicts: string[];
  data_gaps: string[];
}

export interface Anomaly {
  type: string;
  severity: Severity;
  description: string;
}

export interface ImportCostInput {
  commodity: string;
  origin: string;
  purchasePrice: number;
  purchaseCurrency: string;
  quantity: number;
  unit: string;
  exchangeRate: number | null;
  exchangeRatePair: string;
  freight: number | null;
  insurance: number | null;
  customsTariff: number | null;
  taxesFees: number | null;
  transportHandling: number | null;
  sellingPrice: number | null;
  sellingCurrency: string;
}

export interface ImportCostLineItem {
  label: string;
  amount: number;
  currency: string;
}

export interface ImportCostResult {
  lineItems: ImportCostLineItem[];
  totalImportCost: number;
  totalCurrency: string;
  landedCost: number;
  landedCostCurrency: string;
  landedCostPerUnit: number;
  perUnitCurrency: string;
  afnEquivalent: number | null;
  margin: number | null;
  marginPct: number | null;
  note: string;
}

export interface Shipment {
  id: string;
  shipment_id: string;
  origin: string;
  destination: string;
  commodity: string;
  quantity?: number | null;
  unit?: string | null;
  departure_date?: string | null;
  expected_arrival?: string | null;
  actual_arrival?: string | null;
  status: string;
  notes?: string | null;
  source?: string | null;
  created_at: string;
}

export interface StockRecord {
  id: string;
  commodity: string;
  warehouse?: string | null;
  available_stock?: number | null;
  reserved_stock?: number | null;
  in_transit_stock?: number | null;
  expected_incoming?: number | null;
  unit?: string | null;
  update_date: string;
  source?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CommodityEvaluation {
  id: string;
  commodity: string;
  origin: string | null;
  destination: string | null;
  city: string | null;
  opportunity_score: number;
  demand_assessment: string;
  supply_assessment: string;
  competition_assessment: string;
  price_attractiveness: string;
  logistics_feasibility: string;
  market_sentiment: string;
  risk_assessment: string;
  confidence_level: Confidence;
  recommendation: Recommendation;
  key_reasons: string[];
  data_gaps: string[];
  notes: string | null;
  created_at: string;
}

export interface EvaluationResult {
  commodity: string;
  origin: string | null;
  destination: string | null;
  city: string | null;
  opportunity_score: number;
  demand_assessment: string;
  supply_assessment: string;
  competition_assessment: string;
  price_attractiveness: string;
  logistics_feasibility: string;
  market_sentiment: string;
  risk_assessment: string;
  confidence_level: Confidence;
  recommendation: Recommendation;
  key_reasons: string[];
  data_gaps: string[];
}

export interface AgentResult {
  intent: ParsedIntent;
  steps: WorkflowStep[];
  findings: ResearchFindings;
  reportMarkdown: string;
  researchId?: string;
  reportId?: string;
  evaluation?: EvaluationResult;
}

export interface ResearchProviderResult {
  title: string;
  url: string;
  snippet: string;
  source_type: string;
  data_status?: DataStatus;
  confidence?: Confidence;
  freshness?: Freshness;
}

export type ProviderStatus = 'OK' | 'ERROR' | 'NO_PROVIDER';

export interface FxProviderResponse {
  rates: FxRate[];
  source: string;
  status: ProviderStatus;
  base: string;
  message?: string;
}

export interface ResearchProviderResponse {
  query: string;
  results: ResearchProviderResult[];
  source: string;
  status: ProviderStatus;
  message?: string;
}
