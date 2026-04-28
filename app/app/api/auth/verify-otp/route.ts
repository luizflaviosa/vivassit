import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Verifica OTP de 6 dígitos enviado por email (signInWithOtp sem emailRedirectTo).
// Server-side: seta cookies de sessão via @supabase/ssr e linka o user ao tenant.

export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const token = body.token?.trim();

  if (!email || !token) {
    return NextResponse.json({ error: 'Email e código são obrigatórios' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ error: 'Código deve ter 6 dígitos' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userEmail = data.user?.email;
  const userId = data.user?.id;

  if (userEmail && userId) {
    try {
      const admin = supabaseAdmin();

      // 1. Aceita convites pendentes (tenant_members.invited_email = userEmail)
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
      console.error('[verify-otp] link tenant erro:', e);
      // não bloqueia login
    }
  }

  return NextResponse.json({ ok: true });
}
