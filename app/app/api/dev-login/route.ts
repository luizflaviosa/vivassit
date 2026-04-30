/**
 * Dev-only login endpoint pra automação Playwright.
 * Usa signInWithPassword server-side e seta cookies via @supabase/ssr
 * (mesmo formato que o middleware espera).
 *
 * Gated em NODE_ENV !== 'production' E header X-Dev-Login-Token bate
 * com o env DEV_LOGIN_TOKEN. Em prod retorna 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
  // Bloqueio total em produção
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { email, password, token } = body as {
    email?: string;
    password?: string;
    token?: string;
  };

  // Token simples extra (defesa em camadas além do NODE_ENV)
  const expected = process.env.DEV_LOGIN_TOKEN || 'singulare-dev-only';
  if (token !== expected) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: 'email + password required' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || 'sign-in failed' }, { status: 401 });
  }

  return res;
}
