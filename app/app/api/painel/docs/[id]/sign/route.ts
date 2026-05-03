// app/app/api/painel/docs/[id]/sign/route.ts
//
// POST: sign document (draft|pending → signed)
//
// BirdID OTP flow:
//   1. Frontend sends { otp: "123456" }
//   2. Backend looks up doctor's birdid_account_id
//   3. Authenticates with BirdID via OTP
//   4. Generates PDF → creates CESS session → uploads → signs
//
// Manual fallback: if doctor has no BirdID account, marks as signed directly.

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { getDocument, updateDocument } from '@/lib/docs-queries';
import { supabaseAdmin } from '@/lib/supabase';
import { renderToBuffer } from '@react-pdf/renderer';
import { AptidaoFisicaPDF } from '@/lib/pdf/aptidao-fisica';
import {
  authenticateWithOTP,
  signDocument,
  isDoctorBirdIdReady,
  BirdIdError,
} from '@/lib/birdid';
import type { AptidaoFisicaForm } from '@/lib/docs-types';
import React from 'react';

const SIGN_ROLES: MemberRole[] = ['owner', 'doctor'];

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

  if (doc.status !== 'draft' && doc.status !== 'pending') {
    return NextResponse.json(
      { success: false, message: `Status atual é "${doc.status}", esperado "draft" ou "pending"` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // ── Rejection flow ──
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
    // ── Generate PDF ──
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

    // ── Look up doctor's BirdID account ──
    let doctorAccountId: string | null = null;
    if (doc.doctor_id) {
      const { data: doctorRow } = await supabaseAdmin()
        .from('tenant_doctors')
        .select('birdid_account_id')
        .eq('id', doc.doctor_id)
        .maybeSingle();
      doctorAccountId = doctorRow?.birdid_account_id || null;
    }

    // If first-time setup: save account_id from body
    if (body.birdid_account_id && doc.doctor_id) {
      const newId = body.birdid_account_id.trim();
      if (newId) {
        await supabaseAdmin()
          .from('tenant_doctors')
          .update({ birdid_account_id: newId })
          .eq('id', doc.doctor_id);
        doctorAccountId = newId;
      }
    }

    // ── BirdID OTP signing ──
    if (isDoctorBirdIdReady(doctorAccountId) && body.otp && pdfBuffer) {
      const otp = String(body.otp).trim();
      if (!otp || otp.length < 4) {
        return NextResponse.json(
          { success: false, message: 'Código OTP inválido. Digite o código do app BirdID.' },
          { status: 400 }
        );
      }

      // Step 1: Authenticate with OTP
      let token: string;
      try {
        const authResult = await authenticateWithOTP(doctorAccountId!, otp);
        token = authResult.token;
      } catch (e) {
        const msg = e instanceof BirdIdError
          ? `Falha na autenticação BirdID: ${e.message}`
          : 'Erro ao conectar com BirdID. Verifique o código OTP e tente novamente.';
        return NextResponse.json({ success: false, message: msg, error_code: 'AUTH_FAILED' }, { status: 401 });
      }

      // Step 2: Sign document
      try {
        const signResult = await signDocument({
          token,
          accountId: doctorAccountId!,
          pdfBuffer,
          fileName: `${doc.doc_type}-${doc.id}.pdf`,
          docId: doc.id,
          reason: 'Assinatura digital de documento médico',
          location: auth.ctx.tenant.clinic_name || '',
        });

        const now = new Date().toISOString();

        // Mark as signed immediately — webhook will add signed_pdf_url when CESS completes
        const updated = await updateDocument(auth.ctx.tenant.tenant_id, docId, {
          status: 'signed',
          signed_at: now,
          submitted_at: now,
          signed_by_user: auth.ctx.user.id,
        });

        // Store TCN in a dedicated column without polluting form_data
        await supabaseAdmin()
          .from('medical_documents')
          .update({ birdid_tcn: signResult.tcn })
          .eq('id', docId)
          .throwOnError()
          .then(() => null)
          .catch(() => null); // non-fatal if column doesn't exist yet

        return NextResponse.json({
          success: true,
          signing_method: 'birdid',
          document: updated,
          tcn: signResult.tcn,
        });
      } catch (e) {
        const msg = e instanceof BirdIdError
          ? `Falha na assinatura: ${e.message}`
          : 'Erro ao assinar via BirdID.';
        console.error('[sign] BirdID signing error:', e);
        return NextResponse.json({ success: false, message: msg, error_code: 'SIGN_FAILED' }, { status: 500 });
      }
    }

    // ── Manual fallback (no BirdID or no OTP) ──
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
