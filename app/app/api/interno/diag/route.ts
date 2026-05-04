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

  const token = process.env.N8N_TO_VERCEL_TOKEN ?? '';
  const url = process.env.N8N_INTERNAL_AGENT_URL ?? '';

  const tokenInfo = {
    set: token.length > 0,
    length: token.length,
    prefix6: token.slice(0, 6),
    last4: token.slice(-4),
  };

  // Tenta hit no webhook com formato exato que /comando usa
  let upstream: { status?: number; body_preview?: string; error?: string } = {};
  if (url && token) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: 'diag', history: [], tenant_id: 'demo-singulare', user_id: user.id, role: 'owner', clinic_name: 'Diag' }),
      });
      const txt = await r.text();
      upstream = { status: r.status, body_preview: txt.slice(0, 200) };
    } catch (e) {
      upstream = { error: (e as Error).message };
    }
  }

  return NextResponse.json({
    n8n_url: url || '<NÃO CONFIGURADO>',
    token: tokenInfo,
    upstream_with_bearer: upstream,
    hint: upstream.status === 403
      ? 'N8N rejeitou. Verifica que a credential do webhook tem header name=Authorization e header value EXATAMENTE = "Bearer " + ' + tokenInfo.prefix6 + '...' + tokenInfo.last4
      : upstream.status === 200
      ? 'Webhook aceitou! Se ainda dá erro no chat, é problema interno do workflow.'
      : 'Status inesperado ou erro.',
  });
}
