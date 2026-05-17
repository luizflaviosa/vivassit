'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, Calendar, Search, Sparkles, Database, Activity, RotateCcw } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';

interface Operacao {
  id: string;
  category: 'cron' | 'maintenance' | 'diagnostic';
  label: string;
  description: string;
  path: string;
  query?: Record<string, string>;
  schedule?: string;
  icon: React.ReactNode;
  // 'proxy' = via /api/painel/admin/trigger (Bearer token injetado server-side)
  // 'cookie' = chamada direta com cookies (gate via isAdminEmail no próprio endpoint)
  auth: 'proxy' | 'cookie';
}

const OPERACOES: Operacao[] = [
  // ── Crons (agendados pela Vercel)
  {
    id: 'gsc-snapshot',
    category: 'cron',
    label: 'Snapshot do Search Console',
    description: 'Coleta clicks, impressões, CTR, posição + top queries e top páginas dos últimos 7 dias.',
    path: '/api/interno/gsc-snapshot',
    schedule: 'Segunda 8h BRT',
    icon: <Search className="w-4 h-4" />,
    auth: 'proxy',
  },
  {
    id: 'gbp-insights',
    category: 'cron',
    label: 'Insights do Google Meu Negócio',
    description: 'Refresh de impressões em busca/maps, ligações, rotas e mensagens via GBP API.',
    path: '/api/interno/gbp-insights-refresh',
    schedule: 'Dia 1 de cada mês, 4h UTC',
    icon: <Activity className="w-4 h-4" />,
    auth: 'proxy',
  },
  {
    id: 'region-demand',
    category: 'cron',
    label: 'Demanda regional (DataForSEO)',
    description: 'Volume de buscas por especialidade × cidade pra cada tenant ativo.',
    path: '/api/interno/region-demand-refresh',
    schedule: 'Dia 1 de cada mês, 3h UTC',
    icon: <Database className="w-4 h-4" />,
    auth: 'proxy',
  },
  {
    id: 'market-trends',
    category: 'cron',
    label: 'Tendências de mercado',
    description: 'Trends correlatos (doenças relacionadas à especialidade) por região.',
    path: '/api/interno/market-trends-refresh',
    schedule: 'Dia 1 de cada mês, 3h30 UTC',
    icon: <Sparkles className="w-4 h-4" />,
    auth: 'proxy',
  },
  {
    id: 'competitors',
    category: 'cron',
    label: 'Refresh de competidores',
    description: 'Atualiza dados dos competidores próximos via Google Maps.',
    path: '/api/interno/competitors-refresh',
    schedule: 'Dia 1 de cada mês, 4h30 UTC',
    icon: <RotateCcw className="w-4 h-4" />,
    auth: 'proxy',
  },
  {
    id: 'instagram-token',
    category: 'cron',
    label: 'Renovar tokens Instagram',
    description: 'Estende a vida dos long-lived tokens IG antes de expirar.',
    path: '/api/interno/instagram-token-refresh',
    schedule: 'Dia 1 de cada mês, 5h UTC',
    icon: <RotateCcw className="w-4 h-4" />,
    auth: 'proxy',
  },

  // ── Manutenção (sem cron, sob demanda)
  {
    id: 'calendar-renew-watches',
    category: 'maintenance',
    label: 'Renovar watches do Google Calendar',
    description: 'Watches de Calendar expiram em 7 dias. Renova todos os ativos.',
    path: '/api/admin/google-calendar/renew-watches',
    icon: <Calendar className="w-4 h-4" />,
    auth: 'cookie',
  },
  {
    id: 'calendar-setup-watches',
    category: 'maintenance',
    label: 'Setup inicial de Calendar watches',
    description: 'Configura watch pela primeira vez em calendars sem watch ativo.',
    path: '/api/admin/google-calendar/setup-watches',
    icon: <Calendar className="w-4 h-4" />,
    auth: 'cookie',
  },
  {
    id: 'backfill-calendars',
    category: 'maintenance',
    label: 'Backfill de calendars',
    description: 'Cria Google Calendar pra doctors antigos que não têm calendar_id.',
    path: '/api/admin/backfill-doctor-calendars',
    icon: <Calendar className="w-4 h-4" />,
    auth: 'cookie',
  },

  // ── Diagnósticos (read-only)
  {
    id: 'gsc-sites',
    category: 'diagnostic',
    label: 'Listar propriedades do Search Console',
    description: 'Mostra todas as propriedades GSC que a Service Account tem acesso.',
    path: '/api/interno/gsc-sites',
    icon: <Search className="w-4 h-4" />,
    auth: 'proxy',
  },
];

