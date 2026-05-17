// app/app/api/painel/docs/[id]/pdf/route.ts
//
// PDF rendering strategy:
//   1. Tenta componente customizado por doc_type (atualmente: aptidao_fisica).
//   2. Fallback: GenericMarkdownPDF gerado a partir de DOC_TEMPLATES[doc_type].render(context, form_data).
//      Cobre os outros 4 tipos sem precisar de PDF component dedicado.

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { getDocument } from '@/lib/docs-queries';
import { renderToBuffer } from '@react-pdf/renderer';
import { AptidaoFisicaPDF } from '@/lib/pdf/aptidao-fisica';
import { GenericMarkdownPDF } from '@/lib/pdf/generic-markdown';
import type { AptidaoFisicaForm, DocTypeKey } from '@/lib/docs-types';
import { DOC_TYPES } from '@/lib/docs-types';
import { DOC_TEMPLATES } from '@/lib/docs-templates';
import { buildTemplateContext } from '@/lib/docs-context';
import React from 'react';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const docId = parseInt(params.id, 10);
  if (isNaN(docId)) {
    return NextResponse.json({ success: false, message: 'ID inválido' }, { status: 400 });
  }

  const doc = await getDocument(auth.ctx.tenant.tenant_id, docId);
  if (!doc) {
    return NextResponse.json({ success: false, message: 'Documento não encontrado' }, { status: 404 });
  }

  try {
    let pdfBuffer: Buffer;

    // 1. Componente customizado (legado pra aptidao_fisica)
    if (doc.doc_type === 'aptidao_fisica') {
      const form = doc.form_data as unknown as AptidaoFisicaForm;
      pdfBuffer = await renderToBuffer(
        React.createElement(AptidaoFisicaPDF, {
          form,
          clinicName: auth.ctx.tenant.clinic_name,
        }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    } else {
      // 2. Fallback genérico via DOC_TEMPLATES.render(ctx, form_data)
      const tpl = DOC_TEMPLATES[doc.doc_type as DocTypeKey];
      if (!tpl) {
        return NextResponse.json(
          { success: false, message: `Tipo de documento desconhecido: ${doc.doc_type}` },
          { status: 400 }
        );
      }

      const ctx = await buildTemplateContext({
        tenantId: auth.ctx.tenant.tenant_id,
        patientId: doc.patient_id,
        doctorId: doc.doctor_id,
        issueDate: doc.signed_at ?? doc.created_at,
      });

      if (!ctx) {
        return NextResponse.json(
          { success: false, message: 'Não foi possível resolver contexto (paciente/profissional/clínica).' },
          { status: 500 }
        );
      }

      // tpl.render expects (ctx, data); cast pra any porque o tipo varia por template
      const markdown = (tpl.render as any)(ctx, doc.form_data); // eslint-disable-line @typescript-eslint/no-explicit-any

      pdfBuffer = await renderToBuffer(
        React.createElement(GenericMarkdownPDF, {
          markdown,
          clinicName: auth.ctx.tenant.clinic_name,
          documentTypeLabel: DOC_TYPES[doc.doc_type],
        }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
      );
    }

    const filename = `${doc.doc_type}-${doc.id}.pdf`;
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[painel/docs/[id]/pdf] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao gerar PDF' },
      { status: 500 }
    );
  }
}
