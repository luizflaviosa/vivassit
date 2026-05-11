'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, UserPlus, Phone, Mail, Calendar,
  X, MessageCircle, Wallet, Activity, ChevronRight, HeartPulse, Link2, Copy, Check, Smartphone, Send,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import { PatientRowSkeleton } from '@/lib/painel-skeleton';

const ACCENT = '#6E56CF';
const ACCENT_DEEP = '#5746AF';
const ACCENT_SOFT = '#F5F3FF';

interface AppointmentLite {
  id: string;
  doctor_name: string | null;
  appointment_date: string;
  status: string | null;
}
interface PaymentLite {
  id: string;
  consultation_value: number | null;
  status: string | null;
  payment_method: string | null;
  approved_at: string | null;
  created_at: string;
  doctor_name: string | null;
}
interface ObservationLite {
  id: number;
  loinc_code: string;
  display_name: string | null;
  value_numeric: number | string | null;
  unit: string | null;
  effective_time: string;
  data_quality_tag: 'clean' | 'outlier' | 'noisy' | 'rejected';
  category: string;
}
interface VitalsLatest {
  heart_rate: ObservationLite | null;
  hrv_sdnn: ObservationLite | null;
  steps: ObservationLite | null;
  spo2: ObservationLite | null;
}
interface PatientDetail {
  patient: Patient & { birthdate: string | null; created_at: string };
  appointments: AppointmentLite[];
  payments: PaymentLite[];
  health_observations: ObservationLite[];
  vitals_latest: VitalsLatest;
  summary: { total_appointments: number; total_spent: number; total_payments: number; total_observations: number };
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Patient {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  total_consultations: number;
  last_visit_at: string | null;
  last_doctor: string | null;
  doctor_preference: string | null;
  notes: string | null;
  tags: string[] | null;
  health_collection_token?: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VitalCard({ label, obs, fallbackUnit }: { label: string; obs: ObservationLite | null; fallbackUnit: string }) {
  if (!obs || obs.value_numeric === null) {
    return (
      <div className="rounded-lg border border-black/[0.06] px-3 py-2.5">
        <div className="text-[11px] text-zinc-500">{label}</div>
        <div className="text-[15px] font-semibold text-zinc-300 mt-1">—</div>
      </div>
    );
  }
  const value = typeof obs.value_numeric === 'string' ? Number(obs.value_numeric) : obs.value_numeric;
  const ago = (() => {
    const ms = Date.now() - new Date(obs.effective_time).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  })();
  return (
    <div className="rounded-lg border border-black/[0.06] px-3 py-2.5">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-[18px] font-semibold text-zinc-900 leading-none">{value}</span>
        <span className="text-[11px] text-zinc-500">{obs.unit ?? fallbackUnit}</span>
      </div>
      <div className="text-[10px] text-zinc-400 mt-0.5">ha {ago}</div>
    </div>
  );
}

function PacientesInner() {
  const me = useMe();
  const tenantId = me?.tenant_id ?? '';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkAction, setLinkAction] = useState<'idle' | 'generating' | 'copied'>('idle');
  const [shortcutAction, setShortcutAction] = useState<'idle' | 'generating' | 'copied'>('idle');
  const [rookAction, setRookAction] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const ensureToken = async (): Promise<string | null> => {
    if (!detail) return null;
    const existing = detail.patient.health_collection_token;
    if (existing) return existing;
    try {
      const res = await fetch(`/api/painel/pacientes/${detail.patient.id}/collection-token`, { method: 'POST' });
      const j = await res.json();
      if (!j.success) {
        alert(`Erro: ${j.error}`);
        return null;
      }
      setDetail({ ...detail, patient: { ...detail.patient, health_collection_token: j.token } });
      return j.token as string;
    } catch (e) {
      alert(`Erro de rede: ${e}`);
      return null;
    }
  };

  const copyToClipboard = async (url: string, onSet: (s: 'idle' | 'copied') => void) => {
    try {
      await navigator.clipboard.writeText(url);
      onSet('copied');
      setTimeout(() => onSet('idle'), 2500);
    } catch {
      prompt('Copie o link manualmente:', url);
      onSet('idle');
    }
  };

  const handleGenerateOrCopyLink = async () => {
    setLinkAction('generating');
    const token = await ensureToken();
    if (!token) {
      setLinkAction('idle');
      return;
    }
    const url = `${window.location.origin}/saude/${token}`;
    await copyToClipboard(url, (s) => setLinkAction(s));
  };

  const handleCopyShortcutLink = async () => {
    setShortcutAction('generating');
    const token = await ensureToken();
    if (!token) {
      setShortcutAction('idle');
      return;
    }
    const url = `${window.location.origin}/saude/atalho/${token}`;
    await copyToClipboard(url, (s) => setShortcutAction(s));
  };

  const handleSendRookInvite = async () => {
    if (!detail) return;
    if (!confirm('Enviar convite via WhatsApp pra ' + (detail.patient.name ?? 'paciente') + ' conectar Apple Saúde via Rook?')) return;
    setRookAction('sending');
    try {
      const res = await fetch(`/api/painel/pacientes/${detail.patient.id}/rook-invite`, { method: 'POST' });
      const j = await res.json();
      if (j.success) {
        setRookAction('sent');
        setTimeout(() => setRookAction('idle'), 4000);
      } else {
        setRookAction('error');
        alert(`Erro: ${j.error}${j.whatsapp_error ? '\nDetalhe: ' + j.whatsapp_error : ''}`);
        setTimeout(() => setRookAction('idle'), 4000);
      }
    } catch (e) {
      setRookAction('error');
      alert(`Erro de rede: ${e}`);
      setTimeout(() => setRookAction('idle'), 4000);
    }
  };

  useEffect(() => {
    if (selectedId === null) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/painel/pacientes/${selectedId}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setDetail(j); })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/painel/pacientes');
        const json = await res.json();
        if (json.success) setPatients(json.patients);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId]);

  const filtered = patients.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q)
    );
  });

  if (!tenantId) return null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: ACCENT_DEEP }}>
          CRM
        </p>
        <h1 className="text-[28px] sm:text-[32px] leading-[1.05] tracking-[-0.025em] font-medium text-zinc-900">
          Pacientes
        </h1>
        <p className="text-[14px] text-zinc-500 mt-1.5">
          Histórico, contatos e preferências dos seus pacientes.
        </p>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, telefone ou email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-11 px-4 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
      />

      {loading ? (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
          <PatientRowSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/[0.10] p-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 mb-4">
            <UserPlus className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-900 mb-1">
            {patients.length === 0 ? 'Nenhum paciente ainda' : 'Nenhum resultado'}
          </p>
          <p className="text-[13px] text-zinc-500">
            {patients.length === 0
              ? 'Pacientes aparecem aqui automaticamente após o primeiro contato pelo WhatsApp.'
              : 'Tente outros termos.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 bg-zinc-50/60 border-b border-black/[0.06] text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-500">
            <div className="col-span-4">Paciente</div>
            <div className="col-span-3">Contato</div>
            <div className="col-span-2">Última visita</div>
            <div className="col-span-2">Profissional</div>
            <div className="col-span-1 text-right">Cons.</div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="w-full text-left px-5 py-4 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center hover:bg-violet-50/30 transition-colors group">
                <div className="col-span-4 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900 truncate">{p.name ?? 'Sem nome'}</p>
                  <p className="text-[12px] text-zinc-500 sm:hidden mt-1">{p.phone}</p>
                </div>
                <div className="col-span-3 min-w-0 text-[13px] text-zinc-600 hidden sm:block">
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                    <span className="truncate">{p.phone}</span>
                  </div>
                  {p.email && (
                    <div className="flex items-center gap-1.5 truncate mt-0.5">
                      <Mail className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 hidden sm:flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  {fmtDate(p.last_visit_at)}
                </div>
                <div className="col-span-2 text-[13px] text-zinc-600 truncate hidden sm:block">
                  {p.last_doctor ?? p.doctor_preference ?? '—'}
                </div>
                <div className="col-span-1 text-right text-[14px] font-semibold text-zinc-900 inline-flex items-center justify-end gap-1">
                  {p.total_consultations ?? 0}
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-violet-500 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-400 text-center">
        Mostrando até 100 pacientes. Clique em qualquer paciente pra ver detalhes.
      </p>

      {/* Patient detail drawer */}
      <AnimatePresence>
        {selectedId !== null && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[520px] bg-white overflow-y-auto"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            >
              <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-black/[0.06] flex items-center justify-between px-5 py-3 z-10">
                <span className="text-[12px] uppercase tracking-[0.12em] font-semibold text-zinc-500">
                  Paciente
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="h-8 w-8 -mr-2 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading || !detail ? (
                <div className="p-12 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div>
                    <div
                      className="h-12 w-12 rounded-full inline-flex items-center justify-center text-white text-[18px] font-semibold mb-3"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                    >
                      {(detail.patient.name ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-[24px] font-medium tracking-[-0.02em] text-zinc-900">
                      {detail.patient.name ?? 'Sem nome'}
                    </h2>
                    <div className="text-[13px] text-zinc-500 mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{detail.patient.phone}</div>
                      {detail.patient.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{detail.patient.email}</div>}
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                      <div className="text-[18px] font-semibold text-zinc-900 leading-none">{detail.summary.total_appointments}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">Consultas</div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                      <div className="text-[18px] font-semibold text-zinc-900 leading-none">{fmtBRL(detail.summary.total_spent)}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">Gasto total</div>
                    </div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
                      <div className="text-[18px] font-semibold text-zinc-900 leading-none">{detail.summary.total_payments}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">Cobranças</div>
                    </div>
                  </div>

                  {/* Appointments timeline */}
                  <section>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Activity className="w-3.5 h-3.5 text-zinc-400" />
                      <h3 className="text-[13px] font-semibold text-zinc-900">Consultas recentes</h3>
                    </div>
                    {detail.appointments.length === 0 ? (
                      <p className="text-[13px] text-zinc-500 italic">Nenhuma consulta registrada.</p>
                    ) : (
                      <div className="space-y-1">
                        {detail.appointments.slice(0, 8).map((ap) => {
                          const d = new Date(ap.appointment_date);
                          return (
                            <div key={ap.id} className="flex items-center gap-3 py-2 border-t border-black/[0.05] first:border-t-0">
                              <div className="text-center w-12 flex-shrink-0">
                                <div className="text-[10px] uppercase font-semibold text-zinc-500">
                                  {d.toLocaleDateString('pt-BR', { month: 'short' })}
                                </div>
                                <div className="text-[16px] font-semibold text-zinc-900 leading-none">{d.getDate()}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-zinc-900 truncate">{ap.doctor_name ?? 'Profissional'}</p>
                                <p className="text-[11px] text-zinc-500">
                                  {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  {ap.status && ` · ${ap.status}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Payments */}
                  <section>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Wallet className="w-3.5 h-3.5 text-zinc-400" />
                      <h3 className="text-[13px] font-semibold text-zinc-900">Cobranças</h3>
                    </div>
                    {detail.payments.length === 0 ? (
                      <p className="text-[13px] text-zinc-500 italic">Nenhuma cobrança ainda.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.payments.slice(0, 6).map((p) => {
                          const isPaid = ['paid','received','approved','confirmed'].includes((p.status ?? '').toLowerCase());
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                              <div>
                                <span className="text-[13px] font-medium text-zinc-900">{fmtBRL(p.consultation_value ?? 0)}</span>
                                <span className="text-[11px] text-zinc-500 ml-2">
                                  {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                  {p.payment_method && ` · ${p.payment_method}`}
                                </span>
                              </div>
                              <span
                                className="text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded"
                                style={{
                                  background: isPaid ? '#DCFCE7' : '#FEF3C7',
                                  color: isPaid ? '#166534' : '#92400E',
                                }}
                              >
                                {isPaid ? 'pago' : (p.status ?? 'pendente')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Saude cardiaca */}
                  <section>
                    <div className="flex items-center gap-1.5 mb-3">
                      <HeartPulse className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                      <h3 className="text-[13px] font-semibold text-zinc-900">Saude cardiaca</h3>
                      {detail.summary.total_observations > 0 && (
                        <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ml-auto" style={{ background: ACCENT_SOFT, color: ACCENT_DEEP }}>
                          {detail.summary.total_observations} leituras
                        </span>
                      )}
                    </div>

                    {/* Convite Rook via WhatsApp - fluxo principal */}
                    <button
                      type="button"
                      onClick={handleSendRookInvite}
                      disabled={rookAction === 'sending'}
                      className="w-full h-10 mb-2 rounded-lg text-[12px] font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-60"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})` }}
                    >
                      {rookAction === 'sending' ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando WhatsApp...</>
                      ) : rookAction === 'sent' ? (
                        <><Check className="w-3.5 h-3.5" /> Convite enviado</>
                      ) : rookAction === 'error' ? (
                        <><X className="w-3.5 h-3.5" /> Erro · tentar novamente</>
                      ) : (
                        <><Send className="w-3.5 h-3.5" /> Enviar convite WhatsApp · Apple Saúde</>
                      )}
                    </button>

                    {/* Links de coleta pra paciente (fallback manual) */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateOrCopyLink}
                        disabled={linkAction === 'generating'}
                        className="h-10 rounded-lg border border-black/[0.08] hover:bg-zinc-50 text-[12px] font-medium text-zinc-700 inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                      >
                        {linkAction === 'generating' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : linkAction === 'copied' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : detail.patient.health_collection_token ? (
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {linkAction === 'generating' ? 'Gerando...' :
                         linkAction === 'copied' ? 'Copiado!' :
                         'Link manual'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyShortcutLink}
                        disabled={shortcutAction === 'generating'}
                        className="h-10 rounded-lg border border-black/[0.08] hover:bg-zinc-50 text-[12px] font-medium text-zinc-700 inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
                      >
                        {shortcutAction === 'generating' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : shortcutAction === 'copied' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {shortcutAction === 'generating' ? 'Gerando...' :
                         shortcutAction === 'copied' ? 'Copiado!' :
                         'Atalho iOS'}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-400 mb-3 px-1 leading-relaxed">
                      <span className="font-medium text-violet-700">WhatsApp:</span> envia link de 1 clique pra paciente instalar Rook Extraction App (Apple Saúde sincroniza automaticamente). {' '}
                      <span className="font-medium text-zinc-500">Link manual:</span> form web pra digitar vitais. {' '}
                      <span className="font-medium text-zinc-500">Atalho iOS:</span> tutorial pra criar Apple Shortcut.
                    </p>
                    {detail.summary.total_observations === 0 ? (
                      <p className="text-[13px] text-zinc-500 italic">Sem dados de telemonitoramento ainda.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <VitalCard label="FC media" obs={detail.vitals_latest.heart_rate} fallbackUnit="bpm" />
                          <VitalCard label="HRV (SDNN)" obs={detail.vitals_latest.hrv_sdnn} fallbackUnit="ms" />
                          <VitalCard label="Passos" obs={detail.vitals_latest.steps} fallbackUnit="" />
                          <VitalCard label="SpO2" obs={detail.vitals_latest.spo2} fallbackUnit="%" />
                        </div>
                        <details className="text-[12px]">
                          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900 select-none py-1">
                            Ver ultimas {Math.min(10, detail.health_observations.length)} leituras brutas
                          </summary>
                          <div className="mt-2 space-y-1">
                            {detail.health_observations.slice(0, 10).map((o) => {
                              const t = new Date(o.effective_time);
                              const isReject = o.data_quality_tag === 'rejected';
                              const isOut = o.data_quality_tag === 'outlier';
                              return (
                                <div key={o.id} className="flex items-center justify-between gap-2 py-1 border-t border-black/[0.04] first:border-t-0">
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-medium text-zinc-900 truncate">
                                      {o.display_name ?? o.loinc_code}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                      {t.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className={`text-[12px] font-semibold ${isReject ? 'text-red-500 line-through' : 'text-zinc-900'}`}>
                                      {o.value_numeric ?? '—'} {o.unit ?? ''}
                                    </span>
                                    {(isReject || isOut) && (
                                      <span className="ml-1.5 text-[9px] uppercase font-bold tracking-wide" style={{ color: isReject ? '#dc2626' : '#d97706' }}>
                                        {o.data_quality_tag}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      </>
                    )}
                  </section>

                  {/* Notes */}
                  {detail.patient.notes && (
                    <section className="pt-4 border-t border-black/[0.05]">
                      <h3 className="text-[12px] uppercase tracking-[0.1em] font-semibold text-zinc-500 mb-2">Notas</h3>
                      <p className="text-[13px] text-zinc-700 whitespace-pre-wrap">{detail.patient.notes}</p>
                    </section>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2">
                    <a
                      href={`https://wa.me/${detail.patient.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 px-4 rounded-lg bg-emerald-500 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Abrir WhatsApp
                    </a>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

void ACCENT_SOFT;

export default function PacientesPage() {
  return (
    <Suspense fallback={<div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />}>
      <PacientesInner />
    </Suspense>
  );
}
