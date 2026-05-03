// app/app/api/painel/docs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { createDocument, listDocuments } from '@/lib/docs-queries';
import { ENABLED_DOC_TYPES, type DocTypeKey, type DocStatus } from '@/lib/docs-types';

const WRITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];
const READ_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff', 'viewer'];

// GET: list documents for this tenant
export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!READ_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  const status = req.nextUrl.searchParams.get('status') as DocStatus | null;
  const docType = req.nextUrl.searchParams.get('doc_type') as DocTypeKey | null;
  const doctorId = req.nextUrl.searchParams.get('doctor_id');

  try {
    const docs = await listDocuments(auth.ctx.tenant.tenant_id, {
      status: status ?? undefined,
      doc_type: docType ?? undefined,
      doctor_id: doctorId ?? undefined,
    });

    // Enrich with patient name
    const patientIds = [...new Set(docs.map((d) => d.patient_id))];
    let patientMap: Record<number, string> = {};

    if (patientIds.length > 0) {
      const { data: patients } = await supabaseAdmin()
        .from('patients')
        .select('id, name')
        .in('id', patientIds);

      if (patients) {
        patientMap = Object.fromEntries(patients.map((p) => [p.id, p.name ?? 'Sem nome']));
      }
    }

    const enriched = docs.map((d) => ({
      ...d,
      patient_name: patientMap[d.patient_id] ?? 'Sem nome',
    }));

    return NextResponse.json({ success: true, documents: enriched });
  } catch (error) {
    console.error('[painel/docs GET] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao listar documentos' },
      { status: 500 }
    );
  }
}

// POST: create new document draft
export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!WRITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Sem permissão' },
      { status: 403 }
    );
  }

  let body: {
    patient_id: number;
    doctor_id: string; // uuid
    doc_type: DocTypeKey;
    form_data: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'JSON inválido' },
      { status: 400 }
    );
  }

  if (!body.patient_id || !body.doctor_id || !body.doc_type || !body.form_data) {
    return NextResponse.json(
      { success: false, message: 'Campos obrigatórios: patient_id, doctor_id, doc_type, form_data' },
      { status: 400 }
    );
  }

  if (!ENABLED_DOC_TYPES.includes(body.doc_type)) {
    return NextResponse.json(
      { success: false, message: `Tipo de documento "${body.doc_type}" não disponível ainda` },
      { status: 400 }
    );
  }

  try {
    const doc = await createDocument({
      tenant_id: auth.ctx.tenant.tenant_id,
      patient_id: body.patient_id,
      doctor_id: body.doctor_id,
      created_by_user: auth.ctx.user.id,
      doc_type: body.doc_type,
      form_data: body.form_data,
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (error) {
    console.error('[painel/docs POST] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao criar documento' },
      { status: 500 }
    );
  }
}
