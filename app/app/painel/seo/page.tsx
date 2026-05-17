import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Snapshot {
  id: string;
  snapshot_at: string;
  range_start: string;
  range_end: string;
  summary: {
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  };
  top_queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  top_pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  raw_meta: { error?: string; latency_ms?: number; site_url?: string };
}

async function fetchSnapshots(): Promise<Snapshot[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('seo_snapshots')
    .select('*')
    .order('snapshot_at', { ascending: false })
    .limit(12);
  return (data ?? []) as Snapshot[];
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  if (n >= 1000) return n.toLocaleString('pt-BR');
  return String(Math.round(n));
}

function fmtPos(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return n.toFixed(1);
}

function deltaIcon(current: number, previous: number, inverse = false) {
  const delta = current - previous;
  const significant = Math.abs(delta) / (Math.abs(previous) || 1) > 0.02;
  if (!significant) return <Minus className="w-3 h-3 text-zinc-400" strokeWidth={2} />;
  // inverse: pra position (menor é melhor), inverte a cor
  const positive = inverse ? delta < 0 : delta > 0;
  return positive ? (
    <TrendingUp className="w-3 h-3 text-emerald-600" strokeWidth={2.5} />
  ) : (
    <TrendingDown className="w-3 h-3 text-rose-600" strokeWidth={2.5} />
  );
}

function StatCard({
  label,
  value,
  prev,
  inverse = false,
  hint,
}: {
  label: string;
  value: string;
  prev?: { value: number; current: number; inverse?: boolean };
  inverse?: boolean;
  hint?: string;
}) {
  return (
    <div
      className="rounded-xl border border-black/[0.07] bg-white p-5"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium">
          {label}
        </p>
        {prev && deltaIcon(prev.current, prev.value, inverse)}
      </div>
      <p
        className="text-[28px] sm:text-[32px] font-medium tracking-[-0.02em] tabular-nums text-zinc-900"
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.12] bg-white p-12 text-center">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3 text-zinc-400">
        Sem dados ainda
      </p>
      <h2 className="text-[20px] font-semibold text-zinc-900 mb-3">
        O primeiro snapshot ainda não rodou
      </h2>
      <p className="text-[14px] text-zinc-600 leading-relaxed max-w-[480px] mx-auto mb-6">
        O coletor automático roda toda segunda às 8h da manhã (BRT). Pra rodar agora manualmente,
        chama o endpoint <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px]">/api/interno/gsc-snapshot</code>
        com Bearer do <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px]">CRON_SECRET</code>.
      </p>
      <p className="text-[12px] text-zinc-400">
        Requer: env <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> configurada + SA com permissão Restricted na
        propriedade <code>singulare.org</code> do Search Console + API Search Console ativada no Google Cloud.
      </p>
    </div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 mb-6">
      <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-rose-700 mb-1">
        Último snapshot falhou
      </p>
      <p className="text-[13px] text-rose-900 font-mono">{error}</p>
    </div>
  );
}

