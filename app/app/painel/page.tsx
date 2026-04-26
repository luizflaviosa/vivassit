'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Star,
  Wallet,
  MessageCircle,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface Tenant {
  tenant_id: string;
  clinic_name: string;
  doctor_name: string | null;
  plan_type: string;
  subscription_status: string;
  trial_ends_at: string | null;
}

interface Metrics {
  appointments_month: number;
  patients_total: number;
  nps_avg: number | null;
  nps_responses: number;
  revenue_month: number;
  payments_pending: number;
  doctors_active: number;
  messages_month: number;
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function trialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function PainelInner() {
  const searchParams = useSearchParams();
  const tenantId =
    searchParams?.get('tenant') ||
    (typeof window !== 'undefined' ? localStorage.getItem('vivassit_tenant_id') ?? '' : '');

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const [tRes, mRes] = await Promise.all([
          fetch(`/api/painel/tenant?tenant=${encodeURIComponent(tenantId)}`),
          fetch(`/api/painel/overview?tenant=${encodeURIComponent(tenantId)}`),
        ]);
        const tJson = await tRes.json();
        const mJson = await mRes.json();
        if (tJson.success) setTenant(tJson.tenant);
        if (mJson.success) setMetrics(mJson.metrics);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId]);

  if (!tenantId) return null;

  const daysLeft = trialDaysLeft(tenant?.trial_ends_at ?? null);
  const isTrialing = tenant?.subscription_status === 'trialing';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Visão geral
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Olá{tenant?.doctor_name ? `, ${tenant.doctor_name.split(' ')[0]}` : ''}.
        </h1>
        {tenant && (
          <p className="text-[14px] text-zinc-500 mt-1.5">
            {tenant.clinic_name} ·{' '}
            <span className="font-medium text-zinc-700">{PLAN_LABELS[tenant.plan_type] ?? tenant.plan_type}</span>
            {isTrialing && daysLeft !== null && daysLeft > 0 && (
              <>
                {' '}· <span style={{ color: ACCENT_DEEP }}>{daysLeft} {daysLeft === 1 ? 'dia' : 'dias'} de teste</span>
              </>
            )}
          </p>
        )}
      </motion.div>

      {/* Trial CTA */}
      {isTrialing && daysLeft !== null && daysLeft <= 7 && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5 flex items-start gap-3">
          <div className="h-9 w-9 flex-shrink-0 rounded-md flex items-center justify-center" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-zinc-900">Você está no período de teste</p>
            <p className="text-[13px] text-zinc-500 mt-0.5">
              Ative sua assinatura agora pra garantir continuidade depois do trial.
            </p>
          </div>
          <a
            href="#"
            className="hidden sm:inline-flex items-center gap-1 text-[12px] font-semibold rounded-md px-3 h-9"
            style={{ background: ACCENT_DEEP, color: 'white' }}
          >
            Ativar
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Consultas no mês"
          value={loading ? '–' : String(metrics?.appointments_month ?? 0)}
          icon={<Calendar className="w-4 h-4" />}
          accent="violet"
        />
        <MetricCard
          label="Faturamento mensal"
          value={loading ? '–' : fmtBRL(metrics?.revenue_month ?? 0)}
          icon={<Wallet className="w-4 h-4" />}
          accent="emerald"
        />
        <MetricCard
          label="Pacientes ativos"
          value={loading ? '–' : String(metrics?.patients_total ?? 0)}
          icon={<Users className="w-4 h-4" />}
          accent="blue"
        />
        <MetricCard
          label="NPS médio"
          value={
            loading
              ? '–'
              : metrics?.nps_avg !== null && metrics?.nps_avg !== undefined
              ? metrics.nps_avg.toFixed(1)
              : '—'
          }
          subValue={metrics?.nps_responses ? `${metrics.nps_responses} resp.` : undefined}
          icon={<Star className="w-4 h-4" />}
          accent="amber"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecondaryStat
          icon={<MessageCircle className="w-4 h-4" />}
          label="Mensagens da IA no mês"
          value={loading ? '–' : String(metrics?.messages_month ?? 0)}
        />
        <SecondaryStat
          icon={<Users className="w-4 h-4" />}
          label="Profissionais ativos"
          value={loading ? '–' : String(metrics?.doctors_active ?? 0)}
        />
        <SecondaryStat
          icon={<AlertCircle className="w-4 h-4" />}
          label="Cobranças pendentes"
          value={loading ? '–' : String(metrics?.payments_pending ?? 0)}
          highlight={(metrics?.payments_pending ?? 0) > 0}
        />
      </div>

      {/* Quick links */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-zinc-900 mb-3">Atalhos</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <QuickLink
            href={`/painel/profissionais?tenant=${encodeURIComponent(tenantId)}`}
            title="Cadastrar profissional"
            desc="Adicione mais profissionais à clínica"
          />
          <QuickLink
            href={`/painel/configuracoes?tenant=${encodeURIComponent(tenantId)}`}
            title="Personalizar IA"
            desc="Edite as instruções do agente"
          />
          <QuickLink
            href={`/painel/pacientes?tenant=${encodeURIComponent(tenantId)}`}
            title="Lista de pacientes"
            desc="Veja histórico e contatos"
          />
          <QuickLink
            href="#"
            title="Ativar visibilidade"
            desc="Tráfego pago e SEO (em breve)"
            disabled
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  accent: 'violet' | 'emerald' | 'blue' | 'amber';
}) {
  const colors = {
    violet: { bg: '#F5F3FF', fg: '#5746AF' },
    emerald: { bg: '#ECFDF5', fg: '#047857' },
    blue: { bg: '#EFF6FF', fg: '#1D4ED8' },
    amber: { bg: '#FFFBEB', fg: '#B45309' },
  }[accent];
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: colors.bg, color: colors.fg }}
        >
          {icon}
        </span>
      </div>
      <div className="text-[24px] sm:text-[26px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">
        {value}
      </div>
      <div className="text-[12px] text-zinc-500 mt-1.5">{label}</div>
      {subValue && <div className="text-[11px] text-zinc-400 mt-0.5">{subValue}</div>}
    </div>
  );
}

function SecondaryStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 flex items-center gap-3">
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${
          highlight ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[16px] font-medium text-zinc-900 leading-none">{value}</div>
        <div className="text-[12px] text-zinc-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-black/[0.07] bg-zinc-50 opacity-60">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-zinc-700">{title}</div>
          <div className="text-[12px] text-zinc-500 mt-0.5">{desc}</div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-400">Em breve</span>
      </div>
    );
  }
  return (
    <a
      href={href}
      className="group flex items-center justify-between gap-3 p-3.5 rounded-lg border border-black/[0.07] bg-white hover:border-black/[0.15] transition-all"
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-zinc-900">{title}</div>
        <div className="text-[12px] text-zinc-500 mt-0.5">{desc}</div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 transition-colors" />
    </a>
  );
}

export default function PainelPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <PainelInner />
    </Suspense>
  );
}
