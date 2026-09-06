// Report generator — produces management-ready Markdown reports.
// All sections clearly label data status (VERIFIED / REPORTED / ESTIMATED /
// FORECAST) and confidence. Never presents estimates as official values.

import type { ParsedIntent, ResearchFindings, EvaluationResult } from '../lib/types';

function section(title: string, body: string): string {
  return `### ${title}\n\n${body || '—'}\n`;
}

function bullets(items: string[]): string {
  if (items.length === 0) return '—';
  return items.map((i) => `- ${i}`).join('\n');
}

function priceTable(findings: ResearchFindings): string {
  if (findings.price_points.length === 0) return 'INSUFFICIENT VERIFIED DATA';
  const header = '| Location | Price | USD/MT | Status | Confidence | Freshness | Source |\n|---|---|---|---|---|---|---|';
  const rows = findings.price_points.map((p) =>
    `| ${p.location} | ${p.price != null ? `${p.currency ?? ''} ${p.price} / ${p.unit ?? ''}` : '—'} | ${p.normalized_price_usd != null ? p.normalized_price_usd.toFixed(2) : '—'} | ${p.data_status} | ${p.confidence} | ${p.freshness} | ${p.source} |`
  );
  return [header, ...rows].join('\n');
}

function landedCostTable(findings: ResearchFindings): string {
  const lc = findings.landed_cost;
  if (!lc) return 'Not applicable (no origin specified).';
  const header = '| Component | Value | Currency | Status | Confidence |\n|---|---|---|---|---|';
  const rows = lc.components.map((c) =>
    `| ${c.label} | ${c.value != null ? c.value.toFixed(2) : '—'} | ${c.currency ?? '—'} | ${c.data_status} | ${c.confidence} |`
  );
  const total = `\n\n**Estimated Landed Cost (total):** ${lc.currency ?? ''} ${lc.total != null ? lc.total.toFixed(2) : '—'}${lc.unit ? ` per ${lc.unit}` : ''}`;
  return [header, ...rows].join('\n') + total + `\n\n> ${lc.note}`;
}

export function generateReport(intent: ParsedIntent, findings: ResearchFindings, evaluation?: EvaluationResult | null): string {
  const title = `# ${intent.commodity ?? 'Market'} Intelligence Report`;
  const scope = `**Scope:** ${intent.commodity ?? '—'}${intent.origin ? ` | Origin: ${intent.origin}` : ''}${intent.destination ? ` | Destination: ${intent.destination}` : ''}${intent.city ? ` | City: ${intent.city}` : ''}\n**Generated:** ${new Date().toLocaleString()}`;

  const md = [
    title,
    scope,
    '',
    '---',
    section('Executive Summary', findings.executive_summary),
    section('FX Situation', findings.fx_situation),
    section('Operational Stock & Shipment Intelligence', operationalSection(findings)),
    section('Global Market', findings.global_market),
    section('Origin Market', findings.origin_market),
    section('Target Country', findings.target_country),
    section('Target City / Market', findings.target_city),
    section('Commodity Prices', priceTable(findings)),
    section('Landed Cost Estimate', landedCostTable(findings)),
    section('Supply', findings.supply),
    section('Demand', demandSection(findings)),
    section('Market Sentiment', `${findings.sentiment} — ${sentimentRationale(findings)}`),
    section('Competitor Activity', findings.competitor_activity),
    section('Government / Trade Updates', findings.government_trade_updates),
    section('Logistics / Border Risks', findings.logistics_risks),
    section('Key Risks', bullets(findings.key_risks)),
    section('Opportunities', bullets(findings.opportunities.length ? findings.opportunities : ['None identified in available data.'])),
    section('Anomalies Detected', findings.anomalies.length ? bullets(findings.anomalies.map((a) => `[${a.severity}] ${a.type}: ${a.description}`)) : 'No anomalies detected.'),
    section('Short-Term Outlook', findings.short_term_outlook),
    forecastSection(findings),
    section('Recommendation', `**${findings.recommendation}** — ${findings.recommendation_rationale}`),
    intent.assumptions.length ? section('Assumptions Used', bullets(intent.assumptions)) : '',
    findings.data_gaps.length ? section('Data Gaps', bullets(findings.data_gaps)) : '',
    findings.conflicts.length ? section('Conflicting Sources Detected', bullets(findings.conflicts)) : '',
    evaluation ? evaluationSection(evaluation) : '',
    section('Sources', sourcesList(findings)),
  ].filter(Boolean).join('\n');

  return md;
}

