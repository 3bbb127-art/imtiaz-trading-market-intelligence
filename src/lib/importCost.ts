// Import cost / landed cost calculator.
// Accepts user-entered cost components only — never invents tariff/customs values.
// All calculations are pure: given an ImportCostInput, returns an ImportCostResult.

import type { ImportCostInput, ImportCostResult, ImportCostLineItem } from './types';

const FALLBACK_USD_RATES: Record<string, number> = {
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
  IRR: 0.000024,
};

function toUsd(amount: number, currency: string): number | null {
  const rate = FALLBACK_USD_RATES[currency.toUpperCase()];
  if (rate == null) return null;
  return amount * rate;
}

export function calculateImportCost(input: ImportCostInput): ImportCostResult {
  const lineItems: ImportCostLineItem[] = [];
  const totalCurrency = 'USD';

  // Purchase price — convert to USD
  const purchaseUsd = toUsd(input.purchasePrice, input.purchaseCurrency);
  if (purchaseUsd == null) {
    return {
      lineItems: [],
      totalImportCost: 0,
      totalCurrency,
      landedCost: 0,
      landedCostCurrency: totalCurrency,
      landedCostPerUnit: 0,
      perUnitCurrency: totalCurrency,
      afnEquivalent: null,
      margin: null,
      marginPct: null,
      note: `Cannot convert purchase currency ${input.purchaseCurrency} to USD. Use a supported currency or provide an exchange rate.`,
    };
  }

  const purchaseTotalUsd = purchaseUsd * input.quantity;
  lineItems.push({ label: `Purchase Price (${input.quantity} ${input.unit})`, amount: purchaseTotalUsd, currency: totalCurrency });

  // Additive cost components — each entered by user, converted to USD
  const components: { label: string; value: number | null }[] = [
    { label: 'Freight', value: input.freight },
    { label: 'Insurance', value: input.insurance },
    { label: 'Customs / Tariff', value: input.customsTariff },
    { label: 'Taxes / Fees', value: input.taxesFees },
    { label: 'Transport / Handling', value: input.transportHandling },
  ];

  for (const c of components) {
    if (c.value != null && c.value > 0) {
      lineItems.push({ label: c.label, amount: c.value, currency: totalCurrency });
    }
  }

  const totalImportCost = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const landedCost = totalImportCost;
  const landedCostPerUnit = input.quantity > 0 ? totalImportCost / input.quantity : 0;

  // AFN equivalent via user-provided exchange rate or fallback
  let afnEquivalent: number | null = null;
  if (input.exchangeRate != null && input.exchangeRate > 0) {
    // exchangeRate is USD->AFN (how many AFN per 1 USD)
    afnEquivalent = totalImportCost * input.exchangeRate;
  } else {
    const afnRate = FALLBACK_USD_RATES['AFN'];
    if (afnRate) {
      afnEquivalent = totalImportCost / afnRate;
    }
  }

  // Margin calculation — selling price converted to USD
  let margin: number | null = null;
  let marginPct: number | null = null;
  if (input.sellingPrice != null && input.sellingPrice > 0) {
    const sellingUsd = toUsd(input.sellingPrice, input.sellingCurrency);
    if (sellingUsd != null) {
      const totalSelling = sellingUsd * input.quantity;
      margin = totalSelling - totalImportCost;
      marginPct = totalImportCost > 0 ? (margin / totalImportCost) * 100 : null;
    }
  }

  const missing: string[] = [];
  if (input.freight == null) missing.push('freight');
  if (input.insurance == null) missing.push('insurance');
  if (input.customsTariff == null) missing.push('customs/tariff');
  if (input.taxesFees == null) missing.push('taxes/fees');
  if (input.transportHandling == null) missing.push('transport/handling');

  let note = '';
  if (missing.length > 0) {
    note = `Calculation excludes: ${missing.join(', ')}. Enter these for a complete landed cost.`;
  }
  if (input.exchangeRate == null) {
    note += (note ? ' ' : '') + 'AFN equivalent uses approximate fallback rate. Enter an exact exchange rate for accuracy.';
  }

  return {
    lineItems,
    totalImportCost,
    totalCurrency,
    landedCost,
    landedCostCurrency: totalCurrency,
    landedCostPerUnit,
    perUnitCurrency: totalCurrency,
    afnEquivalent,
    margin,
    marginPct,
    note,
  };
}
