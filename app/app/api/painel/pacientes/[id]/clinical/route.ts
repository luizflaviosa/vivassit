// app/app/api/painel/pacientes/[id]/clinical/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getPatientClinical, upsertPatientClinical } from '@/lib/docs-queries';

const ALLOWED_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// GET: retrieve patient clinical data
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!ALLOWED_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json(
      { success: false, message: 'ID inválido' },
      { status: 400 }
    );
  }

  try {
    const data = await getPatientClinical(auth.ctx.tenant.tenant_id, patientId);
    return NextResponse.json({ success: true, clinical: data });
  } catch (error) {
    console.error('[painel/pacientes/clinical GET] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar dados clínicos' },
      { status: 500 }
    );
  }
}

// PATCH: upsert patient clinical data
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!ALLOWED_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json(
      { success: false, message: 'ID inválido' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'JSON inválido' },
      { status: 400 }
    );
  }

  // Whitelist allowed fields
  const allowed = [
    'cpf', 'cns', 'mother_name', 'address',
    'weight_kg', 'height_cm', 'blood_type', 'allergies',
    'insurance_provider', 'insurance_card_number',
    'primary_cid', 'conditions', 'medications', 'collected_by',
  ];
  const fields: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) fields[key] = body[key];
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { success: false, message: 'Nenhum campo para atualizar' },
      { status: 400 }
    );
  }

  try {
    const data = await upsertPatientClinical(
      auth.ctx.tenant.tenant_id,
      patientId,
      fields
    );
    return NextResponse.json({ success: true, clinical: data });
  } catch (error) {
    console.error('[painel/pacientes/clinical PATCH] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao salvar dados clínicos' },
      { status: 500 }
    );
  }
}
