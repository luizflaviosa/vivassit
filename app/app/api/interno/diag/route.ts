/**
 * Diag — POST recebe Authorization e compara com env (sem expor token inteiro).
 * Use isso pra apontar o singulare_dispatch do n8n PRA CÁ temporariamente
 * e ver o JSON com prefix/suffix dos dois lados.
 *
 * Sem auth porque o objetivo é diagnóstico — não revela token, só prefixos.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const tokenRaw = process.env.N8N_TO_VERCEL_TOKEN ?? '';
  const tokenTrimmed = tokenRaw.trim();
  const expectedFull = `Bearer ${tokenTrimmed}`;
  const auth = (req.headers.get('authorization') ?? '').trim();

  return NextResponse.json({
    env: {
      raw_length: tokenRaw.length,
      trimmed_length: tokenTrimmed.length,
      has_trailing_ws: tokenRaw !== tokenTrimmed,
      prefix6: tokenTrimmed.slice(0, 6),
      last4: tokenTrimmed.slice(-4),
    },
    received: {
      length: auth.length,
      starts_with_bearer: auth.startsWith('Bearer '),
      prefix12: auth.slice(0, 12),
      suffix6: auth.slice(-6),
    },
    expected: {
      prefix12: expectedFull.slice(0, 12),
      suffix6: expectedFull.slice(-6),
      length: expectedFull.length,
    },
    match: auth === expectedFull,
    diagnosis:
      auth === expectedFull
        ? '✓ tokens batem'
        : !auth
        ? '✗ Authorization header ausente'
        : !auth.startsWith('Bearer ')
        ? '✗ header não começa com "Bearer " — credential do n8n provavelmente sem prefix'
        : auth.length !== expectedFull.length
        ? `✗ tamanhos diferentes (env=${expectedFull.length}, recv=${auth.length})`
        : '✗ mesmo tamanho mas conteúdo diferente — tokens são diferentes',
  });
}

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tokenRaw = process.env.N8N_TO_VERCEL_TOKEN ?? '';
  const tokenTrimmed = tokenRaw.trim();
  const url = new URL('/api/interno/tools', req.url).toString();

  // Self-call: bate em /api/interno/tools com o env token
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenTrimmed}`,
    },
    body: JSON.stringify({
      tool: 'agenda_hoje',
      params: {},
      tenant_id: 'singulare',
      user_id: user.id,
      role: 'owner',
    }),
  }).catch((e) => ({ status: 0, text: () => Promise.resolve(`ERR: ${(e as Error).message}`) }) as Response);

  const body = await r.text();

  return NextResponse.json({
    env: {
      raw_length: tokenRaw.length,
      trimmed_length: tokenTrimmed.length,
      has_trailing_ws: tokenRaw !== tokenTrimmed,
      prefix6: tokenTrimmed.slice(0, 6),
      last4: tokenTrimmed.slice(-4),
    },
    self_call_to_tools: {
      url,
      status: r.status,
      body_preview: body.slice(0, 200),
    },
    diagnosis:
      r.status === 200
        ? '✓ env Vercel + backend ok. Token interno self-test passou. Se webhook ainda retorna 500, o problema é a credential do n8n (singulare_dispatch) — valor diferente do env Vercel.'
        : r.status === 401
        ? '✗ Self-test falhou com 401. env Vercel não bate com o que verifyAuth() espera. Estranho — geralmente significa que process.env não está disponível em runtime ou trim() não funcionou.'
        : `Status inesperado ${r.status}.`,
  });
}
