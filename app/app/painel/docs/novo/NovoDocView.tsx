'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  Search,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { useMe } from '@/lib/painel-context';
import {
  DOC_TYPES,
  ENABLED_DOC_TYPES,
  type DocTypeKey,
} from '@/lib/docs-types';
import { DOC_TEMPLATES } from '@/lib/docs-templates';
import { DynamicDocForm } from '../_components/DynamicDocForm';
import { DocPreviewMarkdown } from '../_components/DocPreviewMarkdown';

const ACCENT_DEEP = '#5746AF';

interface PatientLite {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  birthdate: string | null;
}

interface DoctorLite {
  id: string; // uuid
  doctor_name: string;
  doctor_crm: string;
  specialty: string;
}

interface ClinicalData {
  cpf: string | null;
}

interface NovoDocViewProps {
  initialPatients: PatientLite[] | null;
  initialDoctors: DoctorLite[] | null;
}

export default function NovoDocView({ initialPatients, initialDoctors }: NovoDocViewProps) {
  const me = useMe();
  const router = useRouter();

  // Wizard step: 1=type, 2=patient, 3=form
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocTypeKey>('aptidao_fisica');

  // Patient selection
  const [patients, setPatients] = useState<PatientLite[]>(initialPatients ?? []);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);

  // Doctor (auto from context). Se Server entregou 1 unico doctor, pre-seleciona.
  const [doctors, setDoctors] = useState<DoctorLite[]>(initialDoctors ?? []);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorLite | null>(
    initialDoctors && initialDoctors.length === 1 ? initialDoctors[0] : null,
  );
  // Pula primeiro mount se Server entregou ambos.
  const firstMount = useRef(initialPatients !== null && initialDoctors !== null);

  // Form genérico — defaults vêm do template, paciente preenche/edita.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, unknown>>(DOC_TEMPLATES[docType].defaults as any);
  const [previewMd, setPreviewMd] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Re-init form quando troca docType (step 1 → 2)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFormData(DOC_TEMPLATES[docType].defaults as any);
    setPreviewMd('');
  }, [docType]);

  // Debounced preview live (350ms)
  useEffect(() => {
    if (step !== 3 || !selectedPatient || !selectedDoctor) return;
    const t = setTimeout(() => {
      setPreviewLoading(true);
      fetch('/api/painel/docs/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctor.id,
          form_data: formData,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.success) setPreviewMd(j.markdown);
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [step, docType, selectedPatient, selectedDoctor, formData]);

  const [saving, setSaving] = useState(false);

  // Load patients + doctors (skip se Server entregou)
  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    if (!me?.tenant_id) return;
    Promise.all([
      fetch('/api/painel/pacientes').then((r) => r.json()),
      fetch('/api/painel/profissionais').then((r) => r.json()),
    ]).then(([pRes, dRes]) => {
      if (pRes.success) setPatients(pRes.patients);
      if (dRes.success) {
        setDoctors(dRes.doctors);
        if (dRes.doctors.length === 1) setSelectedDoctor(dRes.doctors[0]);
      }
    });
  }, [me?.tenant_id]);

  // Load clinical data when patient selected
  useEffect(() => {
    if (!selectedPatient) { setClinical(null); return; }
    fetch(`/api/painel/pacientes/${selectedPatient.id}/clinical`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setClinical(j.clinical); });
  }, [selectedPatient]);

  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    );
  });

  const handleSave = useCallback(async () => {
    if (!selectedPatient || !selectedDoctor) return;

    // Valida required_fields do template
    const tpl = DOC_TEMPLATES[docType];
    const missing = tpl.required_fields.filter((k) => {
      const v = (formData as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) {
      alert(`Campos obrigatórios faltando: ${missing.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/painel/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctor.id,
          doc_type: docType,
          form_data: formData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/painel/docs/${json.document.id}`);
      } else {
        alert(json.message || 'Erro ao criar documento');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }, [selectedPatient, selectedDoctor, formData, docType, router]);

  if (!me?.tenant_id) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => (step > 1 ? setStep(step - 1) : router.push('/painel/docs'))}
        className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {step > 1 ? 'Voltar' : 'Documentos'}
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: s <= step ? ACCENT_DEEP : '#e4e4e7' }}
          />
        ))}
      </div>

      {/* Step 1: Select type */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            Tipo de documento
          </h2>
          <div className="space-y-2">
            {ENABLED_DOC_TYPES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => { setDocType(key); setStep(2); }}
                className="w-full text-left px-5 py-4 rounded-xl border border-black/[0.07] bg-white hover:border-violet-300 hover:bg-violet-50/30 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-zinc-400 group-hover:text-violet-500" />
                  <span className="text-[15px] font-medium text-zinc-900">{DOC_TYPES[key]}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-violet-500" />
              </button>
            ))}
            {/* Disabled types */}
            {(Object.keys(DOC_TYPES) as DocTypeKey[])
              .filter((k) => !ENABLED_DOC_TYPES.includes(k))
              .map((key) => (
                <div
                  key={key}
                  className="w-full px-5 py-4 rounded-xl border border-dashed border-black/[0.07] flex items-center justify-between opacity-50 cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-zinc-300" />
                    <span className="text-[15px] font-medium text-zinc-400">{DOC_TYPES[key]}</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-zinc-400">Em breve</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Step 2: Select patient */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            Selecionar paciente
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-white text-[15px] text-zinc-900 placeholder:text-zinc-400 rounded-lg border border-black/10 hover:border-black/20 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] transition-all"
            />
          </div>
          <div className="rounded-xl border border-black/[0.07] bg-white overflow-hidden max-h-80 overflow-y-auto">
            {filteredPatients.slice(0, 30).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedPatient(p); setStep(3); }}
                className="w-full text-left px-4 py-3 hover:bg-violet-50/30 transition-colors border-b border-black/[0.05] last:border-b-0 flex items-center justify-between"
              >
                <div>
                  <p className="text-[14px] font-semibold text-zinc-900">{p.name ?? 'Sem nome'}</p>
                  <p className="text-[12px] text-zinc-500">{p.phone}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Form dinâmico (5 doc types) + preview live */}
      {step === 3 && selectedPatient && (
        <div className="space-y-6 max-w-none -mx-4 lg:mx-0">
          <div className="px-4 lg:px-0">
            <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900 mb-1">
              {DOC_TYPES[docType]}
            </h2>
            <p className="text-[13px] text-zinc-500">
              Preencha os campos à esquerda. O documento à direita atualiza automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Coluna esquerda: form */}
            <div className="space-y-5 px-4 lg:px-0">
              {/* Patient summary */}
              <div className="rounded-xl bg-zinc-50 p-4 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Paciente</p>
                <p className="text-[15px] font-semibold text-zinc-900">{selectedPatient.name ?? 'Sem nome'}</p>
                <p className="text-[12px] text-zinc-500">
                  {selectedPatient.phone}
                  {clinical?.cpf && ` · CPF: ${clinical.cpf}`}
                </p>
              </div>

              {/* Doctor select (if >1) */}
              {doctors.length > 1 && (
                <div>
                  <label className="block text-[13px] font-medium text-zinc-700 mb-1.5">Profissional responsável</label>
                  <select
                    value={selectedDoctor?.id ?? ''}
                    onChange={(e) => setSelectedDoctor(doctors.find((d) => d.id === e.target.value) ?? null)}
                    className="w-full h-11 px-3 bg-white text-[14px] rounded-lg border border-black/10 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                  >
                    <option value="">Selecionar...</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.doctor_name} — {d.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Form dinâmico vindo do template */}
              <DynamicDocForm
                fields={DOC_TEMPLATES[docType].form_fields}
                value={formData}
                onChange={setFormData}
              />

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedDoctor}
                className="w-full h-12 rounded-xl text-white text-[15px] font-semibold disabled:opacity-40 transition-all hover:brightness-110"
                style={{ background: ACCENT_DEEP }}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Criar documento'}
              </button>
            </div>

            {/* Coluna direita: preview */}
            <div className="lg:sticky lg:top-4 lg:h-fit space-y-2 px-4 lg:px-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.1em] font-semibold text-zinc-500">Pré-visualização</p>
                {previewLoading && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />}
              </div>
              {previewMd ? (
                <div className="max-h-[700px] overflow-y-auto rounded-xl bg-zinc-100/40 p-2">
                  <DocPreviewMarkdown markdown={previewMd} />
                </div>
              ) : (
                <div className="text-[12px] text-zinc-400 text-center py-12 rounded-xl bg-zinc-50 border border-dashed border-zinc-200">
                  Preview aparecerá conforme você preenche.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
