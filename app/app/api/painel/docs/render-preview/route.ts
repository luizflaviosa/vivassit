// POST /api/painel/docs/render-preview
// Body: { doc_type, patient_id, doctor_id, form_data }
// Retorna: { markdown } pra preview live no painel (sem persistir).
//
// Usado pelo NovoDocView (step 3) e DocDetailView (modal edit) pra mostrar
// preview do documento conforme o profissional vai preenchendo o form.

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { DOC_TEMPLATES } from '@/lib/docs-templates';
import { buildTemplateContext } from '@/lib/docs-context';
import type { DocTypeKey } from '@/lib/docs-types';

interface Body {
  doc_type: DocTypeKey;
  patient_id: number;
  doctor_id: string | null;
  form_data: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  const tpl = DOC_TEMPLATES[body.doc_type];
  if (!tpl) {
    return NextResponse.json({ success: false, message: `Tipo de documento desconhecido: ${body.doc_type}` }, { status: 400 });
  }

  const ctx = await buildTemplateContext({
    tenantId: auth.ctx.tenant.tenant_id,
    patientId: body.patient_id,
    doctorId: body.doctor_id,
  });

  if (!ctx) {
    return NextResponse.json({ success: false, message: 'Não foi possível resolver contexto.' }, { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataWithDefaults = { ...(tpl.defaults as any), ...body.form_data };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markdown = (tpl.render as any)(ctx, dataWithDefaults);

  return NextResponse.json({ success: true, markdown });
}
