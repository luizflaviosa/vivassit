import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// Sessões internas que NÃO devem aparecer no painel pra Dra:
//   - assistente_confirmacao_*   → cron 8h envia confirmação (tem chat com IA pra agendar msg)
//   - assistente_interno_*       → chat-drawer do painel (Dra. falando com IA pro próprio painel)
//   - assistente_secretaria_*    → memória interna da secretária IA (se usado)
// Conversa REAL paciente↔IA segue padrão: {tenant_id}_+{phone_E164}
const INTERNAL_SESSION_PREFIXES = ['assistente_'];

function isInternalSession(sid: string | null | undefined): boolean {
  if (!sid) return true;
  return INTERNAL_SESSION_PREFIXES.some((p) => sid.startsWith(p));
}

// session_id pra paciente WhatsApp = "{tenant_id}_+{phone}". Extrai o phone E.164.
function extractPhone(sessionId: string): string | null {
  const m = sessionId.match(/_(\+\d{10,15})$/);
  return m ? m[1] : null;
}

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
  const session = req.nextUrl.searchParams.get('session'); // filtra por conversa
  const supabase = supabaseAdmin();

  // Pega mais que o limit pra compensar o filtro de internas
  const fetchLimit = Math.min(limit * 3, 600);

  let query = supabase
    .from('n8n_historico_mensagens')
    .select('id, session_id, message, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

  if (session) {
    query = query.eq('session_id', session);
  } else {
    // Exclui sessões internas via NOT LIKE no Postgres pra performance
    query = query.not('session_id', 'ilike', 'assistente_%');
  }

  const { data: rawMessages, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Aplica filtro de session interna no JS também (defesa em profundidade)
  const messages = (rawMessages ?? []).filter((m) => session || !isInternalSession(m.session_id));

  // Limita ao requested limit
  const trimmed = messages.slice(0, Math.min(limit, 200));

  // JOIN com patients pra pegar nome — extrai phones únicos das sessions
  const phones = Array.from(
    new Set(
      trimmed
        .map((m) => extractPhone(m.session_id))
        .filter((p): p is string => Boolean(p))
    )
  );

  let patientsByPhone: Record<string, { name: string | null }> = {};
  if (phones.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('phone, name')
      .eq('tenant_id', tenantId)
      .in('phone', phones);
    patientsByPhone = Object.fromEntries(
      (patients ?? []).map((p) => [p.phone, { name: p.name }])
    );
  }

  // Anota cada mensagem com phone + patient_name (se disponível)
  const enriched = trimmed.map((m) => {
    const phone = extractPhone(m.session_id);
    const patient = phone ? patientsByPhone[phone] : undefined;
    return {
      ...m,
      patient_phone: phone,
      patient_name: patient?.name ?? null,
    };
  });

  const sessions = new Set(enriched.map((m) => m.session_id));

  return NextResponse.json({
    success: true,
    messages: enriched,
    summary: {
      total: enriched.length,
      unique_sessions: sessions.size,
    },
  });
}

