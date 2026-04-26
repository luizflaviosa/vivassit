// ──────────────────────────────────────────────────────────────────────────────
// Multi-profissional: tipos de profissional + conselho
// ──────────────────────────────────────────────────────────────────────────────

export const PROFESSIONAL_TYPES = {
  dentista: 'Dentista',
  fisioterapeuta: 'Fisioterapeuta',
  fonoaudiologo: 'Fonoaudiólogo',
  medico: 'Médico',
  nutricionista: 'Nutricionista',
  psicanalista: 'Psicanalista',
  psicologo: 'Psicólogo',
  terapeuta: 'Terapeuta',
  enfermeiro: 'Enfermeiro',
  psicopedagogo: 'Psicopedagogo',
  saude_estetica: 'Saúde Estética',
  outro: 'Outro',
} as const;

export type ProfessionalTypeKey = keyof typeof PROFESSIONAL_TYPES;

// Conselho profissional por tipo
export const COUNCIL_BY_PROFESSIONAL: Record<ProfessionalTypeKey, { label: string; placeholder: string }> = {
  dentista:        { label: 'CRO',     placeholder: 'CRO/SP 12345' },
  fisioterapeuta:  { label: 'CREFITO', placeholder: 'CREFITO 12345-F' },
  fonoaudiologo:   { label: 'CFFa',    placeholder: 'CFFa 1-12345' },
  medico:          { label: 'CRM',     placeholder: 'CRM/SP 123456' },
  nutricionista:   { label: 'CRN',     placeholder: 'CRN-3 12345' },
  psicanalista:    { label: 'Registro', placeholder: 'Registro profissional' },
  psicologo:       { label: 'CRP',     placeholder: 'CRP 06/12345' },
  terapeuta:       { label: 'Registro', placeholder: 'Registro profissional' },
  enfermeiro:      { label: 'COREN',   placeholder: 'COREN-SP 123456' },
  psicopedagogo:   { label: 'ABPP',    placeholder: 'ABPP 1234' },
  saude_estetica:  { label: 'Registro', placeholder: 'Registro profissional (se houver)' },
  outro:           { label: 'Registro', placeholder: 'Registro profissional (opcional)' },
};

// Especialidades por profissional (sample list — agente IA aceita "outro" via free-text)
export const SPECIALTIES_BY_PROFESSIONAL: Record<ProfessionalTypeKey, string[]> = {
  dentista: ['Clínico geral', 'Ortodontia', 'Endodontia', 'Implantodontia', 'Periodontia', 'Odontopediatria', 'Estética', 'Outro'],
  fisioterapeuta: ['Ortopédica', 'Neurológica', 'Respiratória', 'Esportiva', 'Pélvica', 'RPG', 'Pilates', 'Outro'],
  fonoaudiologo: ['Linguagem', 'Voz', 'Audiologia', 'Motricidade orofacial', 'Disfagia', 'Outro'],
  medico: ['Cardiologia', 'Dermatologia', 'Endocrinologia', 'Gastroenterologia', 'Ginecologia', 'Neurologia', 'Oftalmologia', 'Ortopedia', 'Pediatria', 'Pneumologia', 'Psiquiatria', 'Reumatologia', 'Urologia', 'Outro'],
  nutricionista: ['Clínica', 'Esportiva', 'Materno-infantil', 'Estética', 'Comportamental', 'Outro'],
  psicanalista: ['Adulto', 'Infantil', 'Casal', 'Grupo', 'Outro'],
  psicologo: ['Clínica', 'Cognitivo-comportamental', 'Psicanalítica', 'Infantil', 'Casal', 'Organizacional', 'Outro'],
  terapeuta: ['Holística', 'Floral', 'Reiki', 'Terapia ocupacional', 'Outro'],
  enfermeiro: ['Home care', 'Curativos', 'Aplicação de medicação', 'Outro'],
  psicopedagogo: ['Clínica', 'Institucional', 'Outro'],
  saude_estetica: ['Procedimentos faciais', 'Procedimentos corporais', 'Depilação', 'Massagem', 'Outro'],
  outro: ['Outro'],
};

// ──────────────────────────────────────────────────────────────────────────────
// Estabelecimento
// ──────────────────────────────────────────────────────────────────────────────

// 3 opcoes da UI mapeadas para os enums existentes do banco (compatibilidade)
export const ESTABLISHMENT_SIZES = {
  private_practice: { label: 'Consultório particular', desc: '1 profissional', icon: 'user' },
  small_clinic: { label: 'Clínica até 5', desc: '2 a 5 profissionais', icon: 'building' },
  large_clinic: { label: 'Clínica grande', desc: '+5 profissionais', icon: 'buildings' },
} as const;

