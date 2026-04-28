import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';

// Callback unico para 2 fluxos:
//   1. OAuth (Google, etc): chega com ?code=X    → exchangeCodeForSession
//   2. Magic link por email: chega com ?token_hash=X&type=email → verifyOtp
// Em ambos os casos, seta cookies, linka admin_user_id ao tenant, e
// redireciona pra ?next= ou /painel.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = url.searchParams.get('next') ?? '/painel';

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/login?error=missing_token', url.origin));
  }

  // Cria response com redirect; cookies serao adicionadas via setAll
  let response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Recria response preservando o redirect, adiciona cookies
          response = NextResponse.redirect(new URL(next, url.origin));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let userEmail: string | undefined;
  let userId: string | undefined;

  // ── Fluxo 1: OAuth (Google) ───────────────────────────────────────────────
  if (code) {
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchange erro:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
    userEmail = data?.user?.email ?? undefined;
    userId = data?.user?.id;
  }

  // ── Fluxo 2: Magic link / email OTP ───────────────────────────────────────
  if (tokenHash && type) {
    const { error, data } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      console.error('[auth/callback] verifyOtp erro:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
    userEmail = data?.user?.email ?? undefined;
    userId = data?.user?.id;
  }

  // ── Linka ao tenant + aceita convites pendentes (idempotente) ────────────
  if (userEmail && userId) {
    try {
      const admin = supabaseAdmin();

      // 1. Aceita convites pendentes (tenant_members.invited_email = userEmail)
      // Onda 2.5: resolve user_id em todo convite que ainda não foi aceito.
      await admin
        .from('tenant_members')
        .update({
          user_id: userId,
          accepted_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('invited_email', userEmail)
        .is('user_id', null);

      // 2. Auto-link legacy: tenants com admin_email = userEmail mas sem admin_user_id.
      // Cria membership owner se ainda não existe.
      const { data: legacyTenants } = await admin
        .from('tenants')
        .select('tenant_id, admin_user_id')
        .eq('admin_email', userEmail);

      for (const t of legacyTenants ?? []) {
        if (!t.admin_user_id) {
          await admin
            .from('tenants')
            .update({ admin_user_id: userId, updated_at: new Date().toISOString() })
            .eq('tenant_id', t.tenant_id);
        }
        // Garante membership owner (idempotente via UNIQUE constraint)
        await admin
          .from('tenant_members')
          .upsert(
            {
              tenant_id: t.tenant_id,
              user_id: userId,
              role: 'owner',
              status: 'active',
              accepted_at: new Date().toISOString(),
            },
            { onConflict: 'tenant_id,user_id', ignoreDuplicates: true }
          );
      }
    } catch (e) {
      console.error('[auth/callback] link tenant erro:', e);
      // nao bloqueia login
    }
  }

  return response;
}
