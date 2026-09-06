// Reports — list and view generated intelligence reports.

import { useEffect, useState } from 'react';
import { Loader2, ChevronRight, FileDown } from 'lucide-react';
import { Badge, Button, EmptyState, Modal } from '@/components/ui';
import { type Language, t } from '@/lib/i18n';
import { reportsProvider } from '@/lib/providers';
import type { ReportRecord } from '@/lib/types';

export function ReportsPage({ lang }: { lang: Language }) {
  const [rows, setRows] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportRecord | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await reportsProvider.listRecent(100);
      setRows(data as ReportRecord[]);
      setLoading(false);
    })();
  }, []);

  const download = (r: ReportRecord) => {
    const blob = new Blob([r.content_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.report_type}-${r.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_reports')}</h1>

      {rows.length === 0 ? (
        <EmptyState title={t(lang, 'no_reports')} subtitle={t(lang, 'landing_intro')} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-300">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">{r.title}</p>
                <p className="text-xs text-slate-400">
                  {r.report_type.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => download(r)}><FileDown className="h-4 w-4" /></Button>
                <Button variant="secondary" size="sm" onClick={() => setSelected(r)}>{t(lang, 'view')} <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''}>
        {selected && (
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="text-sky-700 bg-sky-50 border-sky-200">{selected.report_type.replace(/_/g, ' ')}</Badge>
              <Badge className="text-slate-700 bg-slate-100 border-slate-200">{selected.language}</Badge>
              <Button size="sm" variant="secondary" onClick={() => download(selected)}><FileDown className="h-4 w-4" /> Markdown</Button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{selected.content_markdown}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
