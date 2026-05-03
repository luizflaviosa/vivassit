// app/app/api/webhooks/birdid/route.ts
//
// Webhook called by BirdID/VaultID CESS when a signing transaction completes.
// Updates the document status and stores the signed PDF URL.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSigningStatus, downloadSignedPdf } from '@/lib/birdid';

export async function POST(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('doc_id');
  if (!docId) {
    return NextResponse.json({ error: 'Missing doc_id' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const tcn = body.tcn || body.transaction_id;
  if (!tcn) {
    return NextResponse.json({ error: 'Missing tcn' }, { status: 400 });
  }

  console.log(`[birdid webhook] doc_id=${docId}, tcn=${tcn}`);

  try {
    // Check signing status with BirdID
    const status = await getSigningStatus(tcn);

    if (status.status === 'SIGNED') {
      // Download the signed PDF
      const signedPdf = await downloadSignedPdf(tcn);

      // Upload to Supabase Storage
      const storagePath = `signed-docs/${docId}-signed.pdf`;
      const { error: uploadError } = await supabaseAdmin()
        .storage
        .from('documents')
        .upload(storagePath, signedPdf, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('[birdid webhook] storage upload error:', uploadError);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin()
        .storage
        .from('documents')
        .getPublicUrl(storagePath);

      // Update document to signed
      await supabaseAdmin()
        .from('medical_documents')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signed_pdf_url: urlData?.publicUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(docId, 10));

      console.log(`[birdid webhook] doc ${docId} signed successfully`);
    } else if (status.status === 'ERROR') {
      // Mark document with error note
      await supabaseAdmin()
        .from('medical_documents')
        .update({
          rejection_note: 'Erro na assinatura digital BirdID. Tente novamente.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(docId, 10));

      console.error(`[birdid webhook] doc ${docId} signing error`);
    }
    // If WAITING, do nothing — BirdID will call again

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[birdid webhook] error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Also support GET for BirdID health checks
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
