import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;

  // Token mal formado: 404 silencioso (nao expor estrutura, nao deixar enumerar)
  if (!token || !UUID_REGEX.test(token)) {
    return NextResponse.json(
      { error: 'not found' },
      { status: 404, headers: noStoreHeaders },
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

  const { data, error } = await supabase
    .from('tenants')
    .select(
      'tenant_id, admin_email, clinic_name, doctor_name, evolution_status, evolution_qr_code, evolution_pairing_code, evolution_phone_number',
    )
    .eq('connect_token', token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: 'not found' },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const connected = CONNECTED_STATUSES.has((data.evolution_status ?? '').toLowerCase());

  // Quando conectou, gera magic link fresh pra logar direto no painel.
  // So gera UMA vez quando virou conectado — o redirect e one-shot.
  let redirectUrl: string | null = null;
  if (connected && data.admin_email) {
    try {
      const origin = request.nextUrl.origin || 'https://app.singulare.org';
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: data.admin_email,
        options: { redirectTo: `${origin}/auth/callback?next=/painel` },
      });
      if (!linkErr) {
        redirectUrl = linkData?.properties?.action_link ?? null;
      }
    } catch (e) {
      console.error('[conectar/status] erro ao gerar magic link:', e);
    }
  }

  return NextResponse.json(
    {
      connected,
      evolution_status: data.evolution_status ?? 'unknown',
      evolution_qr_code: data.evolution_qr_code ?? null,
      evolution_pairing_code: data.evolution_pairing_code ?? null,
      evolution_phone_number: data.evolution_phone_number ?? null,
      redirect_url: redirectUrl,
    },
    { headers: noStoreHeaders },
  );
}
