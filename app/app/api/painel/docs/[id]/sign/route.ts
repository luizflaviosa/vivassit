// app/app/api/painel/docs/[id]/sign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import { AptidaoFisicaPDF } from '@/lib/pdf/aptidao-fisica';
import { isBirdIdConfigured, startSigningSession } from '@/lib/birdid';
import type { AptidaoFisicaForm } from '@/lib/docs-types';
import React from 'react';

// Only doctors and owners (who are also professionals) can sign
const SIGN_ROLES: MemberRole[] = ['owner', 'doctor'];

// POST: sign document (draft|pending → signed)
// With BirdID: generates PDF → sends to BirdID → doctor approves on app → webhook updates status
// Without BirdID: marks as signed immediately (MVP fallback)
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
    // Generate PDF first
    let pdfBuffer: Buffer | null = null;
    if (doc.doc_type === 'aptidao_fisica') {
      const form = doc.form_data as unknown as AptidaoFisicaForm;
      pdfBuffer = await renderToBuffer(
        React.createElement(AptidaoFisicaPDF, {
          form,
          clinicName: auth.ctx.tenant.clinic_name,
        }) as any
      );
    }

    // Try BirdID digital signature
    if (isBirdIdConfigured() && pdfBuffer) {
      // Auto-lookup doctor's BirdID CPF from tenant_doctors
      let doctorCpf = body.signer_cpf?.replace(/\D/g, '') || ''; // Allow override from body
      if (!doctorCpf && doc.doctor_id) {
        const { data: doctorRow } = await supabaseAdmin()
          .from('tenant_doctors')
          .select('birdid_cpf')
          .eq('id', doc.doctor_id)
          .maybeSingle();
        doctorCpf = doctorRow?.birdid_cpf || '';
      }
      if (!doctorCpf) {
        return NextResponse.json(
          { success: false, message: 'CPF do profissional não configurado. Informe o CPF BirdID para assinar digitalmente.', need_cpf: true },
          { status: 400 }
        );
      }

      // If caller asked to persist the CPF for future signings, save it now
      if (body.save_cpf && doc.doctor_id && body.signer_cpf) {
        await supabaseAdmin()
          .from('tenant_doctors')
          .update({ birdid_cpf: doctorCpf })
          .eq('id', doc.doctor_id);
      }

      // Start BirdID signing session
      const birdIdResult = await startSigningSession({
        pdfBuffer,
        fileName: `${doc.doc_type}-${doc.id}.pdf`,
        signerCpf: doctorCpf,
        docId: doc.id,
        reason: 'Assinatura digital de documento médico',
        location: auth.ctx.tenant.clinic_name || '',
      });

      // Update document — status stays draft/pending until webhook confirms
      await updateDocument(auth.ctx.tenant.tenant_id, docId, {
        submitted_at: new Date().toISOString(),
      });

      // Store TCN for reference
      await supabaseAdmin()
        .from('medical_documents')
        .update({
          form_data: {
            ...doc.form_data as object,
            _birdid_tcn: birdIdResult.tcn,
          },
        })
        .eq('id', docId);

      return NextResponse.json({
        success: true,
        signing_method: 'birdid',
        message: 'Assinatura enviada para o BirdID. Autorize no app BirdID.',
        tcn: birdIdResult.tcn,
      });
    }

    // Fallback: sign without BirdID (MVP mode)
    // Store unsigned PDF in storage
    if (pdfBuffer) {
      const storagePath = `docs/${docId}.pdf`;
      await supabaseAdmin()
        .storage
        .from('documents')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      const { data: urlData } = supabaseAdmin()
        .storage
        .from('documents')
        .getPublicUrl(storagePath);

      await updateDocument(auth.ctx.tenant.tenant_id, docId, {
        pdf_url: urlData?.publicUrl || null,
      });
    }

    const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
      status: 'signed',
      signed_by_user: auth.ctx.user.id,
      signed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      signing_method: 'manual',
      document: updated,
    });
  } catch (error) {
    console.error('[painel/docs/[id]/sign] erro:', error);
    return NextResponse.json({ success: false, message: 'Erro ao assinar documento' }, { status: 500 });
  }
}
