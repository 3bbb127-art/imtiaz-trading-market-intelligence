// Locations — reusable location profiles (country, city, currency, sources,
// trade routes). Users can add any global location. Never locked to one.

import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Loader2, Edit3, Globe2, Truck, Banknote } from 'lucide-react';
import { Card, SectionTitle, Badge, Button, Input, Select, Field, Modal, EmptyState, Textarea } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { locationProfilesProvider } from '@/lib/providers';
import type { LocationProfile } from '@/lib/types';

const EMPTY_FORM = {
  name: '', country: '', region: '', city: '', market: '', currency: 'USD',
  relevant_sources: '', customs_sources: '', trade_routes: '', notes: '', is_default: 'false',
};

function parseList(s: string): string[] {
  return s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
}

function parseRoutes(s: string): { route: string; mode: string }[] {
  return s.split('\n').map((line) => {
    const [route, mode] = line.split('|').map((x) => x.trim());
    return { route: route || line.trim(), mode: mode || 'Road' };
  }).filter((r) => r.route);
}

function routesToString(routes: { route: string; mode: string }[]): string {
  return routes.map((r) => `${r.route} | ${r.mode}`).join('\n');
}

export function LocationsPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<LocationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await locationProfilesProvider.list();
    setRows(data as LocationProfile[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (p: LocationProfile) => {
    setForm({
      name: p.name,
      country: p.country,
      region: p.region ?? '',
      city: p.city ?? '',
      market: p.market ?? '',
      currency: p.currency,
      relevant_sources: (p.relevant_sources ?? []).join(', '),
      customs_sources: (p.customs_sources ?? []).join(', '),
      trade_routes: routesToString(p.trade_routes ?? []),
      notes: p.notes ?? '',
      is_default: p.is_default ? 'true' : 'false',
    } as Record<string, string>);
    setEditId(p.id);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.country) return;
    setSaving(true);
    const row: Record<string, unknown> = {
      name: form.name,
      country: form.country,
      region: form.region || null,
      city: form.city || null,
      market: form.market || null,
      currency: form.currency,
      relevant_sources: parseList(form.relevant_sources),
      customs_sources: parseList(form.customs_sources),
      trade_routes: parseRoutes(form.trade_routes),
      notes: form.notes || null,
      is_default: form.is_default === 'true',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>;
    if (editId) {
      await locationProfilesProvider.update(editId, row);
    } else {
      await locationProfilesProvider.insert(row);
    }
    setSaving(false);
    setOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    await locationProfilesProvider.remove(id);
    await load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_locations')}</h1>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4" /> {t(lang, 'add_location')}</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t(lang, 'none')} subtitle={t(lang, 'add_location')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{[p.city, p.country].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={() => remove(p.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="text-emerald-700 bg-emerald-50 border-emerald-200"><Banknote className="mr-1 h-3 w-3" />{p.currency}</Badge>
                {p.is_default && <Badge className="text-slate-700 bg-slate-100 border-slate-200">Default</Badge>}
              </div>

              {p.relevant_sources?.length > 0 && (
                <div className="mt-3">
                  <SectionTitle icon={<Globe2 className="h-3.5 w-3.5" />}>Sources</SectionTitle>
                  <p className="mt-1 text-xs text-slate-500">{p.relevant_sources.join(', ')}</p>
                </div>
              )}
              {p.trade_routes?.length > 0 && (
                <div className="mt-3">
                  <SectionTitle icon={<Truck className="h-3.5 w-3.5" />}>Trade Routes</SectionTitle>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                    {p.trade_routes.map((r, i) => <li key={i}>{r.route} <span className="text-slate-400">({r.mode})</span></li>)}
                  </ul>
                </div>
              )}
              {p.notes && <p className="mt-3 text-xs italic text-slate-400">{p.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? t(lang, 'edit') : t(lang, 'add_location')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Profile Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Afghanistan / Mazar-e-Sharif" /></Field>
          <Field label={t(lang, 'country')}><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Afghanistan" /></Field>
          <Field label="Region / Province"><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Balkh" /></Field>
          <Field label={t(lang, 'city')}><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mazar-e-Sharif" /></Field>
          <Field label="Market"><Input value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="Mazar Central Market" /></Field>
          <Field label={t(lang, 'currency')}><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="AFN" /></Field>
          <div className="sm:col-span-2">
            <Field label="Relevant Sources (comma-separated)"><Textarea rows={2} value={form.relevant_sources} onChange={(e) => setForm({ ...form, relevant_sources: e.target.value })} placeholder="FAO AMIS, World Bank, Tridge" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Customs Sources (comma-separated)"><Textarea rows={2} value={form.customs_sources} onChange={(e) => setForm({ ...form, customs_sources: e.target.value })} placeholder="Afghanistan Customs Department" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Trade Routes (one per line: Route | Mode)"><Textarea rows={3} value={form.trade_routes} onChange={(e) => setForm({ ...form, trade_routes: e.target.value })} placeholder="Russia -> Afghanistan via Kazakhstan | Rail/Road" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t(lang, 'notes')}><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <Field label="Default profile?"><Select value={form.is_default ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_default: e.target.value })}>
            <option value="false">No</option><option value="true">Yes</option>
          </Select></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>{t(lang, 'cancel')}</Button>
          <Button onClick={submit} disabled={saving || !form.name || !form.country}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t(lang, 'save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