interface RunResult {
  loading: boolean;
  ok?: boolean;
  status?: number;
  response?: unknown;
  latency_ms?: number;
  ran_at?: string;
}

function Section({ title, items, results, onRun }: {
  title: string;
  items: Operacao[];
  results: Record<string, RunResult>;
  onRun: (op: Operacao) => void;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4 text-zinc-500">
        {title}
      </h2>
      <div className="space-y-3">
        {items.map(op => {
          const result = results[op.id];
          return (
            <div
              key={op.id}
              className="rounded-xl border border-black/[0.07] bg-white p-5"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: ACCENT_DEEP }}>{op.icon}</span>
                    <h3 className="text-[15px] font-semibold text-zinc-900 tracking-tight">
                      {op.label}
                    </h3>
                  </div>
                  <p className="text-[13px] text-zinc-600 leading-relaxed mb-2">
                    {op.description}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                    <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                      {op.path}
                    </code>
                    {op.schedule && <span>cron: {op.schedule}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onRun(op)}
                  disabled={result?.loading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-[13px] font-medium text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                    boxShadow: '0 4px 12px -4px rgba(110,86,207,0.6)',
                  }}
                >
                  {result?.loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {result?.loading ? 'Rodando…' : 'Rodar agora'}
                </button>
              </div>

              {result && !result.loading && (
                <div
                  className={`mt-4 rounded-lg border p-3 text-[12px] ${
                    result.ok
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-rose-200 bg-rose-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {result.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span className={`font-semibold ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                        HTTP {result.status} · {result.latency_ms}ms
                      </span>
                    </div>
                    <span className="text-zinc-500 text-[11px]">{result.ran_at}</span>
                  </div>
                  <pre className="font-mono text-[11px] leading-relaxed text-zinc-700 overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {JSON.stringify(result.response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OperacoesClient() {
  const [results, setResults] = useState<Record<string, RunResult>>({});

  async function runOperation(op: Operacao) {
    setResults(prev => ({ ...prev, [op.id]: { loading: true } }));
    const t0 = Date.now();
    try {
      let res: Response;
      if (op.auth === 'proxy') {
        // Proxy injeta Bearer token server-side
        res = await fetch('/api/painel/admin/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: op.path, query: op.query }),
        });
        const data = await res.json();
        setResults(prev => ({
          ...prev,
          [op.id]: {
            loading: false,
            ok: data.ok,
            status: data.status,
            response: data.response,
            latency_ms: data.latency_ms,
            ran_at: new Date().toLocaleTimeString('pt-BR'),
          },
        }));
      } else {
        // Cookie: chamada direta, cookies de sessão vão automaticamente
        res = await fetch(op.path, { method: 'GET', cache: 'no-store' });
        const text = await res.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { /* raw */ }
        setResults(prev => ({
          ...prev,
          [op.id]: {
            loading: false,
            ok: res.ok,
            status: res.status,
            response: parsed,
            latency_ms: Date.now() - t0,
            ran_at: new Date().toLocaleTimeString('pt-BR'),
          },
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults(prev => ({
        ...prev,
        [op.id]: {
          loading: false,
          ok: false,
          status: 0,
          response: { error: msg },
          latency_ms: Date.now() - t0,
          ran_at: new Date().toLocaleTimeString('pt-BR'),
        },
      }));
    }
  }

  const crons = OPERACOES.filter(o => o.category === 'cron');
  const maintenance = OPERACOES.filter(o => o.category === 'maintenance');
  const diagnostics = OPERACOES.filter(o => o.category === 'diagnostic');

  return (
    <div className="min-h-screen px-6 sm:px-10 py-10">
      <div className="max-w-[920px] mx-auto">
        <header className="mb-10">
          <p
            className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3"
            style={{ color: ACCENT_DEEP }}
          >
            Plataforma · Operações
          </p>
          <h1 className="text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-3">
            Operações da plataforma
          </h1>
          <p className="text-[14px] text-zinc-600 leading-relaxed max-w-[620px]">
            Dispare manualmente os endpoints internos da Singulare — crons agendados,
            manutenção sob demanda e diagnósticos. Cada operação retorna o JSON bruto pra
            inspeção. Acesso restrito a admins de plataforma.
          </p>
        </header>

        <Section title="Crons agendados" items={crons} results={results} onRun={runOperation} />
        <Section title="Manutenção" items={maintenance} results={results} onRun={runOperation} />
        <Section title="Diagnósticos (read-only)" items={diagnostics} results={results} onRun={runOperation} />
      </div>
    </div>
  );
}
