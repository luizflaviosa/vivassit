// app/app/api/painel/docs/[id]/send/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';

const SEND_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// POST: mark document as sent to patient (signed → sent)
// MVP: just updates status. Phase 2: trigger WhatsApp/email delivery via N8N.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!SEND_ROLES.includes(auth.ctx.member.role)) {
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
  if (doc.status !== 'signed') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "signed"` },
      { status: 400 }
    );
  }

  try {
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'sent',
      sent_to_patient_at: new Date().toISOString(),
    });

    // Phase 2: trigger N8N workflow to send via WhatsApp/email
    // await fetch(process.env.N8N_WEBHOOK_URL + '/doc-send', { ... });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error('[painel/docs/[id]/send] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar documento' }, { status: 500 });
  }
}
