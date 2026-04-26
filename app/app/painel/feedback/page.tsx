'use client';

import { useEffect, useState, Suspense } from 'react';
import { Loader2, Star, MessageSquare } from 'lucide-react';
import { useMe } from '@/lib/painel-context';

const ACCENT_DEEP = '#5746AF';

interface Feedback {
  id: number;
  patient_name: string | null;
  patient_phone: string;
  doctor_name: string | null;
  appointment_date: string | null;
  nps_score: number | null;
  feedback_text: string | null;
  sent_at: string;
  responded_at: string | null;
  status: string;
}

interface Summary {
  total_sent: number;
  total_responded: number;
  avg_score: number | null;
  nps: number | null;
  promoters: number;
  detractors: number;
  passives: number;
}

function npsColor(score: number | null): string {
  if (score === null) return '#94A3B8';
  if (score >= 9) return '#047857'; // emerald
  if (score >= 7) return '#B45309'; // amber
  return '#B91C1C'; // red
}

function npsBg(score: number | null): string {
  if (score === null) return '#F1F5F9';
  if (score >= 9) return '#ECFDF5';
  if (score >= 7) return '#FFFBEB';
  return '#FEF2F2';
}

function FeedbackInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      try {
        const res = await fetch('/api/painel/feedback');
        const json = await res.json();
        if (json.success) {
          setFeedbacks(json.feedbacks);
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
          NPS / Satisfação
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Feedback dos pacientes
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Pesquisas de satisfação enviadas após cada consulta.
        </p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="NPS" value={summary.nps !== null ? String(summary.nps) : '—'} sub="-100 a +100" />
          <SummaryCard label="Score médio" value={summary.avg_score !== null ? summary.avg_score.toFixed(1) : '—'} sub="0 a 10" />
          <SummaryCard label="Respostas" value={`${summary.total_responded}/${summary.total_sent}`} sub="Taxa de resposta" />
          <SummaryCard label="Promotores" value={`${summary.promoters}`} sub={`${summary.detractors} detratores`} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : feedbacks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {feedbacks.map((f) => (
            <div key={f.id} className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold text-[14px]"
                  style={{ background: npsBg(f.nps_score), color: npsColor(f.nps_score) }}
                >
                  {f.nps_score !== null ? f.nps_score : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-[14px] font-semibold text-zinc-900 truncate">{f.patient_name || f.patient_phone}</p>
                    <p className="text-[11px] text-zinc-400 flex-shrink-0">
                      {f.responded_at ? new Date(f.responded_at).toLocaleDateString('pt-BR') : 'Aguardando resposta'}
                    </p>
                  </div>
                  {f.doctor_name && (
                    <p className="text-[12px] text-zinc-500 mb-2">com {f.doctor_name}</p>
                  )}
                  {f.feedback_text && (
                    <p className="text-[13px] text-zinc-700 leading-relaxed italic border-l-2 border-zinc-200 pl-3 mt-2">
                      &ldquo;{f.feedback_text}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white p-4 sm:p-5">
      <div className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900 leading-none">{value}</div>
      <div className="text-[12px] text-zinc-500 mt-1.5">{label}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
        <Star className="w-5 h-5 text-zinc-400" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 mb-1">Sem feedback ainda</p>
      <p className="text-[13px] text-zinc-500 max-w-md mx-auto">
        O agente IA envia pesquisa de satisfação automaticamente após cada consulta. Aparecerá
        aqui assim que receber as primeiras respostas.
      </p>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <FeedbackInner />
    </Suspense>
  );
}
