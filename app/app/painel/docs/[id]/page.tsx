'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ArrowLeft,
  Download,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  AlertTriangle,
  MessageCircle,
  Mail,
  Smartphone,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import {
  DOC_TYPES,
  DOC_STATUSES,
  type DocStatus,
  type AptidaoFisicaForm,
  type MedicalDocument,
} from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

function StatusBadge({ status }: { status: DocStatus }) {
  const info = DOC_STATUSES[status];
  return (
    <span
      className="text-[11px] uppercase tracking-wide font-bold px-2.5 py-1 rounded-md"
      style={{ background: `${info.color}18`, color: info.color }}
    >
      {info.label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resultLabel(r: string): string {
  switch (r) {
    case 'apto': return 'Apto';
    case 'inapto': return 'Inapto';
    case 'apto_restricoes': return 'Apto com restrições';
    default: return r;
  }
}

function resultColor(r: string): string {
  switch (r) {
    case 'apto': return '#22C55E';
    case 'inapto': return '#EF4444';
    case 'apto_restricoes': return '#F59E0B';
    default: return '#71717A';
  }
}

interface DocDetail {
  document: MedicalDocument;
  patient: { name: string | null; phone: string; email: string | null; birthdate: string | null } | null;
  doctor: { doctor_name: string; doctor_crm: string; specialty: string } | null;
}

type SendChannel = 'whatsapp' | 'email' | 'both';

export default function DocDetailPage() {
  const me = useMe();
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;

  const [data, setData] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Sign modal (BirdID CPF input)
  const [showSign, setShowSign] = useState(false);
  const [signerCpf, setSignerCpf] = useState('');
  const [signMessage, setSignMessage] = useState('');

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  // Send modal (channel selection)
  const [showSend, setShowSend] = useState(false);
  const [sendChannel, setSendChannel] = useState<SendChannel>('whatsapp');

  // Cancel confirm
  const [showCancel, setShowCancel] = useState(false);

  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(`/api/painel/docs/${docId}`);
      const json = await res.json();
      if (json.success) {
        setData({ document: json.document, patient: json.patient, doctor: json.doctor });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    if (!me?.tenant_id) return;
    fetchDoc();
  }, [me?.tenant_id, fetchDoc]);

  const handleSign = useCallback(async () => {
    setActing(true);
    setSignMessage('');
    try {
      const res = await fetch(`/api/painel/docs/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_cpf: signerCpf.replace(/\D/g, '') || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.signing_method === 'birdid') {
          setSignMessage('✅ Enviado para o BirdID! Autorize no app.');
          // Poll for status update
          setTimeout(() => { fetchDoc(); setShowSign(false); setSignMessage(''); }, 5000);
        } else {
          await fetchDoc();
          setShowSign(false);
        }
      } else {
        setSignMessage(json.message || 'Erro ao assinar');
      }
    } catch (e) {
      console.error(e);
      setSignMessage('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, signerCpf, fetchDoc]);

  const handleReject = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/painel/docs/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reject: true, rejection_note: rejectNote }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDoc();
        setShowReject(false);
        setRejectNote('');
      } else {
        alert(json.message || 'Erro');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, rejectNote, fetchDoc]);

  const handleSend = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/painel/docs/${docId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: sendChannel }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDoc();
        setShowSend(false);
      } else {
        alert(json.message || 'Erro ao enviar');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, sendChannel, fetchDoc]);

  const handleCancel = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/painel/docs/${docId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { await fetchDoc(); setShowCancel(false); }
      else alert(json.message || 'Erro');
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, fetchDoc]);

  if (!me?.tenant_id) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/painel/docs" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Documentos
        </Link>
        <p className="text-[15px] text-zinc-500">Documento não encontrado.</p>
      </div>
    );
  }

  const { document: doc, patient, doctor } = data;
  const form = doc.form_data as unknown as AptidaoFisicaForm;
  const status = doc.status as DocStatus;

  const canSign = status === 'draft' || status === 'pending';
  const canSend = status === 'signed';
  const canCancel = status !== 'cancelled' && status !== 'sent';
  const canDownloadPdf = status === 'signed' || status === 'sent';
  const hasPhone = !!patient?.phone;
  const hasEmail = !!patient?.email;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/painel/docs" className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Documentos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
              {DOC_TYPES[doc.doc_type]}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="text-[13px] text-zinc-500">#{doc.id} · Criado em {fmtDateTime(doc.created_at)}</p>
        </div>
        {canDownloadPdf && (
          <a
            href={`/api/painel/docs/${doc.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all flex-shrink-0"
            style={{ background: ACCENT_DEEP }}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </a>
        )}
      </div>

      {/* Rejection note */}
      {status === 'rejected' && doc.rejection_note && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-red-800">Rejeitado</p>
            <p className="text-[13px] text-red-700 mt-0.5">{doc.rejection_note}</p>
          </div>
        </div>
      )}

      {/* Patient info */}
      <div className="rounded-xl bg-zinc-50 p-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Paciente</p>
        <p className="text-[15px] font-semibold text-zinc-900">{patient?.name ?? 'Sem nome'}</p>
        <p className="text-[12px] text-zinc-500">
          {patient?.phone}{form.patient_cpf && ` · CPF: ${form.patient_cpf}`}
        </p>
        {patient?.email && <p className="text-[12px] text-zinc-500">{patient.email}</p>}
      </div>

      {/* Doctor info */}
      {doctor && (
        <div className="rounded-xl bg-zinc-50 p-4 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Profissional</p>
          <p className="text-[15px] font-semibold text-zinc-900">{doctor.doctor_name}</p>
          <p className="text-[12px] text-zinc-500">{doctor.doctor_crm} · {doctor.specialty}</p>
        </div>
      )}

      {/* Form data — Aptidão Física */}
      {doc.doc_type === 'aptidao_fisica' && form && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-4">
          <h3 className="text-[13px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Dados do atestado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mb-1">Atividade</p>
              <p className="text-[15px] text-zinc-900">{form.activity_type}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mb-1">Resultado</p>
              <span className="text-[14px] font-bold" style={{ color: resultColor(form.result) }}>
                {resultLabel(form.result)}
              </span>
            </div>
            {form.result === 'apto_restricoes' && form.restrictions && (
              <div className="sm:col-span-2">
                <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mb-1">Restrições</p>
                <p className="text-[14px] text-zinc-700">{form.restrictions}</p>
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mb-1">Data de emissão</p>
              <p className="text-[15px] text-zinc-900">{fmtDate(form.issue_date)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-zinc-400 mb-1">Validade</p>
              <p className="text-[15px] text-zinc-900">{fmtDate(form.validity_date)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-black/[0.07] bg-white p-5 space-y-3">
        <h3 className="text-[13px] uppercase tracking-[0.08em] font-semibold text-zinc-500">Histórico</h3>
        <div className="space-y-2 text-[13px] text-zinc-600">
          <p>Criado em {fmtDateTime(doc.created_at)}</p>
          {doc.submitted_at && <p>Enviado para assinatura em {fmtDateTime(doc.submitted_at)}</p>}
          {doc.signed_at && <p>Assinado em {fmtDateTime(doc.signed_at)}</p>}
          {doc.sent_to_patient_at && <p>Enviado ao paciente em {fmtDateTime(doc.sent_to_patient_at)}</p>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {canSign && (
          <>
            <button
              type="button"
              onClick={() => setShowSign(true)}
              disabled={acting}
              className="h-11 px-5 rounded-xl text-white text-[14px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-40"
              style={{ background: '#22C55E' }}
            >
              <CheckCircle2 className="w-4 h-4" /> Assinar
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={acting}
              className="h-11 px-5 rounded-xl bg-red-50 text-red-600 text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-red-100 transition-all disabled:opacity-40"
            >
              <XCircle className="w-4 h-4" /> Rejeitar
            </button>
          </>
        )}

        {canSend && (
          <button
            type="button"
            onClick={() => setShowSend(true)}
            disabled={acting}
            className="h-11 px-5 rounded-xl text-white text-[14px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-40"
            style={{ background: ACCENT_DEEP }}
          >
            <Send className="w-4 h-4" /> Enviar ao paciente
          </button>
        )}

        {canDownloadPdf && (
          <a
            href={`/api/painel/docs/${doc.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 px-5 rounded-xl bg-zinc-100 text-zinc-700 text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-zinc-200 transition-all sm:hidden"
          >
            <Download className="w-4 h-4" /> PDF
          </a>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            disabled={acting}
            className="h-11 px-5 rounded-xl bg-zinc-100 text-zinc-500 text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-40 ml-auto"
          >
            <Trash2 className="w-4 h-4" /> Cancelar
          </button>
        )}
      </div>

      {/* ═══════ Sign Modal (BirdID) ═══════ */}
      {showSign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-zinc-900">Assinar documento</h3>
            <p className="text-[14px] text-zinc-500">
              Se o profissional tiver CPF BirdID configurado, você receberá uma notificação no app BirdID para autorizar a assinatura digital.
            </p>
            <p className="text-[12px] text-zinc-400">
              Sem CPF BirdID cadastrado, o documento será assinado diretamente (sem certificado digital). Para configurar, acesse as configurações do profissional.
            </p>

            <details className="text-[12px] text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-700 transition-colors">Informar CPF manualmente (opcional)</summary>
              <div className="mt-2">
                <input
                  type="text"
                  value={signerCpf}
                  onChange={(e) => setSignerCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Apenas números — sobrescreve o CPF salvo no perfil"
                  className="w-full h-11 px-4 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
                  inputMode="numeric"
                />
              </div>
            </details>

            {signMessage && (
              <p className={`text-[13px] ${signMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {signMessage}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowSign(false); setSignerCpf(''); setSignMessage(''); }}
                className="h-10 px-4 rounded-lg text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSign}
                disabled={acting}
                className="h-10 px-5 rounded-lg text-white text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
                style={{ background: '#22C55E' }}
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Assinar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Send Channel Modal ═══════ */}
      {showSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-zinc-900">Enviar ao paciente</h3>
            <p className="text-[14px] text-zinc-500">
              Escolha como enviar o documento para <strong>{patient?.name || 'o paciente'}</strong>.
            </p>

            <div className="space-y-2">
              {/* WhatsApp option */}
              <button
                type="button"
                onClick={() => setSendChannel('whatsapp')}
                disabled={!hasPhone}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  sendChannel === 'whatsapp'
                    ? 'border-green-300 bg-green-50'
                    : 'border-black/[0.07] hover:border-green-200 hover:bg-green-50/30'
                } ${!hasPhone ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900">WhatsApp</p>
                  <p className="text-[12px] text-zinc-500 truncate">
                    {hasPhone ? patient!.phone : 'Sem telefone cadastrado'}
                  </p>
                </div>
                {sendChannel === 'whatsapp' && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </button>

              {/* Email option */}
              <button
                type="button"
                onClick={() => setSendChannel('email')}
                disabled={!hasEmail}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  sendChannel === 'email'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-black/[0.07] hover:border-blue-200 hover:bg-blue-50/30'
                } ${!hasEmail ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900">E-mail</p>
                  <p className="text-[12px] text-zinc-500 truncate">
                    {hasEmail ? patient!.email : 'Sem e-mail cadastrado'}
                  </p>
                </div>
                {sendChannel === 'email' && <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />}
              </button>

              {/* Both option */}
              {hasPhone && hasEmail && (
                <button
                  type="button"
                  onClick={() => setSendChannel('both')}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    sendChannel === 'both'
                      ? 'border-violet-300 bg-violet-50'
                      : 'border-black/[0.07] hover:border-violet-200 hover:bg-violet-50/30'
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-900">Ambos</p>
                    <p className="text-[12px] text-zinc-500">WhatsApp + E-mail</p>
                  </div>
                  {sendChannel === 'both' && <CheckCircle2 className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                </button>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowSend(false)}
                className="h-10 px-4 rounded-lg text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={acting}
                className="h-10 px-5 rounded-lg text-white text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
                style={{ background: ACCENT_DEEP }}
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Reject Modal ═══════ */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-zinc-900">Rejeitar documento</h3>
            <p className="text-[14px] text-zinc-500">Informe o motivo da rejeição.</p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={3}
              className="w-full px-4 py-3 bg-zinc-50 text-[15px] rounded-lg border border-black/10 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { setShowReject(false); setRejectNote(''); }}
                className="h-10 px-4 rounded-lg text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleReject} disabled={acting || !rejectNote.trim()}
                className="h-10 px-4 rounded-lg bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-40">
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Cancel Confirm ═══════ */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-[18px] font-semibold text-zinc-900">Cancelar documento?</h3>
            <p className="text-[14px] text-zinc-500">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowCancel(false)}
                className="h-10 px-4 rounded-lg text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">
                Voltar
              </button>
              <button type="button" onClick={handleCancel} disabled={acting}
                className="h-10 px-4 rounded-lg bg-red-500 text-white text-[14px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-40">
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Sim, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
