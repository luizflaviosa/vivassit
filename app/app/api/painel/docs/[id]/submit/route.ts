// app/app/api/painel/docs/[id]/submit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

const SUBMIT_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// POST: submit document for signing (draft → pending)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SUBMIT_ROLES.includes(auth.ctx.member.role)) {
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
      { success: false, message: `Status atual é "${doc.status}", esperado "draft"` },
      { status: 400 }
    );
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/submit] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao submeter documento' }, { status: 500 });
  }
}
