import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evolutionConnect } from '@/lib/evolution';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONNECTED_STATUSES = new Set(['open', 'connected']);

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

/** Garante prefixo data: na string base64 (Evolution as vezes retorna sem). */
function ensureDataUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('data:')) return raw;
  return `data:image/png;base64,${raw}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;

  if (!token || !UUID_REGEX.test(token)) {
    return NextResponse.json(
      { error: 'not found' },
      { status: 404, headers: noStoreHeaders },
    );
  }

  // Rate limit por token: 12 refreshes por minuto (limite generoso pra um humano
  // clicando rapido, suficiente pra bloquear bot atacando endpoint publico).
  const rl = rateLimit(`refresh-qr:${token}`, { max: 12, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rl.retryAfterSeconds },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          'Retry-After': String(rl.retryAfterSeconds),
        },
      },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }) },
    },
  );

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('tenant_id, evolution_instance_name, evolution_status')
    .eq('connect_token', token)
    .maybeSingle();

  if (tenantErr || !tenant) {
    return NextResponse.json(
      { error: 'not found' },
      { status: 404, headers: noStoreHeaders },
    );
  }

  if (!tenant.evolution_instance_name) {
    return NextResponse.json(
      { error: 'instance_pending', message: 'Instancia ainda nao foi provisionada.' },
      { status: 409, headers: noStoreHeaders },
    );
  }

  // Ja conectado: nao gera QR novo, so devolve estado pro client agir
  if (CONNECTED_STATUSES.has((tenant.evolution_status ?? '').toLowerCase())) {
    return NextResponse.json(
      {
        connected: true,
        evolution_status: tenant.evolution_status,
        evolution_qr_code: null,
        evolution_pairing_code: null,
      },
      { headers: noStoreHeaders },
    );
  }

  // Pede QR fresh na Evolution
  let evo;
  try {
    evo = await evolutionConnect(tenant.evolution_instance_name);
  } catch (err) {
    console.error('[refresh-qr] Evolution falhou:', err);
    return NextResponse.json(
      { error: 'evolution_error', message: 'Falha ao gerar novo QR. Tente novamente em segundos.' },
      { status: 502, headers: noStoreHeaders },
    );
  }

  const qrCode = ensureDataUrl(evo.qr_base64);
  const pairingCode = evo.pairing_code;

  // Persiste o QR/pair novos no banco pra polling de status ja servir atualizado
  // e pra reload da pagina nao perder o estado.
  if (qrCode || pairingCode) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (qrCode) updates.evolution_qr_code = qrCode;
    if (pairingCode) updates.evolution_pairing_code = pairingCode;
    if (evo.qr_code) updates.evolution_qr_string = evo.qr_code;

    const { error: updErr } = await supabase
      .from('tenants')
      .update(updates)
      .eq('tenant_id', tenant.tenant_id);
    if (updErr) {
      console.warn('[refresh-qr] update tenants falhou:', updErr.message);
    }
  }

  return NextResponse.json(
    {
      connected: false,
      evolution_status: tenant.evolution_status ?? 'unknown',
      evolution_qr_code: qrCode,
      evolution_pairing_code: pairingCode,
    },
    { headers: noStoreHeaders },
  );
}
