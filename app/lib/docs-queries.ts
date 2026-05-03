// app/lib/docs-queries.ts

import { supabaseAdmin } from './supabase';
import type {
  MedicalDocument,
  PatientClinicalData,
  DocTypeKey,
  DocStatus,
} from './docs-types';

const sb = () => supabaseAdmin();

// ──────────────────────────────────────────────────────────────
// Lookup: CID-10
// ──────────────────────────────────────────────────────────────

export async function searchCID10(query: string, limit = 20) {
  // Use ilike for short codes (e.g. A00, J06), full-text for descriptions
  if (query.length <= 5 && /^[A-Z]\d/i.test(query)) {
    const { data } = await sb()
      .from('lookup_cid10')
      .select('code, name, name_short, chapter')
      .ilike('code', `${query}%`)
      .limit(limit);
    return data ?? [];
  }

  const { data } = await sb()
    .from('lookup_cid10')
    .select('code, name, name_short, chapter')
    .textSearch('code || \' \' || name', query, {
      type: 'websearch',
      config: 'portuguese',
    })
    .limit(limit);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────
// Lookup: TUSS
// ──────────────────────────────────────────────────────────────

export async function searchTUSS(query: string, limit = 20) {
  if (/^\d+$/.test(query)) {
    const { data } = await sb()
      .from('lookup_tuss')
      .select('code, name, table_number')
      .ilike('code', `${query}%`)
      .is('valid_until', null)
      .limit(limit);
    return data ?? [];
  }

  const { data } = await sb()
    .from('lookup_tuss')
    .select('code, name, table_number')
    .textSearch('code || \' \' || name', query, {
      type: 'websearch',
      config: 'portuguese',
    })
    .is('valid_until', null)
    .limit(limit);
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────
// Patient clinical data
// ──────────────────────────────────────────────────────────────

export async function getPatientClinical(
  tenantId: string,
  patientId: number
): Promise<PatientClinicalData | null> {
  const { data } = await sb()
    .from('patient_clinical_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('patient_id', patientId)
    .maybeSingle();
  return data;
}

export async function upsertPatientClinical(
  tenantId: string,
  patientId: number,
  fields: Partial<Omit<PatientClinicalData, 'id' | 'tenant_id' | 'patient_id' | 'created_at'>>
) {
  const { data, error } = await sb()
    .from('patient_clinical_data')
    .upsert(
      {
        tenant_id: tenantId,
        patient_id: patientId,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,patient_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as PatientClinicalData;
}

// ──────────────────────────────────────────────────────────────
// Medical documents CRUD
// ──────────────────────────────────────────────────────────────

export async function createDocument(params: {
  tenant_id: string;
  patient_id: number;
  doctor_id: string; // uuid
  created_by_user: string;
  doc_type: DocTypeKey;
  form_data: Record<string, unknown>;
}): Promise<MedicalDocument> {
  const { data, error } = await sb()
    .from('medical_documents')
    .insert({
      tenant_id: params.tenant_id,
      patient_id: params.patient_id,
      doctor_id: params.doctor_id,
      created_by_user: params.created_by_user,
      doc_type: params.doc_type,
      form_data: params.form_data,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data as MedicalDocument;
}

export async function listDocuments(
  tenantId: string,
  filters?: { status?: DocStatus; doc_type?: DocTypeKey; doctor_id?: string }
) {
  let query = sb()
    .from('medical_documents')
    .select(`
      id, tenant_id, patient_id, doctor_id,
      doc_type, status, form_data,
      rejection_note, pdf_url, signed_pdf_url, signed_at,
      submitted_at, sent_to_patient_at, created_at, updated_at
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(100);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.doc_type) query = query.eq('doc_type', filters.doc_type);
  if (filters?.doctor_id) query = query.eq('doctor_id', filters.doctor_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MedicalDocument[];
}

export async function getDocument(
  tenantId: string,
  docId: number
): Promise<MedicalDocument | null> {
  const { data } = await sb()
    .from('medical_documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', docId)
    .maybeSingle();
  return data as MedicalDocument | null;
}

export async function updateDocument(
  tenantId: string,
  docId: number,
  fields: Partial<Pick<MedicalDocument, 'form_data' | 'status' | 'rejection_note' | 'pdf_url' | 'signed_pdf_url' | 'signed_at' | 'submitted_at' | 'sent_to_patient_at' | 'signed_by_user'>>
) {
  const { data, error } = await sb()
    .from('medical_documents')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', docId)
    .select()
    .single();

  if (error) throw error;
  return data as MedicalDocument;
}
