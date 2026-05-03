// app/app/api/webhooks/birdid/route.ts
//
// Webhook called by BirdID/VaultID CESS when a signing transaction completes.
// Updates the document status. Note: we can't download the signed PDF here
// because the OTP token has expired by the time the webhook fires.
// The signed PDF URL is provided by CESS in the callback body.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('doc_id');
  if (!docId) {
    return NextResponse.json({ error: 'Missing doc_id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const tcn = (body.tcn || body.transaction_id) as string | undefined;
  if (!tcn) {
    return NextResponse.json({ error: 'Missing tcn' }, { status: 400 });
  }

  const txStatus = (body.status as string)?.toUpperCase?.() || 'UNKNOWN';
  console.log(`[birdid webhook] doc_id=${docId}, tcn=${tcn}, status=${txStatus}`);

  try {
    if (txStatus === 'SIGNED' || txStatus === 'COMPLETED') {
      // CESS may include signed document URLs in the callback
      const documents = (body.documents as Array<{ result?: string; status?: string }>) || [];
      const signedUrl = documents[0]?.result || null;

      // Update document to signed
      await supabaseAdmin()
        .from('medical_documents')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          ...(signedUrl ? { signed_pdf_url: signedUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(docId, 10));

      console.log(`[birdid webhook] doc ${docId} signed successfully`);
    } else if (txStatus === 'ERROR' || txStatus === 'FAILED') {
      // Mark document with error note
      await supabaseAdmin()
        .from('medical_documents')
        .update({
          rejection_note: `Erro na assinatura digital BirdID (TCN: ${tcn}). Tente novamente.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parseInt(docId, 10));

      console.error(`[birdid webhook] doc ${docId} signing error, status=${txStatus}`);
    }
    // If WAITING/PROCESSING, do nothing — BirdID will call again

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
