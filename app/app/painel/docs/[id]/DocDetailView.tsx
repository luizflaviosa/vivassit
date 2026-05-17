'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import { useMe } from '@/lib/painel-context';
import {
  DOC_TYPES,
  DOC_STATUSES,
  type DocStatus,
  type AptidaoFisicaForm,
  type MedicalDocument,
} from '@/lib/docs-types';
import { DOC_TEMPLATES, type DocTemplateKey } from '@/lib/docs-templates';
import { DocPreviewAptidao } from '@/lib/components/doc-preview-aptidao';
import { DocPreviewMarkdown } from '../_components/DocPreviewMarkdown';
import { DynamicDocForm } from '../_components/DynamicDocForm';

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

interface DocDetailViewProps {
  docId: string;
  initialData: DocDetail | null;
}

export default function DocDetailView({ docId, initialData }: DocDetailViewProps) {
  const me = useMe();
  const router = useRouter();

  const [data, setData] = useState<DocDetail | null>(initialData);
  const [loading, setLoading] = useState<boolean>(initialData === null);
  const [acting, setActing] = useState(false);
  // Pula primeiro mount se Server entregou. Acoes (sign, edit, etc) podem
  // chamar fetchDoc() pra refresh — comportamento preservado.
  const firstMount = useRef(initialData !== null);

  // Sign modal (OTP-based BirdID)
  const [showSign, setShowSign] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [birdidAccountInput, setBirdidAccountInput] = useState('');
  const [saveAccountId, setSaveAccountId] = useState(true);
  const [signError, setSignError] = useState('');
  const [signingBirdId, setSigningBirdId] = useState(false);
  const [signSuccess, setSignSuccess] = useState<{ method: 'birdid' | 'manual'; tcn?: string } | null>(null);

  // Edit modal (draft only) — universal via DynamicDocForm + preview live.
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editPreviewMd, setEditPreviewMd] = useState<string>('');
  const [editPreviewLoading, setEditPreviewLoading] = useState(false);
  const [editError, setEditError] = useState<string>('');

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
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    if (!me?.tenant_id) return;
    fetchDoc();
  }, [me?.tenant_id, fetchDoc]);

  const handleSign = useCallback(async () => {
    setActing(true);
    setSignError('');

    const doctorHasAccount = !!data?.doctor?.birdid_account_id;
    const accountId = doctorHasAccount
      ? data!.doctor!.birdid_account_id!
      : birdidAccountInput.trim();

    const willUseBirdid = !!accountId && otpCode.trim().length >= 4;

    const body: Record<string, unknown> = {};
    if (otpCode.trim()) body.otp = otpCode.trim();
    if (!doctorHasAccount && accountId) body.birdid_account_id = accountId;

    if (willUseBirdid) setSigningBirdId(true);

    try {
      const res = await fetch(`/api/painel/docs/${docId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        await fetchDoc();
        setSignSuccess({
          method: json.signing_method === 'birdid' ? 'birdid' : 'manual',
          tcn: json.tcn,
        });
      } else {
        setSignError(json.message || 'Erro ao assinar');
      }
    } catch (e) {
      console.error(e);
      setSignError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setActing(false);
      setSigningBirdId(false);
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
    setEditData({ ...(data.document.form_data as Record<string, unknown>) });
    setEditPreviewMd('');
    setEditError('');
    setShowEdit(true);
  }, [data]);

  // Preview live durante edição — debounce 350ms.
  useEffect(() => {
    if (!showEdit || !data) return;
    const t = setTimeout(() => {
      setEditPreviewLoading(true);
      fetch('/api/painel/docs/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: data.document.doc_type,
          patient_id: data.document.patient_id,
          doctor_id: data.document.doctor_id,
          form_data: editData,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setEditPreviewMd(j.markdown);
        })
        .catch(() => {})
        .finally(() => setEditPreviewLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [showEdit, editData, data]);

  const handleEdit = useCallback(async () => {
    if (!data) return;
    setEditError('');

    const tpl = DOC_TEMPLATES[data.document.doc_type as DocTemplateKey];
    if (tpl) {
      const missing = tpl.required_fields.filter((k) => {
        const v = editData[k];
        if (Array.isArray(v)) return v.length === 0;
        return v === undefined || v === null || v === '';
      });
      if (missing.length > 0) {
        setEditError(`Campos obrigatórios faltando: ${missing.join(', ')}`);
        return;
      }
    }

    setActing(true);
    try {
      const res = await fetch(`/api/painel/docs/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: editData }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDoc();
        setShowEdit(false);
      } else {
        setEditError(json.message || 'Erro ao salvar');
      }
    } catch (e) {
      console.error(e);
      setEditError('Erro de conexão');
    } finally {
      setActing(false);
    }
  }, [docId, data, editData, fetchDoc]);

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
  const editTemplate = DOC_TEMPLATES[doc.doc_type as DocTemplateKey];
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
      {doc.doc_type !== 'aptidao_fisica' && (
        <UniversalPreview
          docType={doc.doc_type}
          patientId={doc.patient_id}
          doctorId={doc.doctor_id}
          formData={doc.form_data as Record<string, unknown>}
        />
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

      {/* ═══════ Sign Modal (BirdID OTP) ═══════ */}
      {showSign && (() => {
        const doctorHasAccount = !!data?.doctor?.birdid_account_id;
        const accountIdReady = doctorHasAccount || birdidAccountInput.trim().length > 0;
        const willUseBirdid = accountIdReady && otpCode.trim().length >= 4;

        return (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 overflow-y-auto">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full my-auto flex flex-col max-h-[calc(100vh-2rem)]">

              {/* Loading overlay (BirdID signing in progress) */}
              {signingBirdId && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm gap-4">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" />
                    <Fingerprint className="absolute inset-0 m-auto w-7 h-7 text-violet-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-[15px] font-semibold text-zinc-900">Assinando com BirdID…</p>
                    <p className="text-[13px] text-zinc-500 mt-1">Aguarde, enviando para certificação ICP-Brasil</p>
                  </div>
                </div>
              )}

              {/* ── Success screen ── */}
              {signSuccess && (
                <div className="flex flex-col items-center justify-center px-8 py-12 text-center gap-5">
                  <div className={`h-20 w-20 rounded-full flex items-center justify-center ${signSuccess.method === 'birdid' ? 'bg-emerald-100' : 'bg-violet-100'}`}>
                    {signSuccess.method === 'birdid'
                      ? <Fingerprint className="w-10 h-10 text-emerald-600" />
                      : <CheckCircle2 className="w-10 h-10 text-violet-600" />
                    }
                  </div>
                  <div>
                    <p className="text-[20px] font-semibold text-zinc-900">
                      {signSuccess.method === 'birdid' ? 'Assinado com ICP-Brasil' : 'Documento assinado'}
                    </p>
                    <p className="text-[14px] text-zinc-500 mt-1">
                      {signSuccess.method === 'birdid'
                        ? 'Assinatura digital certificada via BirdID.'
                        : 'Assinatura manual registrada com sucesso.'}
                    </p>
                    {signSuccess.tcn && (
                      <p className="text-[11px] font-mono text-zinc-400 mt-3 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 break-all">
                        TCN: {signSuccess.tcn}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => { setShowSign(false); setOtpCode(''); setBirdidAccountInput(''); setSignError(''); setSignSuccess(null); }}
                      className="h-11 px-6 rounded-xl bg-zinc-100 text-zinc-700 text-[14px] font-semibold hover:bg-zinc-200 transition-colors"
                    >
                      Fechar
                    </button>
                    <a
                      href={`/api/painel/docs/${docId}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 px-6 rounded-xl text-white text-[14px] font-semibold inline-flex items-center gap-2 hover:brightness-110 transition-all"
                      style={{ background: ACCENT_DEEP }}
                    >
                      <Download className="w-4 h-4" /> Baixar PDF
                    </a>
                  </div>
                </div>
              )}

              {/* Header (hidden when success) */}
              {!signSuccess && <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
                <h3 className="text-[17px] font-semibold text-zinc-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  Conferir e assinar
                </h3>
                <button
                  onClick={() => { setShowSign(false); setOtpCode(''); setBirdidAccountInput(''); setSignError(''); setSignSuccess(null); }}
                  disabled={acting}
                  className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-400 disabled:opacity-40"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>}

              {/* Scrollable body (hidden when success) */}
              {!signSuccess && <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* 1. Document preview */}
                <div>
                  <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-400 flex items-center gap-1.5 mb-2.5">
                    <ShieldCheck className="w-3 h-3" /> Confira antes de assinar
                  </p>
                  {doc.doc_type === 'aptidao_fisica' && form && (
                    <DocPreviewAptidao form={form} clinicName={me?.clinic_name ?? undefined} compact />
                  )}
                  {doc.doc_type !== 'aptidao_fisica' && (
                    <div className="max-h-[480px] overflow-y-auto rounded-lg bg-zinc-50 p-2">
                      <UniversalPreview
                        docType={doc.doc_type}
                        patientId={doc.patient_id}
                        doctorId={doc.doctor_id}
                        formData={doc.form_data as Record<string, unknown>}
                      />
                    </div>
                  )}
                </div>

                {/* 2. BirdID section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-violet-600" />
                    <p className="text-[14px] font-semibold text-zinc-900">Assinatura digital BirdID</p>
                  </div>

                  {doctorHasAccount ? (
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-emerald-900">BirdID configurado</p>
                        <p className="text-[12px] text-emerald-700 font-mono mt-0.5">{data!.doctor!.birdid_account_id}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-[13px] text-zinc-500 leading-relaxed">
                        Informe o <strong className="text-zinc-700">CPF</strong> do profissional cadastrado no BirdID para habilitar a assinatura digital ICP-Brasil.
                      </p>
                      <input
                        type="text"
                        value={birdidAccountInput}
                        onChange={(e) => setBirdidAccountInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="CPF do profissional (11 dígitos)"
                        className="w-full h-11 px-4 bg-white text-[14px] text-zinc-900 placeholder:text-zinc-400 rounded-xl border-2 border-zinc-200 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-mono tracking-widest"
                        inputMode="numeric"
                      />
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={saveAccountId}
                          onChange={(e) => setSaveAccountId(e.target.checked)}
                          className="h-4 w-4 accent-violet-600 cursor-pointer rounded"
                        />
                        <span className="text-[13px] text-zinc-500 group-hover:text-zinc-800 transition-colors">
                          Salvar no perfil do profissional
                        </span>
                      </label>
                    </div>
                  )}

                  {/* OTP input */}
                  {accountIdReady && (
                    <div className="space-y-2">
                      <p className="text-[13px] text-zinc-600">
                        Código OTP do app BirdID:
                      </p>
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setSignError(''); }}
                        placeholder="000000"
                        autoFocus={doctorHasAccount}
                        disabled={acting}
                        className="w-full h-16 px-4 bg-zinc-50 text-center text-[28px] text-zinc-900 placeholder:text-zinc-300 placeholder:text-[22px] rounded-xl border-2 border-zinc-200 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-mono tracking-[0.35em] disabled:opacity-50"
                        inputMode="numeric"
                      />
                      <p className="text-[11px] text-zinc-400 text-center">
                        Renova a cada ~30 segundos no app BirdID
                      </p>
                    </div>
                  )}

                  {/* Manual sign notice */}
                  {!willUseBirdid && (
                    <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200/80 px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-800 leading-relaxed">
                        Sem o código OTP, o documento será assinado <strong>manualmente</strong> — sem certificado ICP-Brasil.
                      </p>
                    </div>
                  )}

                  {/* Error */}
                  {signError && (
                    <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[13px] text-red-700 leading-relaxed">{signError}</p>
                    </div>
                  )}
                </div>
              </div>}

              {/* Footer (hidden when success) */}
              {!signSuccess && <div className="flex items-center justify-between gap-3 px-6 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex-shrink-0">
                <p className="text-[11px] text-zinc-400">
                  {willUseBirdid ? '🔐 Certificado ICP-Brasil' : 'Assinatura manual'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowSign(false); setOtpCode(''); setBirdidAccountInput(''); setSignError(''); setSignSuccess(null); }}
                    disabled={acting}
                    className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-600 hover:bg-black/[0.04] transition-colors disabled:opacity-40"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSign}
                    disabled={acting}
                    className="h-10 px-5 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
                    style={{ background: willUseBirdid ? '#7C3AED' : ACCENT_DEEP }}
                  >
                    {acting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : willUseBirdid ? (
                      <Fingerprint className="w-4 h-4" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {acting ? 'Assinando…' : willUseBirdid ? 'Assinar com BirdID' : 'Assinar manualmente'}
                  </button>
                </div>
              </div>}
            </div>
          </div>
        );
      })()}

      {/* ═══════ Send Channel Modal ═══════ */}
      {showSend && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 my-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 my-auto">
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

      {/* ═══════ Edit Modal (draft only) — universal via DynamicDocForm ═══════ */}
      {showEdit && editTemplate && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full my-auto flex flex-col max-h-[calc(100vh-2rem)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] flex-shrink-0">
              <div>
                <h3 className="text-[17px] font-semibold text-zinc-900 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-zinc-400" /> Editar {DOC_TYPES[doc.doc_type]}
                </h3>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Preencha à esquerda. O documento à direita atualiza automaticamente.
                </p>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="h-8 w-8 -mr-2 rounded-md hover:bg-black/[0.04] inline-flex items-center justify-center text-zinc-400"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Body: 2-column layout */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-black/[0.06]">
                {/* Left: form */}
                <div className="px-6 py-5 space-y-5">
                  <DynamicDocForm
                    fields={editTemplate.form_fields}
                    value={editData}
                    onChange={setEditData}
                  />
                </div>

                {/* Right: preview live */}
                <div className="px-6 py-5 bg-zinc-50/40 space-y-2 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">
                      Pré-visualização
                    </p>
                    {editPreviewLoading && (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                    )}
                  </div>
                  {editPreviewMd ? (
                    <div className="rounded-xl bg-white border border-black/[0.05] p-2">
                      <DocPreviewMarkdown markdown={editPreviewMd} />
                    </div>
                  ) : (
                    <div className="text-[12px] text-zinc-400 text-center py-12 rounded-xl bg-white border border-dashed border-zinc-200">
                      Preview aparecerá conforme você edita.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 bg-zinc-50/60 border-t border-black/[0.06] flex-shrink-0">
              <div className="flex-1 min-w-0">
                {editError && (
                  <p className="text-[12px] text-red-600 truncate">{editError}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="h-10 px-4 rounded-lg text-[13px] font-semibold text-zinc-600 hover:bg-black/[0.04] transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleEdit} disabled={acting}
                  className="h-10 px-5 rounded-lg text-white text-[13px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
                  style={{ background: ACCENT_DEEP }}>
                  {acting ? <Loader2 className="w-4 h-4 animate-spin mx-2" /> : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Cancel Confirm ═══════ */}
      {showCancel && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex min-h-full items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 my-auto">
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

// ─────────────────────────────────────────────────────────────
// UniversalPreview — fetch markdown via /api/painel/docs/render-preview
// e renderiza via DocPreviewMarkdown. Usado pros 4 tipos novos (não-aptidão).
// ─────────────────────────────────────────────────────────────

function UniversalPreview({
  docType,
  patientId,
  doctorId,
  formData,
}: {
  docType: string;
  patientId: number;
  doctorId: string | null;
  formData: Record<string, unknown>;
}) {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/painel/docs/render-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_type: docType,
        patient_id: patientId,
        doctor_id: doctorId,
        form_data: formData,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setMarkdown(j.markdown);
        else setErr(j.message ?? 'Erro ao gerar preview');
      })
      .catch((e) => !cancelled && setErr(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [docType, patientId, doctorId, formData]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400 text-[13px]">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Renderizando preview...
      </div>
    );
  if (err)
    return (
      <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{err}</div>
    );
  return <DocPreviewMarkdown markdown={markdown} />;
}
