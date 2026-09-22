// Focused Unit Tests for Global Commodity Normalization Layer
// Run with: npx tsx src/agent/__test__/normalization.test.ts

import {
  normalizeCommodity,
  normalizeUnit,
  normalizeCurrency,
  normalizePricePoint,
} from '../normalization';
import type { PricePoint } from '../../lib/types';

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

console.log('\n=== ALL NORMALIZATION TESTS SUMMARY ===');
if (process.exitCode) {
  console.log('NORMALIZATION TEST SUITE FAILED — see details above.');
} else {
  console.log('NORMALIZATION TEST SUITE PASSED — all normalization assertions passed cleanly.');
}
