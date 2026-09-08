// Market Data — store and manage commodity market observations.

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, Badge, Button, Input, Select, Field, Modal, EmptyState } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { storedMarketDataProvider } from '@/lib/providers';
import { confidenceColor, sentimentColor } from '@/lib/format';
import { commodityCategory } from '@/agent/parser';

interface Row {
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
  competitor_info?: string | null;
  trader_company?: string | null;
  buying_selling_behavior?: string | null;
  new_arrivals?: string | null;
  market_sentiment?: string | null;
  risks_problems?: string | null;
  collector?: string | null;
  import_status?: string | null;
  export_status?: string | null;
  logistics_status?: string | null;
  notes?: string | null;
  data_status: string;
  confidence: string;
}

const EMPTY = {
  commodity: '', country: '', city: '', market: '', origin: '', destination: '', trader_company: '',
  price: '', currency: 'USD', unit: 'kg', observation_date: new Date().toISOString().slice(0, 10),
  source: '', source_type: 'industry', supply: 'Normal', demand: 'Normal', stock: '',
  competitor_info: '', buying_selling_behavior: '', new_arrivals: '',
  market_sentiment: 'Neutral', risks_problems: '', collector: '',
  import_status: '', export_status: '', logistics_status: '', notes: '',
  data_status: 'REPORTED', confidence: 'MEDIUM',
};

