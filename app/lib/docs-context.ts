// Monta o TemplateContext (profissional + paciente + clínica) a partir do DB.
// Único helper que precisa saber sobre tabelas. Templates só consomem o context.

import { supabaseAdmin } from './supabase';
import type { TemplateContext, ProfessionalSnapshot, PatientSnapshot, ClinicSnapshot } from './docs-templates';

interface BuildContextParams {
  tenantId: string;
  patientId: number;
  doctorId: string | null;
  issueDate?: string; // ISO; default = now
  city?: string;       // ex: extraido do endereço da clínica
}

export async function buildTemplateContext({
  tenantId,
  patientId,
  doctorId,
  issueDate,
  city,
}: BuildContextParams): Promise<TemplateContext | null> {
  const sb = supabaseAdmin();

  const [tenantRow, patientRow, clinicalRow, doctorRow] = await Promise.all([
    sb.from('tenants').select('tenant_id, clinic_name, address, phone, email, cnpj').eq('tenant_id', tenantId).maybeSingle(),
    sb.from('patients').select('id, name, phone, birthdate, email').eq('tenant_id', tenantId).eq('id', patientId).maybeSingle(),
    sb.from('patient_clinical_data').select('cpf, cns, address, insurance_provider, insurance_card_number').eq('tenant_id', tenantId).eq('patient_id', patientId).maybeSingle(),
    doctorId
      ? sb.from('tenant_doctors').select('id, doctor_name, specialty, council, council_uf, council_number, rqe, contact_email, contact_phone, address').eq('tenant_id', tenantId).eq('id', doctorId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!tenantRow.data || !patientRow.data) return null;

  const tenant = tenantRow.data as any;
  const patient = patientRow.data as any;
  const clinical = (clinicalRow.data ?? {}) as any;
  const doctor = doctorRow.data as any;

  const professional: ProfessionalSnapshot = doctor
    ? {
        name: doctor.doctor_name ?? '',
        council: doctor.council ?? 'CRM',
        council_uf: doctor.council_uf ?? '',
        council_number: doctor.council_number ?? '',
        specialty: doctor.specialty ?? '',
        rqe: doctor.rqe ?? null,
        email: doctor.contact_email ?? null,
        phone: doctor.contact_phone ?? null,
        address: doctor.address ?? tenant.address ?? null,
      }
    : {
        name: '',
        council: 'CRM',
        council_uf: '',
        council_number: '',
        specialty: '',
        rqe: null,
        email: null,
        phone: null,
        address: tenant.address ?? null,
      };

  const patientSnap: PatientSnapshot = {
    name: patient.name ?? '',
    cpf: clinical.cpf ?? null,
    birthdate: patient.birthdate ?? null,
    rg: null,
    cns: clinical.cns ?? null,
    address: clinical.address ?? null,
    insurance_provider: clinical.insurance_provider ?? null,
    insurance_card_number: clinical.insurance_card_number ?? null,
  };

  const clinic: ClinicSnapshot = {
    clinic_name: tenant.clinic_name ?? '',
    cnpj: tenant.cnpj ?? null,
    address: tenant.address ?? '',
    phone: tenant.phone ?? null,
    email: tenant.email ?? null,
    cnes: null, // tenants ainda nao tem cnes coluna; futuro
  };

  // City extraido do address (heuristica: ultima palavra antes do '/' final, ex "São Paulo/SP")
  const extractedCity = (() => {
    if (city) return city;
    const addr = tenant.address ?? '';
    const match = addr.match(/,\s*([^,]+?)\s*[\/-]\s*[A-Z]{2}\s*$/);
    return match ? match[1].trim() : 'São Paulo';
  })();

  return {
    professional,
    patient: patientSnap,
    clinic,
    issue_date: issueDate ?? new Date().toISOString(),
    city: extractedCity,
  };
}
