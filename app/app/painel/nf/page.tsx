'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';

interface NFRequest {
  id: number;
  patient_name: string;
  patient_cpf: string;
  patient_phone: string | null;
  doctor_name: string | null;
  consultation_date: string | null;
  status: 'pending' | 'sent' | 'completed' | 'cancelled';
  requested_at: string;
  sent_to_accountant_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

const STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  pending:   { bg: '#FFFBEB', fg: '#B45309', label: 'Pendente' },
  sent:      { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Enviado contador' },
  completed: { bg: '#ECFDF5', fg: '#047857', label: 'Concluída' },
  cancelled: { bg: '#F1F5F9', fg: '#475569', label: 'Cancelada' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function NFInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [requests, setRequests] = useState<NFRequest[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch('/api/painel/nf');
        const json = await res.json();
        if (json.success) {
          setRequests(json.requests);
          setSummary(json.summary);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          Faturamento
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Notas fiscais
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Pedidos de NF gerados automaticamente após cada consulta. O contador recebe por email.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="rounded-xl border border-black/[0.07] bg-white p-4">
            <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">
              {summary[key] ?? 0}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.08em] font-semibold mt-2 inline-block px-2 py-0.5 rounded"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-3">Paciente</div>
            <div className="col-span-2">CPF</div>
            <div className="col-span-2">Profissional</div>
            <div className="col-span-2">Consulta</div>
            <div className="col-span-2">Solicitada</div>
            <div className="col-span-1">Status</div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {requests.map((r) => {
              const c = STATUS[r.status] ?? STATUS.pending;
              return (
                <div key={r.id} className="px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                  <div className="sm:col-span-3 text-[14px] font-semibold text-zinc-900 truncate">{r.patient_name}</div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-600 font-mono hidden sm:block">{r.patient_cpf}</div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-700 truncate hidden sm:block">{r.doctor_name || '—'}</div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-600 hidden sm:block">{fmtDate(r.consultation_date)}</div>
                  <div className="sm:col-span-2 text-[13px] text-zinc-600 hidden sm:block">{fmtDate(r.requested_at)}</div>
                  <div className="sm:col-span-1">
                    <span
                      className="inline-flex text-[10px] uppercase tracking-[0.06em] font-semibold px-2 py-1 rounded whitespace-nowrap"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {c.label}
                    </span>
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
        <FileText className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 mb-1">Nenhum pedido de NF</p>
      <p className="text-[13px] text-zinc-500 max-w-md mx-auto">
        Ative &ldquo;NF automática&rdquo; nas configurações pra que cada consulta paga gere
        pedido enviado ao seu contador.
      </p>
    </div>
  );
}

export default function NFPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <NFInner />
    </Suspense>
  );
}
