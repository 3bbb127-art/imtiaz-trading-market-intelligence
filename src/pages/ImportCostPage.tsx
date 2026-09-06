// Import Cost Calculator — lets Imtiaz Trading enter real cost components
// (purchase price, freight, insurance, customs/tariff, taxes, transport,
// exchange rate, quantity, optional selling price) and get total import cost,
// landed cost per unit, AFN equivalent, and margin.

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Card, SectionTitle, Button, Input, Field, Select, Badge } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { calculateImportCost } from '@/lib/importCost';
import type { ImportCostInput, ImportCostResult } from '@/lib/types';
import { classNames } from '@/lib/format';

const CURRENCIES = ['USD', 'AFN', 'EUR', 'PKR', 'INR', 'RUB', 'AED', 'CNY', 'KZT', 'TRY', 'IRR', 'GBP'];
const UNITS = ['kg', 'ton', 'mt', 'bag', 'litre', 'lb'];

export function ImportCostPage({ lang }: { lang: Language }) {
  const [form, setForm] = useState({
    commodity: '',
    origin: '',
    purchasePrice: '',
    purchaseCurrency: 'USD',
    quantity: '',
    unit: 'ton',
    exchangeRate: '',
    exchangeRatePair: 'USD/AFN',
    freight: '',
    insurance: '',
    customsTariff: '',
    taxesFees: '',
    transportHandling: '',
    sellingPrice: '',
    sellingCurrency: 'AFN',
  });

  const [result, setResult] = useState<ImportCostResult | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const compute = () => {
    const numOrZero = (v: string): number | null => {
      const n = parseFloat(v);
      return v.trim() === '' || Number.isNaN(n) ? null : n;
    };

    const input: ImportCostInput = {
      commodity: form.commodity.trim() || 'Unknown',
      origin: form.origin.trim() || 'Unknown',
      purchasePrice: parseFloat(form.purchasePrice) || 0,
      purchaseCurrency: form.purchaseCurrency,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      exchangeRate: numOrZero(form.exchangeRate),
      exchangeRatePair: form.exchangeRatePair,
      freight: numOrZero(form.freight),
      insurance: numOrZero(form.insurance),
      customsTariff: numOrZero(form.customsTariff),
      taxesFees: numOrZero(form.taxesFees),
      transportHandling: numOrZero(form.transportHandling),
      sellingPrice: numOrZero(form.sellingPrice),
      sellingCurrency: form.sellingCurrency,
    };

    setResult(calculateImportCost(input));
  };

  const canCompute = parseFloat(form.purchasePrice) > 0 && parseFloat(form.quantity) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-emerald-600" />
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_import_cost')}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <Card className="p-5">
          <SectionTitle icon={<Calculator className="h-4 w-4" />}>{t(lang, 'import_cost_inputs')}</SectionTitle>

          <div className="mt-4 space-y-4">
            {/* Shipment details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(lang, 'commodity')}>
                <Input value={form.commodity} onChange={(e) => set('commodity', e.target.value)} placeholder="Wheat" />
              </Field>
              <Field label={t(lang, 'origin')}>
                <Input value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Russia" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t(lang, 'price')}>
                <Input type="number" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} placeholder="250" />
              </Field>
              <Field label={t(lang, 'currency')}>
                <Select value={form.purchaseCurrency} onChange={(e) => set('purchaseCurrency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label={t(lang, 'unit')}>
                <Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t(lang, 'quantity')}>
                <Input type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="100" />
              </Field>
              <Field label={t(lang, 'exchange_rate')}>
                <Input type="number" step="0.0001" value={form.exchangeRate} onChange={(e) => set('exchangeRate', e.target.value)} placeholder="e.g. 71.5 (1 USD = 71.5 AFN)" />
              </Field>
            </div>

            {/* Cost components */}
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'cost_components')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t(lang, 'freight')}>
                  <Input type="number" value={form.freight} onChange={(e) => set('freight', e.target.value)} placeholder="USD" />
                </Field>
                <Field label={t(lang, 'insurance')}>
                  <Input type="number" value={form.insurance} onChange={(e) => set('insurance', e.target.value)} placeholder="USD" />
                </Field>
                <Field label={t(lang, 'customs_tariff')}>
                  <Input type="number" value={form.customsTariff} onChange={(e) => set('customsTariff', e.target.value)} placeholder="USD" />
                </Field>
                <Field label={t(lang, 'taxes_fees')}>
                  <Input type="number" value={form.taxesFees} onChange={(e) => set('taxesFees', e.target.value)} placeholder="USD" />
                </Field>
                <Field label={t(lang, 'transport_handling')}>
                  <Input type="number" value={form.transportHandling} onChange={(e) => set('transportHandling', e.target.value)} placeholder="USD" />
                </Field>
              </div>
            </div>

            {/* Selling price (optional) */}
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t(lang, 'selling_price_optional')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t(lang, 'selling_price')}>
                  <Input type="number" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} placeholder="Per unit" />
                </Field>
                <Field label={t(lang, 'currency')}>
                  <Select value={form.sellingCurrency} onChange={(e) => set('sellingCurrency', e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              </div>
            </div>

            <Button onClick={compute} disabled={!canCompute} size="lg" className="w-full">
              <Calculator className="h-4 w-4" /> {t(lang, 'calculate')}
            </Button>
            {!canCompute && (
              <p className="text-center text-xs text-slate-400">{t(lang, 'enter_price_quantity')}</p>
            )}
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {!result && (
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <Calculator className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">{t(lang, 'import_cost_result_placeholder')}</p>
            </Card>
          )}

          {result && (
            <>
              {result.lineItems.length === 0 ? (
                <Card className="border-rose-200 bg-rose-50 p-5">
                  <p className="text-sm text-rose-700">{result.note}</p>
                </Card>
              ) : (
                <>
                  {/* Line items */}
                  <Card className="p-5">
                    <SectionTitle>{t(lang, 'cost_breakdown')}</SectionTitle>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500">
                            <th className="py-2 pr-3 font-medium">Component</th>
                            <th className="py-2 pr-3 font-medium">Amount</th>
                            <th className="py-2 font-medium">Currency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.lineItems.map((li, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-2 pr-3 text-slate-700">{li.label}</td>
                              <td className="py-2 pr-3 font-medium text-slate-800">{li.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-slate-600">{li.currency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Key results */}
                  <Card className="p-5">
                    <SectionTitle>{t(lang, 'import_cost_summary')}</SectionTitle>
                    <div className="mt-4 space-y-3">
                      <ResultRow label={t(lang, 'total_import_cost')} value={`${result.totalCurrency} ${result.totalImportCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} highlight />
                      <ResultRow label={t(lang, 'landed_cost')} value={`${result.landedCostCurrency} ${result.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} highlight />
                      <ResultRow label={t(lang, 'landed_cost_per_unit')} value={`${result.perUnitCurrency} ${result.landedCostPerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })} / ${form.unit}`} highlight />
                      {result.afnEquivalent != null && (
                        <ResultRow label={t(lang, 'afn_equivalent')} value={`AFN ${result.afnEquivalent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                      )}
                      {result.margin != null && result.marginPct != null && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-600">{t(lang, 'margin')}</span>
                            <div className="flex items-center gap-2">
                              <Badge className={result.margin >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'}>
                                {result.marginPct >= 0 ? '+' : ''}{result.marginPct.toFixed(1)}%
                              </Badge>
                              <span className="text-sm font-semibold text-slate-800">
                                USD {result.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {result.note && (
                      <p className="mt-3 text-[11px] italic text-amber-600">{result.note}</p>
                    )}
                  </Card>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={classNames('flex items-center justify-between rounded-lg p-3', highlight ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200')}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className={classNames('text-sm font-semibold', highlight ? 'text-emerald-800' : 'text-slate-800')}>{value}</span>
    </div>
  );
}
