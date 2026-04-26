'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  Loader2, ShieldCheck, ArrowLeft, MessageCircle, DollarSign,
  Users, TrendingUp, AlertCircle, RefreshCw, ExternalLink,
} from 'lucide-react';

const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface TenantUsage {
  tenant_id: string;
  clinic_name: string;
  plan_type: string;
  status: string;
  msgs_month: number;
  last_message_at: string | null;
  cost_month_usd: number;
  cost_month_brl: number;
}

interface UsageSummary {
  total_msgs_alltime: number;
  total_msgs_month: number;
  total_msgs_7days: number;
  tenants_total: number;
  tenants_active_month: number;
  cost_month_usd: number;
  cost_month_brl: number;
  projected_full_month_usd: number;
  projected_full_month_brl: number;
  avg_msg_cost_usd: number;
  avg_msg_cost_brl: number;
  assumptions: {
    model: string;
    avg_input_tokens: number;
    avg_output_tokens: number;
    usd_to_brl: number;
    note: string;
  };
}

interface UsageData {
  summary: UsageSummary;
  tenants: TenantUsage[];
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(v);
}
function fmtUSD(v: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(v);
}
function fmtNum(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(v);
}
function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h';
  return Math.floor(diff / 86_400_000) + 'd';
}

export default function AdminUsagePage() {
  const router = useRouter();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/usage', { cache: 'no-store' });
      if (res.status === 403) {
        setError('Você não tem permissão pra acessar essa página.');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData({ summary: json.summary, tenants: json.tenants });
      } else {
        setError(json.message || 'Erro ao carregar');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-5">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-4">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h1 className="text-[20px] font-medium text-zinc-900 mb-2">Acesso negado</h1>
          <p className="text-[14px] text-zinc-500 mb-5">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/painel')}
            className="h-10 px-4 rounded-lg border border-black/[0.10] text-zinc-900 text-[13px] font-semibold hover:border-black/30 transition-all"
          >
            Voltar pro painel
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const s = data.summary;

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logos/singulare-a.svg" alt="Singulare" width={140} height={46} className="h-8 sm:h-10 w-auto" priority />
            <span
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-bold px-2 py-1 rounded"
              style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
            >
              <ShieldCheck className="w-3 h-3" />
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              className="h-9 w-9 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/painel"
              className="h-9 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] rounded-md transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar pro painel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
            Operação · interno
          </p>
          <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
            Uso da plataforma
          </h1>
          <p className="text-[14px] text-zinc-500 mt-1.5">
            Visão de mensagens processadas, custo estimado de LLM e tenants ativos.
          </p>
        </motion.div>

        {/* Stats principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<MessageCircle className="w-4 h-4" />}
            label="Mensagens no mês"
            value={fmtNum(s.total_msgs_month)}
            sub={`${fmtNum(s.total_msgs_7days)} nos últimos 7d`}
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Custo LLM (mês até agora)"
            value={fmtBRL(s.cost_month_brl)}
            sub={fmtUSD(s.cost_month_usd)}
            accent="violet"
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Projeção do mês completo"
            value={fmtBRL(s.projected_full_month_brl)}
            sub="baseado nos últimos 7d"
            accent="amber"
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Tenants ativos no mês"
            value={`${fmtNum(s.tenants_active_month)} / ${fmtNum(s.tenants_total)}`}
            sub={`${fmtNum(s.total_msgs_alltime)} msgs all-time`}
          />
        </div>

        {/* Premissas */}
        <div className="rounded-xl border border-black/[0.06] bg-zinc-50/40 px-4 py-3 text-[12px] text-zinc-600 leading-relaxed">
          <p className="font-semibold mb-1">Premissas do cálculo</p>
          <p>
            Modelo: <strong>{s.assumptions.model}</strong> · Input médio: ~{fmtNum(s.assumptions.avg_input_tokens)} tokens/msg · Output: ~{fmtNum(s.assumptions.avg_output_tokens)} tokens
            · Custo por msg: ~{fmtBRL(s.avg_msg_cost_brl)} ({fmtUSD(s.avg_msg_cost_usd)})
            · USD-BRL: {s.assumptions.usd_to_brl}
          </p>
          <p className="mt-1.5 text-zinc-500 italic">{s.assumptions.note}</p>
        </div>

        {/* Tabela de tenants */}
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-black/[0.06] flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-zinc-900">Por tenant (mês corrente)</h2>
            <span className="text-[11px] text-zinc-400">ordenado por uso</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-zinc-50/40 text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-2.5">Clínica</th>
                  <th className="text-left px-5 py-2.5 hidden sm:table-cell">Plano</th>
                  <th className="text-left px-5 py-2.5 hidden md:table-cell">Status</th>
                  <th className="text-right px-5 py-2.5">Mensagens</th>
                  <th className="text-right px-5 py-2.5">Custo</th>
                  <th className="text-right px-5 py-2.5 hidden md:table-cell">Última</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {data.tenants.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-400">Nenhum tenant.</td></tr>
                ) : data.tenants.map((t) => (
                  <tr key={t.tenant_id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-zinc-900">{t.clinic_name}</div>
                      <div className="text-[11px] font-mono text-zinc-400 truncate max-w-[240px]">{t.tenant_id}</div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell text-zinc-600">{t.plan_type}</td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className={`text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${
                        t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                      }`}>{t.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-zinc-900">{fmtNum(t.msgs_month)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="font-semibold text-zinc-900">{fmtBRL(t.cost_month_brl)}</div>
                      <div className="text-[10px] text-zinc-400">{fmtUSD(t.cost_month_usd)}</div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-right text-zinc-500">{relTime(t.last_message_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-400 pt-4">
          Visão privada. Acessível apenas pra emails listados em <code className="text-zinc-500">lib/admin-auth.ts</code>.
          {' '}<a href="https://supabase.com/dashboard/project/qwyxacfgoqlskidwzdxe" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-900">
            Abrir Supabase <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'violet' | 'amber';
}) {
  const colors = accent === 'violet'
    ? { bg: '#F5F3FF', fg: '#5746AF' }
    : accent === 'amber'
      ? { bg: '#FFFBEB', fg: '#B45309' }
      : { bg: '#F4F4F5', fg: '#52525B' };
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
      <div className="text-[22px] sm:text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">
        {value}
      </div>
      <div className="text-[12px] text-zinc-500 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}
