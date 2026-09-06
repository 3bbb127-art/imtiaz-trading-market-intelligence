// Formatting and data-quality utilities: currency/unit normalization,
// freshness classification, confidence helpers.

import type { Confidence, DataStatus, Freshness, PricePoint } from './types';

const USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  AED: 0.27,
  CNY: 0.14,
  INR: 0.012,
  PKR: 0.0036,
  AFN: 0.014,
  KZT: 0.0022,
  RUB: 0.011,
  TRY: 0.031,
};

// Fallback approximate rates when the FX provider is unreachable. Clearly
// labelled as estimates by callers via data_status=ESTIMATED.
export const FALLBACK_USD_RATES = USD_PER_UNIT;

export function toUsd(amount: number, currency: string): number | null {
  const rate = USD_PER_UNIT[currency.toUpperCase()];
  if (rate == null) return null;
  return amount * rate;
}

// Normalize a per-unit price to USD per metric ton for comparison.
const KG_PER_UNIT: Record<string, number> = {
  kg: 1,
  kilo: 1,
  kg50: 50,
  bag: 50,
  ton: 1000,
  mt: 1000,
  metricton: 1000,
  litre: 1,
  liter: 1,
  lb: 0.4536,
};

export function normalizeToUsdPerMt(price: number | null, currency: string | null, unit: string | null): number | null {
  if (price == null || currency == null || unit == null) return null;
  const usd = toUsd(price, currency);
  if (usd == null) return null;
  const kg = KG_PER_UNIT[unit.toLowerCase()];
  if (kg == null) return null;
  const perKg = usd / kg;
  return perKg * 1000;
}

export function freshnessOf(dateStr: string | undefined): Freshness {
  if (!dateStr) return 'UNKNOWN';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'UNKNOWN';
  const days = (Date.now() - d.getTime()) / 86400000;
  if (days <= 2) return 'CURRENT';
  if (days <= 14) return 'RECENT';
  return 'STALE';
}

export function formatPrice(p: PricePoint): string {
  if (p.price == null || p.currency == null || p.unit == null) {
    return 'INSUFFICIENT VERIFIED DATA';
  }
  return `${p.currency} ${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${p.unit}`;
}

export function formatUsdPerMt(p: PricePoint): string {
  if (p.normalized_price_usd == null) return '—';
  return `USD ${p.normalized_price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} / MT`;
}

export function confidenceRank(c: Confidence): number {
  return c === 'HIGH' ? 3 : c === 'MEDIUM' ? 2 : 1;
}

export function statusRank(s: DataStatus): number {
  return s === 'VERIFIED' ? 4 : s === 'REPORTED' ? 3 : s === 'ESTIMATED' ? 2 : 1;
}

export function shipmentStatusColor(status: string): string {
  switch (status) {
    case 'Arrived':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'In Transit':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'Delayed':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Cancelled':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'Planned':
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

export function stockIndicatorColor(indicator: string): string {
  switch (indicator) {
    case 'SHORTAGE':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'EXCESS':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'NORMAL':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

export function classNames(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function severityColor(sev: string): string {
  switch (sev) {
    case 'CRITICAL':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'HIGH':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'MEDIUM':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'LOW':
    default:
      return 'text-sky-700 bg-sky-50 border-sky-200';
  }
}

export function recommendationColor(rec: string): string {
  switch (rec) {
    case 'GO':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'NO-GO':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'NEED MORE DATA':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'HOLD':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'MONITOR':
      return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    default:
      return 'text-slate-700 bg-slate-50 border-slate-200';
  }
}

export function sentimentColor(s: string): string {
  switch (s) {
    case 'Positive':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'Neutral':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'Cautious':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Negative':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'Highly Uncertain':
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

export function supplyDemandColor(level: string): string {
  switch (level) {
    case 'High':
    case 'Strong':
    case 'Surging':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'Normal':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'Tight':
    case 'Weak':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Critical':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'Unknown':
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

export function freshnessColor(f: Freshness): string {
  switch (f) {
    case 'CURRENT':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'RECENT':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    case 'STALE':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-slate-700 bg-slate-100 border-slate-200';
  }
}

export function confidenceColor(c: Confidence): string {
  switch (c) {
    case 'HIGH':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'MEDIUM':
      return 'text-sky-700 bg-sky-50 border-sky-200';
    default:
      return 'text-amber-700 bg-amber-50 border-amber-200';
  }
}
