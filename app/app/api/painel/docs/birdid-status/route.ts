// app/app/api/painel/docs/birdid-status/route.ts
//
// BirdID availability is now per-doctor (based on birdid_account_id in tenant_doctors).
// This endpoint is kept for backwards compat but just returns sandbox URLs info.

import { NextResponse } from 'next/server';

export async function GET() {
  const apiUrl = process.env.BIRDID_API_URL || 'https://apihom.birdid.com.br';
  const cessUrl = process.env.BIRDID_CESS_URL || 'https://cesshom.vaultid.com.br';
  const isSandbox = apiUrl.includes('hom');

  return NextResponse.json({
    birdid_available: true, // OTP-based — always available if doctor has account ID
    mode: isSandbox ? 'sandbox' : 'production',
    api_url: apiUrl,
  });
}
