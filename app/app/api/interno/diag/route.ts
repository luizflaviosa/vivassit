/**
 * Diagnóstico do agente interno — sem expor secrets.
 * Confirma:
 *   - Token está setado no Vercel
 *   - URL do N8N webhook
 *   - Resposta direta do webhook com o exato token+formato que /api/interno/comando usa
 *
 * Acesso: cookie auth (precisa estar logado).
 * Remove esta route após debug.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tokenRaw = process.env.N8N_TO_VERCEL_TOKEN ?? '';
  const tokenTrimmed = tokenRaw.trim();
  const url = (process.env.N8N_INTERNAL_AGENT_URL ?? '').trim();

  const tokenInfo = {
    raw_length: tokenRaw.length,
    trimmed_length: tokenTrimmed.length,
    has_trailing_whitespace: tokenRaw !== tokenTrimmed,
    last4_trimmed: tokenTrimmed.slice(-4),
    prefix6: tokenTrimmed.slice(0, 6),
  };

  // Tenta hit no webhook com TRIMMED + RAW pra comparar
  async function ping(label: string, t: string) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${t}`,
        },
        body: JSON.stringify({ message: 'diag', history: [], tenant_id: 'demo-singulare', user_id: user.id, role: 'owner', clinic_name: 'Diag' }),
      });
      const txt = await r.text();
      return { label, status: r.status, body_preview: txt.slice(0, 100) };
    } catch (e) {
      return { label, error: (e as Error).message };
    }
  }

  const trimmed = url && tokenTrimmed ? await ping('with trimmed', tokenTrimmed) : null;
  const raw = url && tokenRaw ? await ping('with raw', tokenRaw) : null;

  return NextResponse.json({
    n8n_url: url || '<NÃO CONFIGURADO>',
    token: tokenInfo,
    test_trimmed: trimmed,
    test_raw: raw,
    diagnosis:
      trimmed?.status === 200
        ? '✓ trim resolveu — o env tem whitespace, mas trim() na app fixa. Ainda assim, edita o env no Vercel pra remover o whitespace.'
        : trimmed?.status === 403 && tokenInfo.has_trailing_whitespace
        ? '✗ trim NÃO resolveu — credential do N8N tem token DIFERENTE do env Vercel. Verifica no n8n a credential do webhook (Header Auth). Header name deve ser "Authorization" e value "Bearer ' + tokenInfo.prefix6 + '...' + tokenInfo.last4_trimmed + '" (sem espaços, sem newlines).'
        : trimmed?.status === 403 && !tokenInfo.has_trailing_whitespace
        ? '✗ Token sem whitespace mas N8N rejeita. Diferença entre env Vercel e credential N8N.'
        : 'Status inesperado.',
  });
}
