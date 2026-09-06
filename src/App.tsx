import { useEffect, useState } from 'react';
import { Layout, type PageId } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { AskAgentPage } from '@/pages/AskAgentPage';
import { MarketDataPage } from '@/pages/MarketDataPage';
import { ResearchPage } from '@/pages/ResearchPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { LocationsPage } from '@/pages/LocationsPage';
import { CommodityEvaluationPage } from '@/pages/CommodityEvaluationPage';
import { ImportCostPage } from '@/pages/ImportCostPage';
import { ShipmentsPage } from '@/pages/ShipmentsPage';
import { StockPage } from '@/pages/StockPage';
import { type Language } from '@/lib/i18n';
import { dirFor } from '@/lib/i18n';

export default function App() {
  const [page, setPage] = useState<PageId>('ask');
  const [lang, setLang] = useState<Language>('en');

  // Persist language preference locally
  useEffect(() => {
    const saved = localStorage.getItem('gmio-lang') as Language | null;
    if (saved && ['en', 'fa', 'ps'].includes(saved)) setLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('gmio-lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  return (
    <Layout page={page} setPage={setPage} lang={lang} setLang={setLang}>
      {page === 'dashboard' && <DashboardPage lang={lang} goTo={(p) => setPage(p as PageId)} />}
      {page === 'ask' && <AskAgentPage lang={lang} />}
      {page === 'market_data' && <MarketDataPage lang={lang} />}
      {page === 'import_cost' && <ImportCostPage lang={lang} />}
      {page === 'shipments' && <ShipmentsPage lang={lang} />}
      {page === 'stock' && <StockPage lang={lang} />}
      {page === 'research' && <ResearchPage lang={lang} />}
      {page === 'reports' && <ReportsPage lang={lang} />}
      {page === 'locations' && <LocationsPage lang={lang} />}
      {page === 'evaluation' && <CommodityEvaluationPage lang={lang} />}
    </Layout>
  );
}
