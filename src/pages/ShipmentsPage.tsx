// Shipments — track individual shipments/wagons with origin, commodity,
// quantity, dates, status, and notes. Provides summary cards for incoming
// volume, expected arrivals, recent arrivals, and delayed shipments.

import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Card, Badge, Button, Input, Select, Field, Modal, EmptyState, StatCard } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { shipmentsProvider } from '@/lib/providers';
import { shipmentStatusColor } from '@/lib/format';
import type { Shipment } from '@/lib/types';

const STATUSES = ['Planned', 'In Transit', 'Arrived', 'Delayed', 'Cancelled'];
const UNITS = ['kg', 'ton', 'mt', 'bag', 'litre', 'lb'];

const EMPTY_FORM = {
  shipment_id: '', origin: '', destination: '', commodity: '',
  quantity: '', unit: 'ton', departure_date: '', expected_arrival: '',
  actual_arrival: '', status: 'Planned', notes: '', source: '',
};

export function ShipmentsPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await shipmentsProvider.listRecent(200);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.shipment_id || !form.commodity || !form.origin) return;
    setSaving(true);
    const row: Record<string, unknown> = {
      shipment_id: form.shipment_id,
      origin: form.origin,
      destination: form.destination,
      commodity: form.commodity,
      quantity: form.quantity ? Number(form.quantity) : null,
      unit: form.unit,
      departure_date: form.departure_date || null,
      expected_arrival: form.expected_arrival || null,
      actual_arrival: form.actual_arrival || null,
      status: form.status,
      source: form.source || null,
      notes: form.notes || null,
    };
    await shipmentsProvider.insert(row);
    setSaving(false);
    setOpen(false);
    setForm(EMPTY_FORM);
    await load();
  };

  const remove = async (id: string) => {
    await shipmentsProvider.remove(id);
    await load();
  };

  const filtered = filter
    ? rows.filter((r) =>
        (r.shipment_id + r.commodity + r.origin + r.destination + r.status)
          .toLowerCase().includes(filter.toLowerCase()))
    : rows;

  const summaries = useMemo(() => computeSummaries(rows), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_shipments')}</h1>
        <div className="flex gap-2">
          <Input placeholder={t(lang, 'filter')} value={filter} onChange={(e) => setFilter(e.target.value)} className="w-40" />
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t(lang, 'add_shipment')}</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t(lang, 'incoming_volume')}
          value={summaries.incomingVolume != null ? `${summaries.incomingVolume.toLocaleString()} ${summaries.incomingUnit ?? ''}` : '—'}
          sub={`${summaries.incomingCount} ${t(lang, 'shipments')}`}
          accent="text-sky-700"
        />
        <StatCard
          label={t(lang, 'expected_arrivals')}
          value={summaries.expectedCount}
          sub={summaries.nextExpected ? t(lang, 'next') + ': ' + summaries.nextExpected : t(lang, 'none_scheduled')}
          accent="text-indigo-700"
        />
        <StatCard
          label={t(lang, 'recent_arrivals')}
          value={summaries.recentCount}
          sub={summaries.lastArrival ? t(lang, 'last') + ': ' + summaries.lastArrival : t(lang, 'none_arrived')}
          accent="text-emerald-700"
        />
        <StatCard
          label={t(lang, 'delayed_shipments')}
          value={summaries.delayedCount}
          sub={summaries.delayedCount > 0 ? t(lang, 'needs_attention') : t(lang, 'all_on_time')}
          accent={summaries.delayedCount > 0 ? 'text-amber-700' : 'text-slate-700'}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title={t(lang, 'no_shipments')} subtitle={t(lang, 'add_shipment')} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t(lang, 'shipment_id')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'commodity')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'route')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'quantity')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'departure_date')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'expected_arrival')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'actual_arrival')}</th>
                  <th className="px-4 py-2 font-medium">{t(lang, 'status')}</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-700">{r.shipment_id}</td>
                    <td className="px-4 py-2 text-slate-600">{r.commodity}</td>
                    <td className="px-4 py-2 text-slate-600">{r.origin} → {r.destination}</td>
                    <td className="px-4 py-2 text-slate-600">{r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.departure_date ? String(r.departure_date).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.expected_arrival ? String(r.expected_arrival).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{r.actual_arrival ? String(r.actual_arrival).slice(0, 10) : '—'}</td>
                    <td className="px-4 py-2"><Badge className={shipmentStatusColor(r.status)}>{r.status}</Badge></td>
                    <td className="px-4 py-2 text-slate-500">{r.source ?? '—'}</td>
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

      <Modal open={open} onClose={() => setOpen(false)} title={t(lang, 'add_shipment')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t(lang, 'shipment_id')}><Input value={form.shipment_id} onChange={(e) => setForm({ ...form, shipment_id: e.target.value })} placeholder="WGN-001" /></Field>
          <Field label={t(lang, 'commodity')}><Input value={form.commodity} onChange={(e) => setForm({ ...form, commodity: e.target.value })} placeholder="Wheat" /></Field>
          <Field label={t(lang, 'origin')}><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Russia" /></Field>
          <Field label={t(lang, 'destination')}><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Mazar-e-Sharif" /></Field>
          <Field label={t(lang, 'quantity')}><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100" /></Field>
          <Field label={t(lang, 'unit')}><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select></Field>
          <Field label={t(lang, 'departure_date')}><Input type="date" value={form.departure_date} onChange={(e) => setForm({ ...form, departure_date: e.target.value })} /></Field>
          <Field label={t(lang, 'expected_arrival')}><Input type="date" value={form.expected_arrival} onChange={(e) => setForm({ ...form, expected_arrival: e.target.value })} /></Field>
          <Field label={t(lang, 'actual_arrival')}><Input type="date" value={form.actual_arrival} onChange={(e) => setForm({ ...form, actual_arrival: e.target.value })} /></Field>
          <Field label={t(lang, 'status')}><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select></Field>
          <div className="sm:col-span-2">
            <Field label="Source"><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Railway record, warehouse log, trader" /></Field>
            <Field label={t(lang, 'notes')}><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t(lang, 'notes_placeholder')} /></Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>{t(lang, 'cancel')}</Button>
          <Button onClick={submit} disabled={saving || !form.shipment_id || !form.commodity || !form.origin}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t(lang, 'save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---- Summaries ----

interface ShipmentSummaries {
  incomingVolume: number | null;
  incomingUnit: string | null;
  incomingCount: number;
  expectedCount: number;
  nextExpected: string | null;
  recentCount: number;
  lastArrival: string | null;
  delayedCount: number;
}

function computeSummaries(rows: Shipment[]): ShipmentSummaries {
  const today = new Date().toISOString().slice(0, 10);
  const activeStatuses = new Set(['In Transit', 'Planned']);
  const active = rows.filter((r) => activeStatuses.has(r.status));

  // Incoming volume — sum quantity of in-transit + planned shipments
  const incoming = active.filter((r) => r.quantity != null);
  const incomingVolume = incoming.length > 0 ? incoming.reduce((s, r) => s + (r.quantity ?? 0), 0) : null;
  const incomingUnit = incoming.length > 0 ? incoming[0].unit ?? null : null;

  // Expected arrivals — shipments with expected_arrival >= today that haven't arrived
  const expected = rows.filter((r) =>
    r.status !== 'Arrived' && r.status !== 'Cancelled' &&
    r.expected_arrival && String(r.expected_arrival).slice(0, 10) >= today
  ).sort((a, b) => String(a.expected_arrival).localeCompare(String(b.expected_arrival)));

  // Recent arrivals — arrived in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recent = rows.filter((r) =>
    r.status === 'Arrived' && r.actual_arrival && String(r.actual_arrival).slice(0, 10) >= thirtyDaysAgo
  ).sort((a, b) => String(b.actual_arrival).localeCompare(String(a.actual_arrival)));

  // Delayed — status is Delayed, OR expected_arrival < today and not arrived/cancelled
  const delayed = rows.filter((r) =>
    r.status === 'Delayed' ||
    (r.status !== 'Arrived' && r.status !== 'Cancelled' &&
     r.expected_arrival && String(r.expected_arrival).slice(0, 10) < today)
  );

  return {
    incomingVolume,
    incomingUnit,
    incomingCount: active.length,
    expectedCount: expected.length,
    nextExpected: expected.length > 0 ? String(expected[0].expected_arrival).slice(0, 10) : null,
    recentCount: recent.length,
    lastArrival: recent.length > 0 ? String(recent[0].actual_arrival).slice(0, 10) : null,
    delayedCount: delayed.length,
  };
}