export default async function SeoPage() {
  const snapshots = await fetchSnapshots();
  const current = snapshots[0];
  const previous = snapshots[1];

  if (!current) {
    return (
      <div className="min-h-screen px-6 sm:px-10 py-10">
        <Suspense fallback={null}>
          <div className="max-w-[1100px] mx-auto">
            <Header />
            <EmptyState />
          </div>
        </Suspense>
      </div>
    );
  }

  const error = current.raw_meta?.error;
  const hasData = !error && (current.summary?.impressions ?? 0) > 0;

  return (
    <div className="min-h-screen px-6 sm:px-10 py-10">
      <div className="max-w-[1100px] mx-auto">
        <Header lastUpdate={current.snapshot_at} range={current} />

        {error && <ErrorBanner error={error} />}

        {hasData && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
              <StatCard
                label="Cliques"
                value={fmtNum(current.summary.clicks)}
                prev={previous ? {
                  value: previous.summary.clicks ?? 0,
                  current: current.summary.clicks ?? 0,
                } : undefined}
                hint="usuários que clicaram em uma URL sua na busca"
              />
              <StatCard
                label="Impressões"
                value={fmtNum(current.summary.impressions)}
                prev={previous ? {
                  value: previous.summary.impressions ?? 0,
                  current: current.summary.impressions ?? 0,
                } : undefined}
                hint="quantas vezes seu site apareceu na busca"
              />
              <StatCard
                label="CTR"
                value={fmtPct(current.summary.ctr)}
                prev={previous ? {
                  value: previous.summary.ctr ?? 0,
                  current: current.summary.ctr ?? 0,
                } : undefined}
                hint="taxa de cliques sobre impressões"
              />
              <StatCard
                label="Posição média"
                value={fmtPos(current.summary.position)}
                inverse
                prev={previous ? {
                  value: previous.summary.position ?? 0,
                  current: current.summary.position ?? 0,
                  inverse: true,
                } : undefined}
                hint="menor = melhor"
              />
            </div>

            {/* Top queries */}
            <section className="mb-10">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4 text-zinc-500">
                Top queries (últimos 7 dias)
              </h2>
              <div
                className="rounded-xl border border-black/[0.07] bg-white overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
              >
                <table className="w-full text-[13px]">
                  <thead className="bg-zinc-50/60 border-b border-black/[0.05]">
                    <tr className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      <th className="text-left px-4 py-3 font-medium">Query</th>
                      <th className="text-right px-3 py-3 font-medium w-[80px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-medium w-[100px]">Impressões</th>
                      <th className="text-right px-3 py-3 font-medium w-[80px]">CTR</th>
                      <th className="text-right px-4 py-3 font-medium w-[80px]">Pos.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {current.top_queries.slice(0, 20).map((q, i) => (
                      <tr key={i} className="hover:bg-zinc-50/40">
                        <td className="px-4 py-2.5 text-zinc-900">{q.query || '(query sem texto)'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-900">{fmtNum(q.clicks)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{fmtNum(q.impressions)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{fmtPct(q.ctr)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{fmtPos(q.position)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top pages */}
            <section className="mb-10">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4 text-zinc-500">
                Top páginas (últimos 7 dias)
              </h2>
              <div
                className="rounded-xl border border-black/[0.07] bg-white overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
              >
                <table className="w-full text-[13px]">
                  <thead className="bg-zinc-50/60 border-b border-black/[0.05]">
                    <tr className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                      <th className="text-left px-4 py-3 font-medium">Página</th>
                      <th className="text-right px-3 py-3 font-medium w-[80px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-medium w-[100px]">Impressões</th>
                      <th className="text-right px-3 py-3 font-medium w-[80px]">CTR</th>
                      <th className="text-right px-4 py-3 font-medium w-[80px]">Pos.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {current.top_pages.slice(0, 20).map((p, i) => {
                      const path = p.page.replace(/^https?:\/\/singulare\.org/, '') || '/';
                      return (
                        <tr key={i} className="hover:bg-zinc-50/40">
                          <td className="px-4 py-2.5">
                            <a
                              href={p.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-900 hover:underline inline-flex items-center gap-1"
                            >
                              {path}
                              <ExternalLink className="w-3 h-3 text-zinc-400" />
                            </a>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-zinc-900">{fmtNum(p.clicks)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{fmtNum(p.impressions)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-zinc-600">{fmtPct(p.ctr)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-600">{fmtPos(p.position)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Snapshots history */}
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-4 text-zinc-500">
            Histórico de snapshots
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshots.map(s => (
              <div
                key={s.id}
                className="rounded-xl border border-black/[0.07] bg-white p-4"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
              >
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400 font-medium mb-1">
                  {new Date(s.snapshot_at).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-[12px] text-zinc-500 mb-2">
                  {s.range_start} – {s.range_end}
                </p>
                {s.raw_meta?.error ? (
                  <p className="text-[12px] text-rose-600">erro: {s.raw_meta.error.slice(0, 50)}…</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-zinc-400">Cliques: </span>
                      <span className="font-medium tabular-nums text-zinc-900">{fmtNum(s.summary.clicks)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Impr.: </span>
                      <span className="font-medium tabular-nums text-zinc-900">{fmtNum(s.summary.impressions)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({
  lastUpdate,
  range,
}: {
  lastUpdate?: string;
  range?: { range_start: string; range_end: string };
}) {
  return (
    <header className="mb-10">
      <p
        className="text-[11px] uppercase tracking-[0.14em] font-semibold mb-3"
        style={{ color: ACCENT_DEEP }}
      >
        Crescimento · SEO
      </p>
      <h1 className="text-[32px] sm:text-[40px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900 mb-3">
        Search Console
      </h1>
      <div className="flex items-center gap-4 text-[12px] text-zinc-500 flex-wrap">
        {lastUpdate && (
          <span>
            Último snapshot: <span className="text-zinc-900 font-medium">{new Date(lastUpdate).toLocaleString('pt-BR')}</span>
          </span>
        )}
        {range && (
          <span>
            Período: <span className="text-zinc-900 font-medium">{range.range_start} – {range.range_end}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" />
          atualiza toda segunda 8h BRT
        </span>
      </div>
    </header>
  );
}
