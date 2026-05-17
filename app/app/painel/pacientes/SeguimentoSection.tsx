'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Plus, Loader2, FileText, PauseCircle, PlayCircle, CheckCircle2, X } from 'lucide-react';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#EEEBF8';

interface Props {
  patientId: number;
}

interface Protocol {
  id: number;
  tenant_id: string | null;
  specialty: string;
  slug: string;
  name: string;
  description: string | null;
  duration_weeks: number;
  cadence_days: number;
}

interface PatientProtocol {
  id: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  started_at: string;
  ends_at: string | null;
  next_consultation_at: string | null;
  last_dispatched_at: string | null;
  notes: string | null;
  created_at: string;
  protocol: {
    id: number;
    slug: string;
    name: string;
    specialty: string;
    description: string | null;
    duration_weeks: number;
  } | null;
}

export function SeguimentoSection({ patientId }: Props) {
  const [list, setList] = useState<PatientProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/painel/pacientes/${patientId}/seguimento`);
      const j = await res.json();
      if (j.success) setList(j.patient_protocols ?? []);
      else setError(j.error ?? 'unknown_error');
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleAction = async (pp: PatientProtocol, action: 'pause' | 'resume' | 'complete') => {
    setPendingAction(pp.id);
    try {
      const res = await fetch(`/api/painel/pacientes/${patientId}/seguimento`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_protocol_id: pp.id, action }),
      });
      const j = await res.json();
      if (!j.success) {
        alert(`Erro: ${j.error}`);
      } else {
        await reload();
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setPendingAction(null);
    }
  };

  const activeCount = list.filter((p) => p.status === 'active').length;

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Activity className="w-3.5 h-3.5" style={{ color: ACCENT }} />
        <h3 className="text-[13px] font-semibold text-zinc-900">Seguimento de tratamento</h3>
        {activeCount > 0 && (
          <span
            className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded"
            style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}
          >
            {activeCount} ativo{activeCount > 1 ? 's' : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowAssign(true)}
          className="ml-auto h-7 px-2.5 rounded-md border border-black/[0.08] hover:bg-zinc-50 text-[11px] font-medium text-zinc-700 inline-flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" /> Atribuir
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
        </div>
      ) : error ? (
        <p className="text-[12px] text-red-600">Erro: {error}</p>
      ) : list.length === 0 ? (
        <p className="text-[13px] text-zinc-500 italic">Nenhum protocolo atribuido. Clique &ldquo;Atribuir&rdquo; pra comecar.</p>
      ) : (
        <div className="space-y-2">
          {list.map((pp) => (
            <ProtocolCard
              key={pp.id}
              pp={pp}
              busy={pendingAction === pp.id}
              onAction={(action) => handleAction(pp, action)}
            />
          ))}
        </div>
      )}

      {showAssign && (
        <AssignModal
          patientId={patientId}
          onClose={() => setShowAssign(false)}
          onAssigned={() => {
            setShowAssign(false);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function ProtocolCard({
  pp,
  busy,
  onAction,
}: {
  pp: PatientProtocol;
  busy: boolean;
  onAction: (action: 'pause' | 'resume' | 'complete') => void;
}) {
  const protocolName = pp.protocol?.name ?? '(protocolo nao encontrado)';
  const started = new Date(pp.started_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const next = pp.next_consultation_at
    ? new Date(pp.next_consultation_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null;

  const statusStyle: Record<PatientProtocol['status'], { bg: string; text: string; label: string }> = {
    active: { bg: '#D1FAE5', text: '#047857', label: 'Ativo' },
    paused: { bg: '#FEF3C7', text: '#92400E', label: 'Pausado' },
    completed: { bg: '#E0E7FF', text: '#3730A3', label: 'Concluido' },
    abandoned: { bg: '#FECACA', text: '#991B1B', label: 'Abandonado' },
  };
  const s = statusStyle[pp.status];

  return (
    <div className="rounded-lg border border-black/[0.06] p-3 bg-white">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-zinc-900 truncate">{protocolName}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Iniciado {started}
            {next ? ` · Retorno ${next}` : ''}
            {pp.last_dispatched_at ? ` · Ultimo toque ${new Date(pp.last_dispatched_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''}
          </div>
        </div>
        <span
          className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: s.bg, color: s.text }}
        >
          {s.label}
        </span>
      </div>

      {pp.notes && (
        <p className="text-[11px] text-zinc-600 italic whitespace-pre-wrap mb-2 line-clamp-2">{pp.notes}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <a
          href={`/painel/seguimento/briefing/${pp.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors hover:opacity-90"
          style={{ background: ACCENT, color: 'white' }}
        >
          <FileText className="w-3 h-3" /> Briefing
        </a>
        {pp.status === 'active' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('pause')}
              className="h-7 px-2.5 rounded-md border border-black/[0.08] text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 disabled:opacity-60"
            >
              <PauseCircle className="w-3 h-3" /> Pausar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction('complete')}
              className="h-7 px-2.5 rounded-md border border-black/[0.08] text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 disabled:opacity-60"
            >
              <CheckCircle2 className="w-3 h-3" /> Concluir
            </button>
          </>
        )}
        {pp.status === 'paused' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction('resume')}
            className="h-7 px-2.5 rounded-md border border-black/[0.08] text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 disabled:opacity-60"
          >
            <PlayCircle className="w-3 h-3" /> Retomar
          </button>
        )}
      </div>
    </div>
  );
}

function AssignModal({
  patientId,
  onClose,
  onAssigned,
}: {
  patientId: number;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nextConsultation, setNextConsultation] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/painel/seguimento/protocols')
      .then((r) => r.json())
      .then((j) => {
        if (!mounted) return;
        if (j.success) {
          setProtocols(j.protocols ?? []);
          if ((j.protocols ?? []).length > 0) setSelectedId(j.protocols[0].id);
        } else {
          setError(j.error ?? 'unknown_error');
        }
      })
      .catch((e) => mounted && setError(String(e)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/painel/pacientes/${patientId}/seguimento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocol_id: selectedId,
          next_consultation_at: nextConsultation || null,
          notes: notes || null,
        }),
      });
      const j = await res.json();
      if (j.success) {
        onAssigned();
      } else {
        setError(j.error ?? 'unknown_error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selected = protocols.find((p) => p.id === selectedId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-black/[0.06] shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-zinc-900">Atribuir protocolo</h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">Inicia seguimento de tratamento pra esse paciente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : protocols.length === 0 ? (
          <p className="text-[13px] text-zinc-500 italic py-4">Nenhum template disponivel.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-600 mb-1.5 block">
                Protocolo
              </label>
              <div className="space-y-1.5">
                {protocols.map((p) => {
                  const isSelected = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-violet-400 bg-violet-50' : 'border-black/[0.08] hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-zinc-900">{p.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-zinc-500 flex-shrink-0">{p.specialty}</span>
                      </div>
                      {p.description && (
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{p.description}</p>
                      )}
                      <p className="text-[10px] text-zinc-400 mt-1">
                        {p.duration_weeks} semanas · 1 toque a cada {p.cadence_days}d
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-600 mb-1.5 block">
                Proxima consulta (opcional)
              </label>
              <input
                type="datetime-local"
                value={nextConsultation}
                onChange={(e) => setNextConsultation(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-black/[0.08] focus:border-black/[0.2] focus:outline-none text-[13px]"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                Define quando o briefing pre-consulta sera gerado (90 dias antes).
              </p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-600 mb-1.5 block">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex: paciente em uso de losartana 50mg/dia"
                className="w-full px-3 py-2 rounded-lg border border-black/[0.08] focus:border-black/[0.2] focus:outline-none text-[13px] resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-[12px] text-red-700">Erro: {error}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 h-10 rounded-lg border border-black/[0.08] hover:bg-zinc-50 text-[13px] font-medium text-zinc-700 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedId}
                className="flex-1 h-10 rounded-lg text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {submitting ? 'Atribuindo...' : 'Atribuir'}
              </button>
            </div>

            {selected && (
              <p className="text-[10px] text-zinc-400 text-center pt-1">
                {selected.name} sera atribuido e o paciente comeca a receber perguntas semanais.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
