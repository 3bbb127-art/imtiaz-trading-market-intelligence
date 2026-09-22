// Focused Unit Tests for Global Commodity Normalization Layer
// Run with: npx tsx src/agent/__test__/normalization.test.ts

import {
  normalizeCommodity,
  normalizeUnit,
  normalizeCurrency,
  normalizePricePoint,
} from '../normalization';
import type { Confidence, DataStatus, PricePoint } from '../../lib/types';

function assert(name: string, condition: boolean, details: string): void {
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}: ${details}`);
  if (!condition) process.exitCode = 1;
}

console.log('\n=== TEST 1: Global Commodity Name & Alias Normalization ===');

const maizeNorm = normalizeCommodity('maize');
assert('Maize -> Corn', maizeNorm.canonical === 'Corn', `got "${maizeNorm.canonical}"`);
assert('Maize raw preserved', maizeNorm.raw === 'maize', `got "${maizeNorm.raw}"`);

const durumNorm = normalizeCommodity('durum wheat');
assert('Durum Wheat -> Wheat', durumNorm.canonical === 'Wheat', `got "${durumNorm.canonical}"`);

const paddyNorm = normalizeCommodity('paddy rice');
assert('Paddy Rice -> Rice', paddyNorm.canonical === 'Rice', `got "${paddyNorm.canonical}"`);

const soyNorm = normalizeCommodity('soybeans');
assert('Soybeans -> Soybeans', soyNorm.canonical === 'Soybeans', `got "${soyNorm.canonical}"`);

const customNorm = normalizeCommodity('organic sesame seeds');
assert('Unknown commodity preserves title case', customNorm.canonical === 'Organic Sesame Seeds', `got "${customNorm.canonical}"`);
assert('Unknown commodity raw preserved', customNorm.raw === 'organic sesame seeds', `got "${customNorm.raw}"`);

const nullCommodityNorm = normalizeCommodity(null);
assert('Null commodity -> null canonical', nullCommodityNorm.canonical === null, `got "${nullCommodityNorm.canonical}"`);


console.log('\n=== TEST 2: Global Unit & Quantity Normalization ===');

const mtNorm = normalizeUnit('MT');
assert('MT -> MT (factor 1)', mtNorm.canonicalUnit === 'MT' && mtNorm.mtFactor === 1, `unit=${mtNorm.canonicalUnit}, factor=${mtNorm.mtFactor}`);

const kgNorm = normalizeUnit('kg');
assert('kg -> kg (factor 1000)', kgNorm.canonicalUnit === 'kg' && kgNorm.mtFactor === 1000, `unit=${kgNorm.canonicalUnit}, factor=${kgNorm.mtFactor}`);

const bagNorm = normalizeUnit('50kg bag');
assert('50kg bag -> bag (50kg) (factor 20)', bagNorm.canonicalUnit === 'bag (50kg)' && bagNorm.mtFactor === 20, `unit=${bagNorm.canonicalUnit}, factor=${bagNorm.mtFactor}`);

const lbNorm = normalizeUnit('lbs');
assert('lbs -> lb (factor 2204.62)', lbNorm.canonicalUnit === 'lb' && lbNorm.mtFactor === 2204.62, `unit=${lbNorm.canonicalUnit}, factor=${lbNorm.mtFactor}`);

const qtlNorm = normalizeUnit('quintal');
assert('quintal -> quintal (100kg) (factor 10)', qtlNorm.canonicalUnit === 'quintal (100kg)' && qtlNorm.mtFactor === 10, `unit=${qtlNorm.canonicalUnit}, factor=${qtlNorm.mtFactor}`);

const unknownUnitNorm = normalizeUnit('custom-crate');
assert('Unknown unit preserves raw unit name', unknownUnitNorm.canonicalUnit === 'custom-crate', `unit=${unknownUnitNorm.canonicalUnit}`);
assert('Unknown unit returns null factor (never guess)', unknownUnitNorm.mtFactor === null, `factor=${unknownUnitNorm.mtFactor}`);

const litreNorm = normalizeUnit('litre');
assert('Litre unit canonical is litre', litreNorm.canonicalUnit === 'litre', `unit=${litreNorm.canonicalUnit}`);
assert('Litre unit mtFactor is null without commodity density (never guess)', litreNorm.mtFactor === null, `factor=${litreNorm.mtFactor}`);


console.log('\n=== TEST 3: Currency Symbol & Code Normalization ===');

const usdSymNorm = normalizeCurrency('$');
assert('$ -> USD', usdSymNorm.canonicalCurrency === 'USD', `got "${usdSymNorm.canonicalCurrency}"`);

const eurSymNorm = normalizeCurrency('€');
assert('€ -> EUR', eurSymNorm.canonicalCurrency === 'EUR', `got "${eurSymNorm.canonicalCurrency}"`);

const gbpSymNorm = normalizeCurrency('£');
assert('£ -> GBP', gbpSymNorm.canonicalCurrency === 'GBP', `got "${gbpSymNorm.canonicalCurrency}"`);

const inrNorm = normalizeCurrency('inr');
assert('inr -> INR', inrNorm.canonicalCurrency === 'INR', `got "${inrNorm.canonicalCurrency}"`);


console.log('\n=== TEST 4: PricePoint Normalization & Evidence Preservation ===');

const rawPricePoint: PricePoint = {
  label: 'Mazar-e-Sharif Wheat Market',
  location: 'Mazar-e-Sharif',
  price: 25,
  currency: 'AFN',
  unit: 'kg',
  normalized_price_usd: 350,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/report',
  data_status: 'REPORTED',
  confidence: 'MEDIUM',
  freshness: 'CURRENT',
  observation_date: '2026-09-20',
};

const fxRates = [
  { base_currency: 'AFN', quote_currency: 'USD', rate: 0.014 },
];

const normalizedPoint = normalizePricePoint(rawPricePoint, fxRates);

assert('Raw price preserved', normalizedPoint.raw_price === 25, `got ${normalizedPoint.raw_price}`);
assert('Raw currency preserved', normalizedPoint.raw_currency === 'AFN', `got "${normalizedPoint.raw_currency}"`);
assert('Raw unit preserved', normalizedPoint.raw_unit === 'kg', `got "${normalizedPoint.raw_unit}"`);
assert('Raw location preserved', normalizedPoint.raw_location === 'Mazar-e-Sharif', `got "${normalizedPoint.raw_location}"`);

assert('Data status preserved', normalizedPoint.data_status === 'REPORTED', `got "${normalizedPoint.data_status}"`);
assert('Confidence preserved', normalizedPoint.confidence === 'MEDIUM', `got "${normalizedPoint.confidence}"`);
assert('Freshness preserved', normalizedPoint.freshness === 'CURRENT', `got "${normalizedPoint.freshness}"`);
assert('Observation date preserved', normalizedPoint.observation_date === '2026-09-20', `got "${normalizedPoint.observation_date}"`);

// 25 AFN/kg * 0.014 USD/AFN = 0.35 USD/kg * 1000 kg/MT = 350 USD/MT
assert('Recalculated USD/MT normalized price matches FX rate', Math.abs((normalizedPoint.normalized_price_usd ?? 0) - 350) < 0.01, `got ${normalizedPoint.normalized_price_usd}`);


console.log('\n=== TEST 5: Unparseable & Missing Value Discipline ===');

const incompletePoint: PricePoint = {
  label: 'Unknown Market Observation',
  location: 'Global',
  price: null,
  currency: null,
  unit: null,
  normalized_price_usd: null,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/incomplete',
  data_status: 'REPORTED',
  confidence: 'LOW',
  freshness: 'UNKNOWN',
};

const normalizedIncomplete = normalizePricePoint(incompletePoint);

assert('Missing price remains null (no invention)', normalizedIncomplete.normalized_price_usd === null, `got ${normalizedIncomplete.normalized_price_usd}`);
assert('Missing currency raw preserved', normalizedIncomplete.raw_currency === null, `got ${normalizedIncomplete.raw_currency}`);
assert('Unknown freshness remains UNKNOWN', normalizedIncomplete.freshness === 'UNKNOWN', `got "${normalizedIncomplete.freshness}"`);

console.log('\n=== TEST 6: Data Integrity & Metadata Non-Invention Rules ===');

const litrePricePoint: PricePoint = {
  label: 'Vegetable Oil Price in Rotterdam',
  location: 'Rotterdam',
  price: 1.2,
  currency: 'EUR',
  unit: 'litre',
  normalized_price_usd: null,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/oil',
  data_status: 'REPORTED',
  confidence: 'HIGH',
  freshness: 'CURRENT',
};

const fxRatesEur = [{ base_currency: 'EUR', quote_currency: 'USD', rate: 1.08 }];
const normalizedLitre = normalizePricePoint(litrePricePoint, fxRatesEur);

assert('Litre price point retains raw price 1.2', normalizedLitre.raw_price === 1.2, `got ${normalizedLitre.raw_price}`);
assert('Litre price point retains raw unit litre', normalizedLitre.raw_unit === 'litre', `got "${normalizedLitre.raw_unit}"`);
assert('Litre price point normalized_price_usd remains null (no MT factor guessed without density)', normalizedLitre.normalized_price_usd === null, `got ${normalizedLitre.normalized_price_usd}`);

const missingMetadataPoint: PricePoint = {
  label: 'Unverified Spot Price',
  location: 'Global',
  price: 500,
  currency: 'USD',
  unit: 'MT',
  normalized_price_usd: 500,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/unverified',
  data_status: undefined as unknown as DataStatus,
  confidence: undefined as unknown as Confidence,
  freshness: 'UNKNOWN',
};

const normalizedMissingMetadata = normalizePricePoint(missingMetadataPoint);

assert('data_status is NOT invented when raw is missing', normalizedMissingMetadata.data_status === undefined, `got ${normalizedMissingMetadata.data_status}`);
assert('confidence is NOT invented when raw is missing', normalizedMissingMetadata.confidence === undefined, `got ${normalizedMissingMetadata.confidence}`);

console.log('\n=== TEST 7: Publication Date & Freshness Derivation Rules ===');

const now = Date.now();
const MS_PER_DAY = 86400000;
const date3DaysAgo = new Date(now - 3 * MS_PER_DAY).toISOString().slice(0, 10);
const date45DaysAgo = new Date(now - 45 * MS_PER_DAY).toISOString().slice(0, 10);

const recentPublishedPoint: PricePoint = {
  label: 'Recent Wheat Spot Price',
  location: 'Chicago',
  price: 220,
  currency: 'USD',
  unit: 'MT',
  normalized_price_usd: 220,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/recent-pub',
  data_status: 'REPORTED',
  confidence: 'MEDIUM',
  freshness: 'UNKNOWN',
  published_date: date3DaysAgo,
};

const normalizedRecentPub = normalizePricePoint(recentPublishedPoint);
assert('published_date is preserved in output', normalizedRecentPub.published_date === date3DaysAgo, `got "${normalizedRecentPub.published_date}"`);
assert('Freshness calculated from recent published_date -> CURRENT', normalizedRecentPub.freshness === 'CURRENT', `got "${normalizedRecentPub.freshness}"`);

const stalePublishedPoint: PricePoint = {
  label: 'Stale Wheat Price',
  location: 'Chicago',
  price: 210,
  currency: 'USD',
  unit: 'MT',
  normalized_price_usd: 210,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/stale-pub',
  data_status: 'REPORTED',
  confidence: 'MEDIUM',
  freshness: 'UNKNOWN',
  published_date: date45DaysAgo,
};

const normalizedStalePub = normalizePricePoint(stalePublishedPoint);
assert('Freshness calculated from older published_date -> STALE', normalizedStalePub.freshness === 'STALE', `got "${normalizedStalePub.freshness}"`);

const fallbackObsPoint: PricePoint = {
  label: 'Observation Date Fallback Price',
  location: 'Global',
  price: 230,
  currency: 'USD',
  unit: 'MT',
  normalized_price_usd: 230,
  normalized_unit: 'USD/MT',
  source: 'https://example.com/fallback-obs',
  data_status: 'REPORTED',
  confidence: 'MEDIUM',
  freshness: 'UNKNOWN',
  published_date: null,
  observation_date: date3DaysAgo,
};

const normalizedFallbackObs = normalizePricePoint(fallbackObsPoint);
assert('When published_date is missing, freshness falls back to observation_date -> CURRENT', normalizedFallbackObs.freshness === 'CURRENT', `got "${normalizedFallbackObs.freshness}"`);

console.log('\n=== TEST 8: Unspecified Bag Weight & Ambiguous Ton Rules ===');

const unspecifiedBagNorm = normalizeUnit('bag');
assert('Unspecified bag unit -> canonical "bag"', unspecifiedBagNorm.canonicalUnit === 'bag', `got "${unspecifiedBagNorm.canonicalUnit}"`);
assert('Unspecified bag mtFactor is null (never guess bag weight)', unspecifiedBagNorm.mtFactor === null, `got ${unspecifiedBagNorm.mtFactor}`);

const explicitBagNorm = normalizeUnit('50kg bag');
assert('Explicit 50kg bag -> canonical "bag (50kg)"', explicitBagNorm.canonicalUnit === 'bag (50kg)', `got "${explicitBagNorm.canonicalUnit}"`);
assert('Explicit 50kg bag mtFactor is 20', explicitBagNorm.mtFactor === 20, `got ${explicitBagNorm.mtFactor}`);

const ambiguousTonNorm = normalizeUnit('ton');
assert('Ambiguous ton unit -> canonical "ton"', ambiguousTonNorm.canonicalUnit === 'ton', `got "${ambiguousTonNorm.canonicalUnit}"`);
assert('Ambiguous ton mtFactor is null (never guess ton type)', ambiguousTonNorm.mtFactor === null, `got ${ambiguousTonNorm.mtFactor}`);

const explicitMtNorm = normalizeUnit('MT');
assert('Explicit MT unit -> canonical "MT"', explicitMtNorm.canonicalUnit === 'MT', `got "${explicitMtNorm.canonicalUnit}"`);
assert('Explicit MT mtFactor is 1', explicitMtNorm.mtFactor === 1, `got ${explicitMtNorm.mtFactor}`);

console.log('\n=== ALL NORMALIZATION TESTS SUMMARY ===');
if (process.exitCode) {
  console.log('NORMALIZATION TEST SUITE FAILED — see details above.');
} else {
  console.log('NORMALIZATION TEST SUITE PASSED — all normalization assertions passed cleanly.');
}
