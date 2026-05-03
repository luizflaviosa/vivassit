// app/app/api/painel/docs/[id]/pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { getDocument } from '@/lib/docs-queries';
import { renderToBuffer } from '@react-pdf/renderer';
import { AptidaoFisicaPDF } from '@/lib/pdf/aptidao-fisica';
import type { AptidaoFisicaForm } from '@/lib/docs-types';
import React from 'react';

// GET: generate and return PDF for a document
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

    switch (doc.doc_type) {
      case 'aptidao_fisica': {
        const form = doc.form_data as unknown as AptidaoFisicaForm;
        pdfBuffer = await renderToBuffer(
          React.createElement(AptidaoFisicaPDF, {
            form,
            clinicName: auth.ctx.tenant.clinic_name,
          }) as any // eslint-disable-line @typescript-eslint/no-explicit-any
        );
        break;
      }
      default:
        return NextResponse.json(
          { success: false, message: `PDF não disponível para tipo "${doc.doc_type}"` },
          { status: 400 }
        );
    }

    // Return PDF as download
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
