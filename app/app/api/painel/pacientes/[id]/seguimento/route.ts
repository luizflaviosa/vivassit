// GET   — lista patient_protocols do paciente (ativos + historico).
// POST  — atribui protocolo ao paciente.
// PATCH — muda status (pause/resume/complete/abandon) ou edita next_consultation_at/notes.

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx {
  params: { id: string };
}

async function validatePatientInTenant(admin: ReturnType<typeof supabaseAdmin>, patientId: number, tenantId: string) {
  const { data, error } = await admin
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return { ok: !error && !!data, error: error?.message };
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const { tenant } = auth.ctx;

  const patientId = Number(params.id);
  if (!Number.isFinite(patientId) || patientId <= 0) {
    return NextResponse.json({ success: false, error: 'invalid_patient_id' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { ok, error: vErr } = await validatePatientInTenant(admin, patientId, tenant.tenant_id);
  if (!ok) return NextResponse.json({ success: false, error: vErr ?? 'patient_not_found' }, { status: 404 });

  const { data, error } = await admin
    .from('patient_protocols')
    .select(`
      id, status, started_at, ends_at, next_consultation_at, last_dispatched_at, notes, created_at,
      protocol:treatment_protocols(id, slug, name, specialty, description, duration_weeks)
    `)
    .eq('patient_id', patientId)
    .eq('tenant_id', tenant.tenant_id)
    .order('started_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, patient_protocols: data ?? [] });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const { tenant } = auth.ctx;

  const patientId = Number(params.id);
  if (!Number.isFinite(patientId) || patientId <= 0) {
    return NextResponse.json({ success: false, error: 'invalid_patient_id' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const protocolId = Number(body?.protocol_id);
  if (!Number.isFinite(protocolId) || protocolId <= 0) {
    return NextResponse.json({ success: false, error: 'invalid_protocol_id' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { ok, error: vErr } = await validatePatientInTenant(admin, patientId, tenant.tenant_id);
  if (!ok) return NextResponse.json({ success: false, error: vErr ?? 'patient_not_found' }, { status: 404 });

  // Confirma que o protocolo e acessivel pelo tenant (global ou proprio).
  const { data: prot, error: pErr } = await admin
    .from('treatment_protocols')
    .select('id, tenant_id')
    .eq('id', protocolId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenant.tenant_id}`)
    .maybeSingle();
  if (pErr) return NextResponse.json({ success: false, error: pErr.message }, { status: 500 });
  if (!prot) return NextResponse.json({ success: false, error: 'protocol_not_accessible' }, { status: 404 });

  // Bloqueia atribuicao duplicada ativa do mesmo protocolo.
  const { data: existing } = await admin
    .from('patient_protocols')
    .select('id')
    .eq('patient_id', patientId)
    .eq('tenant_id', tenant.tenant_id)
    .eq('protocol_id', protocolId)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ success: false, error: 'already_active', patient_protocol_id: existing.id }, { status: 409 });
  }

  const nextConsultationAt = body?.next_consultation_at && typeof body.next_consultation_at === 'string'
    ? body.next_consultation_at
    : null;
  const notes = body?.notes && typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null;
  const doctorId = body?.doctor_id && typeof body.doctor_id === 'string' ? body.doctor_id : null;

  const { data: inserted, error: iErr } = await admin
    .from('patient_protocols')
    .insert({
      patient_id: patientId,
      tenant_id: tenant.tenant_id,
      protocol_id: protocolId,
      doctor_id: doctorId,
      next_consultation_at: nextConsultationAt,
      notes,
      status: 'active',
    })
    .select('id, status, started_at, next_consultation_at, notes')
    .single();

  if (iErr) return NextResponse.json({ success: false, error: iErr.message }, { status: 500 });
  return NextResponse.json({ success: true, patient_protocol: inserted });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const { tenant } = auth.ctx;

  const patientId = Number(params.id);
  if (!Number.isFinite(patientId) || patientId <= 0) {
    return NextResponse.json({ success: false, error: 'invalid_patient_id' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const patientProtocolId = Number(body?.patient_protocol_id);
  if (!Number.isFinite(patientProtocolId) || patientProtocolId <= 0) {
    return NextResponse.json({ success: false, error: 'invalid_patient_protocol_id' }, { status: 400 });
  }

  const STATUS_MAP: Record<string, 'active' | 'paused' | 'completed' | 'abandoned'> = {
    pause: 'paused',
    resume: 'active',
    complete: 'completed',
    abandon: 'abandoned',
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.action && typeof body.action === 'string' && STATUS_MAP[body.action]) {
    update.status = STATUS_MAP[body.action];
    if (body.action === 'complete' || body.action === 'abandon') {
      update.ends_at = new Date().toISOString();
    }
  }
  if (typeof body?.next_consultation_at === 'string' || body?.next_consultation_at === null) {
    update.next_consultation_at = body.next_consultation_at;
  }
  if (typeof body?.notes === 'string') {
    update.notes = body.notes.slice(0, 1000);
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ success: false, error: 'no_changes' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('patient_protocols')
    .update(update)
    .eq('id', patientProtocolId)
    .eq('patient_id', patientId)
    .eq('tenant_id', tenant.tenant_id)
    .select('id, status, next_consultation_at, notes, ends_at')
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ success: true, patient_protocol: data });
}
