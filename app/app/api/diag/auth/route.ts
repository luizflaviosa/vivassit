import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

// Endpoint de diagnostico de auth - acesso via /api/diag/auth?secret=<DIAG_SECRET>
// Mostra config esperada vs real para debug rapido sem ping-pong.
// NAO expoe segredos - apenas presenca/ausencia.

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.DIAG_SECRET;
  const providedSecret = req.nextUrl.searchParams.get('secret');

  // Sem DIAG_SECRET configurado = aberto pra qualquer um
  // (intencional: permite debug rapido em dev/staging sem gestao de chave)
  // Em prod, configure DIAG_SECRET pra restringir.
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, message: 'unauthorized', hint: 'use ?secret=<DIAG_SECRET>' },
      { status: 401 }
    );
  }

  const result: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    request: {
      url: req.url,
      origin: req.nextUrl.origin,
      cookies_count: req.cookies.getAll().length,
      cookies_names: req.cookies.getAll().map((c) => c.name),
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL_value: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length ?? 0,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
      ASAAS_API_KEY: !!process.env.ASAAS_API_KEY,
      ASAAS_API_URL: process.env.ASAAS_API_URL ?? null,
      ASAAS_WEBHOOK_TOKEN: !!process.env.ASAAS_WEBHOOK_TOKEN,
      N8N_WEBHOOK_URL: !!process.env.N8N_WEBHOOK_URL,
      N8N_TO_VERCEL_TOKEN: !!process.env.N8N_TO_VERCEL_TOKEN,
      ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
      ENCRYPTION_KEY_length: process.env.ENCRYPTION_KEY?.length ?? 0,
      ENCRYPTION_KEY_valid: process.env.ENCRYPTION_KEY?.length === 64,
    },
    expected: {
      site_url: 'https://app.singulare.org',
      auth_redirect_uris: [
        'https://app.singulare.org/auth/callback',
        'http://localhost:3000/auth/callback',
      ],
      google_oauth_redirect_uri:
        'https://qwyxacfgoqlskidwzdxe.supabase.co/auth/v1/callback',
    },
  };

  // Tenta validar Supabase admin
  try {
    const admin = supabaseAdmin();
    const { count, error } = await admin
      .from('tenants')
      .select('*', { count: 'exact', head: true });
    result.supabase_admin = error ? { ok: false, error: error.message } : { ok: true, tenants_count: count };
  } catch (e) {
    result.supabase_admin = { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }

  // Tenta validar Supabase client SSR (le cookie do user)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // no-op pra diag
          },
        },
      }
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    result.session = userErr
      ? { ok: false, error: userErr.message }
      : user
      ? {
          ok: true,
          user_id: user.id,
          email: user.email,
          provider: user.app_metadata?.provider,
          created_at: user.created_at,
        }
      : { ok: true, anonymous: true };
  } catch (e) {
    result.session = { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }

  // Se tem session, tenta achar tenant
  if ((result.session as { user_id?: string })?.user_id) {
    const userId = (result.session as { user_id: string }).user_id;
    const userEmail = (result.session as { email?: string }).email;
    try {
      const admin = supabaseAdmin();
      const { data: byId } = await admin
        .from('tenants')
        .select('tenant_id, clinic_name, plan_type, admin_user_id')
        .eq('admin_user_id', userId)
        .maybeSingle();

      const { data: byEmail } = userEmail
        ? await admin
            .from('tenants')
            .select('tenant_id, clinic_name, plan_type, admin_user_id, admin_email')
            .eq('admin_email', userEmail)
            .order('created_at', { ascending: false })
            .limit(3)
        : { data: null };

      result.tenant_lookup = {
        by_user_id: byId,
        by_email: byEmail,
      };
    } catch (e) {
      result.tenant_lookup = { error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // Asaas connectivity
  try {
    const asaasUrl = process.env.ASAAS_API_URL?.replace(/\/$/, '') || 'https://sandbox.asaas.com/api/v3';
    const res = await fetch(`${asaasUrl}/finance/balance`, {
      headers: { access_token: process.env.ASAAS_API_KEY ?? '' },
    });
    result.asaas = {
      ok: res.ok,
      status: res.status,
      url: asaasUrl,
    };
  } catch (e) {
    result.asaas = { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }

  return NextResponse.json(result, { status: 200 });
}
