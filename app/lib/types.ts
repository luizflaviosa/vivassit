
export interface OnboardingData {
  real_phone: string;
  clinic_name: string;
  admin_email: string;
  doctor_name: string;
  doctor_crm: string;
  speciality: string;
  consultation_duration: string;
  establishment_type: string;
  plan_type: string;
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

export const ESTABLISHMENT_TYPES = {
  small_clinic: 'Clínica Pequena',
  medium_clinic: 'Clínica Média',
  large_clinic: 'Clínica Grande',
  hospital: 'Hospital',
  private_practice: 'Consultório Particular'
} as const;

export const PLAN_TYPES = {
  basic: 'Básico',
  professional: 'Profissional',
  premium: 'Premium',
  enterprise: 'Corporativo'
} as const;

export const SPECIALITIES = [
  'cardiologia',
  'dermatologia',
  'endocrinologia',
  'gastroenterologia',
  'ginecologia',
  'neurologia',
  'oftalmologia',
  'ortopedia',
  'pediatria',
  'pneumologia',
  'psiquiatria',
  'urologia',
  'outras'
] as const;
