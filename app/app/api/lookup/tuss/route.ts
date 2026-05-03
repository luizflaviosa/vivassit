// app/app/api/lookup/tuss/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { searchTUSS } from '@/lib/docs-queries';

// Public endpoint — no auth required (read-only regulated data)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { success: false, message: 'Query deve ter pelo menos 2 caracteres' },
      { status: 400 }
    );
  }

  try {
    const results = await searchTUSS(q, 20);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[lookup/tuss] erro:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar TUSS' },
      { status: 500 }
    );
  }
}
