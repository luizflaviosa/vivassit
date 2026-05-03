'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Star,
  Users,
  Eye,
  MessageCircle,
  ArrowUpRight,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { MARKETING_PLANS, MARKETING_PLAN_AMOUNTS, type MarketingPlanKey } from '@/lib/marketing-types';
import type { MarketingSubscription, MarketingMetrics } from '@/lib/marketing-types';

const ACCENT_DEEP = '#5746AF';

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-2">
      <div className="flex items-center gap-2 text-zinc-400">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold">{label}</span>
      </div>
      <p className="text-[28px] font-semibold tracking-[-0.02em] text-zinc-900">{value}</p>
      {sub && <p className="text-[12px] text-zinc-500">{sub}</p>}
    </div>
  );
}

function MarketingInner() {
  const me = useMe();
  const [sub, setSub] = useState<MarketingSubscription | null>(null);
  const [metrics, setMetrics] = useState<MarketingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!me?.tenant_id) return;
    Promise.all([
      fetch('/api/painel/marketing/subscription').then((r) => r.json()),
      fetch('/api/painel/marketing/events?days=30').then((r) => r.json()),
    ]).then(([sRes, mRes]) => {
      if (sRes.success) setSub(sRes.subscription);
      if (mRes.success) setMetrics(mRes.metrics);
    }).finally(() => setLoading(false));
  }, [me?.tenant_id]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch('/api/painel/marketing/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'presenca' }),
      });
      const json = await res.json();
      if (json.success) setSub(json.subscription);
    } catch (e) {
      console.error(e);
    } finally {
      setActivating(false);
    }
  };

  if (!me?.tenant_id) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  // No subscription — show upsell
  if (!sub) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Marketing
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Singulare Presença
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Aumente sua visibilidade online com reviews automáticos, recall de pacientes e vitrine SEO.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-white p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-zinc-900">Presença</p>
              <p className="text-[13px] text-zinc-500">
                R${MARKETING_PLAN_AMOUNTS.presenca}/mês · 7 dias grátis
              </p>
            </div>
          </div>

          <ul className="space-y-2.5 text-[14px] text-zinc-700">
            <li className="flex items-start gap-2">
              <Star className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>NPS 9-10 → mensagem automática no WhatsApp com link para Google Review</span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Recall semanal de pacientes inativos há +90 dias via WhatsApp</span>
            </li>
            <li className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Página pública SEO do profissional com JSON-LD (apareça no Google)</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
              <span>Dashboard de métricas: reviews, recall, visitas à vitrine</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="w-full h-12 rounded-xl text-white text-[15px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
            style={{ background: ACCENT_DEEP }}
          >
            {activating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ativar teste grátis (7 dias)'}
          </button>
        </div>

        {/* Future plans teaser */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['social', 'ads'] as MarketingPlanKey[]).map((key) => (
            <div
              key={key}
              className="rounded-xl border border-dashed border-black/[0.10] p-5 opacity-60 cursor-not-allowed"
            >
              <p className="text-[15px] font-semibold text-zinc-600">{MARKETING_PLANS[key]}</p>
              <p className="text-[13px] text-zinc-400 mt-1">
                R${MARKETING_PLAN_AMOUNTS[key]}/mês
              </p>
              <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mt-2 block">
                Em breve
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Has subscription — show dashboard
  const m = metrics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Marketing
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            {MARKETING_PLANS[sub.plan]}
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Métricas dos últimos 30 dias
            {sub.status === 'trial' && (
              <span className="ml-2 text-[11px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600">
                Teste grátis
              </span>
            )}
          </p>
        </div>
        <Link
          href="/painel/marketing/configurar"
          className="h-10 px-4 rounded-lg bg-zinc-100 text-zinc-700 text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-zinc-200 transition-all flex-shrink-0"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Configurar</span>
        </Link>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Reviews solicitados"
          value={m?.review_requests_sent ?? 0}
          sub={m && m.review_requests_sent > 0
            ? `${m.reviews_completed} concluídos (${Math.round(m.review_conversion_rate)}%)`
            : undefined}
          icon={<Star className="w-4 h-4" />}
        />
        <MetricCard
          label="Recall enviados"
          value={m?.recalls_sent ?? 0}
          sub={m && m.recalls_sent > 0
            ? `${m.recalls_converted} convertidos (${Math.round(m.recall_conversion_rate)}%)`
            : undefined}
          icon={<MessageCircle className="w-4 h-4" />}
        />
        <MetricCard
          label="Visitas à vitrine"
          value={m?.vitrine_views ?? 0}
          sub={m && m.vitrine_views > 0
            ? `${m.vitrine_whatsapp_clicks} cliques WhatsApp`
            : undefined}
          icon={<Eye className="w-4 h-4" />}
        />
        <MetricCard
          label="Posts publicados"
          value={m?.posts_published ?? 0}
          icon={<ArrowUpRight className="w-4 h-4" />}
        />
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-3">
        <h3 className="text-[13px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Links rápidos</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/painel/feedback"
            className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline"
          >
            Ver NPS / Feedback →
          </Link>
          <Link
            href="/painel/marketing/configurar"
            className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline"
          >
            Configurar Google Review URL →
          </Link>
        </div>
      </div>

      {/* Empty state hint */}
      {m && m.review_requests_sent === 0 && m.recalls_sent === 0 && m.vitrine_views === 0 && (
        <div className="rounded-xl border border-dashed border-black/[0.10] p-6 text-center">
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">Nenhum dado ainda</p>
          <p className="text-[13px] text-zinc-500">
            Configure sua URL do Google Review e o sistema começará a enviar solicitações automaticamente para pacientes com NPS 9-10.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 text-zinc-400 animate-spin mx-auto mt-12" />}>
      <MarketingInner />
    </Suspense>
  );
}
