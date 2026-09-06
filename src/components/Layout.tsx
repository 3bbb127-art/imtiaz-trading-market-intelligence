// App shell: sidebar navigation + top bar with language selector.
// Responsive: sidebar collapses to a bottom nav on small screens.

import { useState } from 'react';
import {
  LayoutDashboard, MessageSquareText, Database, FlaskConical, FileText, MapPin, Globe2, Calculator, Truck, Boxes, ClipboardCheck,
} from 'lucide-react';
import { LANGUAGES, type Language, t, dirFor } from '@/lib/i18n';
import { classNames } from '@/lib/format';

export type PageId = 'dashboard' | 'ask' | 'market_data' | 'import_cost' | 'shipments' | 'stock' | 'research' | 'reports' | 'locations' | 'evaluation';

const NAV: { id: PageId; key: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', key: 'nav_dashboard', icon: LayoutDashboard },
  { id: 'ask', key: 'nav_ask', icon: MessageSquareText },
  { id: 'market_data', key: 'nav_market_data', icon: Database },
  { id: 'import_cost', key: 'nav_import_cost', icon: Calculator },
  { id: 'shipments', key: 'nav_shipments', icon: Truck },
  { id: 'stock', key: 'nav_stock', icon: Boxes },
  { id: 'research', key: 'nav_research', icon: FlaskConical },
  { id: 'reports', key: 'nav_reports', icon: FileText },
  { id: 'locations', key: 'nav_locations', icon: MapPin },
  { id: 'evaluation', key: 'nav_evaluation', icon: ClipboardCheck },
];

export function Layout({
  page, setPage, lang, setLang, children,
}: {
  page: PageId;
  setPage: (p: PageId) => void;
  lang: Language;
  setLang: (l: Language) => void;
  children: React.ReactNode;
}) {
  const dir = dirFor(lang);
  return (
    <div dir={dir} className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent page={page} setPage={setPage} lang={lang} />
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            <Globe2 className="h-6 w-6 text-emerald-600" />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-800">{t(lang, 'appName')}</p>
              <p className="hidden text-xs text-slate-400 sm:block">{t(lang, 'tagline')}</p>
            </div>
          </div>
          <LanguageSelector lang={lang} setLang={setLang} />
        </header>

        <main className="px-4 pb-24 pt-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={classNames(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                active ? 'text-emerald-600' : 'text-slate-400',
              )}
            >
              <Icon className="h-5 w-5" />
              {t(lang, item.key)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarContent({ page, setPage, lang }: { page: PageId; setPage: (p: PageId) => void; lang: Language }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Globe2 className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold text-slate-800">{t(lang, 'appName')}</p>
          <p className="text-[10px] text-slate-400">{t(lang, 'tagline')}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={classNames(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {t(lang, item.key)}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400">
        DATA → EVIDENCE → INTELLIGENCE → DECISION
      </div>
    </div>
  );
}

function LanguageSelector({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  const [open, setOpen] = useState(false);
  const current = LANGUAGES.find((l) => l.code === lang);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Globe2 className="h-4 w-4" />
        {current?.nativeLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className={classNames(
                  'flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-slate-50',
                  l.code === lang ? 'font-semibold text-emerald-700' : 'text-slate-600',
                )}
              >
                {l.nativeLabel}
                <span className="text-slate-400">{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
