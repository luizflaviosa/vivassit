// app/app/api/painel/docs/[id]/sign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

// Only doctors and owners (who are also professionals) can sign
const SIGN_ROLES: MemberRole[] = ['owner', 'doctor'];

// POST: sign document (pending → signed)
// MVP: marks as signed without BirdID. Phase 2 adds real digital signature.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SIGN_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json(
      { success: false, message: 'Apenas profissionais (doctor/owner) podem assinar documentos' },
      { status: 403 }
    );
  }

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }

  // Allow signing from draft (Profile A: self-service) or pending (Profiles B/C)
  if (doc.status !== 'draft' && doc.status !== 'pending') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "draft" ou "pending"` },
      { status: 400 }
    );
  }

  // Check for rejection request
  const body = await req.json().catch(() => ({}));
  if (body.reject) {
    if (!body.rejection_note?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Motivo da rejeição é obrigatório' },
        { status: 400 }
      );
    }
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'rejected',
      rejection_note: body.rejection_note.trim(),
    });
    return NextResponse.json({ success: true, document: updated });
  }

  try {
    // MVP: mark as signed (no BirdID integration yet)
    // Phase 2: call BirdID API here to get real ICP-Brasil signature
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'signed',
      signed_by_user: auth.ctx.user.id,
      signed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/sign] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao assinar documento' }, { status: 500 });
  }
}
