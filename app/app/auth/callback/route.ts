import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

// Callback do magic link: troca code por session, linka tenant.admin_user_id
// (idempotente) se ainda nao linkado, redireciona pra /painel ou ?next=...

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/painel';

  const res = NextResponse.redirect(new URL(next, url.origin));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth/callback] exchange erro:', error);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }

  const user = data?.user;
  if (user?.email) {
    // Linka o user ao tenant cujo admin_email bate (se ainda nao tem admin_user_id)
    try {
      const admin = supabaseAdmin();
      const { data: tenant } = await admin
        .from('tenants')
        .select('tenant_id, admin_user_id')
        .eq('admin_email', user.email)
        .maybeSingle();

      if (tenant && !tenant.admin_user_id) {
        await admin
          .from('tenants')
          .update({ admin_user_id: user.id, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenant.tenant_id);
      }
    } catch (e) {
      console.error('[auth/callback] link tenant erro:', e);
      // nao bloqueia login
    }
  }

  return res;
}