export function MarketDataPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await storedMarketDataProvider.listRecent(200);
    setRows(data as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.commodity || !form.country) return;
    setSaving(true);
    const row = {
      ...form,
      commodity_category: commodityCategory(form.commodity),
      price: form.price ? Number(form.price) : null,
      observation_date: form.observation_date,
    };
    await storedMarketDataProvider.insert(row);
    setSaving(false);
    setOpen(false);
    setForm(EMPTY);
    await load();
  };

  const remove = async (id: string) => {
    await storedMarketDataProvider.remove(id);
    await load();
  };

  const filtered = filter
    ? rows.filter((r) => (r.commodity + r.country + r.city).toLowerCase().includes(filter.toLowerCase()))
    : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_market_data')}</h1>
        <div className="flex gap-2">
          <Input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40" />
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t(lang, 'add_market_data')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t(lang, 'no_data')} subtitle={t(lang, 'add_market_data')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Commodity</th>
                  <th className="px-4 py-2 font-medium">Location</th>
                  <th className="px-4 py-2 font-medium">Trader / Company</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Supply</th>
                  <th className="px-4 py-2 font-medium">Demand</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Sentiment</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Collector</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{r.commodity}</td>
                    <td className="px-4 py-2 text-slate-600">{[r.city, r.country].filter(Boolean).join(', ')}</td>
                    <td className="px-4 py-2 text-slate-500">{r.trader_company ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{r.price != null ? `${r.currency} ${r.price}/${r.unit}` : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.supply ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{r.demand ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{String(r.observation_date).slice(0, 10)}</td>
                    <td className="px-4 py-2">{r.market_sentiment ? <Badge className={sentimentColor(r.market_sentiment)}>{r.market_sentiment}</Badge> : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.source ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.collector ?? '—'}</td>
                    <td className="px-4 py-2"><Badge className={confidenceColor(r.confidence as 'HIGH' | 'MEDIUM' | 'LOW')}>{r.data_status}</Badge></td>
                    <td className="px-4 py-2">
                      <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t(lang, 'add_market_data')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(lang, 'commodity')}><Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="Wheat" /></Field>
          <Field label={t(lang, 'commodity_category')}><Input value={commodityCategory(form.commodity || 'Other')} disabled /></Field>
          <Field label={t(lang, 'country')}><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Afghanistan" /></Field>
          <Field label="Trader / Company (optional)"><Input value={form.trader_company} onChange={(e) => setForm({ ...form, trader_company: e.target.value })} placeholder="Trader or company name" /></Field>
          <Field label={t(lang, 'city')}><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mazar-e-Sharif" /></Field>
          <Field label={t(lang, 'price')}><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="22" /></Field>
          <Field label={t(lang, 'currency')}><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="AFN" /></Field>
          <Field label={t(lang, 'unit')}><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            <option>kg</option><option>ton</option><option>mt</option><option>bag</option><option>litre</option><option>lb</option>
          </Select></Field>
          <Field label={t(lang, 'date')}><Input type="date" value={form.observation_date} onChange={(e) => setForm({ ...form, observation_date: e.target.value })} /></Field>
          <Field label={t(lang, 'supply')}><Select value={form.supply} onChange={(e) => setForm({ ...form, supply: e.target.value })}>
            <option>High</option><option>Normal</option><option>Tight</option><option>Critical</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'demand')}><Select value={form.demand} onChange={(e) => setForm({ ...form, demand: e.target.value })}>
            <option>Strong</option><option>Normal</option><option>Weak</option><option>Surging</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'stock')}><Select value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}>
            <option value="">—</option>
            <option>High</option><option>Normal</option><option>Low</option><option>Depleted</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'market_sentiment')}><Select value={form.market_sentiment} onChange={(e) => setForm({ ...form, market_sentiment: e.target.value })}>
            <option>Positive</option><option>Neutral</option><option>Cautious</option><option>Negative</option><option>Highly Uncertain</option>
          </Select></Field>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'buying_selling_behavior')}><Input value={form.buying_selling_behavior} onChange={(e) => setForm({ ...form, buying_selling_behavior: e.target.value })} placeholder="Active buying, price negotiation, bulk purchases…" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'competitor_info')}><Input value={form.competitor_info} onChange={(e) => setForm({ ...form, competitor_info: e.target.value })} placeholder="Competitor activity observed…" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'new_arrivals')}><Input value={form.new_arrivals} onChange={(e) => setForm({ ...form, new_arrivals: e.target.value })} placeholder="New shipments or goods arriving at the market…" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'risks_problems')}><Input value={form.risks_problems} onChange={(e) => setForm({ ...form, risks_problems: e.target.value })} placeholder="Supply disruptions, road issues, payment risks…" /></Field>
          </div>
          <Field label={t(lang, 'import_status')}><Select value={form.import_status} onChange={(e) => setForm({ ...form, import_status: e.target.value })}>
            <option value="">—</option>
            <option>Normal</option><option>Restricted</option><option>Banned</option><option>Delayed</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'export_status')}><Select value={form.export_status} onChange={(e) => setForm({ ...form, export_status: e.target.value })}>
            <option value="">—</option>
            <option>Normal</option><option>Restricted</option><option>Banned</option><option>Delayed</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'logistics_status')}><Select value={form.logistics_status} onChange={(e) => setForm({ ...form, logistics_status: e.target.value })}>
            <option value="">—</option>
            <option>Normal</option><option>Disrupted</option><option>Constrained</option><option>Blocked</option><option>Unknown</option>
          </Select></Field>
          <Field label={t(lang, 'collector')}><Input value={form.collector} onChange={(e) => setForm({ ...form, collector: e.target.value })} placeholder="Name of field officer" /></Field>
          <Field label={t(lang, 'source')}><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="FAO AMIS" /></Field>
          <Field label={t(lang, 'source_type')}><Select value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
            <option value="government">Government</option>
            <option value="international">International organization</option>
            <option value="exchange">Commodity exchange</option>
            <option value="industry">Industry source</option>
            <option value="news">News</option>
            <option value="market">Market participant</option>
          </Select></Field>
          <Field label={t(lang, 'data_status')}><Select value={form.data_status} onChange={(e) => setForm({ ...form, data_status: e.target.value })}>
            <option>VERIFIED</option><option>REPORTED</option><option>ESTIMATED</option><option>FORECAST</option>
          </Select></Field>
          <Field label={t(lang, 'confidence')}><Select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
            <option>HIGH</option><option>MEDIUM</option><option>LOW</option>
          </Select></Field>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'notes')}><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Free-text observation notes" /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>{t(lang, 'cancel')}</Button>
          <Button onClick={submit} disabled={saving || !form.commodity || !form.country}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t(lang, 'save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
