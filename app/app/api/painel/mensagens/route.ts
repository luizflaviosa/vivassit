import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

interface MessagePayload {
  type?: string;
  content?: string;
  data?: { content?: string; [key: string]: unknown };
  text?: string;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
  const session = req.nextUrl.searchParams.get('session'); // filtra por conversa

  const supabase = supabaseAdmin();
  let query = supabase
    .from('n8n_historico_mensagens')
    .select('id, session_id, message, created_at')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));

  if (session) query = query.eq('session_id', session);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Resumo de sessoes ativas
  const sessions = new Set((data ?? []).map((m) => m.session_id));

  return NextResponse.json({
    success: true,
    messages: data ?? [],
    summary: {
      total: data?.length ?? 0,
      unique_sessions: sessions.size,
    },
  });
}

