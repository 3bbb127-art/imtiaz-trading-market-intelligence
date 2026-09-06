// Ask Agent — the autonomous AI interface. User types a natural-language
// command; the Agent executes the full workflow and delivers intelligence.

import { useState, useRef, useCallback } from 'react';
import { Send, Loader2, Sparkles, AlertTriangle, FileDown, ClipboardCheck } from 'lucide-react';
import { Button, Card, Textarea, Badge, EmptyState, StatCard } from '@/components/ui';
import { runAgent, type RunOptions } from '@/agent/executor';
import type { AgentResult, WorkflowStep } from '@/lib/types';
import { FindingsView } from '@/components/FindingsView';
import { type Language, t } from '@/lib/i18n';
import {
  recommendationColor, sentimentColor, supplyDemandColor, confidenceColor, classNames,
} from '@/lib/format';

const EXAMPLES = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'];

export function AskAgentPage({ lang }: { lang: Language }) {
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onStep = useCallback((s: WorkflowStep) => {
    setSteps((prev) => {
      const idx = prev.findIndex((p) => p.step === s.step);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = s;
        return next;
      }
      return [...prev, s];
    });
  }, []);

  const run = async () => {
    if (!command.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setSteps([]);
    const ac = new AbortController();
    abortRef.current = ac;
    const opts: RunOptions = { onStep, signal: ac.signal };
    try {
      const res = await runAgent(command.trim(), opts);
      setResult(res);
    } catch (err) {
      setError((err as Error).message || t(lang, 'error_generic'));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([result.reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-intelligence-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-800">{t(lang, 'nav_ask')}</h1>
        </div>
        <p className="mb-4 text-sm text-slate-500">{t(lang, 'landing_intro')}</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t(lang, 'ask_placeholder')}
              rows={3}
              disabled={running}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run();
              }}
            />
          </div>
          <Button onClick={run} disabled={running || !command.trim()} size="lg" className="sm:h-auto">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {running ? t(lang, 'ask_running') : t(lang, 'ask_send')}
          </Button>
        </div>

        {/* Examples */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-400">{t(lang, 'examples')}</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setCommand(t(lang, ex))}
                disabled={running}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {t(lang, ex)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Workflow progress */}
      {(running || steps.length > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(lang, 'workflow')}</h2>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <StepIcon status={s.status} />
                <div className="flex-1">
                  <p className={classNames('font-medium', s.status === 'done' ? 'text-slate-700' : s.status === 'running' ? 'text-emerald-700' : s.status === 'error' ? 'text-rose-700' : 'text-slate-400')}>
                    {s.step}
                  </p>
                  {s.detail && <p className="text-xs text-slate-400">{s.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {error && (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={recommendationColor(result.findings.recommendation)}>
                  {result.findings.recommendation}
                </Badge>
                <Badge className={sentimentColor(result.findings.sentiment)}>
                  {result.findings.sentiment}
                </Badge>
                <Badge className={supplyDemandColor(result.findings.supply)}>
                  {t(lang, 'supply')}: {result.findings.supply}
                </Badge>
                <Badge className={supplyDemandColor(result.findings.demand)}>
                  {t(lang, 'demand')}: {result.findings.demand}
                </Badge>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadReport}>
                <FileDown className="h-4 w-4" /> Markdown
              </Button>
            </div>
          </Card>

          <FindingsView findings={result.findings} intent={result.intent} lang={lang} />

          {result.evaluation && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-700">{t(lang, 'evaluation_section')}</h2>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <StatCard label={t(lang, 'opportunity_score')} value={`${result.evaluation.opportunity_score}/100`} accent={result.evaluation.opportunity_score >= 60 ? 'text-emerald-700' : result.evaluation.opportunity_score >= 35 ? 'text-amber-700' : 'text-rose-700'} />
                <StatCard label={t(lang, 'recommendation')} value={<Badge className={recommendationColor(result.evaluation.recommendation)}>{result.evaluation.recommendation}</Badge>} />
                <StatCard label={t(lang, 'confidence')} value={<Badge className={confidenceColor(result.evaluation.confidence_level)}>{result.evaluation.confidence_level}</Badge>} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AssessmentItem label={t(lang, 'demand_assessment')} value={result.evaluation.demand_assessment} />
                <AssessmentItem label={t(lang, 'supply_assessment')} value={result.evaluation.supply_assessment} />
                <AssessmentItem label={t(lang, 'competition_assessment')} value={result.evaluation.competition_assessment} />
                <AssessmentItem label={t(lang, 'price_attractiveness')} value={result.evaluation.price_attractiveness} />
                <AssessmentItem label={t(lang, 'logistics_feasibility')} value={result.evaluation.logistics_feasibility} />
                <AssessmentItem label={t(lang, 'market_sentiment')} value={result.evaluation.market_sentiment} />
                <AssessmentItem label={t(lang, 'risk_assessment')} value={result.evaluation.risk_assessment} />
              </div>
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(lang, 'key_reasons')}</h3>
                <ul className="space-y-1">
                  {result.evaluation.key_reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              {result.evaluation.data_gaps.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t(lang, 'data_gaps_warnings')}
                  </h3>
                  <ul className="space-y-1">
                    {result.evaluation.data_gaps.map((g, i) => <li key={i} className="text-xs text-amber-700">• {g}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t(lang, 'findings')} — Report</h2>
            <div className="max-h-[600px] overflow-auto rounded-lg bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{result.reportMarkdown}</pre>
            </div>
          </Card>
        </div>
      )}

      {!result && !running && steps.length === 0 && !error && (
        <EmptyState title={t(lang, 'nav_ask')} subtitle={t(lang, 'landing_intro')} />
      )}
    </div>
  );
}

function StepIcon({ status }: { status: WorkflowStep['status'] }) {
  if (status === 'running') return <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin text-emerald-600" />;
  if (status === 'done') return <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z" /></svg></span>;
  if (status === 'error') return <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />;
  if (status === 'skipped') return <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor"><path d="M5 10a5 5 0 1110 0 5 5 0 01-10 0z" /></svg></span>;
  return <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-slate-300" />;
}

function AssessmentItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-700">{value}</p>
    </div>
  );
}
