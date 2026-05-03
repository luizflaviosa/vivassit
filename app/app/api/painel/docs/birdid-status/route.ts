// app/app/api/painel/docs/birdid-status/route.ts
//
// Lightweight endpoint so the UI knows whether BirdID digital signing
// is available on this deployment. No auth required (leaks no secrets).

import { NextResponse } from 'next/server';
import { isBirdIdConfigured } from '@/lib/birdid';

export async function GET() {
  return NextResponse.json({
    birdid_configured: isBirdIdConfigured(),
  });
}
