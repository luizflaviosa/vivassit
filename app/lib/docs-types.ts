// app/lib/docs-types.ts

// ──────────────────────────────────────────────────────────────
// Document types and statuses
// ──────────────────────────────────────────────────────────────

export const DOC_TYPES = {
  aptidao_fisica: 'Atestado de Aptidão Física',
  tiss_guia: 'Guia TISS',
  afastamento_inss: 'Relatório Afastamento INSS',
  lme_alto_custo: 'LME — Alto Custo',
  vacina_prioritaria: 'Relatório Vacina Prioritária',
} as const;

export type DocTypeKey = keyof typeof DOC_TYPES;

// MVP: only aptidao_fisica is enabled
export const ENABLED_DOC_TYPES: DocTypeKey[] = ['aptidao_fisica'];

export const DOC_STATUSES = {
  draft: { label: 'Rascunho', color: '#71717A' },       // zinc-500
  pending: { label: 'Aguardando assinatura', color: '#F59E0B' }, // amber-500
  signed: { label: 'Assinado', color: '#22C55E' },      // green-500
  rejected: { label: 'Rejeitado', color: '#EF4444' },   // red-500
  sent: { label: 'Enviado', color: '#6E56CF' },         // accent
  cancelled: { label: 'Cancelado', color: '#A1A1AA' },  // zinc-400
} as const;

export type DocStatus = keyof typeof DOC_STATUSES;

// ──────────────────────────────────────────────────────────────
// Aptidão Física form schema
// ──────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  'Musculação',
  'Corrida',
  'Natação',
  'Esporte coletivo',
  'Artes marciais',
  'Crossfit',
  'Pilates',
  'Yoga',
  'Ciclismo',
  'Outro',
] as const;

export const FITNESS_RESULTS = [
  { value: 'apto', label: 'Apto' },
  { value: 'inapto', label: 'Inapto' },
  { value: 'apto_restricoes', label: 'Apto com restrições' },
] as const;

export type FitnessResult = 'apto' | 'inapto' | 'apto_restricoes';

export interface AptidaoFisicaForm {
  // Pre-filled from patient
  patient_name: string;
  patient_cpf: string;
  patient_birthdate: string;

  // Clinical input
  activity_type: string;
  result: FitnessResult;
  restrictions: string; // visible only when result = 'apto_restricoes'

  // Automatic
  validity_date: string;      // +12 months from issue date
  professional_name: string;
  professional_council: string; // CRM/CRO/etc
  issue_date: string;          // now()
}

// ──────────────────────────────────────────────────────────────
// Database row types
// ──────────────────────────────────────────────────────────────

export interface PatientClinicalData {
  id: number;
  tenant_id: string;
  patient_id: number;
  cpf: string | null;
  cns: string | null;
  mother_name: string | null;
  address: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  blood_type: string | null;
  allergies: string[] | null;
  insurance_provider: string | null;
  insurance_card_number: string | null;
  primary_cid: string | null;
  conditions: Array<{ cid: string; description: string; since: string; status: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; since: string }>;
  collected_by: 'agent' | 'manual' | 'form';
  updated_at: string;
  created_at: string;
}

export interface MedicalDocument {
  id: number;
  tenant_id: string;
  patient_id: number;
  doctor_id: number | null;
  created_by_user: string | null;
  signed_by_user: string | null;
  doc_type: DocTypeKey;
  status: DocStatus;
  form_data: Record<string, unknown>;
  rejection_note: string | null;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  signed_at: string | null;
  submitted_at: string | null;
  sent_to_patient_at: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// Lookup types (for API responses)
// ──────────────────────────────────────────────────────────────

export interface CID10Entry {
  code: string;
  name: string;
  name_short: string | null;
  chapter: string | null;
}

export interface TUSSEntry {
  code: string;
  name: string;
  table_number: number | null;
}
