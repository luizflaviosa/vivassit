'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Activity,
  XCircle,
  Users,
  DollarSign,
  Star,
  MapPin,
  Compass,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CalendarRange,
  LineChart,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface FinancialScenario {
  ok: boolean;
  capacity: { slots_per_week: number; monthly: number; doctors_count: number };
  ticket: {
    value: number | null;
    source: 'realized' | 'configured' | 'unknown';
    realized_payment_count: number;
    realized_revenue_6m: number;
  };
  volume: {
    bookings_30d: number;
    bookings_90d: number;
    monthly_avg: number;
    utilization_pct: number | null;
  };
  annual: { tam: number | null; realized: number | null; gap: number | null };
  retention: {
    total_patients: number;
    recurrent_patients: number;
    retention_pct: number | null;
    at_risk: number;
  };
  recommendations: Array<{ priority: 'high' | 'medium' | 'low'; title: string; body: string }>;
  collected_at: string;
}

interface PerformanceData {
  generated_at: string;
  scope: { is_doctor: boolean; doctors: Array<{ id: string; name: string }> };
  indicators: {
    utilization: { booked: number; capacity: number; pct: number; target_pct: number };
    cancellation: {
      rate_pct: number;
      trend_4w: Array<{ week_start: string; rate: number }>;
      target_pct: number;
    };
    patients: {
      total: number;
      new_this_month: number;
      returning_this_month: number;
    };
    revenue: {
      last_30d_brl: number;
      by_method: Record<string, number>;
      avg_consult_value_brl: number;
    };
    nps: {
      sent_30d: number;
      answered_30d: number;
      avg_score: number | null;
      promoters: number;
      detractors: number;
      response_rate_pct: number;
    };
    google_reviews: {
      configured: boolean;
      place_id: string | null;
    };
    patient_source: {
      breakdown: Array<{ source: string; count: number }>;
      total_30d: number;
    };
  };
}

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function statusFromTarget(value: number, target: number, kind: 'higher_better' | 'lower_better') {
  const ratio = value / target;
  if (kind === 'higher_better') {
    if (ratio >= 0.95) return 'green';
    if (ratio >= 0.7) return 'amber';
    return 'red';
  }
  if (value <= target) return 'green';
  if (value <= target * 1.5) return 'amber';
  return 'red';
}

