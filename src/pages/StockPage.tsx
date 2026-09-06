// Stock Intelligence — track available, reserved, in-transit, and expected
// incoming stock per commodity per warehouse. Provides summary cards and
// shortage/excess indication. Never invents values — missing fields stay blank.

import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, Badge, Button, Input, Select, Field, Modal, EmptyState, StatCard } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { stockProvider } from '@/lib/providers';
import { stockIndicatorColor } from '@/lib/format';
import type { StockRecord } from '@/lib/types';

const UNITS = ['kg', 'ton', 'mt', 'bag', 'litre', 'lb'];

const EMPTY_FORM = {
  commodity: '', warehouse: '', available_stock: '', reserved_stock: '',
  in_transit_stock: '', expected_incoming: '', unit: 'ton',
  update_date: new Date().toISOString().slice(0, 10),
  source: '', notes: '',
};

export function StockPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await stockProvider.listRecent(200);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.commodity) return;
    setSaving(true);
    const row: Record<string, unknown> = {
      commodity: form.commodity,
      warehouse: form.warehouse || null,
      available_stock: form.available_stock ? Number(form.available_stock) : null,
      reserved_stock: form.reserved_stock ? Number(form.reserved_stock) : null,
      in_transit_stock: form.in_transit_stock ? Number(form.in_transit_stock) : null,
      expected_incoming: form.expected_incoming ? Number(form.expected_incoming) : null,
      unit: form.unit,
      update_date: form.update_date,
      source: form.source || null,
      notes: form.notes || null,
    };
    await stockProvider.insert(row);
    setSaving(false);
    setOpen(false);
    setForm(EMPTY_FORM);
    await load();
  };

  const remove = async (id: string) => {
    await stockProvider.remove(id);
    await load();
  };

  const filtered = filter
    ? rows.filter((r) =>
        (r.commodity + (r.warehouse ?? '')).toLowerCase().includes(filter.toLowerCase()))
    : rows;

  const summaries = useMemo(() => computeSummaries(rows), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_stock')}</h1>
        <div className="flex gap-2">
          <Input placeholder={t(lang, 'filter')} value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40" />
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t(lang, 'add_stock')}</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={t(lang, 'available_stock')}
          value={summaries.available != null ? `${summaries.available.toLocaleString()} ${summaries.unit ?? ''}` : '—'}
          accent="text-emerald-700"
        />
        <StatCard
          label={t(lang, 'reserved_stock')}
          value={summaries.reserved != null ? `${summaries.reserved.toLocaleString()} ${summaries.unit ?? ''}` : '—'}
          accent="text-amber-700"
        />
        <StatCard
          label={t(lang, 'in_transit_stock')}
          value={summaries.inTransit != null ? `${summaries.inTransit.toLocaleString()} ${summaries.unit ?? ''}` : '—'}
          accent="text-sky-700"
        />
        <StatCard
          label={t(lang, 'expected_incoming')}
          value={summaries.expectedIncoming != null ? `${summaries.expectedIncoming.toLocaleString()} ${summaries.unit ?? ''}` : '—'}
          accent="text-indigo-700"
        />
        <StatCard
          label={t(lang, 'total_stock_incoming')}
          value={summaries.totalWithIncoming != null ? `${summaries.totalWithIncoming.toLocaleString()} ${summaries.unit ?? ''}` : '—'}
          sub={summaries.indicator !== 'UNKNOWN' ? t(lang, `indicator_${summaries.indicator.toLowerCase()}`) : t(lang, 'indicator_unknown')}
          accent={summaries.indicator === 'SHORTAGE' ? 'text-rose-700' : summaries.indicator === 'EXCESS' ? 'text-emerald-700' : 'text-slate-700'}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t(lang, 'no_stock')} subtitle={t(lang, 'add_stock')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t(lang, 'commodity')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'warehouse')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'available_stock')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'reserved_stock')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'in_transit_stock')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'expected_incoming')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'net_available')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'indicator')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'update_date')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'source')}</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const net = (r.available_stock ?? null) != null && (r.reserved_stock ?? null) != null
                    ? (r.available_stock ?? 0) - (r.reserved_stock ?? 0)
                    : null;
                  const ind = rowIndicator(r);
                  return (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-700">{r.commodity}</td>
                      <td className="px-4 py-2 text-slate-600">{r.warehouse ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-800">{r.available_stock != null ? `${r.available_stock} ${r.unit ?? ''}` : '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{r.reserved_stock != null ? `${r.reserved_stock} ${r.unit ?? ''}` : '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{r.in_transit_stock != null ? `${r.in_transit_stock} ${r.unit ?? ''}` : '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{r.expected_incoming != null ? `${r.expected_incoming} ${r.unit ?? ''}` : '—'}</td>
                      <td className={net != null && net < 0 ? 'px-4 py-2 font-medium text-rose-700' : 'px-4 py-2 text-slate-700'}>
                        {net != null ? `${net} ${r.unit ?? ''}` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge className={stockIndicatorColor(ind)}>{t(lang, `indicator_${ind.toLowerCase()}`)}</Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{String(r.update_date).slice(0, 10)}</td>
                      <td className="px-4 py-2 text-slate-500">{r.source ?? '—'}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t(lang, 'add_stock')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(lang, 'commodity')}><Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="Wheat" /></Field>
          <Field label={t(lang, 'warehouse')}><Input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} placeholder="Mazar Warehouse" /></Field>
          <Field label={t(lang, 'available_stock')}><Input type="number" value={form.available_stock} onChange={(e) => setForm({ ...form, available_stock: e.target.value })} placeholder="500" /></Field>
          <Field label={t(lang, 'reserved_stock')}><Input type="number" value={form.reserved_stock} onChange={(e) => setForm({ ...form, reserved_stock: e.target.value })} placeholder="100" /></Field>
          <Field label={t(lang, 'in_transit_stock')}><Input type="number" value={form.in_transit_stock} onChange={(e) => setForm({ ...form, in_transit_stock: e.target.value })} placeholder="200" /></Field>
          <Field label={t(lang, 'expected_incoming')}><Input type="number" value={form.expected_incoming} onChange={(e) => setForm({ ...form, expected_incoming: e.target.value })} placeholder="300" /></Field>
          <Field label={t(lang, 'unit')}><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select></Field>
          <Field label={t(lang, 'update_date')}><Input type="date" value={form.update_date} onChange={(e) => setForm({ ...form, update_date: e.target.value })} /></Field>
          <Field label={t(lang, 'source')}><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Warehouse log" /></Field>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'notes')}><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t(lang, 'notes_placeholder')} /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>{t(lang, 'cancel')}</Button>
          <Button onClick={submit} disabled={saving || !form.commodity}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t(lang, 'save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---- Summaries ----

interface StockSummaries {
  available: number | null;
  reserved: number | null;
  inTransit: number | null;
  expectedIncoming: number | null;
  totalWithIncoming: number | null;
  unit: string | null;
  indicator: 'SHORTAGE' | 'EXCESS' | 'NORMAL' | 'UNKNOWN';
}

function num(v: number | null | undefined): number | null {
  return v != null ? v : null;
}

function rowIndicator(r: StockRecord): 'SHORTAGE' | 'EXCESS' | 'NORMAL' | 'UNKNOWN' {
  const available = num(r.available_stock);
  const reserved = num(r.reserved_stock);
  if (available == null) return 'UNKNOWN';
  const net = reserved != null ? available - reserved : available;
  if (net < 0) return 'SHORTAGE';
  // Excess: available stock is more than double what's reserved (rough heuristic)
  if (reserved != null && reserved > 0 && available > reserved * 2) return 'EXCESS';
  return 'NORMAL';
}

function computeSummaries(rows: StockRecord[]): StockSummaries {
  if (rows.length === 0) {
    return { available: null, reserved: null, inTransit: null, expectedIncoming: null, totalWithIncoming: null, unit: null, indicator: 'UNKNOWN' };
  }

  // Use the most common unit for display
  const units = rows.map((r) => r.unit).filter((u): u is string => u != null);
  const unit: string | null = units.length > 0 ? units[0] : null;

  const sum = (selector: (r: StockRecord) => number | null | undefined): number | null => {
    const vals = rows.map(selector).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
  };

  const available = sum((r) => r.available_stock);
  const reserved = sum((r) => r.reserved_stock);
  const inTransit = sum((r) => r.in_transit_stock);
  const expectedIncoming = sum((r) => r.expected_incoming);

  const totalWithIncoming = [
    available, inTransit, expectedIncoming,
  ].filter((v): v is number => v != null).reduce((s, v) => s + v, 0) || null;

  // Overall indicator
  let indicator: 'SHORTAGE' | 'EXCESS' | 'NORMAL' | 'UNKNOWN' = 'UNKNOWN';
  if (available != null && reserved != null) {
    const net = available - reserved;
    if (net < 0) indicator = 'SHORTAGE';
    else if (reserved > 0 && available > reserved * 2) indicator = 'EXCESS';
    else indicator = 'NORMAL';
  } else if (available != null && available === 0) {
    indicator = 'SHORTAGE';
  }

  return { available, reserved, inTransit, expectedIncoming, totalWithIncoming, unit, indicator };
}