export type EstablishmentSizeKey = keyof typeof ESTABLISHMENT_SIZES;

// chatwoot: 1 prof = compartilhado na conta singulare; clinicas = dedicada
export function chatwootTypeFor(size: EstablishmentSizeKey): 'shared' | 'dedicated' {
  return size === 'private_practice' ? 'shared' : 'dedicated';
}

// Manter retrocompatibilidade
export const ESTABLISHMENT_TYPES = {
  small_clinic: 'Clínica até 5 profissionais',
  medium_clinic: 'Clínica média',
  large_clinic: 'Clínica grande (+5)',
  hospital: 'Hospital',
  private_practice: 'Consultório particular (1 profissional)',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Planos SaaS Vivassit
// ──────────────────────────────────────────────────────────────────────────────

export const PLAN_TYPES = {
  basic: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
  enterprise_plus: 'Clínica +5 profissionais',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Cobranca: metodos aceitos + timing
// ──────────────────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS_ACCEPTED = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  boleto: 'Boleto',
  cash: 'Dinheiro em espécie',
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHODS_ACCEPTED;

export const CHARGE_TIMING = {
  before: 'Cobrar antes da consulta',
  after: 'Receber após a consulta',
  optional: 'Paciente escolhe',
} as const;

export type ChargeTimingKey = keyof typeof CHARGE_TIMING;

export const PARTIAL_CHARGE_OPTIONS = [
  { value: 30, label: '30% antes (sinal)' },
  { value: 50, label: '50% antes (meia entrada)' },
  { value: 100, label: '100% antes (pagamento integral)' },
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Convenios: top 12 + free text
// ──────────────────────────────────────────────────────────────────────────────

export const COMMON_INSURANCES = [
  'Unimed',
  'Bradesco Saúde',
  'SulAmérica',
  'Amil',
  'Hapvida',
  'NotreDame Intermédica',
  'Porto Saúde',
  'Allianz Saúde',
  'Care Plus',
  'GreenLine',
  'Prevent Senior',
  'Cassi',
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Specialities legadas (mantida pra compatibilidade — nao usar mais)
// ──────────────────────────────────────────────────────────────────────────────

export const SPECIALITIES = [
  'cardiologia', 'dermatologia', 'endocrinologia', 'gastroenterologia',
  'ginecologia', 'neurologia', 'oftalmologia', 'ortopedia', 'pediatria',
  'pneumologia', 'psiquiatria', 'urologia', 'outras',
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Onboarding form data
// ──────────────────────────────────────────────────────────────────────────────

export interface DoctorEntry {
  doctor_name: string;
  doctor_crm: string; // pode ser CRO/CREFITO/etc
  professional_type: ProfessionalTypeKey;
  specialty: string;
  consultation_value?: number;
  consultation_duration?: number;
  payment_methods?: PaymentMethodKey[];
  working_hours?: Record<string, string>; // { seg: "08:00-18:00", ... }
  accepts_insurance?: boolean;
  insurance_list?: string[];
  is_primary?: boolean;
}

export interface OnboardingData {
  // identificacao do tipo
  professional_type: ProfessionalTypeKey;
  establishment_size: EstablishmentSizeKey;

  // profissional principal (sempre coletado)
  doctor_name: string;
  doctor_crm: string;
  speciality: string;

  // clinica
  clinic_name: string;
  admin_email: string;
  real_phone: string;

  // atendimento (obrigatorio se 1 prof, opcional se clinica)
  consultation_value?: string;
  consultation_duration: string;
  payment_methods?: PaymentMethodKey[];
  charge_timing?: ChargeTimingKey;
  partial_charge_pct?: number; // 30, 50 ou 100
  accepts_insurance?: boolean;
  insurance_list?: string[];
  followup_window_days?: number;
  working_hours?: Record<string, string>;
  auto_emit_nf?: boolean;
  accountant_email?: string;

  // IA
  assistant_prompt?: string;

  // multi-prof (clinica)
  additional_doctors?: DoctorEntry[];

  // LGPD
  lgpd_accepted?: boolean;
  lgpd_accepted_at?: string;

  // legado
  establishment_type: string;
  plan_type: string;
  qualifications?: string[];
  timestamp?: string;
  source?: string;
  user_timezone?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// API
// ──────────────────────────────────────────────────────────────────────────────

export interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    tenant_id: string;
    clinic_name: string;
    doctor_name: string;
    status: string;
    external_reference?: string;
    order_id?: number;
    checkout_url?: string;
  };
  missing_fields?: string[];
  error_code?: string;
}

export interface ValueBlock {
  icon: string;
  title: string;
  description: string;
}

export interface QualificationOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  fields: string[];
}
