'use client';

// HTML preview of the Aptidão Física document, visually matching the PDF layout.
// Used in the doc detail page and in the sign confirmation modal.

import type { AptidaoFisicaForm } from '@/lib/docs-types';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function resultLabel(r: string): string {
  switch (r) {
    case 'apto': return 'APTO';
    case 'inapto': return 'INAPTO';
    case 'apto_restricoes': return 'APTO COM RESTRIÇÕES';
    default: return r.toUpperCase();
  }
}

function resultColor(r: string): string {
  switch (r) {
    case 'apto': return '#16a34a';
    case 'inapto': return '#dc2626';
    case 'apto_restricoes': return '#d97706';
    default: return '#333';
  }
}

interface Props {
  form: AptidaoFisicaForm;
  clinicName?: string;
  /** Compact mode for inside modals */
  compact?: boolean;
}

export function DocPreviewAptidao({ form, clinicName, compact = false }: Props) {
  const pad = compact ? 'px-5 py-4' : 'px-8 py-6';
  const scale = compact ? 'scale-[0.92] origin-top' : '';

  return (
    <div className={`bg-white border border-black/[0.10] rounded-xl shadow-sm overflow-hidden ${scale}`}>
      {/* A4-like document body */}
      <div className={`${pad} space-y-0`} style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
        {/* Header */}
        <div className="text-center space-y-1 pb-4">
          {clinicName && (
            <p className="text-[13px] font-bold text-zinc-800 tracking-wide uppercase">
              {clinicName}
            </p>
          )}
          <h2 className="text-[17px] font-bold text-zinc-900 tracking-tight">
            ATESTADO DE APTIDÃO FÍSICA
          </h2>
          <p className="text-[11px] text-zinc-500">Para prática de atividade física</p>
        </div>

        <hr className="border-zinc-200" />

        {/* Patient data */}
        <div className="py-3 space-y-1.5">
          <Row label="Paciente" value={form.patient_name} />
          <Row label="CPF" value={form.patient_cpf || '—'} mono />
          <Row label="Data de Nascimento" value={form.patient_birthdate ? fmtDate(form.patient_birthdate) : '—'} />
          <Row label="Atividade" value={form.activity_type} />
        </div>

        <hr className="border-zinc-200" />

        {/* Result box */}
        <div
          className="my-4 py-4 border rounded-md text-center"
          style={{ borderColor: resultColor(form.result) + '44', backgroundColor: resultColor(form.result) + '08' }}
        >
          <p className="text-[18px] font-black tracking-wide" style={{ color: resultColor(form.result) }}>
            {resultLabel(form.result)}
          </p>
        </div>

        {/* Restrictions */}
        {form.result === 'apto_restricoes' && form.restrictions && (
          <div className="pb-3">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Restrições</p>
            <p className="text-[13px] text-zinc-800 leading-relaxed">{form.restrictions}</p>
          </div>
        )}

        <hr className="border-zinc-200" />

        {/* Dates */}
        <div className="py-3 space-y-1.5">
          <Row label="Data de emissão" value={fmtDate(form.issue_date)} />
          <Row label="Válido até" value={fmtDate(form.validity_date)} />
        </div>

        {/* Signature */}
        <div className="pt-8 pb-2 text-center">
          <div className="mx-auto w-64 border-t border-zinc-400 pt-2">
            <p className="text-[13px] font-bold text-zinc-900">{form.professional_name}</p>
            <p className="text-[11px] text-zinc-500">{form.professional_council}</p>
          </div>
          <p className="text-[9px] text-zinc-400 mt-4">
            Este documento tem validade de 12 meses a partir da data de emissão.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider w-36 flex-shrink-0 pt-0.5">
        {label}:
      </span>
      <span className={`text-[13px] text-zinc-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}
