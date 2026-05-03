// app/app/api/painel/docs/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';

const WRITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];
const READ_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff', 'viewer'];

// GET: document detail
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!READ_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  try {
    const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
    }

    // Enrich with patient and doctor names
    const [patientRes, doctorRes] = await Promise.all([
      supabaseAdmin().from('patients').select('name, phone, email, birthdate').eq('id', doc.patient_id).maybeSingle(),
      doc.doctor_id
        ? supabaseAdmin().from('tenant_doctors').select('doctor_name, doctor_crm, specialty').eq('id', doc.doctor_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      success: true,
      document: doc,
      patient: patientRes.data,
      doctor: doctorRes.data,
    });
  } catch (error) {
    console.error('[painel/docs/[id] GET] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao buscar documento' }, { status: 500 });
  }
}

// PATCH: edit draft document (only status=draft)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!WRITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }
  if (doc.status !== 'draft') {
    return NextResponse.json(
      { success: false, message: 'Apenas rascunhos podem ser editados' },
      { status: 400 }
    );
  }

  let body: { form_data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  if (!body.form_data) {
    return NextResponse.json({ success: false, message: 'form_data obrigatório' }, { status: 400 });
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      form_data: body.form_data,
    });
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id] PATCH] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao atualizar documento' }, { status: 500 });
  }
}

// DELETE: cancel document (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const cancelRoles: MemberRole[] = ['owner', 'admin', 'doctor'];
  if (!cancelRoles.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão' }, { status: 403 });
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  try {
    await updateDocument(auth.ctx.tenant.tenant_id, docId, { status: 'cancelled' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[painel/docs/[id] DELETE] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao cancelar documento' }, { status: 500 });
  }
}
