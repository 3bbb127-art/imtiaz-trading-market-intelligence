// Global-First Normalization Layer for Commodity Market Intelligence
// Standardizes commodities, units, currencies, and prices globally while
// preserving raw source evidence, source publication dates, freshness, and confidence.

import type { Freshness, PricePoint } from '../lib/types';
import { freshnessOf } from '../lib/format';

export interface UnitNormalizationResult {
  canonicalUnit: string | null;
  mtFactor: number | null; // Multiply price by this factor to get price per Metric Ton (MT) if price is per canonicalUnit
  raw: string | null;
}

export interface CommodityNormalizationResult {
  canonical: string | null;
  raw: string | null;
}

export interface CurrencyNormalizationResult {
  canonicalCurrency: string | null;
  raw: string | null;
}

export interface NormalizedPricePointResult extends PricePoint {
  raw_price: number | null;
  raw_currency: string | null;
  raw_unit: string | null;
  raw_commodity?: string | null;
  raw_location?: string | null;
  canonical_commodity?: string | null;
}

// -----------------------------------------------------------------------------
// Commodity Normalization
// -----------------------------------------------------------------------------

const COMMODITY_ALIASES: Record<string, string> = {
  // Grains
  corn: 'Corn',
  maize: 'Corn',
  'yellow corn': 'Corn',
  'white corn': 'Corn',
  wheat: 'Wheat',
  durum: 'Wheat',
  'durum wheat': 'Wheat',
  'milling wheat': 'Wheat',
  'feed wheat': 'Wheat',
  'wheat flour': 'Wheat',
  flour: 'Wheat',
  rice: 'Rice',
  basmati: 'Rice',
  'basmati rice': 'Rice',
  'non-basmati rice': 'Rice',
  paddy: 'Rice',
  'paddy rice': 'Rice',
  'milled rice': 'Rice',
  'white rice': 'Rice',
  barley: 'Barley',
  'feed barley': 'Barley',
  'malting barley': 'Barley',
  sorghum: 'Sorghum',
  oats: 'Oats',

  // Oilseeds & Oils
  soy: 'Soybeans',
  soybean: 'Soybeans',
  soybeans: 'Soybeans',
  'soy oil': 'Soybean Oil',
  'soybean oil': 'Soybean Oil',
  'palm oil': 'Palm Oil',
  'crude palm oil': 'Palm Oil',
  'sunflower oil': 'Sunflower Oil',
  sunflower: 'Sunflower Oil',
  'vegetable oil': 'Vegetable Oil',
  canola: 'Rapeseed',
  rapeseed: 'Rapeseed',

  // Softs & Sugar
  sugar: 'Sugar',
  'raw sugar': 'Sugar',
  'white sugar': 'Sugar',
  'refined sugar': 'Sugar',
  coffee: 'Coffee',
  cocoa: 'Cocoa',
  cotton: 'Cotton',

  // Pulses
  lentils: 'Lentils',
  chickpeas: 'Chickpeas',
  beans: 'Beans',
};

export function normalizeCommodity(
  rawCommodity: string | null | undefined,
): CommodityNormalizationResult {
  if (!rawCommodity || typeof rawCommodity !== 'string') {
    return { canonical: null, raw: rawCommodity ?? null };
  }

  const trimmed = rawCommodity.trim();
  if (!trimmed) {
    return { canonical: null, raw: trimmed };
  }

  const lower = trimmed.toLowerCase().replace(/\s+/g, ' ');
  const matched = COMMODITY_ALIASES[lower];

  if (matched) {
    return { canonical: matched, raw: trimmed };
  }

  // Fallback title-case without fabricating non-existent commodity types
  const titleCased = trimmed
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return { canonical: titleCased, raw: trimmed };
}

// -----------------------------------------------------------------------------
// Unit & Quantity Normalization
// -----------------------------------------------------------------------------

