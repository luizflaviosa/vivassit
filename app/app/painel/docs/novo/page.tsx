'use client';

import { useEffect, useState, useCallback } from 'react';
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
  ACTIVITY_TYPES,
  FITNESS_RESULTS,
  type DocTypeKey,
  type FitnessResult,
  type AptidaoFisicaForm,
} from '@/lib/docs-types';

const ACCENT_DEEP = '#5746AF';

interface PatientLite {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  birthdate: string | null;
}

interface DoctorLite {
  id: number;
  doctor_name: string;
  doctor_crm: string;
  specialty: string;
}

interface ClinicalData {
  cpf: string | null;
}

export default function NovoDocPage() {
  const me = useMe();
  const router = useRouter();

  // Wizard step: 1=type, 2=patient, 3=form
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocTypeKey>('aptidao_fisica');

  // Patient selection
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(null);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);

  // Doctor (auto from context)
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorLite | null>(null);

  // Aptidão Física form
  const [activityType, setActivityType] = useState('');
  const [result, setResult] = useState<FitnessResult>('apto');
  const [restrictions, setRestrictions] = useState('');

  const [saving, setSaving] = useState(false);

  // Load patients + doctors
  useEffect(() => {
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
    if (!selectedPatient || !selectedDoctor || !activityType) return;
    setSaving(true);

    const now = new Date();
    const validityDate = new Date(now);
    validityDate.setFullYear(validityDate.getFullYear() + 1);

    const formData: AptidaoFisicaForm = {
      patient_name: selectedPatient.name ?? 'Sem nome',
      patient_cpf: clinical?.cpf ?? '',
      patient_birthdate: selectedPatient.birthdate ?? '',
      activity_type: activityType,
      result,
      restrictions: result === 'apto_restricoes' ? restrictions : '',
      validity_date: validityDate.toISOString(),
      professional_name: selectedDoctor.doctor_name,
      professional_council: selectedDoctor.doctor_crm,
      issue_date: now.toISOString(),
    };

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
  }, [selectedPatient, selectedDoctor, activityType, result, restrictions, clinical, docType, router]);

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

      {/* Step 3: Form (Aptidão Física) */}
      {step === 3 && selectedPatient && (
        <div className="space-y-6">
          <h2 className="text-[22px] font-medium tracking-[-0.02em] text-zinc-900">
            {DOC_TYPES[docType]}
          </h2>

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
              <label className="block text-[13px] font-medium text-zinc-700 mb-2">Profissional responsável</label>
              <select
                value={selectedDoctor?.id ?? ''}
                onChange={(e) => setSelectedDoctor(doctors.find((d) => d.id === parseInt(e.target.value)) ?? null)}
                className="w-full h-11 px-3 bg-white text-[15px] rounded-lg border border-black/10 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06]"
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

          {/* Activity type */}
          <div>
            <label className="block text-[13px] font-medium text-zinc-700 mb-2">Tipo de atividade</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActivityType(a)}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                    activityType === a
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
                  onClick={() => setResult(r.value as FitnessResult)}
                  className={`flex-1 px-4 py-3 rounded-lg text-[13px] font-medium transition-all text-center ${
                    result === r.value
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
          {result === 'apto_restricoes' && (
            <div>
              <label className="block text-[13px] font-medium text-zinc-700 mb-2">Restrições</label>
              <textarea
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                placeholder="Descreva as restrições..."
                rows={3}
                className="w-full px-4 py-3 bg-white text-[15px] rounded-lg border border-black/10 focus:outline-none focus:ring-4 focus:ring-zinc-900/[0.06] resize-none"
              />
            </div>
          )}

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !activityType || !selectedDoctor}
            className="w-full h-12 rounded-xl text-white text-[15px] font-semibold disabled:opacity-40 transition-all hover:brightness-110"
            style={{ background: ACCENT_DEEP }}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Criar documento'}
          </button>
        </div>
      )}
    </div>
  );
}
