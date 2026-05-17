// GET /api/painel/lookup/cid10?q=...
// Autocomplete pra forms de documentos. Usa searchCID10 (textsearch portuguese).

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { searchCID10 } from '@/lib/docs-queries';

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ success: true, results: [] });
  }

  const results = await searchCID10(q, 15);
  return NextResponse.json({
    success: true,
    results: results.map((r) => ({ code: r.code, name: r.name_short ?? r.name })),
  });
}
