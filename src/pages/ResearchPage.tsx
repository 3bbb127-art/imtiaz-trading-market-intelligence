// Research Memory — history of completed research sessions for comparison.

import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, ChevronRight } from 'lucide-react';
import { Card, SectionTitle, Badge, Button, EmptyState } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { researchMemoryProvider } from '@/lib/providers';
import { recommendationColor } from '@/lib/format';
import { FindingsView } from '@/components/FindingsView';
import type { ResearchMemory } from '@/lib/types';

export function ResearchPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<ResearchMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ResearchMemory | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await researchMemoryProvider.listRecent(100);
      setRows(data as ResearchMemory[]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  if (rows.length === 0 && !selected) {
    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_research')}</h1>
        <EmptyState title={t(lang, 'no_research')} subtitle={t(lang, 'landing_intro')} />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800">{selected.command}</h1>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Back</Button>
        </div>
        <Card className="p-5">
          <SectionTitle icon={<FlaskConical className="h-4 w-4" />}>{t(lang, 'workflow')}</SectionTitle>
          <ol className="mt-3 space-y-1.5 text-sm">
            {selected.workflow_steps?.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className={s.status === 'done' ? 'text-emerald-600' : s.status === 'error' ? 'text-rose-600' : 'text-slate-400'}>●</span>
                <span className="text-slate-700">{s.step}{s.detail ? ` — ${s.detail}` : ''}</span>
              </li>
            ))}
          </ol>
        </Card>
        <FindingsView findings={selected.findings} intent={selected.parsed_intent} lang={lang} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'research_memory')}</h1>
      <div className="space-y-2">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{r.command}</p>
              <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            {r.recommendation && <Badge className={recommendationColor(r.recommendation)}>{r.recommendation}</Badge>}
            <ChevronRight className="ml-2 h-4 w-4 text-slate-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
