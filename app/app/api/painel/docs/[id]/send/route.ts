// app/app/api/painel/docs/[id]/send/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';

const SEND_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

type SendChannel = 'whatsapp' | 'email' | 'both';

// POST: send signed document to patient via WhatsApp, email, or both
export async function POST(
  req: NextRequest,
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

  // Parse channel from body
  const body = await req.json().catch(() => ({}));
  const channel: SendChannel = body.channel || 'whatsapp';

  if (!['whatsapp', 'email', 'both'].includes(channel)) {
    return NextResponse.json({ success: false, message: 'Canal inválido' }, { status: 400 });
  }

  try {
    // Get patient info for delivery
    const { data: patient } = await supabaseAdmin()
      .from('patients')
      .select('name, phone, email')
      .eq('id', doc.patient_id)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json({ success: false, message: 'Paciente não encontrado' }, { status: 404 });
    }

    // Build PDF URL (prefer signed, fallback to generated)
    const pdfUrl = doc.signed_pdf_url || doc.pdf_url ||
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/painel/docs/${docId}/pdf`;

    const results: { whatsapp?: boolean; email?: boolean } = {};

    // Send via WhatsApp
    if (channel === 'whatsapp' || channel === 'both') {
      if (!patient.phone) {
        return NextResponse.json({ success: false, message: 'Paciente sem telefone cadastrado' }, { status: 400 });
      }
      try {
        await sendWhatsApp(auth.ctx.tenant, patient, pdfUrl, doc);
        results.whatsapp = true;
      } catch (e) {
        console.error('[send] WhatsApp error:', e);
        results.whatsapp = false;
      }
    }

    // Send via Email
    if (channel === 'email' || channel === 'both') {
      if (!patient.email) {
        if (channel === 'email') {
          return NextResponse.json({ success: false, message: 'Paciente sem e-mail cadastrado' }, { status: 400 });
        }
        results.email = false;
      } else {
        try {
          await sendEmail(auth.ctx.tenant, patient, pdfUrl, doc);
          results.email = true;
        } catch (e) {
          console.error('[send] Email error:', e);
          results.email = false;
        }
      }
    }

    // Update document status
    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'sent',
      sent_to_patient_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      document: updated,
      delivery: results,
      channel,
    });
  } catch (error) {
    console.error('[painel/docs/[id]/send] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao enviar documento' }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// WhatsApp via Evolution API (Baileys)
// ──────────────────────────────────────────────────────────────

async function sendWhatsApp(
  tenant: any,
  patient: { name: string | null; phone: string },
  pdfUrl: string,
  doc: any,
) {
  const evoUrl = process.env.EVOLUTION_BASE_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  const instance = tenant.evolution_instance_name;

  if (!evoUrl || !evoKey || !instance) {
    throw new Error('Evolution API not configured');
  }

  const firstName = (patient.name || 'paciente').split(' ')[0];

  // Send text message
  await fetch(`${evoUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'apikey': evoKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: patient.phone,
      text: `Olá, ${firstName}! 😊\n\nSeu documento médico está pronto. Você pode acessar e baixar pelo link abaixo:\n\n📄 ${pdfUrl}\n\nQualquer dúvida, é só responder esta mensagem.`,
    }),
  });
}

// ──────────────────────────────────────────────────────────────
// Email via N8N webhook (or direct SES in future)
// ──────────────────────────────────────────────────────────────

async function sendEmail(
  tenant: any,
  patient: { name: string | null; email: string | null },
  pdfUrl: string,
  doc: any,
) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_DOC_EMAIL;

  if (n8nWebhookUrl) {
    // Send via N8N workflow
    await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: patient.email,
        to_name: patient.name || 'Paciente',
        clinic_name: tenant.clinic_name || 'Singulare',
        pdf_url: pdfUrl,
        doc_type: doc.doc_type,
        doc_id: doc.id,
      }),
    });
    return;
  }

  // Fallback: direct email via SES (if configured)
  const ses_region = process.env.AWS_SES_REGION || 'us-east-1';
  // For now, log and skip if N8N not configured
  console.log(`[send] Email would be sent to ${patient.email} (N8N not configured)`);
}
