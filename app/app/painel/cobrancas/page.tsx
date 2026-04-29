'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader2, CreditCard, ExternalLink, Filter } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';

interface Payment {
  id: number;
  asaas_payment_id: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  consultation_date: string;
  consultation_value: number | string;
  asaas_fee_value: number | string | null;
  asaas_net_value: number | string | null;
  estimated_fee_value: number | string | null;
  status: string;
  payment_method: string | null;
  payment_url: string | null;
  created_at: string;
  approved_at: string | null;
}

interface Summary {
  received: number;
  received_net: number;
  received_fee: number;
  pending: number;
  received_count: number;
  pending_count: number;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pending:   { bg: '#FFFBEB', fg: '#B45309', label: 'Aguardando' },
  approved:  { bg: '#ECFDF5', fg: '#047857', label: 'Pago' },
  paid:      { bg: '#ECFDF5', fg: '#047857', label: 'Pago' },
  overdue:   { bg: '#FEF2F2', fg: '#B91C1C', label: 'Vencido' },
  refunded:  { bg: '#F1F5F9', fg: '#475569', label: 'Reembolsado' },
  cancelled: { bg: '#F1F5F9', fg: '#475569', label: 'Cancelado' },
};

function fmtBRL(v: number | string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function CobrancasInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const url = filter === 'all' ? '/api/painel/cobrancas' : `/api/painel/cobrancas?status=${filter}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
          setPayments(json.payments);
          setSummary(json.summary);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, filter]);

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Marketplace
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Cobranças
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Histórico de cobranças geradas pra pacientes via WhatsApp.
        </p>
      </div>

      {/* Summary com breakdown modelo B (pass-through pro médico) */}
      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
              <div className="text-[12px] text-zinc-500 mb-1">Cobrado dos pacientes</div>
              <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">
                {fmtBRL(summary.received)}
              </div>
              <div className="text-[12px] text-zinc-400 mt-1">{summary.received_count} cobranças pagas</div>
            </div>
            <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
              <div className="text-[12px] text-zinc-500 mb-1">Taxa Asaas</div>
              <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-700 leading-none">
                {fmtBRL(summary.received_fee)}
              </div>
              <div className="text-[12px] text-zinc-400 mt-1">processamento de pagamento</div>
            </div>
            <div
              className="rounded-xl p-4 sm:p-5 text-white"
              style={{ background: `linear-gradient(135deg, #6E56CF, ${ACCENT_DEEP})` }}
            >
              <div className="text-[12px] text-violet-100 mb-1">Você recebe</div>
              <div className="text-[24px] font-medium tracking-[-0.02em] leading-none">
                {fmtBRL(summary.received_net)}
              </div>
              <div className="text-[12px] text-violet-200 mt-1">cai direto na sua conta</div>
            </div>
          </div>
          {summary.received > 0 && (
            <p className="text-[11.5px] text-zinc-400 leading-relaxed -mt-1">
              A taxa do Asaas é cobrada por transação (PIX R$ 0,99 · cartão crédito 1,99% + R$ 0,49 à vista
              no preço promocional vigente). Sem markup do Singulare — o que você vê é o que recebe.
            </p>
          )}
          {summary.pending > 0 && (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-amber-900">
                Aguardando pagamento
              </span>
              <span className="text-[15px] font-semibold text-amber-900">
                {fmtBRL(summary.pending)}{' '}
                <span className="text-[12px] font-normal text-amber-700">· {summary.pending_count} cobranças</span>
              </span>
            </div>
          )}
        </>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        {[
          { id: 'all',      label: 'Todas' },
          { id: 'pending',  label: 'Pendentes' },
          { id: 'approved', label: 'Pagas' },
          { id: 'overdue',  label: 'Vencidas' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 h-8 px-3 rounded-md text-[12px] font-semibold transition-all ${
              filter === f.id
                ? 'bg-zinc-900 text-white'
                : 'bg-white border border-black/[0.08] text-zinc-700 hover:border-black/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-3">Paciente</div>
            <div className="col-span-2">Profissional</div>
            <div className="col-span-2">Data</div>
            <div className="col-span-2">Valor</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1"></div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {payments.map((p) => {
              const c = STATUS_COLORS[p.status] ?? { bg: '#F1F5F9', fg: '#475569', label: p.status };
              return (
                <div key={p.id} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                  <div className="sm:col-span-3 min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-900 truncate">{p.patient_name}</p>
                    <p className="text-[12px] text-zinc-500 truncate">{p.patient_phone}</p>
                  </div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-700 truncate hidden sm:block">{p.doctor_name || '—'}</div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-600 hidden sm:block">{p.consultation_date || fmtDate(p.created_at)}</div>
                  <div className="sm:col-span-2">
                    <div className="text-[14px] font-semibold text-zinc-900">{fmtBRL(p.consultation_value)}</div>
                    {(p.status === 'approved' || p.status === 'paid') && p.asaas_net_value !== null && p.asaas_net_value !== undefined && (
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        recebe {fmtBRL(p.asaas_net_value)}
                      </div>
                    )}
                    {p.status === 'pending' && p.estimated_fee_value !== null && p.estimated_fee_value !== undefined && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        ~{fmtBRL(Number(p.consultation_value) - Number(p.estimated_fee_value))} líquido
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <span
                      className="inline-flex items-center text-[11px] uppercase tracking-[0.06em] font-semibold px-2 py-1 rounded"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {c.label}
                    </span>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    {p.payment_url && (
                      <a
                        href={p.payment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-8 w-8 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700"
                        title="Ver cobrança"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
        <CreditCard className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 mb-1">Nenhuma cobrança ainda</p>
      <p className="text-[13px] text-zinc-500 max-w-md mx-auto">
        As cobranças aparecem aqui automaticamente quando o agente IA gera links de
        pagamento via WhatsApp. Ative o Marketplace em <strong>Pagamentos</strong> primeiro.
      </p>
    </div>
  );
}

export default function CobrancasPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <CobrancasInner />
    </Suspense>
  );
}
