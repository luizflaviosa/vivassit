import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';

// Bypass de OTP pra usuário demo. Usado pra demos ao vivo (sem precisar
// abrir email). Só funciona pro email DEMO_EMAIL.
//
// Como funciona:
//   1. Verifica que body.email === DEMO_EMAIL
//   2. Admin gera magic link → extrai hashed_token (não envia email)
//   3. verifyOtp com o token → cria sessão real
//   4. Seta cookies session via @supabase/ssr → middleware reconhece login

export const DEMO_EMAIL = 'demo@singulare.org';

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (email !== DEMO_EMAIL) {
    return NextResponse.json({ error: 'Bypass disponível só pro usuário demo' }, { status: 403 });
  }

  const admin = supabaseAdmin();

  // 1. Gera magic link como admin (não envia email — só retorna o token)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error('[demo-login] generateLink erro:', linkErr);
    return NextResponse.json(
      { error: linkErr?.message ?? 'Falha ao gerar link demo' },
      { status: 500 }
    );
  }

  const tokenHash = linkData.properties.hashed_token;

  // 2. Cria response que vai receber as cookies de sessão
  let response = NextResponse.json({ success: true, redirect: '/painel' });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          response = NextResponse.json({ success: true, redirect: '/painel' });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Verifica o token → seta cookies de sessão
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyErr) {
    console.error('[demo-login] verifyOtp erro:', verifyErr);
    return NextResponse.json({ error: verifyErr.message }, { status: 500 });
  }

  return response;
}