export function normalizeUnit(
  rawUnit: string | null | undefined,
): UnitNormalizationResult {
  if (!rawUnit || typeof rawUnit !== 'string') {
    return { canonicalUnit: null, mtFactor: null, raw: rawUnit ?? null };
  }

  const trimmed = rawUnit.trim();
  if (!trimmed) {
    return { canonicalUnit: null, mtFactor: null, raw: trimmed };
  }

  const lower = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (lower === 'mt' || lower === 'ton' || lower === 'tonne' || lower === 'metricton' || lower === 'mton') {
    return { canonicalUnit: 'MT', mtFactor: 1, raw: trimmed };
  }

  if (lower === 'kg' || lower === 'kilo' || lower === 'kilogram') {
    return { canonicalUnit: 'kg', mtFactor: 1000, raw: trimmed };
  }

  if (lower === 'bag' || lower === '50kg' || lower === '50kgbag' || lower === 'bag50kg') {
    return { canonicalUnit: 'bag (50kg)', mtFactor: 20, raw: trimmed };
  }

  if (lower === 'lb' || lower === 'lbs' || lower === 'pound' || lower === 'pounds') {
    return { canonicalUnit: 'lb', mtFactor: 2204.62, raw: trimmed };
  }

  if (lower === 'quintal' || lower === 'qtl' || lower === '100kg') {
    return { canonicalUnit: 'quintal (100kg)', mtFactor: 10, raw: trimmed };
  }

  if (lower === 'litre' || lower === 'liter' || lower === 'l') {
    // Litres require commodity-specific density to convert to metric tons.
    // Without density, keep mtFactor null to avoid guessing.
    return { canonicalUnit: 'litre', mtFactor: null, raw: trimmed };
  }

  // Unknown unit: retain raw unit, factor remains null so no prices are guessed
  return { canonicalUnit: trimmed, mtFactor: null, raw: trimmed };
}

// -----------------------------------------------------------------------------
// Currency Normalization
// -----------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '₽': 'RUB',
  '₺': 'TRY',
  '¥': 'CNY',
  '₴': 'UAH',
};

export function normalizeCurrency(
  rawCurrency: string | null | undefined,
): CurrencyNormalizationResult {
  if (!rawCurrency || typeof rawCurrency !== 'string') {
    return { canonicalCurrency: null, raw: rawCurrency ?? null };
  }

  const trimmed = rawCurrency.trim();
  if (!trimmed) {
    return { canonicalCurrency: null, raw: trimmed };
  }

  const upper = trimmed.toUpperCase();
  if (CURRENCY_SYMBOLS[trimmed]) {
    return { canonicalCurrency: CURRENCY_SYMBOLS[trimmed], raw: trimmed };
  }

  if (/^[A-Z]{3}$/.test(upper)) {
    return { canonicalCurrency: upper, raw: trimmed };
  }

  return { canonicalCurrency: upper, raw: trimmed };
}

// -----------------------------------------------------------------------------
// Full PricePoint Normalization
// -----------------------------------------------------------------------------

export function normalizePricePoint(
  p: PricePoint,
  fxRates: Array<{ base_currency: string; quote_currency: string; rate: number }> = [],
): NormalizedPricePointResult {
  const currencyNorm = normalizeCurrency(p.currency);
  const unitNorm = normalizeUnit(p.unit);

  let normalizedUsdPerMt = p.normalized_price_usd;

  // Re-calculate or verify USD/MT if raw price, currency, and unit are present
  if (p.price != null && p.price > 0 && currencyNorm.canonicalCurrency && unitNorm.mtFactor != null) {
    let usdPrice: number | null = null;
    const currency = currencyNorm.canonicalCurrency;

    if (currency === 'USD') {
      usdPrice = p.price;
    } else {
      const direct = fxRates.find(
        (f) => f.base_currency.toUpperCase() === currency && f.quote_currency.toUpperCase() === 'USD' && f.rate > 0,
      );
      if (direct) {
        usdPrice = p.price * direct.rate;
      } else {
        const inverse = fxRates.find(
          (f) => f.base_currency.toUpperCase() === 'USD' && f.quote_currency.toUpperCase() === currency && f.rate > 0,
        );
        if (inverse) {
          usdPrice = p.price / inverse.rate;
        }
      }
    }

    if (usdPrice != null) {
      normalizedUsdPerMt = usdPrice * unitNorm.mtFactor;
    }
  }

  // Preserve publication date freshness calculation
  const freshness: Freshness = p.freshness ?? freshnessOf(p.observation_date);

  return {
    ...p,
    raw_price: p.price,
    raw_currency: p.currency,
    raw_unit: p.unit,
    raw_location: p.location,

    price: p.price,
    currency: currencyNorm.canonicalCurrency ?? p.currency,
    unit: unitNorm.canonicalUnit ?? p.unit,

    normalized_price_usd: normalizedUsdPerMt,
    normalized_unit: 'USD/MT',

    data_status: p.data_status,
    confidence: p.confidence,
    freshness,
    observation_date: p.observation_date,
  };
}