const STATUS_COLORS = {
  green: { fg: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  amber: { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  red: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
} as const;

function CardShell({ title, icon, children, footer }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
        >
          {icon}
        </div>
        <h3 className="text-[13px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
          {title}
        </h3>
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-4 pt-3 border-t border-black/[0.05] text-[12px] text-zinc-500">{footer}</div>}
    </div>
  );
}

interface PerformanceViewProps {
  initialData: PerformanceData | null;
  initialFinancial: FinancialScenario | null;
  initialError: string | null;
}

function PerformanceInner({ initialData, initialFinancial, initialError }: PerformanceViewProps) {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  // First paint instantaneo: state inicia com dados ja fetchados pelo Server Component.
  const [data, setData] = useState<PerformanceData | null>(initialData);
  const [financial, setFinancial] = useState<FinancialScenario | null>(initialFinancial);
  // Fallback de refetch so se Server falhou em entregar dados.
  const [loading, setLoading] = useState<boolean>(!initialData && !initialError);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    // Pula refetch se Server ja entregou dados — economiza round-trip + render.
    if (initialData || initialError) return;
    if (!tenantId) return;
    Promise.all([
      fetch('/api/painel/performance', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch('/api/painel/performance/financial-scenario', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ])
      .then(([perf, fin]) => {
        if (perf?.success) setData(perf as PerformanceData);
        else setError(perf?.message ?? 'Erro ao carregar');
        if (fin?.ok) setFinancial(fin as FinancialScenario);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  if (!tenantId && !initialData) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        <span className="ml-3 text-[14px] text-zinc-500">Carregando performance…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-[14px] text-amber-900">{error ?? 'Dados não disponíveis ainda.'}</div>
      </div>
    );
  }

  const i = data.indicators;
  const utilStatus = STATUS_COLORS[statusFromTarget(i.utilization.pct, i.utilization.target_pct, 'higher_better')];
  const cancelStatus = STATUS_COLORS[statusFromTarget(i.cancellation.rate_pct, i.cancellation.target_pct, 'lower_better')];

  // Tendência cancelamento: compara 1ª e última semana do trend
  const trendDelta =
    i.cancellation.trend_4w.length >= 2
      ? i.cancellation.trend_4w[i.cancellation.trend_4w.length - 1].rate - i.cancellation.trend_4w[0].rate
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <p
          className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2"
          style={{ color: ACCENT_DEEP }}
        >
          Performance
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Saúde da clínica
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5 max-w-xl">
          Visão consolidada dos sinais que importam: ocupação, cancelamentos, retenção, receita,
          satisfação e canais. Atualizado em{' '}
          {new Date(data.generated_at).toLocaleString('pt-BR')}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. UTILIZAÇÃO SEMANAL */}
        <CardShell
          title="Utilização semanal"
          icon={<Activity className="w-4 h-4" />}
          footer={
            <div className="flex items-center justify-between">
              <span>Meta: ≥{i.utilization.target_pct}%</span>
              <span style={{ color: utilStatus.fg }} className="font-semibold">
                {i.utilization.pct >= i.utilization.target_pct ? 'No alvo' : 'Abaixo do alvo'}
              </span>
            </div>
          }
        >
          <div className="flex items-end gap-2">
            <span className="text-[44px] leading-none font-medium tracking-[-0.03em]" style={{ color: utilStatus.fg }}>
              {i.utilization.pct.toFixed(0)}%
            </span>
            <span className="text-[14px] text-zinc-500 mb-2">
              {i.utilization.booked} de {i.utilization.capacity} slots
            </span>
          </div>
          <div className="mt-4 h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, i.utilization.pct)}%`, background: utilStatus.fg }}
            />
          </div>
        </CardShell>

        {/* 2. CANCELAMENTOS 30D */}
        <CardShell
          title="Cancelamentos 30 dias"
          icon={<XCircle className="w-4 h-4" />}
          footer={
            <div className="flex items-center justify-between">
              <span>Meta: ≤{i.cancellation.target_pct}%</span>
              <span className="inline-flex items-center gap-1" style={{ color: cancelStatus.fg }}>
                {trendDelta < -1 ? <TrendingDown className="w-3.5 h-3.5" /> : trendDelta > 1 ? <TrendingUp className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                {trendDelta > 0 ? '+' : ''}
                {trendDelta.toFixed(1)}pp vs 4 sem
              </span>
            </div>
          }
        >
          <div className="flex items-end gap-2">
            <span className="text-[44px] leading-none font-medium tracking-[-0.03em]" style={{ color: cancelStatus.fg }}>
              {i.cancellation.rate_pct.toFixed(0)}%
            </span>
          </div>
          {/* Sparkline simples 4 semanas */}
          <div className="mt-4 flex items-end gap-1 h-10">
            {i.cancellation.trend_4w.map((wk, idx) => {
              const max = Math.max(1, ...i.cancellation.trend_4w.map((w) => w.rate));
              const h = (wk.rate / max) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(4, h)}%`, background: cancelStatus.fg, opacity: 0.3 + (idx / 4) * 0.7 }}
                  title={`Sem ${wk.week_start}: ${wk.rate.toFixed(1)}%`}
                />
              );
            })}
          </div>
        </CardShell>

        {/* 3. PACIENTES */}
        <CardShell
          title="Pacientes"
          icon={<Users className="w-4 h-4" />}
          footer={
            <div>
              Base total: <span className="font-semibold text-zinc-700">{i.patients.total}</span>
            </div>
          }
        >
          <div className="flex items-end gap-2 mb-4">
            <span className="text-[44px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
              {i.patients.new_this_month + i.patients.returning_this_month}
            </span>
            <span className="text-[14px] text-zinc-500 mb-2">este mês</span>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">Novos</span>
              <span className="font-semibold text-zinc-900">{i.patients.new_this_month}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Retornos</span>
              <span className="font-semibold text-zinc-900">{i.patients.returning_this_month}</span>
            </div>
          </div>
        </CardShell>

        {/* 4. RECEITA */}
        <CardShell
          title="Receita rastreada 30d"
          icon={<DollarSign className="w-4 h-4" />}
          footer={
            i.revenue.avg_consult_value_brl > 0 ? (
              <div>
                Ticket médio: <span className="font-semibold text-zinc-700">{brl(i.revenue.avg_consult_value_brl)}</span>
              </div>
            ) : null
          }
        >
          <div className="flex items-end gap-2 mb-4">
            <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
              {brl(i.revenue.last_30d_brl)}
            </span>
          </div>
          {Object.keys(i.revenue.by_method).length === 0 ? (
            <p className="text-[12px] text-zinc-500 leading-snug">
              Nenhum pagamento rastreado. Ative o Asaas em <span className="text-violet-700">Pagamentos → Ativar</span> pra começar a registrar receita automaticamente.
            </p>
          ) : (
            <div className="space-y-2 text-[13px]">
              {Object.entries(i.revenue.by_method).map(([method, value]) => (
                <div key={method} className="flex justify-between">
                  <span className="text-zinc-500 capitalize">{method.replace(/_/g, ' ')}</span>
                  <span className="font-semibold text-zinc-900">{brl(value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardShell>

        {/* 5. NPS */}
        <CardShell
          title="NPS 30 dias"
          icon={<Star className="w-4 h-4" />}
          footer={
            <div className="flex items-center justify-between">
              <span>Resp. {i.nps.response_rate_pct.toFixed(0)}%</span>
              <span>
                <span className="text-emerald-700 font-semibold">{i.nps.promoters}P</span>
                {' · '}
                <span className="text-red-700 font-semibold">{i.nps.detractors}D</span>
              </span>
            </div>
          }
        >
          {i.nps.answered_30d === 0 ? (
            <div>
              <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-300">—</span>
              <p className="text-[12px] text-zinc-500 mt-3 leading-snug">
                {i.nps.sent_30d === 0
                  ? 'Nenhum NPS enviado. Configure o disparo automático em Configurações.'
                  : `${i.nps.sent_30d} enviados sem resposta ainda.`}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <span className="text-[44px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
                  {i.nps.avg_score?.toFixed(1)}
                </span>
                <span className="text-[14px] text-zinc-500 mb-2">de 10</span>
              </div>
              <p className="text-[12px] text-zinc-500 mt-3">
                {i.nps.answered_30d} respondentes de {i.nps.sent_30d} enviados
              </p>
            </>
          )}
        </CardShell>

        {/* 6. REVIEWS GOOGLE */}
        <CardShell
          title="Reviews Google"
          icon={<MapPin className="w-4 h-4" />}
          footer={
            i.google_reviews.configured ? (
              <span className="text-zinc-500">Última sincronização em breve.</span>
            ) : (
              <a href="/painel/configuracoes" className="text-violet-700 font-semibold hover:underline">
                Vincular Google Place ID →
              </a>
            )
          }
        >
          {i.google_reviews.configured ? (
            <>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-300">—</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-snug">
                Integração com Google My Business sincronizando dados. Aparece aqui em breve.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-300">—</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-snug">
                Google Place ID não vinculado. Cadastre nas <span className="text-violet-700">Configurações</span> pra ver reviews aqui.
              </p>
            </>
          )}
        </CardShell>

        {/* 7. ORIGEM DO PACIENTE */}
        <CardShell
          title="Origem do paciente 30d"
          icon={<Compass className="w-4 h-4" />}
          footer={
            <span>Total agendamentos rastreados: <span className="font-semibold text-zinc-700">{i.patient_source.total_30d}</span></span>
          }
        >
          {i.patient_source.breakdown.length === 0 ? (
            <p className="text-[12px] text-zinc-500 leading-snug">
              Sem agendamentos rastreados nos últimos 30 dias.
            </p>
          ) : (
            <div className="space-y-2.5">
              {i.patient_source.breakdown.map((s) => {
                const pct = (s.count / i.patient_source.total_30d) * 100;
                return (
                  <div key={s.source}>
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="text-zinc-700 capitalize">{s.source.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-zinc-900">{s.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: ACCENT }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>

        {/* 8. CAPACIDADE MENSAL (financial-scenario) */}
        {financial && (
          <CardShell
            title="Capacidade mensal"
            icon={<CalendarRange className="w-4 h-4" />}
            footer={
              financial.capacity.doctors_count > 0 ? (
                <span>
                  {financial.capacity.doctors_count} profissional{financial.capacity.doctors_count > 1 ? 'is' : ''} · {financial.capacity.slots_per_week} slots/semana
                </span>
              ) : (
                <span className="text-zinc-400">Configure horários em /painel/configuracoes</span>
              )
            }
          >
            <div className="flex items-end gap-2 mb-4">
              <span className="text-[44px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
                {financial.capacity.monthly}
              </span>
              <span className="text-[14px] text-zinc-500 mb-2">slots/mês</span>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Volume médio/mês</span>
                <span className="font-semibold text-zinc-900">{financial.volume.monthly_avg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Utilização</span>
                <span className="font-semibold text-zinc-900">
                  {financial.volume.utilization_pct != null ? `${Math.round(financial.volume.utilization_pct)}%` : '—'}
                </span>
              </div>
            </div>
          </CardShell>
        )}

        {/* 9. CENÁRIO ANUAL (TAM + crescimento projetado) */}
        {financial && financial.annual.tam != null && (
          <CardShell
            title="Cenário anual"
            icon={<LineChart className="w-4 h-4" />}
            footer={
              financial.annual.gap != null && financial.annual.gap > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Crescimento projetado</span>
                  <span className="font-semibold" style={{ color: ACCENT_DEEP }}>
                    {brl(financial.annual.gap)}
                  </span>
                </div>
              ) : financial.ticket.source === 'unknown' ? (
                <a href="/painel/configuracoes" className="text-violet-700 font-semibold hover:underline">
                  Configurar ticket médio →
                </a>
              ) : null
            }
          >
            <div className="flex items-end gap-2 mb-1">
              <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
                {brl(financial.annual.tam)}
              </span>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4">
              Receita potencial a 100% da capacidade
              {financial.ticket.value != null && (
                <> · ticket {brl(financial.ticket.value)}</>
              )}
            </p>
            {financial.annual.realized != null && (
              <>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-zinc-500">Realizado projetado</span>
                  <span className="font-semibold text-zinc-700">{brl(financial.annual.realized)}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (financial.annual.realized / financial.annual.tam) * 100)}%`,
                      background: ACCENT,
                    }}
                  />
                </div>
              </>
            )}
          </CardShell>
        )}

        {/* 10. RETENÇÃO */}
        {financial && (
          <CardShell
            title="Retenção"
            icon={<RotateCcw className="w-4 h-4" />}
            footer={
              financial.retention.at_risk > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Em risco (90+ dias)</span>
                  <span className="font-semibold" style={{ color: STATUS_COLORS.amber.fg }}>
                    {financial.retention.at_risk}
                  </span>
                </div>
              ) : (
                <span className="text-zinc-400">Sem pacientes em risco</span>
              )
            }
          >
            {financial.retention.total_patients === 0 ? (
              <div>
                <span className="text-[36px] leading-none font-medium tracking-[-0.03em] text-zinc-300">—</span>
                <p className="text-[12px] text-zinc-500 mt-3">Sem pacientes registrados ainda.</p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-[44px] leading-none font-medium tracking-[-0.03em] text-zinc-900">
                    {financial.retention.retention_pct != null ? `${Math.round(financial.retention.retention_pct)}%` : '—'}
                  </span>
                  <span className="text-[14px] text-zinc-500 mb-2">com 2+ visitas</span>
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Pacientes ativos</span>
                    <span className="font-semibold text-zinc-900">{financial.retention.total_patients}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Recorrentes</span>
                    <span className="font-semibold text-zinc-900">{financial.retention.recurrent_patients}</span>
                  </div>
                </div>
              </>
            )}
          </CardShell>
        )}
      </div>

      {/* Painel "Onde focar" — recomendações financeiras */}
      {financial && financial.recommendations.length > 0 && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-[13px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
              Onde focar
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {financial.recommendations.map((rec, idx) => {
              const tone = rec.priority === 'high'
                ? STATUS_COLORS.amber
                : rec.priority === 'medium'
                ? { fg: ACCENT_DEEP, bg: ACCENT_SOFT, border: 'rgba(110,86,207,0.25)' }
                : STATUS_COLORS.green;
              return (
                <div
                  key={idx}
                  className="rounded-xl p-4"
                  style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
                >
                  <p
                    className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1.5"
                    style={{ color: tone.fg }}
                  >
                    {rec.priority === 'high' ? 'Alta prioridade' : rec.priority === 'medium' ? 'Atenção' : 'Otimização'}
                  </p>
                  <p className="text-[14px] font-semibold text-zinc-900 mb-1 leading-tight">
                    {rec.title}
                  </p>
                  <p className="text-[12px] text-zinc-600 leading-relaxed">
                    {rec.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.scope.is_doctor && (
        <p className="text-[12px] text-zinc-400 italic">
          Indicadores filtrados pra você ({data.scope.doctors[0]?.name}).
        </p>
      )}
    </div>
  );
}

export default function PerformanceView(props: PerformanceViewProps) {
  return <PerformanceInner {...props} />;
}
