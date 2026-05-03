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
  Fingerprint,
  ShieldCheck,
  FileText,
  Pencil,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import {
  DOC_TYPES,
  DOC_STATUSES,
  ACTIVITY_TYPES,
  FITNESS_RESULTS,
  type DocStatus,
  type FitnessResult,
  type AptidaoFisicaForm,
  type MedicalDocument,
} from '@/lib/docs-types';
import { DocPreviewAptidao } from '@/lib/components/doc-preview-aptidao';

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


interface DocDetail {
  document: MedicalDocument;
  patient: { name: string | null; phone: string; email: string | null; birthdate: string | null } | null;
  doctor: { doctor_name: string; doctor_crm: string; specialty: string; birdid_account_id: string | null } | null;
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

  // Sign modal (OTP-based BirdID)
  const [showSign, setShowSign] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [birdidAccountInput, setBirdidAccountInput] = useState('');
  const [saveAccountId, setSaveAccountId] = useState(true);
  const [signMessage, setSignMessage] = useState('');

  // Edit modal (draft only)
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    activity_type: string;
    result: FitnessResult;
    restrictions: string;
  }>({ activity_type: '', result: 'apto', restrictions: '' });

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

    // Determine BirdID account: saved on doctor or entered now
    const doctorHasAccount = !!data?.doctor?.birdid_account_id;
    const accountId = doctorHasAccount
      ? data!.doctor!.birdid_account_id!
      : birdidAccountInput.trim();

    // Build body for the sign API
    const body: Record<string, unknown> = {};
    if (otpCode.trim()) {
      body.otp = otpCode.trim();
    }
    // If first-time setup, send the account ID to save
    if (!doctorHasAccount && accountId) {
      body.birdid_account_id = accountId;
    }

    try {
      const res = await fetch(`/api/painel/docs/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        if (json.signing_method === 'birdid') {
          setSignMessage(`✅ ${json.message || 'Documento assinado digitalmente via BirdID!'}`);
          setTimeout(() => { fetchDoc(); setShowSign(false); setSignMessage(''); setOtpCode(''); }, 3000);
        } else {
          await fetchDoc();
          setShowSign(false);
          setOtpCode('');
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
  }, [docId, otpCode, birdidAccountInput, data, fetchDoc]);

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

  const openEdit = useCallback(() => {
    if (!data) return;
    const f = data.document.form_data as unknown as AptidaoFisicaForm;
    setEditForm({
      activity_type: f.activity_type || '',
      result: (f.result as FitnessResult) || 'apto',
      restrictions: f.restrictions || '',
    });
    setShowEdit(true);
  }, [data]);

  const handleEdit = useCallback(async () => {
    if (!data) return;
    setActing(true);
    const currentForm = data.document.form_data as unknown as AptidaoFisicaForm;
    const updatedForm: AptidaoFisicaForm = {
      ...currentForm,
      activity_type: editForm.activity_type,
      result: editForm.result,
      restrictions: editForm.result === 'apto_restricoes' ? editForm.restrictions : '',
    };
    try {
      const res = await fetch(`/api/painel/docs/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: updatedForm }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDoc();
        setShowEdit(false);
      } else {
        alert(json.message || 'Erro ao salvar');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, data, editForm, fetchDoc]);

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

  const canEdit = status === 'draft';
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

      {/* ── Preview visual do documento (replica o layout do PDF) ── */}
      {doc.doc_type === 'aptidao_fisica' && form && (
        <DocPreviewAptidao form={form} clinicName={me?.clinic_name ?? undefined} />
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
        {canEdit && (
          <button
            type="button"
            onClick={openEdit}
            disabled={acting}
            className="h-11 px-5 rounded-xl bg-zinc-100 text-zinc-700 text-[14px] font-semibold inline-flex items-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-40"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}
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

      {/* ═══════ Sign Modal (BirdID OTP) — com conferência do documento ═══════ */}
      {showSign && (() => {
        const doctorHasAccount = !!data?.doctor?.birdid_account_id;
        const accountIdReady = doctorHasAccount || birdidAccountInput.trim().length > 0;
        const willUseBirdid = accountIdReady && otpCode.trim().length >= 4;
        return (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-auto flex flex-col max-h-[calc(100vh-2rem)]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
                <h3 className="text-[17px] font-semibold text-zinc-900 flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-zinc-400" />
                  Conferir e assinar
                </h3>
                <button
                  onClick={() => { setShowSign(false); setOtpCode(''); setBirdidAccountInput(''); setSignMessage(''); }}
                  className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-400"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {/* ── 1. Preview visual do documento (mesmo layout do PDF) ── */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500 flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-3 h-3" /> Confira o documento antes de assinar
                  </p>
                  {doc.doc_type === 'aptidao_fisica' && form && (
                    <DocPreviewAptidao form={form} clinicName={me?.clinic_name ?? undefined} compact />
                  )}
                </div>

                {/* ── 2. Assinatura digital BirdID (OTP) ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-violet-600" />
                    <p className="text-[14px] font-medium text-zinc-900">Assinatura digital BirdID</p>
                  </div>

                  {doctorHasAccount ? (
                    /* Doctor already has BirdID configured → show status + OTP input */
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                      <Fingerprint className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-emerald-900">BirdID configurado</p>
                        <p className="text-[12px] text-emerald-700 font-mono">{data!.doctor!.birdid_account_id}</p>
                      </div>
                    </div>
                  ) : (
                    /* First time — need to enter BirdID account ID */
                    <div className="space-y-2">
                      <p className="text-[13px] text-zinc-500">
                        Informe o ID da conta BirdID do profissional para habilitar assinatura digital.
                      </p>
                      <input
                        type="text"
                        value={birdidAccountInput}
                        onChange={(e) => setBirdidAccountInput(e.target.value)}
                        placeholder="BirdID Account ID (ex: c2a217b6e9)"
                        className="w-full h-11 px-4 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border-2 border-zinc-200 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-mono"
                      />
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={saveAccountId}
                          onChange={(e) => setSaveAccountId(e.target.checked)}
                          className="h-4 w-4 accent-violet-600 cursor-pointer"
                        />
                        <span className="text-[13px] text-zinc-600 group-hover:text-zinc-900 transition-colors">
                          Salvar no perfil do profissional
                        </span>
                      </label>
                    </div>
                  )}

                  {/* OTP input — always shown when account is available */}
                  {accountIdReady && (
                    <div className="space-y-2">
                      <p className="text-[13px] text-zinc-600">
                        Digite o codigo OTP que aparece no app BirdID do profissional:
                      </p>
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="Codigo OTP (6 digitos)"
                        autoFocus
                        className="w-full h-14 px-4 bg-white text-center text-[24px] text-zinc-900 placeholder:text-zinc-400 placeholder:text-[16px] rounded-xl border-2 border-zinc-200 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-mono tracking-[0.3em]"
                        inputMode="numeric"
                      />
                      <p className="text-[11px] text-zinc-400">
                        O codigo renova a cada ~30 segundos. Digite o codigo atual do app.
                      </p>
                    </div>
                  )}

                  {/* Option to skip BirdID and sign manually */}
                  {!willUseBirdid && (
                    <div className="flex items-center gap-3 rounded-xl bg-zinc-50 border border-black/[0.06] p-3 mt-2">
                      <AlertTriangle className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                      <p className="text-[12px] text-zinc-500">
                        Sem o codigo OTP, o documento sera assinado manualmente (sem certificado ICP-Brasil).
                      </p>
                    </div>
                  )}
                </div>

                {/* Feedback messages */}
                {signMessage && (
                  <p className={`text-[13px] rounded-lg px-3 py-2.5 ${signMessage.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {signMessage}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex-shrink-0">
                <p className="text-[11px] text-zinc-400">
                  {willUseBirdid ? 'Certificado digital ICP-Brasil' : 'Assinatura manual'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowSign(false); setOtpCode(''); setBirdidAccountInput(''); setSignMessage(''); }}
                    className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-600 hover:bg-black/[0.04] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSign}
                    disabled={acting}
                    className="h-10 px-5 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-40"
                    style={{ background: willUseBirdid ? '#22C55E' : ACCENT_DEEP }}
                  >
                    {acting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : willUseBirdid ? (
                      <Fingerprint className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {acting ? 'Assinando...' : willUseBirdid ? 'Assinar via BirdID' : 'Assinar manualmente'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* ═══════ Edit Modal (draft only) ═══════ */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[18px] font-semibold text-zinc-900">Editar documento</h3>
              <button
                onClick={() => setShowEdit(false)}
                className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-400"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Activity type */}
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-2">Tipo de atividade</label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TYPES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, activity_type: a }))}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                      editForm.activity_type === a
                        ? 'bg-violet-100 text-violet-800 border border-violet-300'
                        : 'bg-zinc-100 text-zinc-600 border border-transparent hover:bg-zinc-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-2">Resultado</label>
              <div className="flex gap-2">
                {FITNESS_RESULTS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, result: r.value as FitnessResult }))}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all text-center ${
                      editForm.result === r.value
                        ? 'bg-violet-100 text-violet-800 border border-violet-300'
                        : 'bg-zinc-100 text-zinc-600 border border-transparent hover:bg-zinc-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Restrictions (conditional) */}
            {editForm.result === 'apto_restricoes' && (
              <div>
                <label className="block text-[13px] font-medium text-zinc-700 mb-2">Restricoes</label>
                <textarea
                  value={editForm.restrictions}
                  onChange={(e) => setEditForm((f) => ({ ...f, restrictions: e.target.value }))}
                  placeholder="Descreva as restricoes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white text-[15px] rounded-lg border border-black/10 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] resize-none"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowEdit(false)}
                className="h-10 px-4 rounded-lg text-[14px] font-medium text-zinc-600 hover:bg-zinc-100 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleEdit} disabled={acting || !editForm.activity_type}
                className="h-10 px-5 rounded-lg text-white text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
                style={{ background: ACCENT_DEEP }}>
                {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Salvar'}
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
            <p className="text-[14px] text-zinc-500">Essa acao nao pode ser desfeita.</p>
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