function operationalSection(findings: ResearchFindings): string {
  const o = findings.operational_intelligence;
  if (!o) return 'No operational intelligence recorded.';
  const unit = o.stock.unit ?? o.shipments.unit ?? '';
  return [
    `**Stock:** available ${o.stock.available.toLocaleString()} ${unit}; reserved ${o.stock.reserved.toLocaleString()} ${unit}; in transit ${o.stock.in_transit.toLocaleString()} ${unit}; expected incoming ${o.stock.expected_incoming.toLocaleString()} ${unit}.`,
    `**Shipments/Wagons:** ${o.shipments.total} total; ${o.shipments.in_transit} in transit; ${o.shipments.arrived} arrived; ${o.shipments.delayed} delayed; ${o.shipments.planned} planned; ${o.shipments.cancelled} cancelled.`,
    `**Incoming quantity:** ${o.shipments.quantity_in_transit.toLocaleString()} ${unit} in transit; ${o.shipments.expected_quantity.toLocaleString()} ${unit} expected/active.`,
    `**Next recorded ETA:** ${o.shipments.next_eta ?? '—'} | **Latest stock update:** ${o.stock.latest_update ?? '—'}.`,
    '', o.summary,
  ].join('\n');
}

function demandSection(findings: ResearchFindings): string {
  const di = findings.demand_intelligence;
  if (!di) return findings.demand;
  const lines = [
    `**Level:** ${di.level} | **Score:** ${di.score}/100 | **Trend:** ${di.trend} | **Confidence:** ${di.confidence}`,
    '',
    di.summary,
    '',
  ];
  if (di.signals.length > 0) {
    lines.push('**Evidence:**');
    for (const s of di.signals) {
      lines.push(`- [${s.evidence_type}] ${s.level} (${s.trend}) \\u2014 ${s.source}${s.url ? ` (${s.url})` : ''} [${s.confidence}, ${s.freshness}]`);
    }
  } else {
    lines.push('**Evidence:** No demand signals identified.');
  }
  return lines.join('\n');
}

function sentimentRationale(findings: ResearchFindings): string {
  // Sentiment rationale isn't stored directly in findings; infer short text.
  if (findings.sentiment === 'Highly Uncertain') return 'insufficient verified data';
  return `based on supply (${findings.supply}), demand (${findings.demand}), and price signals`;
}

function forecastSection(findings: ResearchFindings): string {
  const f = findings.forecast;
  if (!f) return section('Forecast', 'No forecast — insufficient data.');
  const body = [
    `**Horizon:** ${f.horizon}`,
    `**Price direction:** ${f.price_direction}`,
    `**Supply direction:** ${f.supply_direction}`,
    `**Demand direction:** ${f.demand_direction}`,
    `**Market risk:** ${f.market_risk}`,
    `**Sentiment:** ${f.sentiment}`,
    `**Forecast Confidence:** ${f.confidence}`,
    '',
    `**Rationale:** ${f.rationale}`,
    '',
    '> Forecasts are model-generated estimates, not certainties. Treat as decision support, not prediction.',
  ].join('\n');
  return section('Forecast', body);
}

function sourcesList(findings: ResearchFindings): string {
  if (findings.sources.length === 0) return 'No sources recorded.';
  return findings.sources.map((s) => `- ${s.name}${s.url ? ` — ${s.url}` : ''} (${s.source_type}, ${s.data_status}, ${s.confidence}, ${s.freshness})`).join('\n');
}

function evaluationSection(ev: EvaluationResult): string {
  const title = '## New Commodity Evaluation';
  const header = `**Commodity:** ${ev.commodity}${ev.origin ? ` | Origin: ${ev.origin}` : ''}${ev.destination ? ` | Destination: ${ev.destination}` : ''}${ev.city ? ` | City: ${ev.city}` : ''}`;
  const score = `**Opportunity Score:** ${ev.opportunity_score}/100 | **Recommendation:** ${ev.recommendation} | **Confidence:** ${ev.confidence_level}`;
  const assessments = [
    section('Demand Assessment', ev.demand_assessment),
    section('Supply Assessment', ev.supply_assessment),
    section('Competition Assessment', ev.competition_assessment),
    section('Price Attractiveness', ev.price_attractiveness),
    section('Logistics / Import Feasibility', ev.logistics_feasibility),
    section('Market Sentiment', ev.market_sentiment),
    section('Risk Assessment', ev.risk_assessment),
    section('Key Reasons / Signals', bullets(ev.key_reasons)),
    ev.data_gaps.length ? section('Data Gaps & Warnings', bullets(ev.data_gaps)) : '',
  ].filter(Boolean).join('\n');
  return [title, header, score, '', assessments].join('\n');
}
